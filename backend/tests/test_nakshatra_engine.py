import unittest
from datetime import date, datetime, time, timedelta

from app.services.nakshatra_engine import NAKSHATRA_SPAN, NakshatraData, NakshatraEngine


class NakshatraEngineTests(unittest.TestCase):
    def test_partial_birth_dasha_uses_true_antardasha_offset(self) -> None:
        nakshatra = NakshatraData(
            name="Pushya",
            index=7,
            lord="Saturn",
            pada=4,
            degree_in_nakshatra=NAKSHATRA_SPAN * 0.75,
        )

        timeline = NakshatraEngine.calculate_dasha_timeline(
            nakshatra=nakshatra,
            birth_date=datetime(2000, 1, 1, 12, 0),
            current_date=datetime(2000, 1, 1, 12, 0),
        )

        self.assertIsNotNone(timeline.current_dasha)
        self.assertIsNotNone(timeline.current_antardasha)
        self.assertEqual(timeline.current_dasha.planet, "Saturn")
        self.assertEqual(timeline.current_antardasha.sub_lord, "Rahu")

    def test_sub_periods_clip_to_visible_partial_window(self) -> None:
        birth_date = datetime(2000, 1, 1, 12, 0)
        sequence_start = birth_date - timedelta(days=19 * 365.25 * 0.75)
        sequence_end = sequence_start + timedelta(days=19 * 365.25)

        sub_periods = NakshatraEngine.compute_sub_periods(
            parent_lord="Saturn",
            parent_start=birth_date.date(),
            parent_end=sequence_end.date(),
            level=2,
            parent_lords=["Saturn"],
            sequence_start=sequence_start,
            sequence_end=sequence_end,
        )

        self.assertTrue(sub_periods)
        self.assertEqual(sub_periods[0]["planet"], "Rahu")
        self.assertTrue(sub_periods[0]["is_partial"])
        self.assertLessEqual(sub_periods[0]["start_date"], sub_periods[0]["end_date"])

    def test_exact_boundary_moves_into_next_sub_period(self) -> None:
        sub_periods = NakshatraEngine.compute_sub_periods(
            parent_lord="Saturn",
            parent_start=date(2000, 1, 1),
            parent_end=date(2019, 1, 1),
            level=2,
            parent_lords=["Saturn"],
        )

        saturn_period = sub_periods[0]
        mercury_period = sub_periods[1]

        timeline = NakshatraEngine.calculate_dasha_timeline(
            nakshatra=NakshatraData(
                name="Pushya",
                index=7,
                lord="Saturn",
                pada=1,
                degree_in_nakshatra=0.0,
            ),
            birth_date=datetime(2000, 1, 1, 0, 0),
            current_date=datetime.combine(mercury_period["sequence_start_date"], time(23, 59)),
        )

        self.assertIsNotNone(timeline.current_antardasha)
        self.assertNotEqual(timeline.current_antardasha.sub_lord, saturn_period["planet"])


if __name__ == "__main__":
    unittest.main()
