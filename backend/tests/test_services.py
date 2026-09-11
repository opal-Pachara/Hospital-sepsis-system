import unittest
from datetime import datetime, date, time, timedelta
from backend.services import (
    score_rr,
    score_spo2,
    score_temp,
    score_sbp,
    score_hr,
    score_avpu,
    calculate_news_from_row,
    parse_db_date,
    parse_db_time,
    row_to_arrival_iso,
    format_time_str,
)


class TestServicesNEWS(unittest.TestCase):
    def test_score_rr_boundaries(self):
        self.assertEqual(score_rr(8), 3)
        self.assertEqual(score_rr(9), 1)
        self.assertEqual(score_rr(11), 1)
        self.assertEqual(score_rr(12), 0)
        self.assertEqual(score_rr(20), 0)
        self.assertEqual(score_rr(21), 2)
        self.assertEqual(score_rr(24), 2)
        self.assertEqual(score_rr(25), 3)

    def test_score_spo2_boundaries(self):
        self.assertEqual(score_spo2(91), 3)
        self.assertEqual(score_spo2(92), 2)
        self.assertEqual(score_spo2(93), 2)
        self.assertEqual(score_spo2(94), 1)
        self.assertEqual(score_spo2(95), 1)
        self.assertEqual(score_spo2(96), 0)
        self.assertEqual(score_spo2(100), 0)

    def test_score_temp_boundaries(self):
        self.assertEqual(score_temp(35.0), 3)
        self.assertEqual(score_temp(35.1), 1)
        self.assertEqual(score_temp(36.0), 1)
        self.assertEqual(score_temp(36.1), 0)
        self.assertEqual(score_temp(38.0), 0)
        self.assertEqual(score_temp(38.1), 1)
        self.assertEqual(score_temp(39.0), 1)
        self.assertEqual(score_temp(39.1), 2)

    def test_score_sbp_boundaries(self):
        self.assertEqual(score_sbp(90), 3)
        self.assertEqual(score_sbp(91), 2)
        self.assertEqual(score_sbp(100), 2)
        self.assertEqual(score_sbp(101), 1)
        self.assertEqual(score_sbp(110), 1)
        self.assertEqual(score_sbp(111), 0)
        self.assertEqual(score_sbp(219), 0)
        self.assertEqual(score_sbp(220), 3)

    def test_score_hr_boundaries(self):
        self.assertEqual(score_hr(40), 3)
        self.assertEqual(score_hr(41), 1)
        self.assertEqual(score_hr(50), 1)
        self.assertEqual(score_hr(51), 0)
        self.assertEqual(score_hr(90), 0)
        self.assertEqual(score_hr(91), 1)
        self.assertEqual(score_hr(110), 1)
        self.assertEqual(score_hr(111), 2)
        self.assertEqual(score_hr(130), 2)
        self.assertEqual(score_hr(131), 3)

    def test_score_avpu_boundaries(self):
        self.assertEqual(score_avpu(15), 0)
        self.assertEqual(score_avpu(14), 3)
        self.assertEqual(score_avpu(3), 3)
        self.assertEqual(score_avpu(None), 0)

    def test_calculate_news_from_row_high_risk(self):
        row = {
            'resp_rate': 28,     # 3
            'spo2': 90,          # 3
            'temperature': 39.5, # 2
            'sbp': 85,           # 3
            'heart_rate': 135,   # 3
            'gcs': 13,           # 3
        }
        res = calculate_news_from_row(row)
        self.assertEqual(res.totalScore, 17)
        self.assertEqual(res.riskLevel, 'high')
        self.assertTrue(res.hasSingleParameterAlert)
        self.assertEqual(res.missingDataCount, 0)

    def test_calculate_news_from_row_single_alert_escalation(self):
        # Total score is 3 (less than 5), but one score is 3 → riskLevel must be low_medium
        row = {
            'resp_rate': 18,     # 0
            'spo2': 98,          # 0
            'temperature': 37.0, # 0
            'sbp': 85,           # 3 (critical!)
            'heart_rate': 75,    # 0
            'gcs': 15,           # 0
        }
        res = calculate_news_from_row(row)
        self.assertEqual(res.totalScore, 3)
        self.assertTrue(res.hasSingleParameterAlert)
        self.assertEqual(res.riskLevel, 'low_medium')

    def test_calculate_news_from_row_with_missing_data(self):
        row = {
            'resp_rate': None,
            'spo2': 98,
            'temperature': None,
            'sbp': 120,
            'heart_rate': 80,
            'gcs': None,
        }
        res = calculate_news_from_row(row)
        self.assertEqual(res.missingDataCount, 3)
        self.assertEqual(res.totalScore, 0)
        self.assertEqual(res.riskLevel, 'low')


class TestServicesTimeParsing(unittest.TestCase):
    def test_parse_db_time_timedelta(self):
        # 10:56:50 in seconds = 10*3600 + 56*60 + 50 = 39410
        td = timedelta(seconds=39410)
        parsed = parse_db_time(td)
        self.assertEqual(parsed, time(10, 56, 50))

    def test_parse_db_time_zero_timedelta(self):
        td = timedelta(seconds=0)
        parsed = parse_db_time(td)
        self.assertEqual(parsed, time(0, 0, 0))

    def test_parse_db_time_string_hh_mm_ss(self):
        self.assertEqual(parse_db_time("14:30:15"), time(14, 30, 15))

    def test_parse_db_time_string_hh_mm(self):
        self.assertEqual(parse_db_time("08:45"), time(8, 45, 0))

    def test_parse_db_time_hosxp_6digit(self):
        self.assertEqual(parse_db_time("112233"), time(11, 22, 33))

    def test_parse_db_time_hosxp_4digit(self):
        self.assertEqual(parse_db_time("1122"), time(11, 22, 0))

    def test_parse_db_time_fallback(self):
        self.assertEqual(parse_db_time(None), time(0, 0, 0))
        self.assertEqual(parse_db_time("invalid"), time(0, 0, 0))

    def test_parse_db_date_formats(self):
        d = date(2026, 9, 10)
        self.assertEqual(parse_db_date(d), d)
        self.assertEqual(parse_db_date(datetime(2026, 9, 10, 15, 30)), d)
        self.assertEqual(parse_db_date("2026-09-10"), d)
        self.assertEqual(parse_db_date("2026/09/10"), d)

    def test_row_to_arrival_iso(self):
        d = date(2026, 9, 10)
        td = timedelta(seconds=39410)  # 10:56:50
        iso_str = row_to_arrival_iso(d, td)
        self.assertEqual(iso_str, "2026-09-10T10:56:50")

    def test_format_time_str(self):
        td = timedelta(seconds=39410)
        self.assertEqual(format_time_str(td), "10:56:50")
        self.assertEqual(format_time_str("08:15:20"), "08:15:20")


if __name__ == '__main__':
    unittest.main()
