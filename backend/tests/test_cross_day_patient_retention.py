import json
import os
import sys
import unittest
from datetime import date, datetime, timedelta

# Ensure project root is on sys.path when executed directly
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.config import settings
from backend.database import db_pool, dashboard_pool
from backend import scheduler
from backend.main import get_patients
from backend.treatment_service import (
    init_treatment_table,
    acknowledge_alert,
    doctor_confirm_sepsis,
    complete_treatment,
    rule_out_sepsis,
    get_active_treating_hns,
)

TEST_HNS = [
    "HNXDAYTODAY1",
    "HNXDAYIDLE1",
    "HNXDAYDONE1",
    "HNXDAYRULE1",
    "HNXDAYACT1",
    "HNXDAYACT2",
    "HNXDAYMID1",
    "HNXDAYMID2",
]


class TestCrossDayPatientRetention(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await db_pool.connect()
        await dashboard_pool.connect()
        await init_treatment_table()

        self._orig_cache = list(scheduler._patients_cache)
        self._orig_seen_vitals = dict(scheduler.last_seen_vitals)
        self._orig_snapshots = dict(scheduler.last_seen_patient_snapshots)
        self._orig_fallback = getattr(settings, "ENABLE_DATE_FALLBACK", False)

        # Guarantee strict CURDATE() mode (the production setting under test)
        settings.ENABLE_DATE_FALLBACK = False
        await self._cleanup_test_data()

    async def asyncTearDown(self):
        settings.ENABLE_DATE_FALLBACK = self._orig_fallback
        await self._cleanup_test_data()

        scheduler._patients_cache = [
            p for p in self._orig_cache if str(p.get("hn", "")).strip() not in TEST_HNS
        ]
        scheduler.last_seen_vitals = {
            k: v
            for k, v in self._orig_seen_vitals.items()
            if not any(k == hn or k.startswith(f"{hn}_") for hn in TEST_HNS)
        }
        scheduler.last_seen_patient_snapshots = {
            k: v
            for k, v in self._orig_snapshots.items()
            if str(k).strip() not in TEST_HNS
        }
        scheduler._save_seen_vitals()
        scheduler._save_patient_snapshots()

        await db_pool.disconnect()
        await dashboard_pool.disconnect()

    async def _cleanup_test_data(self):
        placeholders = ", ".join(["%s"] * len(TEST_HNS))
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    f"DELETE FROM patient_visits WHERE hn IN ({placeholders});",
                    tuple(TEST_HNS),
                )
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    f"DELETE FROM patient_treatment_status WHERE hn IN ({placeholders});",
                    tuple(TEST_HNS),
                )
                await cur.execute(
                    f"DELETE FROM treated_patient_archive WHERE hn IN ({placeholders});",
                    tuple(TEST_HNS),
                )

        scheduler._patients_cache = [
            p for p in scheduler._patients_cache if str(p.get("hn", "")).strip() not in TEST_HNS
        ]
        scheduler.last_seen_vitals = {
            k: v
            for k, v in scheduler.last_seen_vitals.items()
            if not any(k == hn or k.startswith(f"{hn}_") for hn in TEST_HNS)
        }
        scheduler.last_seen_patient_snapshots = {
            k: v
            for k, v in scheduler.last_seen_patient_snapshots.items()
            if str(k).strip() not in TEST_HNS
        }

    async def _insert_visit(
        self,
        hn: str,
        vstdate: date,
        vsttime: str = "14:00:00",
        vn: str | None = None,
        heart_rate: int = 122,
        sbp: int = 92,
        resp_rate: int = 26,
        spo2: int = 93,
        temperature: float = 38.8,
        gcs: int = 15,
        created_at: datetime | None = None,
    ):
        vn_val = vn or f"VN{vstdate.strftime('%y%m%d')}{hn[-6:]}"
        created_val = created_at or datetime.combine(vstdate, datetime.strptime(vsttime, "%H:%M:%S").time())
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO patient_visits (
                        hn, vn, vstdate, vsttime, patient_name, sex, age, chief_complaint,
                        gcs, spo2, heart_rate, sbp, dbp, resp_rate, temperature, weight, height, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        hn,
                        vn_val,
                        vstdate.strftime("%Y-%m-%d"),
                        vsttime,
                        f"Test {hn}",
                        "male",
                        62,
                        "Fever & tachypnea",
                        gcs,
                        spo2,
                        heart_rate,
                        sbp,
                        60,
                        resp_rate,
                        temperature,
                        65.0,
                        170.0,
                        created_val.strftime("%Y-%m-%d %H:%M:%S"),
                    ),
                )

    async def test_1_today_new_arrivals_are_fetched_without_date_fallback(self):
        """Case 1: Production default ENABLE_DATE_FALLBACK=False strictly pulls today's visits."""
        self.assertFalse(settings.ENABLE_DATE_FALLBACK)
        today = date.today()
        await self._insert_visit("HNXDAYTODAY1", today, "09:15:00")

        rows = await scheduler.fetch_vitals_from_db()
        fetched_hns = {r["hn"] for r in rows}
        self.assertIn("HNXDAYTODAY1", fetched_hns)

        await scheduler.process_vitals()
        cache_hns = {p["hn"] for p in scheduler.get_patients_cache()}
        self.assertIn("HNXDAYTODAY1", cache_hns)

    async def test_2_previous_day_idle_patients_are_excluded(self):
        """Case 2: Historical idle visits from previous days without active treatment must NOT be pulled."""
        today = date.today()
        yesterday = today - timedelta(days=1)
        three_days_ago = today - timedelta(days=3)

        await self._insert_visit("HNXDAYTODAY1", today, "08:00:00")
        await self._insert_visit("HNXDAYIDLE1", yesterday, "22:30:00", vn="VNIDLE1")
        await self._insert_visit("HNXDAYIDLE1", three_days_ago, "10:00:00", vn="VNIDLEOLD")

        active_hns = await get_active_treating_hns()
        self.assertNotIn("HNXDAYIDLE1", active_hns)

        rows = await scheduler.fetch_vitals_from_db()
        fetched_hns = {r["hn"] for r in rows}
        self.assertIn("HNXDAYTODAY1", fetched_hns)
        self.assertNotIn("HNXDAYIDLE1", fetched_hns)

        await scheduler.process_vitals()
        cache_hns = {p["hn"] for p in scheduler.get_patients_cache()}
        self.assertNotIn("HNXDAYIDLE1", cache_hns)

    async def test_3_previous_day_completed_and_ruled_out_patients_are_excluded(self):
        """Case 3: Previous-day patients whose treatment completed or was ruled out must NOT return to active poll."""
        today = date.today()
        yesterday = today - timedelta(days=1)

        await self._insert_visit("HNXDAYTODAY1", today, "10:00:00")
        await self._insert_visit("HNXDAYDONE1", yesterday, "21:00:00")
        await self._insert_visit("HNXDAYRULE1", yesterday, "20:00:00")

        await acknowledge_alert("HNXDAYDONE1", "Nurse Test")
        await doctor_confirm_sepsis("HNXDAYDONE1", "Nurse Test", "Dr. Test")
        await complete_treatment("HNXDAYDONE1", "Dr. Test")

        await acknowledge_alert("HNXDAYRULE1", "Nurse Test")
        await rule_out_sepsis("HNXDAYRULE1")

        active_hns = await get_active_treating_hns()
        self.assertNotIn("HNXDAYDONE1", active_hns)
        self.assertNotIn("HNXDAYRULE1", active_hns)

        rows = await scheduler.fetch_vitals_from_db()
        fetched_hns = {r["hn"] for r in rows}
        self.assertIn("HNXDAYTODAY1", fetched_hns)
        self.assertNotIn("HNXDAYDONE1", fetched_hns)
        self.assertNotIn("HNXDAYRULE1", fetched_hns)

        await scheduler.process_vitals()
        cache_hns = {p["hn"] for p in scheduler.get_patients_cache()}
        self.assertNotIn("HNXDAYDONE1", cache_hns)
        self.assertNotIn("HNXDAYRULE1", cache_hns)

    async def test_4_previous_day_unfinished_active_patients_stay_in_db_cache_and_api(self):
        """Case 4: Previous-day active patients (acknowledged or doctor-confirmed, unfinished) remain visible alongside today's patients."""
        today = date.today()
        yesterday = today - timedelta(days=1)
        two_days_ago = today - timedelta(days=2)
        ten_days_ago = today - timedelta(days=10)

        await self._insert_visit("HNXDAYTODAY1", today, "09:00:00")
        await self._insert_visit("HNXDAYIDLE1", yesterday, "18:00:00")
        # Insert an older visit + yesterday's visit for HNXDAYACT1 to ensure latest visit wins
        await self._insert_visit("HNXDAYACT1", ten_days_ago, "07:00:00", vn="VNOLD10D", heart_rate=80)
        await self._insert_visit("HNXDAYACT1", yesterday, "23:15:00", vn="VNYDAY1", heart_rate=131)
        await self._insert_visit("HNXDAYACT2", two_days_ago, "22:00:00", vn="VN2D1", heart_rate=128)

        # HNXDAYACT1: nurse acknowledged, doctor not yet confirmed
        await acknowledge_alert("HNXDAYACT1", "Nurse Night", vn="VNYDAY1")
        # HNXDAYACT2: doctor confirmed, 60-min timer running, treatment not completed
        await acknowledge_alert("HNXDAYACT2", "Nurse Night", vn="VN2D1")
        await doctor_confirm_sepsis("HNXDAYACT2", "Nurse Night", "Dr. Night")

        active_hns = await get_active_treating_hns()
        self.assertIn("HNXDAYACT1", active_hns)
        self.assertIn("HNXDAYACT2", active_hns)
        self.assertNotIn("HNXDAYIDLE1", active_hns)

        rows = await scheduler.fetch_vitals_from_db()
        fetched_hns = {r["hn"] for r in rows}
        self.assertTrue({"HNXDAYTODAY1", "HNXDAYACT1", "HNXDAYACT2"}.issubset(fetched_hns))
        self.assertNotIn("HNXDAYIDLE1", fetched_hns)

        # Ensure process_vitals keeps all 3 and selects latest visit for HNXDAYACT1
        await scheduler.process_vitals()
        cache_by_hn = {p["hn"]: p for p in scheduler.get_patients_cache()}
        self.assertIn("HNXDAYTODAY1", cache_by_hn)
        self.assertIn("HNXDAYACT1", cache_by_hn)
        self.assertIn("HNXDAYACT2", cache_by_hn)
        self.assertNotIn("HNXDAYIDLE1", cache_by_hn)
        self.assertEqual(cache_by_hn["HNXDAYACT1"]["vn"], "VNYDAY1")

        # Ensure GET /api/patients (cache hit + refresh=True + cache miss) includes them
        api_refresh = json.loads((await get_patients(refresh=True)).body.decode("utf-8"))
        api_refresh_hns = {p["hn"] for p in api_refresh["patients"]}
        self.assertTrue({"HNXDAYTODAY1", "HNXDAYACT1", "HNXDAYACT2"}.issubset(api_refresh_hns))
        self.assertNotIn("HNXDAYIDLE1", api_refresh_hns)

        # Clear cache cleanly and test cache-miss path in GET /api/patients
        scheduler.clear_cache(preserve_hns=[])
        api_miss = json.loads((await get_patients(refresh=False)).body.decode("utf-8"))
        api_miss_hns = {p["hn"] for p in api_miss["patients"]}
        self.assertTrue({"HNXDAYTODAY1", "HNXDAYACT1", "HNXDAYACT2"}.issubset(api_miss_hns))
        self.assertNotIn("HNXDAYIDLE1", api_miss_hns)

    async def test_5_midnight_rollover_preserves_active_and_flushes_idle_and_finished(self):
        """Case 5: Midnight auto-clear preserves active HNs in cache/last_seen_vitals while flushing finished/idle."""
        yesterday = date.today() - timedelta(days=1)
        await self._insert_visit("HNXDAYMID1", yesterday, "23:45:00", vn="VNMID1")

        await acknowledge_alert("HNXDAYMID1", "Nurse Mid", vn="VNMID1")
        await doctor_confirm_sepsis("HNXDAYMID1", "Nurse Mid", "Dr. Mid")

        await acknowledge_alert("HNXDAYMID2", "Nurse Mid")
        await complete_treatment("HNXDAYMID2", "Dr. Mid")

        scheduler._patients_cache = [
            {"id": "HNXDAYMID1", "hn": "HNXDAYMID1", "vn": "VNMID1"},
            {"id": "HNXDAYMID2", "hn": "HNXDAYMID2", "vn": "VNMID2"},
            {"id": "HNXDAYIDLE1", "hn": "HNXDAYIDLE1", "vn": "VNIDLE1"},
        ]
        scheduler.last_seen_vitals = {
            "HNXDAYMID1_VNMID1_23:45:00": True,
            "HNXDAYMID2_VNMID2_22:00:00": True,
            "HNXDAYIDLE1_VNIDLE1_21:00:00": True,
        }

        active_hns = await get_active_treating_hns()
        stats = scheduler.clear_cache(preserve_hns=active_hns)

        cache_hns = {p["hn"] for p in scheduler.get_patients_cache()}
        self.assertIn("HNXDAYMID1", cache_hns)
        self.assertNotIn("HNXDAYMID2", cache_hns)
        self.assertNotIn("HNXDAYIDLE1", cache_hns)
        self.assertIn("HNXDAYMID1_VNMID1_23:45:00", scheduler.last_seen_vitals)
        self.assertNotIn("HNXDAYMID2_VNMID2_22:00:00", scheduler.last_seen_vitals)
        self.assertNotIn("HNXDAYIDLE1_VNIDLE1_21:00:00", scheduler.last_seen_vitals)
        self.assertIn("HNXDAYMID1", stats["preserved_hns"])

        # Also verify process_vitals retains active cached patient even if momentarily absent from DB rows
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM patient_visits WHERE hn = %s;", ("HNXDAYMID1",))
        await scheduler.process_vitals()
        retained_cache_hns = {p["hn"] for p in scheduler.get_patients_cache()}
        self.assertIn("HNXDAYMID1", retained_cache_hns)

    async def test_6_completing_or_ruling_out_previous_day_patient_removes_from_active_poll(self):
        """Case 6: Completing treatment or ruling out Sepsis immediately drops previous-day patient on next poll."""
        yesterday = date.today() - timedelta(days=1)
        await self._insert_visit("HNXDAYACT1", yesterday, "22:10:00")
        await self._insert_visit("HNXDAYACT2", yesterday, "22:20:00")

        await acknowledge_alert("HNXDAYACT1", "Nurse Night")
        await doctor_confirm_sepsis("HNXDAYACT1", "Nurse Night", "Dr. Night")
        await acknowledge_alert("HNXDAYACT2", "Nurse Night")

        # Before finishing: both are active and present
        await scheduler.process_vitals()
        initial_hns = {p["hn"] for p in scheduler.get_patients_cache()}
        self.assertIn("HNXDAYACT1", initial_hns)
        self.assertIn("HNXDAYACT2", initial_hns)

        # Complete HNXDAYACT1 & rule out HNXDAYACT2
        await complete_treatment("HNXDAYACT1", "Dr. Morning")
        await rule_out_sepsis("HNXDAYACT2")

        active_after = await get_active_treating_hns()
        self.assertNotIn("HNXDAYACT1", active_after)
        self.assertNotIn("HNXDAYACT2", active_after)

        rows_after = await scheduler.fetch_vitals_from_db()
        fetched_after = {r["hn"] for r in rows_after}
        self.assertNotIn("HNXDAYACT1", fetched_after)
        self.assertNotIn("HNXDAYACT2", fetched_after)

        await scheduler.process_vitals()
        cache_after = {p["hn"] for p in scheduler.get_patients_cache()}
        self.assertNotIn("HNXDAYACT1", cache_after)
        self.assertNotIn("HNXDAYACT2", cache_after)

        api_after = json.loads((await get_patients(refresh=True)).body.decode("utf-8"))
        api_hns_after = {p["hn"] for p in api_after["patients"]}
        self.assertNotIn("HNXDAYACT1", api_hns_after)
        self.assertNotIn("HNXDAYACT2", api_hns_after)

    async def test_7_archived_precedence_and_clear_treated_keeps_previous_day_active(self):
        """Case 7: Archived patients are excluded even if stale active row remains; clear_treated preserves active."""
        from backend.treatment_service import clear_treated_statuses

        yesterday = date.today() - timedelta(days=1)
        await self._insert_visit("HNXDAYACT1", yesterday, "20:00:00")
        await self._insert_visit("HNXDAYDONE1", yesterday, "19:00:00")

        await acknowledge_alert("HNXDAYACT1", "Nurse Active")
        await acknowledge_alert("HNXDAYDONE1", "Nurse Done")
        await complete_treatment("HNXDAYDONE1", "Dr. Done")

        # Simulate stale uncompleted row left in patient_treatment_status while archive is completed
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE patient_treatment_status SET treatment_completed = 0, sepsis_ruled_out = 0 WHERE hn = %s;",
                    ("HNXDAYDONE1",),
                )

        active_hns = await get_active_treating_hns()
        self.assertIn("HNXDAYACT1", active_hns)
        self.assertNotIn("HNXDAYDONE1", active_hns)

        # Clearing treated records leaves active previous-day patient intact while purging finished archive
        await clear_treated_statuses()
        active_after_purge = await get_active_treating_hns()
        self.assertIn("HNXDAYACT1", active_after_purge)

    async def test_8_opdscreen_legacy_hosxp_path_includes_active_cross_day_hns(self):
        """Case 8: Legacy opdscreen JOIN er_nursing_detail query injects active_hns filter and orders latest date first."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_cur = AsyncMock()
        mock_cur.fetchall = AsyncMock(
            side_effect=[
                [],  # patient_visits empty -> triggers opdscreen path
                [
                    {"hn": "HNXDAYACT1", "vn": "VNOPD1", "vstdate": "2026-11-13", "vsttime": "23:10:00"},
                    {"hn": "HNXDAYTODAY1", "vn": "VNOPD2", "vstdate": "2026-11-14", "vsttime": "08:00:00"},
                ],
            ]
        )
        cur_ctx = AsyncMock()
        cur_ctx.__aenter__ = AsyncMock(return_value=mock_cur)
        cur_ctx.__aexit__ = AsyncMock(return_value=False)

        mock_conn = MagicMock()
        mock_conn.cursor = MagicMock(return_value=cur_ctx)
        conn_ctx = AsyncMock()
        conn_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        conn_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch.object(scheduler.db_pool, "get_connection", return_value=conn_ctx):
            rows = await scheduler.fetch_vitals_from_db(active_hns=["HNXDAYACT1"])

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["_source_table"], "opdscreen")
        # Second execute call is opdscreen query with parameterized active_hns
        self.assertEqual(mock_cur.execute.await_count, 2)
        opd_call = mock_cur.execute.await_args_list[1]
        opd_sql, opd_params = opd_call.args[0], opd_call.args[1]
        self.assertIn("WHERE (o.vstdate >= CURDATE() OR o.hn IN (%s))", opd_sql)
        self.assertIn("ORDER BY o.vstdate DESC, o.vsttime DESC", opd_sql)
        self.assertEqual(opd_params, ("HNXDAYACT1",))


if __name__ == "__main__":
    unittest.main()
