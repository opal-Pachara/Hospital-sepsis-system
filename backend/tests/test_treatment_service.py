import unittest
import asyncio
from backend.database import dashboard_pool
from backend.treatment_service import (
    init_treatment_table,
    acknowledge_alert,
    doctor_confirm_sepsis,
    get_treatment_status,
    complete_treatment,
    rule_out_sepsis,
    update_checklist_json,
    get_all_treatment_statuses,
    clear_treated_statuses,
)


class TestTreatmentService(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await dashboard_pool.connect()
        await init_treatment_table()
        # Clean test HN
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM patient_treatment_status WHERE hn = 'TEST_HN_SYNC';")
                await cur.execute("DELETE FROM treated_patient_archive WHERE hn = 'TEST_HN_SYNC';")

    async def asyncTearDown(self):
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM patient_treatment_status WHERE hn = 'TEST_HN_SYNC';")
                await cur.execute("DELETE FROM treated_patient_archive WHERE hn = 'TEST_HN_SYNC';")
        await dashboard_pool.disconnect()

    async def test_acknowledge_and_get_status(self):
        ack_res = await acknowledge_alert("TEST_HN_SYNC", "Nurse_Test")
        self.assertTrue(ack_res["acknowledged"])
        self.assertFalse(ack_res.get("doctor_confirmed", False))
        self.assertIsNone(ack_res.get("countdown_started_at"))

        status = await get_treatment_status("TEST_HN_SYNC")
        self.assertIsNotNone(status)
        self.assertEqual(status["hn"], "TEST_HN_SYNC")
        self.assertEqual(status["acknowledged_by"], "Nurse_Test")
        self.assertTrue(status["acknowledged"])

    async def test_doctor_confirm_with_custom_time(self):
        custom_time = "2026-09-13T10:15:00"
        doc_res = await doctor_confirm_sepsis(
            "TEST_HN_SYNC",
            confirmed_by="พว.สมหญิง",
            physician="นพ.สมหมาย",
            confirmed_at=custom_time
        )
        self.assertTrue(doc_res["doctor_confirmed"])
        self.assertTrue(doc_res["acknowledged"])
        self.assertIn("10:15:00", str(doc_res["countdown_started_at"]))

        status = await get_treatment_status("TEST_HN_SYNC")
        self.assertIsNotNone(status)
        self.assertTrue(status["doctor_confirmed"])
        self.assertIn("10:15:00", str(status["countdown_started_at"]))


    async def test_complete_treatment(self):
        await acknowledge_alert("TEST_HN_SYNC", "Nurse_Test")
        comp_res = await complete_treatment("TEST_HN_SYNC", "Doctor_Test")
        self.assertTrue(comp_res["treatment_completed"])

        status = await get_treatment_status("TEST_HN_SYNC")
        self.assertTrue(status["treatment_completed"])
        self.assertEqual(status["treatment_completed_by"], "Doctor_Test")

    async def test_clear_treated_statuses(self):
        # Setup: 1 treated patient, 1 actively treating patient
        await acknowledge_alert("TEST_HN_SYNC", "Nurse_Test")
        await complete_treatment("TEST_HN_SYNC", "Doctor_Test")

        # Act: clear treated
        cleared = await clear_treated_statuses()
        self.assertIn("TEST_HN_SYNC", cleared)

        # Verify: TEST_HN_SYNC is cleared
        status = await get_treatment_status("TEST_HN_SYNC")
        self.assertIsNone(status)

    async def test_rule_out_sepsis(self):
        await rule_out_sepsis("TEST_HN_SYNC")
        status = await get_treatment_status("TEST_HN_SYNC")
        self.assertTrue(status["sepsis_ruled_out"])

    async def test_get_all_treatment_statuses(self):
        await acknowledge_alert("TEST_HN_SYNC", "Nurse_Test")
        all_st = await get_all_treatment_statuses()
        self.assertIn("TEST_HN_SYNC", all_st)
        self.assertTrue(all_st["TEST_HN_SYNC"]["acknowledged"])

    async def test_update_checklist_json_after_archive_preserves_completed_status(self):
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "INSERT INTO treated_patient_archive "
                    "(hn, doctor_confirmed, countdown_started_at, treatment_completed, treatment_completed_at, sepsis_ruled_out) "
                    "VALUES ('TEST_HN_SYNC', 1, NOW(), 1, NOW(), 0);"
                )

        checklist_payload = '[{"phase":"triage","items":[]}]'
        res = await update_checklist_json("TEST_HN_SYNC", checklist_payload)
        self.assertTrue(res["treatment_completed"])
        self.assertEqual(res["checklist_json"], checklist_payload)

        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT COUNT(*) FROM patient_treatment_status WHERE hn = 'TEST_HN_SYNC';")
                active_count = (await cur.fetchone())[0]
        self.assertEqual(active_count, 0)

        single = await get_treatment_status("TEST_HN_SYNC")
        self.assertIsNotNone(single)
        self.assertTrue(single["treatment_completed"])
        self.assertEqual(single["checklist_json"], checklist_payload)

        all_st = await get_all_treatment_statuses()
        self.assertTrue(all_st["TEST_HN_SYNC"]["treatment_completed"])

if __name__ == '__main__':
    unittest.main()
