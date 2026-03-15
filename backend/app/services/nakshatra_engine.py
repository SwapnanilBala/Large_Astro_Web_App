"""
Vedic Astrology Nakshatra + Vimshottari Dasha Calculation Engine.

Computes Nakshatra position from Moon longitude and builds a full
Vimshottari Dasha / Antardasha timeline from the birth moment.
"""

from datetime import date, datetime, time, timedelta
from dataclasses import dataclass
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

NAKSHATRAS: list[str] = [
    "Ashwini",
    "Bharani",
    "Krittika",
    "Rohini",
    "Mrigashira",
    "Ardra",
    "Punarvasu",
    "Pushya",
    "Ashlesha",
    "Magha",
    "Purva Phalguni",
    "Uttara Phalguni",
    "Hasta",
    "Chitra",
    "Swati",
    "Vishakha",
    "Anuradha",
    "Jyeshtha",
    "Moola",
    "Purva Ashadha",
    "Uttara Ashadha",
    "Shravana",
    "Dhanishta",
    "Shatabhisha",
    "Purva Bhadrapada",
    "Uttara Bhadrapada",
    "Revati",
]

# The 9-planet lordship cycle that repeats across the 27 nakshatras (3 rounds).
NAKSHATRA_LORDS: list[str] = [
    "Ketu",
    "Venus",
    "Sun",
    "Moon",
    "Mars",
    "Rahu",
    "Jupiter",
    "Saturn",
    "Mercury",
]

# Total Vimshottari Dasha years for each planetary lord (sums to 120).
DASHA_YEARS: dict[str, int] = {
    "Ketu": 7,
    "Venus": 20,
    "Sun": 6,
    "Moon": 10,
    "Mars": 7,
    "Rahu": 18,
    "Jupiter": 16,
    "Saturn": 19,
    "Mercury": 17,
}

# Each nakshatra spans 13 degrees 20 minutes = 13.333... degrees.
NAKSHATRA_SPAN: float = 13.333333333
YEAR_DAYS: float = 365.25


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class NakshatraData:
    """Result of a Nakshatra calculation from Moon longitude."""
    name: str
    index: int
    lord: str
    pada: int
    degree_in_nakshatra: float


@dataclass
class DashaPeriod:
    """A single Maha Dasha period."""
    planet: str
    start_date: date
    end_date: date
    years: float
    sequence_start_date: date
    sequence_end_date: date
    is_partial: bool = False


@dataclass
class AntarDashaPeriod:
    """A sub-period (Bhukti) within a Maha Dasha."""
    major_lord: str
    sub_lord: str
    start_date: date
    end_date: date


@dataclass
class DashaTimeline:
    """Complete Vimshottari Dasha timeline with current period info."""
    periods: list[DashaPeriod]
    current_dasha: Optional[DashaPeriod]
    current_antardasha: Optional[AntarDashaPeriod]
    current_dasha_start: Optional[date]
    current_dasha_end: Optional[date]
    current_antardasha_start: Optional[date]
    current_antardasha_end: Optional[date]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _to_date(d) -> date:
    """Normalise a date or datetime to a plain date object."""
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return date(d.year, d.month, d.day)
    return d


def _to_datetime(value: date | datetime) -> datetime:
    """Normalise a date or datetime to a naive datetime."""
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    return datetime.combine(value, time.min)


def _duration_years(start_moment: datetime, end_moment: datetime) -> float:
    total_seconds = max((end_moment - start_moment).total_seconds(), 0.0)
    return total_seconds / (86400.0 * YEAR_DAYS)


