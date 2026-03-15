import unittest
from datetime import date, time

from app.models.chart_models import BirthDetails
from app.services.chart_service import ChartService


class ChartServiceTests(unittest.TestCase):
    def test_build_chart_exposes_calculation_audit_for_dasha_checks(self) -> None:
        service = ChartService()
        birth = BirthDetails(
            name="Audit Check",
            birth_date=date(1998, 2, 9),
            birth_time=time(16, 30),
            engine_id="raman_classic",
            timezone_offset_minutes=330,
            latitude=22.9749723,
            longitude=88.4345915,
            country="India",
            state="West Bengal",
            city="Kalyani",
            town="Kalyani",
            time_zone_id="Asia/Kolkata",
        )

        response = service.build_chart(
            birth,
            include_transits=False,
            include_premium=True,
            include_ultimate=False,
            persist_result=False,
        )

        audit = response.chart.calculation_audit
        self.assertIsNotNone(audit)
        assert audit is not None
        self.assertEqual(audit.engine_id, "raman_classic")
        self.assertEqual(audit.nakshatra_name, "Pushya")
        self.assertEqual(audit.dasha_seed_lord, "Saturn")
        self.assertEqual(audit.time_zone_id, "Asia/Kolkata")
        self.assertEqual(audit.birth_local_iso, "1998-02-09T16:30")
        self.assertEqual(audit.birth_utc_iso, "1998-02-09T11:00+00:00")
        self.assertAlmostEqual(audit.moon_sidereal_longitude, 95.5407, places=3)
        self.assertAlmostEqual(audit.nakshatra_progress_percent, 16.56, places=2)


if __name__ == "__main__":
    unittest.main()
