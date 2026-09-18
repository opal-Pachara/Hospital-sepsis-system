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


if __name__ == "__main__":
    unittest.main()
