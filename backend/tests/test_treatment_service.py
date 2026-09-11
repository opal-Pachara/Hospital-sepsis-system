import unittest
import asyncio
from backend.database import db_pool
from backend.treatment_service import (
    init_treatment_table,
    acknowledge_alert,
    get_treatment_status,
    complete_treatment,
    rule_out_sepsis,
    get_all_treatment_statuses,
)

class TestTreatmentService(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await db_pool.connect()
        await init_treatment_table()
        # Clean test HN
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM patient_treatment_status WHERE hn = 'TEST_HN_SYNC';")

    async def asyncTearDown(self):
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM patient_treatment_status WHERE hn = 'TEST_HN_SYNC';")
        await db_pool.disconnect()

    async def test_acknowledge_and_get_status(self):
        ack_res = await acknowledge_alert("TEST_HN_SYNC", "Nurse_Test")
        self.assertTrue(ack_res["acknowledged"])
        self.assertTrue(ack_res["doctor_confirmed"])
        self.assertIsNotNone(ack_res["countdown_started_at"])

        status = await get_treatment_status("TEST_HN_SYNC")
        self.assertIsNotNone(status)
        self.assertEqual(status["hn"], "TEST_HN_SYNC")
        self.assertEqual(status["acknowledged_by"], "Nurse_Test")
        self.assertTrue(status["acknowledged"])

    async def test_complete_treatment(self):
        await acknowledge_alert("TEST_HN_SYNC", "Nurse_Test")
        comp_res = await complete_treatment("TEST_HN_SYNC", "Doctor_Test")
        self.assertTrue(comp_res["treatment_completed"])

        status = await get_treatment_status("TEST_HN_SYNC")
        self.assertTrue(status["treatment_completed"])
        self.assertEqual(status["treatment_completed_by"], "Doctor_Test")

    async def test_rule_out_sepsis(self):
        await rule_out_sepsis("TEST_HN_SYNC")
        status = await get_treatment_status("TEST_HN_SYNC")
        self.assertTrue(status["sepsis_ruled_out"])

    async def test_get_all_treatment_statuses(self):
        await acknowledge_alert("TEST_HN_SYNC", "Nurse_Test")
        all_st = await get_all_treatment_statuses()
        self.assertIn("TEST_HN_SYNC", all_st)
        self.assertTrue(all_st["TEST_HN_SYNC"]["acknowledged"])

if __name__ == '__main__':
    unittest.main()
