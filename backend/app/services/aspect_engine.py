"""Planetary aspect calculation engine for Vedic and Western astrology."""

from dataclasses import dataclass

from app.models.chart_models import PlanetPosition

# ── Western aspect definitions ───────────────────────────────
# Each entry maps an aspect name to its ideal angle and allowed orb.

WESTERN_ASPECTS: dict[str, dict[str, float]] = {
    "Conjunction": {"angle": 0.0, "orb": 8.0},
    "Opposition": {"angle": 180.0, "orb": 8.0},
    "Trine": {"angle": 120.0, "orb": 8.0},
    "Square": {"angle": 90.0, "orb": 7.0},
    "Sextile": {"angle": 60.0, "orb": 6.0},
}

# ── Vedic special (graha-drishti) aspects ────────────────────
# Mars, Jupiter, and Saturn cast special aspects to specific houses
# counted from their own position.  The house offset is converted to
# degrees by multiplying by 30.

VEDIC_SPECIAL_ASPECTS: dict[str, list[int]] = {
    "Mars": [4, 8],
    "Jupiter": [5, 9],
    "Saturn": [3, 10],
}

# ── Speed ordering (fastest → slowest) for applying logic ────
_PLANET_SPEED_ORDER: list[str] = [
    "Moon",
    "Mercury",
    "Venus",
    "Sun",
    "Mars",
    "Jupiter",
    "Saturn",
    "Rahu",
    "Ketu",
]


@dataclass
class AspectData:
    """Represents a single aspect between two planets."""

    planet1: str
    planet2: str
    aspect_type: str
    exact_angle: float
    orb: float
    applying: bool
    vedic: bool


class AspectEngine:
    """Calculate Western and Vedic planetary aspects."""

    # ── helpers ───────────────────────────────────────────────

    @staticmethod
    def _angle_between(lon1: float, lon2: float) -> float:
        """Return the angular distance between two ecliptic longitudes (0-180)."""
        diff = abs(lon1 - lon2) % 360.0
        return diff if diff <= 180.0 else 360.0 - diff

    @staticmethod
    def _is_applying(p1: PlanetPosition, p2: PlanetPosition, target_angle: float) -> bool:
        """Approximate whether the aspect is applying.

        A faster planet approaching the exact aspect angle with a slower
        planet is considered *applying*.  We use mean speed ordering
        rather than instantaneous speed for a simple, deterministic check.
        """
        speed_rank = {name: idx for idx, name in enumerate(_PLANET_SPEED_ORDER)}
        rank1 = speed_rank.get(p1.name, 99)
        rank2 = speed_rank.get(p2.name, 99)

        # The faster planet (lower rank number) is the one that "applies"
        # towards the slower.  If the faster planet still has arc to
        # cover before reaching the exact aspect angle, the aspect is
        # applying; otherwise it is separating.
        if rank1 < rank2:
            # p1 is faster
            faster, slower = p1, p2
        else:
            faster, slower = p2, p1

        current_angle = AspectEngine._angle_between(faster.longitude, slower.longitude)
        # If the current distance is slightly larger than the target the
        # faster body is still closing the gap → applying.
        return current_angle >= target_angle

    # ── main calculation ─────────────────────────────────────

    @classmethod
    def calculate_aspects(
        cls,
        planets: list[PlanetPosition],
        include_vedic: bool = True,
    ) -> list[AspectData]:
        """Return all aspects found among *planets*.

        Parameters
        ----------
        planets:
            List of planet positions (longitude, sign, etc.).
        include_vedic:
            When ``True`` (default), Vedic special aspects (graha-drishti)
            are included in addition to the five standard Western aspects.

        Returns
        -------
        list[AspectData]
            Aspects sorted by tightest orb (smallest first).
        """
        aspects: list[AspectData] = []
        # Track pairs already matched so Vedic pass can skip duplicates.
        seen_pairs: set[tuple[str, str]] = set()

        n = len(planets)

        # ── Western aspects ──────────────────────────────────
        for i in range(n):
            for j in range(i + 1, n):
                p1, p2 = planets[i], planets[j]
                angle = cls._angle_between(p1.longitude, p2.longitude)

                for aspect_name, spec in WESTERN_ASPECTS.items():
                    target = spec["angle"]
                    max_orb = spec["orb"]
                    orb = abs(angle - target)
                    if orb <= max_orb:
                        applying = cls._is_applying(p1, p2, target)
                        aspects.append(
                            AspectData(
                                planet1=p1.name,
                                planet2=p2.name,
                                aspect_type=aspect_name,
                                exact_angle=target,
                                orb=round(orb, 4),
                                applying=applying,
                                vedic=False,
                            )
                        )
                        pair_key = (
                            (min(p1.name, p2.name), max(p1.name, p2.name))
                        )
                        seen_pairs.add(pair_key)

        # ── Vedic special aspects (graha-drishti) ────────────
        if include_vedic:
            vedic_orb = 10.0  # degrees

            for caster in planets:
                house_offsets = VEDIC_SPECIAL_ASPECTS.get(caster.name)
                if house_offsets is None:
                    continue

                for offset in house_offsets:
                    target_lon = (caster.longitude + offset * 30.0) % 360.0

                    for receiver in planets:
                        if receiver.name == caster.name:
                            continue

                        pair_key = (
                            min(caster.name, receiver.name),
                            max(caster.name, receiver.name),
                        )
                        if pair_key in seen_pairs:
                            continue

                        orb = cls._angle_between(receiver.longitude, target_lon)
                        if orb <= vedic_orb:
                            aspect_label = f"Vedic-{caster.name}-{offset}th"
                            applying = cls._is_applying(caster, receiver, 0.0)
                            aspects.append(
                                AspectData(
                                    planet1=caster.name,
                                    planet2=receiver.name,
                                    aspect_type=aspect_label,
                                    exact_angle=round(target_lon, 4),
                                    orb=round(orb, 4),
                                    applying=applying,
                                    vedic=True,
                                )
                            )
                            seen_pairs.add(pair_key)

        # Sort by tightest orb first.
        aspects.sort(key=lambda a: a.orb)
        return aspects
