import unittest
import asyncio
from unittest.mock import patch, AsyncMock
import backend.scheduler as scheduler
import backend.log_service as log_service


class TestPatientLogging(unittest.TestCase):
    def setUp(self):
        scheduler.last_seen_vitals.clear()
        scheduler.last_seen_patient_snapshots.clear()
        scheduler._patients_cache = []

    def test_new_patient_ingestion_log_format(self):
        """Verify new patient ingestion produces exact log structure matching user specification."""
        test_row = {
            "hn": "000559689",
            "vn": "690916212151",
            "vstdate": "2026-09-16",
            "vsttime": "14:50:43",
            "patient_name": None,
            "sex": 1,
            "age": 60,
            "chief_complaint": "ไข้สูง หนาวสั่น หายใจหอบเหนื่อย",
            "sbp": 86,
            "dbp": 52,
            "heart_rate": 126,
            "resp_rate": 26,
            "temperature": 39.4,
            "spo2": 89,
            "gcs": 13,
            "weight": 60,
            "height": 165,
            "_source_table": "patient_visits"
        }

        recorded_logs = []

        def mock_record_log(level, message, component, details):
            recorded_logs.append({
                "level": level,
                "message": message,
                "component": component,
                "details": details,
            })

        # We set baseline first to simulate prior system state
        scheduler.last_seen_vitals["HN_EXISTING_10:00:00"] = True
        scheduler.last_seen_patient_snapshots["HN_EXISTING"] = {"hn": "HN_EXISTING"}

        with patch("backend.scheduler.fetch_vitals_from_db", new=AsyncMock(return_value=[test_row])), \
             patch("backend.log_service.record_log", side_effect=mock_record_log), \
             patch("backend.main.broadcast_message", new=AsyncMock()):
            asyncio.run(scheduler.process_vitals())

        # Find the ingest log
        ingest_logs = [l for l in recorded_logs if l["details"].get("event") == "new_patient_ingested"]
        self.assertEqual(len(ingest_logs), 1)
        log_entry = ingest_logs[0]

        # 1. Check message prefix and format
        msg = log_entry["message"]
        self.assertTrue(msg.startswith("นำเข้าข้อมูลผู้ป่วยใหม่ HN 000559689 (VN: 690916212151): สัญญาณชีพ BP 86/52, HR 126, RR 26, BT 39.4°C, SpO2 89%, GCS 13"))
        self.assertIn("คำนวณ NEWS เสร็จเวลา", msg)
        self.assertIn("ได้ 16 คะแนน [HIGH RISK]", msg)

        # 2. Check JSON details structure
        d = log_entry["details"]
        self.assertEqual(d["event"], "new_patient_ingested")
        self.assertEqual(d["hn"], "000559689")
        self.assertEqual(d["vn"], "690916212151")
        self.assertEqual(d["vstdate"], "2026-09-16")
        self.assertEqual(d["vsttime"], "14:50:43")
        self.assertEqual(d["vitals"]["sbp"], 86)
        self.assertEqual(d["vitals"]["dbp"], 52)
        self.assertEqual(d["vitals"]["heart_rate"], 126)
        self.assertEqual(d["vitals"]["resp_rate"], 26)
        self.assertEqual(d["vitals"]["temperature"], 39.4)
        self.assertEqual(d["vitals"]["spo2"], 89)
        self.assertEqual(d["vitals"]["gcs"], 13)
        self.assertEqual(d["vitals_summary"], "BP 86/52, HR 126, RR 26, BT 39.4°C, SpO2 89%, GCS 13")
        self.assertEqual(d["news_score"], 16)
        self.assertEqual(d["risk_level"], "high")
        self.assertTrue(d["is_complete"])
        self.assertTrue(d["has_single_alert"])
        self.assertIn("respiratoryRate", d["parameters_breakdown"])
        self.assertIn("spO2", d["parameters_breakdown"])
        self.assertIn("calc_completed_at", d)
        self.assertIn("calc_duration_ms", d)
        self.assertEqual(d["source_table"], "patient_visits")

    def test_incomplete_patient_and_subsequent_update(self):
        """Verify handling of incomplete patient (e.g. HN 9099) and subsequent vitals update."""
        # 1. Incomplete patient: only SBP, DBP, HR available
        incomplete_row = {
            "hn": "9099",
            "vn": "VN9099",
            "vstdate": "2026-09-16",
            "vsttime": "15:00:00",
            "patient_name": None,
            "sex": 1,
            "age": 45,
            "chief_complaint": "ไข้ อ่อนเพลีย",
            "sbp": 95,
            "dbp": 60,
            "heart_rate": 110,
            "resp_rate": None,
            "temperature": None,
            "spo2": None,
            "gcs": None,
            "weight": None,
            "height": None,
            "_source_table": "patient_visits"
        }

        recorded_logs = []

        def mock_record_log(level, message, component, details):
            recorded_logs.append({
                "level": level,
                "message": message,
                "component": component,
                "details": details,
            })

        # Baseline to make sure this is processed as normal polling
        scheduler.last_seen_vitals["HN_EXISTING_10:00:00"] = True
        scheduler.last_seen_patient_snapshots["HN_EXISTING"] = {"hn": "HN_EXISTING"}

        with patch("backend.scheduler.fetch_vitals_from_db", new=AsyncMock(return_value=[incomplete_row])), \
             patch("backend.log_service.record_log", side_effect=mock_record_log), \
             patch("backend.main.broadcast_message", new=AsyncMock()):
            asyncio.run(scheduler.process_vitals())

        ingest_logs = [l for l in recorded_logs if l["details"].get("event") == "new_patient_ingested"]
        self.assertEqual(len(ingest_logs), 1)
        d1 = ingest_logs[0]["details"]
        self.assertFalse(d1["is_complete"])
        self.assertIn("missing_fields", d1)
        self.assertIn("resp_rate", d1["missing_fields"])
        self.assertIn("temperature", d1["missing_fields"])
        self.assertIn("spo2", d1["missing_fields"])
        self.assertIn("gcs", d1["missing_fields"])
        self.assertIn("present_fields", d1)
        self.assertIn("sbp", d1["present_fields"])
        self.assertIn("heart_rate", d1["present_fields"])

        # 2. Updated patient: added BT, SpO2, RR, GCS
        updated_row = dict(incomplete_row)
        updated_row["resp_rate"] = 24
        updated_row["temperature"] = 38.8
        updated_row["spo2"] = 92
        updated_row["gcs"] = 14
        updated_row["vsttime"] = "15:10:00"

        recorded_logs.clear()

        with patch("backend.scheduler.fetch_vitals_from_db", new=AsyncMock(return_value=[updated_row])), \
             patch("backend.log_service.record_log", side_effect=mock_record_log), \
             patch("backend.main.broadcast_message", new=AsyncMock()):
            asyncio.run(scheduler.process_vitals())

        update_logs = [l for l in recorded_logs if l["details"].get("event") == "patient_vitals_updated"]
        self.assertEqual(len(update_logs), 1)
        d2 = update_logs[0]["details"]
        self.assertEqual(d2["hn"], "9099")
        self.assertIn("resp_rate", d2["added_fields"])
        self.assertIn("temperature", d2["added_fields"])
        self.assertIn("spo2", d2["added_fields"])
        self.assertIn("gcs", d2["added_fields"])
        self.assertTrue(d2["is_complete"])
        self.assertIn("อัปเดตข้อมูลผู้ป่วย HN 9099", update_logs[0]["message"])
        self.assertIn("ได้รับสัญญาณชีพเพิ่ม", update_logs[0]["message"])

    def test_hosxp_disconnect_and_reconnect_downtime_tracking(self):
        """Verify HOSxP database disconnection logs ERROR and subsequent reconnection logs Note with downtime."""
        recorded_logs = []

        def mock_record_log(level, message, component, details):
            recorded_logs.append({
                "level": level,
                "message": message,
                "component": component,
                "details": details,
            })

        # Ensure clean state
        scheduler._hosxp_disconnected_at = None

        with patch("backend.log_service.record_log", side_effect=mock_record_log), \
             patch("backend.database.db_pool.get_connection", side_effect=Exception("Connection refused (192.168.1.100:3306)")):
            rows = asyncio.run(scheduler.fetch_vitals_from_db())
            self.assertEqual(rows, [])

        # Verify ERROR log was recorded under HOSxP_DB
        err_logs = [l for l in recorded_logs if l["component"] == "HOSxP_DB" and l["level"] == "ERROR"]
        self.assertEqual(len(err_logs), 1)
        self.assertIn("ไม่สามารถเชื่อมต่อฐานข้อมูล HOSxP MySQL ได้", err_logs[0]["message"])
        self.assertEqual(err_logs[0]["details"]["status"], "DISCONNECTED")
        self.assertIn("disconnected_at", err_logs[0]["details"])
        self.assertIsNotNone(scheduler._hosxp_disconnected_at)

        # Now simulate reconnection
        recorded_logs.clear()

        mock_conn = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchall.return_value = [{"hn": "123", "vstdate": "2026-09-19", "vsttime": "12:00:00"}]
        
        # Proper async context manager for conn.cursor(...)
        mock_cursor_ctx = AsyncMock()
        mock_cursor_ctx.__aenter__.return_value = mock_cursor
        mock_cursor_ctx.__aexit__.return_value = None
        mock_conn.cursor = unittest.mock.MagicMock(return_value=mock_cursor_ctx)

        mock_conn_ctx = AsyncMock()
        mock_conn_ctx.__aenter__.return_value = mock_conn
        mock_conn_ctx.__aexit__.return_value = None

        with patch("backend.log_service.record_log", side_effect=mock_record_log), \
             patch("backend.database.db_pool.get_connection", return_value=mock_conn_ctx):
            rows = asyncio.run(scheduler.fetch_vitals_from_db())
            self.assertEqual(len(rows), 1)

        # Verify Reconnected Note log was recorded with downtime details
        rec_logs = [l for l in recorded_logs if l["component"] == "HOSxP_DB" and l["level"] == "Note"]
        self.assertEqual(len(rec_logs), 1)
        self.assertIn("HOSxP Server Reconnected", rec_logs[0]["message"])
        self.assertIn("หยุดทำงานไป", rec_logs[0]["message"])
        self.assertEqual(rec_logs[0]["details"]["status"], "CONNECTED")
        self.assertIn("downtime_seconds", rec_logs[0]["details"])
        self.assertIn("reconnected_at", rec_logs[0]["details"])
        self.assertIsNone(scheduler._hosxp_disconnected_at)

    def test_batch_log_patient_and_parameter_breakdown(self):
        """Verify batch log summarizes multiple new/updated patients and their parameters."""
        recorded_logs = []

        def mock_record_log(level, message, component, details):
            recorded_logs.append({
                "level": level,
                "message": message,
                "component": component,
                "details": details,
            })

        patient1 = {
            "hn": "HN101",
            "vn": "VN101",
            "vstdate": "2026-09-19",
            "vsttime": "12:00:00",
            "sbp": 110, "dbp": 70, "heart_rate": 80, "resp_rate": 18,
            "temperature": 37.0, "spo2": 98, "gcs": 15,
            "_source_table": "patient_visits"
        }
        patient2 = {
            "hn": "HN102",
            "vn": "VN102",
            "vstdate": "2026-09-19",
            "vsttime": "12:01:00",
            "sbp": 88, "dbp": 50, "heart_rate": 120, "resp_rate": 26,
            "temperature": 39.0, "spo2": 90, "gcs": 14,
            "_source_table": "patient_visits"
        }

        # Baseline set
        scheduler.last_seen_vitals["HN_EXISTING_10:00:00"] = True
        scheduler.last_seen_patient_snapshots["HN_EXISTING"] = {"hn": "HN_EXISTING"}

        with patch("backend.scheduler.fetch_vitals_from_db", new=AsyncMock(return_value=[patient1, patient2])), \
             patch("backend.log_service.record_log", side_effect=mock_record_log), \
             patch("backend.main.broadcast_message", new=AsyncMock()):
            asyncio.run(scheduler.process_vitals())

        # Find batch summary log
        batch_logs = [l for l in recorded_logs if l["component"] == "HOSxP_Sync" and "ตรวจพบข้อมูลใหม่" in l["message"]]
        self.assertEqual(len(batch_logs), 1)
        b_log = batch_logs[0]

        # Verify message contains patient summaries
        self.assertIn("HN101", b_log["message"])
        self.assertIn("HN102", b_log["message"])
        self.assertIn("details", b_log)
        self.assertIn("patients_breakdown", b_log["details"])
        self.assertEqual(len(b_log["details"]["patients_breakdown"]), 2)
        self.assertEqual(b_log["details"]["patients_breakdown"][0]["hn"], "HN101")
        self.assertEqual(b_log["details"]["patients_breakdown"][1]["hn"], "HN102")

    def test_treatment_completion_and_dashboard_archival_logs(self):
        """Verify complete_treatment and archive_treated_patient record Clinical_Treatment and Dashboard_Archive logs."""
        import backend.treatment_service as ts
        recorded_logs = []

        def mock_record_log(level, message, component, details):
            recorded_logs.append({
                "level": level,
                "message": message,
                "component": component,
                "details": details,
            })

        mock_visit = {
            "hn": "HN555",
            "vn": "VN555",
            "vstdate": "2026-09-19",
            "vsttime": "10:00:00",
            "sex": 1, "age": 55, "chief_complaint": "ไข้สูง",
            "sbp": 90, "dbp": 60, "heart_rate": 110, "resp_rate": 24,
            "temperature": 39.0, "spo2": 92, "gcs": 15
        }

        mock_conn = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.fetchone.return_value = mock_visit
        mock_cursor_ctx = AsyncMock()
        mock_cursor_ctx.__aenter__.return_value = mock_cursor
        mock_cursor_ctx.__aexit__.return_value = None
        mock_conn.cursor = unittest.mock.MagicMock(return_value=mock_cursor_ctx)

        mock_conn_ctx = AsyncMock()
        mock_conn_ctx.__aenter__.return_value = mock_conn
        mock_conn_ctx.__aexit__.return_value = None

        with patch("backend.log_service.record_log", side_effect=mock_record_log), \
             patch("backend.database.db_pool.get_connection", return_value=mock_conn_ctx), \
             patch("backend.database.dashboard_pool.get_connection", return_value=mock_conn_ctx), \
             patch("backend.treatment_service.get_treatment_status", new=AsyncMock(return_value={"hn": "HN555", "treatment_completed": True})):
            asyncio.run(ts.complete_treatment("HN555", completed_by="พยาบาลวิชาชีพ"))

        # Verify Stage 1: Clinical_Treatment log
        clin_logs = [l for l in recorded_logs if l["component"] == "Clinical_Treatment"]
        self.assertEqual(len(clin_logs), 1)
        self.assertIn("HN 555", clin_logs[0]["message"])
        self.assertIn("พยาบาลวิชาชีพ", clin_logs[0]["details"]["completed_by"])

        # Verify Stage 2: Dashboard_Archive log
        arch_logs = [l for l in recorded_logs if l["component"] == "Dashboard_Archive"]
        self.assertEqual(len(arch_logs), 1)
        self.assertIn("treated_patient_archive", arch_logs[0]["message"])
        self.assertEqual(arch_logs[0]["details"]["hn"], "HN555")
        self.assertEqual(arch_logs[0]["details"]["archive_table"], "treated_patient_archive")


if __name__ == "__main__":
    unittest.main()
