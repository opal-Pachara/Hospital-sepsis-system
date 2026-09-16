import unittest
from fastapi.testclient import TestClient
from backend.main import app

class TestApiEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_ctx = TestClient(app)
        cls.client = cls.client_ctx.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_ctx.__exit__(None, None, None)

    def test_health_check(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "healthy")

    def test_cache_stats_and_db_status(self):
        res = self.client.get("/api/admin/cache-stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("last_seen_vitals_count", data)

        db_res = self.client.get("/api/admin/db-status")
        self.assertEqual(db_res.status_code, 200)
        self.assertTrue(db_res.json().get("pool_available"))

    def test_clear_cache_with_preserve_hns(self):
        res = self.client.post("/api/admin/clear-cache", json={"preserve_hns": ["HN1001", "HN1002"]})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("preserved_hns", data)
        self.assertEqual(sorted(data["preserved_hns"]), ["HN1001", "HN1002"])

    def test_get_patients(self):
        res = self.client.get("/api/patients")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("patients", data)
        self.assertIn("count", data)
        self.assertIsInstance(data["patients"], list)

    def test_treatment_status_full_cycle(self):
        test_hn = "API_TEST_HN_999"

        # 1. Acknowledge
        ack_res = self.client.post("/api/treatment-status/acknowledge", json={
            "hn": test_hn,
            "acknowledged_by": "Dr. Test API",
            "vn": "VN999"
        })
        self.assertEqual(ack_res.status_code, 200)
        ack_data = ack_res.json()["data"]
        self.assertEqual(ack_data["hn"], test_hn)
        self.assertTrue(ack_data["acknowledged"])
        self.assertTrue(ack_data.get("doctor_confirmed", False))

        # 2. Get status for HN
        get_res = self.client.get(f"/api/treatment-status/{test_hn}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["acknowledged_by"], "Dr. Test API")

        # 3. Save checklist
        chk_res = self.client.post("/api/treatment-status/checklist", json={
            "hn": test_hn,
            "checklist_json": '{"phase1": true, "phase2": false}'
        })
        self.assertEqual(chk_res.status_code, 200)

        # 4. Complete treatment
        comp_res = self.client.post("/api/treatment-status/complete", json={
            "hn": test_hn,
            "completed_by": "Dr. Completer"
        })
        self.assertEqual(comp_res.status_code, 200)
        self.assertTrue(comp_res.json()["data"]["treatment_completed"])

        # 5. Rule out sepsis
        ro_res = self.client.post("/api/treatment-status/rule-out", json={
            "hn": test_hn
        })
        self.assertEqual(ro_res.status_code, 200)
        self.assertTrue(ro_res.json()["data"]["sepsis_ruled_out"])

        # 6. Clear treated records
        clear_res = self.client.post("/api/treatment-status/clear-treated")
        self.assertEqual(clear_res.status_code, 200)
        self.assertIn(test_hn, clear_res.json()["cleared_hns"])

        # 7. Verify test_hn is cleaned up
        verify_res = self.client.get(f"/api/treatment-status/{test_hn}")
        self.assertEqual(verify_res.status_code, 404)

if __name__ == '__main__':
    unittest.main()
