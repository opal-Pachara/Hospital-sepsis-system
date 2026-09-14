import unittest
from fastapi.testclient import TestClient
from backend.main import app

class TestSimulatorApi(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_inject_patient_high_risk(self):
        payload = {
            "hn": "HN_SIM_001",
            "patient_name": "นายทดสอบ วิกฤต",
            "sex": "male",
            "age": 62,
            "chief_complaint": "ไข้สูง หนาวสั่น หายใจหอบเหนื่อย",
            "sbp": 80,
            "dbp": 50,
            "heart_rate": 130,
            "resp_rate": 28,
            "temperature": 39.5,
            "spo2": 90,
            "gcs": 13,
        }
        res = self.client.post("/api/simulator/inject-patient", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        patient = data.get("patient")
        self.assertEqual(patient.get("hn"), "HN_SIM_001")
        news = patient.get("news_result", {})
        self.assertGreaterEqual(news.get("totalScore", 0), 5)
        self.assertEqual(news.get("riskLevel"), "high")

    def test_admin_reset_dashboard(self):
        res = self.client.post("/api/admin/reset-dashboard")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("cleared_count", data)

if __name__ == '__main__':
    unittest.main()
