import unittest
from datetime import date, datetime, time

from app.models.chart_models import BirthDetails


class BirthDetailsTests(unittest.TestCase):
    def test_utc_datetime_prefers_time_zone_id_over_manual_offset(self) -> None:
        birth = BirthDetails(
            name="Timezone Check",
            birth_date=date(1990, 6, 15),
            birth_time=time(14, 30),
            timezone_offset_minutes=-330,
            latitude=28.6139,
            longitude=77.209,
            country="India",
            state="Delhi",
            city="New Delhi",
            time_zone_id="Asia/Kolkata",
        )

        self.assertEqual(birth.resolved_timezone_offset_minutes(), 330)
        self.assertEqual(birth.utc_datetime, datetime(1990, 6, 15, 9, 0))

    def test_current_local_conversion_uses_zone_when_available(self) -> None:
        birth = BirthDetails(
            name="DST Check",
            birth_date=date(1990, 1, 1),
            birth_time=time(12, 0),
            timezone_offset_minutes=-300,
            latitude=40.7128,
            longitude=-74.0060,
            country="USA",
            state="NY",
            city="New York",
            time_zone_id="America/New_York",
        )

        july_utc = datetime(2026, 7, 1, 16, 0)
        self.assertEqual(birth.utc_to_local(july_utc), datetime(2026, 7, 1, 12, 0))


if __name__ == "__main__":
    unittest.main()