def _moment_in_window(
    moment: datetime,
    start_moment: datetime,
    end_moment: datetime,
    is_last: bool = False,
) -> bool:
    if is_last:
        return start_moment <= moment <= end_moment
    return start_moment <= moment < end_moment


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class NakshatraEngine:
    """Vedic Nakshatra and Vimshottari Dasha calculator."""

    # ------------------------------------------------------------------ #
    # Nakshatra from Moon longitude
    # ------------------------------------------------------------------ #

    @staticmethod
    def calculate_nakshatra(moon_longitude: float) -> NakshatraData:
        """
        Determine the Nakshatra, pada, and ruling lord for a given
        sidereal Moon longitude (0-360 degrees).

        Parameters
        ----------
        moon_longitude : float
            Sidereal longitude of the Moon in degrees (0 <= lon < 360).

        Returns
        -------
        NakshatraData
        """
        # Clamp longitude into [0, 360)
        moon_longitude = moon_longitude % 360.0

        nak_index = int(moon_longitude / NAKSHATRA_SPAN)
        nak_index = max(0, min(nak_index, 26))

        degree_in_nak = moon_longitude - (nak_index * NAKSHATRA_SPAN)

        pada = int(degree_in_nak / (NAKSHATRA_SPAN / 4)) + 1
        pada = max(1, min(pada, 4))

        lord = NAKSHATRA_LORDS[nak_index % 9]

        return NakshatraData(
            name=NAKSHATRAS[nak_index],
            index=nak_index,
            lord=lord,
            pada=pada,
            degree_in_nakshatra=degree_in_nak,
        )

    # ------------------------------------------------------------------ #
    # Full Vimshottari Dasha timeline
    # ------------------------------------------------------------------ #

    @staticmethod
    def calculate_dasha_timeline(
        nakshatra: NakshatraData,
        birth_date: date | datetime,
        current_date: Optional[date | datetime] = None,
    ) -> DashaTimeline:
        """
        Build the Vimshottari Dasha timeline beginning at *birth_date*
        and locate the current Maha Dasha / Antardasha.

        Parameters
        ----------
        nakshatra : NakshatraData
            Nakshatra data (usually from ``calculate_nakshatra``).
        birth_date : date
            Native's birth date.
        current_date : date | None
            Reference date for "current" period lookup.  Defaults to today.

        Returns
        -------
        DashaTimeline
        """
        birth_moment = _to_datetime(birth_date)
        current_moment = (
            _to_datetime(current_date)
            if current_date is not None
            else datetime.utcnow()
        )

        # -- Anchor the birth lord dasha to its true start -------------------
        birth_lord = nakshatra.lord
        fraction_elapsed = nakshatra.degree_in_nakshatra / NAKSHATRA_SPAN
        lord_total_years = DASHA_YEARS[birth_lord]
        elapsed_days = lord_total_years * fraction_elapsed * YEAR_DAYS

        # -- Build the lord sequence starting from birth lord ----------------
        lord_start_idx = NAKSHATRA_LORDS.index(birth_lord)

        periods: list[DashaPeriod] = []
        lookup_periods: list[tuple[DashaPeriod, datetime, datetime]] = []
        cursor = birth_moment - timedelta(days=elapsed_days)

        # Maximum span: 120 years from birth
        visible_start = birth_moment
        max_end = birth_moment + timedelta(days=120 * YEAR_DAYS)

        # Full dashas, clipped to the native's post-birth viewing window
        seq_idx = lord_start_idx
        while cursor < max_end:
            lord = NAKSHATRA_LORDS[seq_idx % 9]
            years = DASHA_YEARS[lord]
            sequence_start = cursor
            sequence_end = cursor + timedelta(days=years * YEAR_DAYS)

            clipped_start = max(sequence_start, visible_start)
            clipped_end = min(sequence_end, max_end)
            if clipped_start < clipped_end:
                period = DashaPeriod(
                    planet=lord,
                    start_date=clipped_start.date(),
                    end_date=clipped_end.date(),
                    years=round(_duration_years(clipped_start, clipped_end), 2),
                    sequence_start_date=sequence_start.date(),
                    sequence_end_date=sequence_end.date(),
                    is_partial=clipped_start != sequence_start or clipped_end != sequence_end,
                )
                periods.append(period)
                lookup_periods.append((period, sequence_start, sequence_end))

            cursor = sequence_end
            seq_idx += 1

        # -- Locate current Maha Dasha --------------------------------------
        current_dasha: Optional[DashaPeriod] = None
        current_dasha_sequence_start: Optional[date] = None
        current_dasha_sequence_end: Optional[date] = None
        for index, (period, sequence_start, sequence_end) in enumerate(lookup_periods):
            if _moment_in_window(
                current_moment,
                sequence_start,
                sequence_end,
                is_last=index == len(lookup_periods) - 1,
            ):
                current_dasha = period
                current_dasha_sequence_start = sequence_start.date()
                current_dasha_sequence_end = sequence_end.date()
                break

        # -- Compute Antardasha inside current Maha Dasha --------------------
        current_antardasha: Optional[AntarDashaPeriod] = None
        current_antardasha_start: Optional[date] = None
        current_antardasha_end: Optional[date] = None
        if current_dasha is not None:
            sub_periods = NakshatraEngine._build_sub_period_windows(
                parent_lord=current_dasha.planet,
                parent_start=current_dasha.start_date,
                parent_end=current_dasha.end_date,
                level=2,
                parent_lords=[current_dasha.planet],
                sequence_start=current_dasha_sequence_start,
                sequence_end=current_dasha_sequence_end,
            )
            for index, sub_period in enumerate(sub_periods):
                if _moment_in_window(
                    current_moment,
                    sub_period["sequence_start_dt"],
                    sub_period["sequence_end_dt"],
                    is_last=index == len(sub_periods) - 1,
                ):
                    current_antardasha = AntarDashaPeriod(
                        major_lord=current_dasha.planet,
                        sub_lord=sub_period["planet"],
                        start_date=sub_period["sequence_start_date"],
                        end_date=sub_period["sequence_end_date"],
                    )
                    current_antardasha_start = sub_period["sequence_start_date"]
                    current_antardasha_end = sub_period["sequence_end_date"]
                    break

        return DashaTimeline(
            periods=periods,
            current_dasha=current_dasha,
            current_antardasha=current_antardasha,
            current_dasha_start=current_dasha_sequence_start,
            current_dasha_end=current_dasha_sequence_end,
            current_antardasha_start=current_antardasha_start,
            current_antardasha_end=current_antardasha_end,
        )

    # ------------------------------------------------------------------ #
    # Generic sub-period computation (levels 2-5)
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_sub_period_windows(
        parent_lord: str,
        parent_start: date | datetime,
        parent_end: date | datetime,
        level: int,
        parent_lords: Optional[list[str]] = None,
        sequence_start: Optional[date | datetime] = None,
        sequence_end: Optional[date | datetime] = None,
    ) -> list[dict]:
        visible_start = _to_datetime(parent_start)
        visible_end = _to_datetime(parent_end)
        full_start = _to_datetime(sequence_start or parent_start)
        full_end = _to_datetime(sequence_end or parent_end)
        total_seconds = (full_end - full_start).total_seconds()
        if total_seconds <= 0:
            return []

        if parent_lords is None:
            parent_lords = []

        start_idx = NAKSHATRA_LORDS.index(parent_lord)
        cursor = full_start
        results: list[dict] = []

        for i in range(9):
            sub_lord = NAKSHATRA_LORDS[(start_idx + i) % 9]
            proportion = DASHA_YEARS[sub_lord] / 120.0
            sub_seconds = total_seconds * proportion
            raw_end = cursor + timedelta(seconds=sub_seconds)

            if i == 8 or raw_end > full_end:
                raw_end = full_end

            clipped_start = max(cursor, visible_start)
            clipped_end = min(raw_end, visible_end)
            if clipped_start < clipped_end:
                results.append({
                    "level": level,
                    "planet": sub_lord,
                    "lords": parent_lords + [sub_lord],
                    "start_date": clipped_start.date(),
                    "end_date": clipped_end.date(),
                    "sequence_start_date": cursor.date(),
                    "sequence_end_date": raw_end.date(),
                    "is_partial": clipped_start != cursor or clipped_end != raw_end,
                    "sequence_start_dt": cursor,
                    "sequence_end_dt": raw_end,
                })
            cursor = raw_end

        return results

    @staticmethod
    def compute_sub_periods(
        parent_lord: str,
        parent_start: date | datetime,
        parent_end: date | datetime,
        level: int,
        parent_lords: Optional[list[str]] = None,
        sequence_start: Optional[date | datetime] = None,
        sequence_end: Optional[date | datetime] = None,
    ) -> list[dict]:
        """
        Compute the 9 sub-periods within a given parent period.

        This uses the standard Vimshottari proportional algorithm:
        each sub-lord gets ``total_days * (planet_years / 120)`` days.
        The sequence starts from the parent lord itself.

        Parameters
        ----------
        parent_lord : str
            The planetary lord of the parent period.
        parent_start : date
            Start date of the parent period.
        parent_end : date
            End date of the parent period.
        level : int
            The sub-period level being computed (2-5):
            2 = Antardasha, 3 = Pratyantardasha,
            4 = Sookshma Dasha, 5 = Prana Dasha.
        parent_lords : list[str] | None
            The hierarchy of lords from Maha Dasha down to (but not
            including) the current level. Used for labelling.

        Returns
        -------
        list[dict]
            List of 9 sub-period dicts with keys:
            level, planet, lords, start_date, end_date.
        """
        raw_results = NakshatraEngine._build_sub_period_windows(
            parent_lord=parent_lord,
            parent_start=parent_start,
            parent_end=parent_end,
            level=level,
            parent_lords=parent_lords,
            sequence_start=sequence_start,
            sequence_end=sequence_end,
        )

        return [
            {
                key: value
                for key, value in item.items()
                if key not in {"sequence_start_dt", "sequence_end_dt"}
            }
            for item in raw_results
        ]
