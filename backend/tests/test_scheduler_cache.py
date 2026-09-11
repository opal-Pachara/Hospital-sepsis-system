import unittest
import backend.scheduler as scheduler


class TestSchedulerCache(unittest.TestCase):
    def setUp(self):
        # Seed cache with known mock data
        scheduler.last_seen_vitals = {
            "HN001_10:00:00": True,
            "HN001_10:15:00": True,
            "HN002_09:30:00": True,
            "HN003_08:00:00": True,
        }
        scheduler._patients_cache = [
            {"hn": "HN001", "patient_name": "Patient One"},
            {"hn": "HN002", "patient_name": "Patient Two"},
            {"hn": "HN003", "patient_name": "Patient Three"},
        ]

    def test_clear_cache_with_active_treatment_preservation(self):
        # Preserve HN001 (in active sepsis treatment), purge HN002 and HN003
        stats = scheduler.clear_cache(preserve_hns=["HN001"])

        self.assertEqual(stats["cleared_patients"], 2)
        self.assertEqual(stats["retained_patients"], 1)
        self.assertEqual(stats["cleared_vitals"], 2)
        self.assertEqual(stats["retained_vitals"], 2)

        # Assert HN001 is still in cache
        cached_hns = [p["hn"] for p in scheduler._patients_cache]
        self.assertIn("HN001", cached_hns)
        self.assertNotIn("HN002", cached_hns)
        self.assertNotIn("HN003", cached_hns)

        # Assert vitals for HN001 preserved
        self.assertIn("HN001_10:00:00", scheduler.last_seen_vitals)
        self.assertIn("HN001_10:15:00", scheduler.last_seen_vitals)
        self.assertNotIn("HN002_09:30:00", scheduler.last_seen_vitals)
        self.assertNotIn("HN003_08:00:00", scheduler.last_seen_vitals)

    def test_clear_cache_all_when_no_preservation(self):
        stats = scheduler.clear_cache(preserve_hns=[])

        self.assertEqual(stats["cleared_patients"], 3)
        self.assertEqual(stats["retained_patients"], 0)
        self.assertEqual(stats["cleared_vitals"], 4)
        self.assertEqual(stats["retained_vitals"], 0)
        self.assertEqual(len(scheduler._patients_cache), 0)
        self.assertEqual(len(scheduler.last_seen_vitals), 0)

    def test_get_cache_stats(self):
        stats = scheduler.get_cache_stats()
        self.assertEqual(stats["patients_cache_count"], 3)
        self.assertEqual(stats["last_seen_vitals_count"], 4)
        self.assertIn("last_clear_date", stats)


if __name__ == '__main__':
    unittest.main()
