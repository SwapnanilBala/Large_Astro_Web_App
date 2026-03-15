import unittest
from datetime import date, time
from unittest.mock import Mock

from app.api.v1.chart import create_chart, get_chart
from app.models.chart_models import BirthDetails


class ChartAccessTests(unittest.TestCase):
    def test_basic_user_gets_full_chart(self) -> None:
        service = Mock()
        service.build_chart.return_value = {"ok": True}

        create_chart(
            payload=BirthDetails(
                name="Basic User",
                birth_date=date(1990, 1, 1),
                birth_time=time(12, 0),
                timezone_offset_minutes=0,
                latitude=0,
                longitude=0,
            ),
            include_transits=True,
            service=service,
        )

        _, kwargs = service.build_chart.call_args
        self.assertTrue(kwargs["include_premium"])
        self.assertTrue(kwargs["include_ultimate"])
        self.assertEqual(kwargs["subscription_tier"], "guest")

    def test_pro_user_gets_full_chart(self) -> None:
        service = Mock()
        service.build_chart.return_value = {"ok": True}

        get_chart(
            name="Pro User",
            birth_date=date(1990, 1, 1),
            birth_time=time(12, 0),
            timezone_offset_minutes=0,
            latitude=0,
            longitude=0,
            country="",
            state="",
            city="",
            town="",
            time_zone_id="",
            include_transits=True,
            service=service,
        )

        _, kwargs = service.build_chart.call_args
        self.assertTrue(kwargs["include_premium"])
        self.assertTrue(kwargs["include_ultimate"])
        self.assertEqual(kwargs["subscription_tier"], "guest")

    def test_ultimate_user_gets_full_chart_modules(self) -> None:
        service = Mock()
        service.build_chart.return_value = {"ok": True}

        get_chart(
            name="Ultimate User",
            birth_date=date(1990, 1, 1),
            birth_time=time(12, 0),
            timezone_offset_minutes=0,
            latitude=0,
            longitude=0,
            country="",
            state="",
            city="",
            town="",
            time_zone_id="",
            include_transits=True,
            service=service,
        )

        _, kwargs = service.build_chart.call_args
        self.assertTrue(kwargs["include_premium"])
        self.assertTrue(kwargs["include_ultimate"])
        self.assertEqual(kwargs["subscription_tier"], "guest")

    def test_guest_user_gets_full_chart(self) -> None:
        service = Mock()
        service.build_chart.return_value = {"ok": True}

        get_chart(
            name="Guest User",
            birth_date=date(1990, 1, 1),
            birth_time=time(12, 0),
            timezone_offset_minutes=0,
            latitude=0,
            longitude=0,
            country="",
            state="",
            city="",
            town="",
            time_zone_id="",
            include_transits=False,
            service=service,
        )

        _, kwargs = service.build_chart.call_args
        self.assertTrue(kwargs["include_premium"])
        self.assertTrue(kwargs["include_ultimate"])
        self.assertEqual(kwargs["subscription_tier"], "guest")


if __name__ == "__main__":
    unittest.main()
