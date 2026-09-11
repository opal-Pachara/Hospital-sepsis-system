import unittest
from fastapi.testclient import TestClient
from backend.main import app

class TestDashboardEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_ctx = TestClient(app)
        cls.client = cls.client_ctx.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_ctx.__exit__(None, None, None)

    def test_get_daily_dashboard_stats(self):
        res = self.client.get("/api/dashboard/daily-stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("dates", data)
        self.assertIn("summary_today", data)
        self.assertIn("daily_history", data)

        summary = data["summary_today"]
        self.assertIn("total_cases", summary)
        self.assertIn("high_risk_cases", summary)
        self.assertIn("treated_completed", summary)
        self.assertIn("ruled_out", summary)
        self.assertIn("compliance_rate", summary)

    def test_get_daily_cases_pdpa_compliance(self):
        res = self.client.get("/api/dashboard/daily-cases")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("cases", data)
        self.assertIn("count", data)

        cases = data["cases"]
        if cases:
            first_case = cases[0]
            # Must have masked HN
            self.assertIn("masked_hn", first_case)
            self.assertTrue(first_case["masked_hn"].startswith("HN****"))

            # STRICT PDPA: No full patient name, citizen id, or address
            self.assertNotIn("patient_name", first_case)
            self.assertNotIn("name", first_case)
            self.assertNotIn("citizen_id", first_case)
            self.assertNotIn("cid", first_case)
            self.assertNotIn("address", first_case)

            # Allowed clinical fields
            self.assertIn("gender", first_case)
            self.assertIn("age", first_case)
            self.assertIn("news_score", first_case)
            self.assertIn("outcome_label", first_case)

    def test_get_treated_cases_alias(self):
        res = self.client.get("/api/dashboard/treated-cases?date=2026-09-01")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("cases", data)
        self.assertIn("date", data)
        self.assertEqual(data["date"], "2026-09-01")

if __name__ == '__main__':
    unittest.main()
