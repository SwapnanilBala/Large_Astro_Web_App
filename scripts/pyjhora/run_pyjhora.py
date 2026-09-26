"""
Step 2 of the PyJHora comparison: judge the exported charts with PyJHora.

Reads scripts/pyjhora/out/charts.json (written by export-charts.ts) and writes
scripts/pyjhora/out/pyjhora-results.json. Two separate questions are answered:

1. Yogas. Every chart is handed to PyJHora as *our* planet longitudes, so its
   yoga functions see exactly the chart ours saw. Only the functions named in
   yoga-map.ts are called.

2. Positions. PyJHora also computes each chart itself from the birth moment,
   with the Lahiri ayanamsa our engine uses, and the result is compared planet
   by planet. This is what tells us whether a real user would get the same
   chart from both engines -- a separate question from whether the yoga rules
   agree.

   Rahu is compared twice. PyJHora's chart uses the true (osculating) node,
   and its node switch does not reach drik.dhasavarga, so the mean node is
   taken from the Swiss Ephemeris directly. Our engine's "true node" turned
   out to track the mean node, and reporting both makes that visible.

Run with the Python from scripts/pyjhora/setup.mjs:
    <venv python> scripts/pyjhora/run_pyjhora.py
"""

import contextlib
import inspect
import io
import json
import sys
import traceback
from importlib.metadata import version
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent / "out"
CHARTS_FILE = OUT_DIR / "charts.json"
RESULTS_FILE = OUT_DIR / "pyjhora-results.json"

# PyJHora prints a line for every directory it adds to sys.path on import, and
# some yoga functions print as they work. None of it is our output.
_quiet = io.StringIO()
with contextlib.redirect_stdout(_quiet):
    import swisseph as swe
    from jhora import const, utils
    from jhora.horoscope.chart import charts, house, raja_yoga, yoga
    from jhora.panchanga import drik

# PyJHora numbers the planets; the ascendant is "L".
PLANET_IDS = {
    "Sun": 0, "Moon": 1, "Mars": 2, "Mercury": 3, "Jupiter": 4,
    "Venus": 5, "Saturn": 6, "Rahu": 7, "Ketu": 8,
}
SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]


def planet_positions(chart):
    """Our chart in PyJHora's format: [["L", (sign, degree)], [0, (sign, degree)], ...]."""
    asc = chart["ascendant"]
    positions = [[const._ascendant_symbol, (SIGNS.index(asc["sign"]), asc["degree_in_sign"])]]
    by_name = {p["name"]: p for p in chart["planets"]}
    for name, pid in PLANET_IDS.items():
        p = by_name[name]
        positions.append([pid, (SIGNS.index(p["sign"]), p["degree_in_sign"])])
    return positions


def resolve(function_name):
    """The callable for one yoga name, and the kind of input it takes."""
    if function_name == "raja_yoga_pairs":
        return raja_yoga.get_raja_yoga_pairs_from_planet_positions, "positions"
    from_positions = getattr(yoga, function_name + "_from_planet_positions", None)
    if from_positions is not None:
        # The navamsa yogas take (rasi positions, navamsa positions). Judged by
        # the parameter's name: others also take a second parameter, an
        # optional benefic or malefic list, which must be left at its default.
        if any("navamsa" in p for p in inspect.signature(from_positions).parameters):
            return from_positions, "positions+navamsa"
        return from_positions, "positions"
    from_chart = getattr(yoga, function_name, None)
    if from_chart is not None:
        return from_chart, "chart_1d"
    return None, None


def is_present(result):
    """PyJHora returns a bool, a list of pairs, or (bool, details). Reduce to one bool."""
    if isinstance(result, tuple) and result and isinstance(result[0], bool):
        return result[0]
    return bool(result)


def snapshot_const_lists():
    """Copies of every list PyJHora keeps in jhora.const.

    Some yoga functions change these in place. adhi_yoga, for one, runs
    `_natural_benefics += [MERCURY_ID]` on const.natural_benefics itself, so
    after one chart where Mercury counts as a benefic, every later function in
    the same process treats Mercury as a benefic too. Restoring after each call
    keeps every function judging the chart it was given.
    """
    return {name: list(value) for name, value in vars(const).items() if isinstance(value, list)}


def restore_const_lists(snapshot, culprit, mutated):
    for name, original in snapshot.items():
        current = getattr(const, name)
        if current != original:
            current[:] = original  # in place: other modules hold the same list object
            mutated.setdefault(name, set()).add(culprit)


def angle_gap(a, b):
    """The smaller arc between two longitudes, in degrees."""
    d = abs(a - b) % 360.0
    return min(d, 360.0 - d)


def main():
    data = json.loads(CHARTS_FILE.read_text(encoding="utf-8"))
    functions = data["pyjhora_functions"]

    resolved = {}
    missing = []
    for name in functions:
        fn, kind = resolve(name)
        if fn is None:
            missing.append(name)
        else:
            resolved[name] = (fn, kind)

    # Match our engine's ayanamsa for the position check. The yoga check does
    # not depend on it: it is handed our longitudes directly.
    drik.set_ayanamsa_mode("LAHIRI")

    results = []
    positions = []
    return_types = {}
    const_lists = snapshot_const_lists()
    mutated = {}
    for record in data["charts"]:
        chart = record["chart"]
        pp = planet_positions(chart)
        # PyJHora's own navamsa of our longitudes, the same call its navamsa
        # yogas make when they are not handed one.
        with contextlib.redirect_stdout(_quiet):
            navamsa_pp = charts.navamsa_chart([list(p) for p in pp])[: const._pp_count_upto_ketu]

        present, errors = [], {}
        for name, (fn, kind) in resolved.items():
            # Rebuilt per call, because a function may also edit its input.
            chart_1d = utils.get_house_planet_list_from_planet_positions(pp)
            try:
                with contextlib.redirect_stdout(_quiet):
                    if kind == "positions":
                        result = fn([list(p) for p in pp])
                    elif kind == "positions+navamsa":
                        result = fn([list(p) for p in pp], [list(p) for p in navamsa_pp])
                    else:
                        result = fn(chart_1d)
                return_types.setdefault(name, type(result).__name__)
                if is_present(result):
                    present.append(name)
            except Exception as error:  # one broken function must not sink the run
                where = traceback.extract_tb(error.__traceback__)[-1]
                errors[name] = f"{type(error).__name__}: {error} ({Path(where.filename).name}:{where.lineno})"[:240]
            finally:
                restore_const_lists(const_lists, name, mutated)

        # Which lord PyJHora takes for Scorpio and Aquarius in this chart: it
        # picks the stronger of Mars/Ketu and Saturn/Rahu, judged from the rasi
        # positions or (in Bharathi) the navamsa positions. compare.ts only
        # blames this for a disagreement when the pick differs from ours.
        with contextlib.redirect_stdout(_quiet):
            co_lords = {
                basis: [house.house_owner_from_planet_positions([list(p) for p in positions], sign)
                        for sign in (const.SCORPIO, const.AQUARIUS)]
                for basis, positions in (("rasi", pp), ("navamsa", navamsa_pp))
            }
        results.append({"id": record["id"], "present": present, "errors": errors, "co_lords": co_lords})

        # Timezone 0 because the exported moment is already UTC.
        place = drik.Place(record["city"], record["latitude"], record["longitude"], 0.0)
        jd = record["julian_day_ut"]
        with contextlib.redirect_stdout(_quiet):
            theirs = drik.dhasavarga(jd, place, 1)
            asc = drik.ascendant(jd, place)
        gaps = {"Ascendant": angle_gap(asc[0] * 30 + asc[1], chart["ascendant"]["longitude"])}
        sign_mismatch = []
        if SIGNS[asc[0]] != chart["ascendant"]["sign"]:
            sign_mismatch.append("Ascendant")
        ours_by_name = {p["name"]: p for p in chart["planets"]}
        for pid, (sign, degree) in theirs:
            name = next((n for n, i in PLANET_IDS.items() if i == pid), None)
            if name is None:
                continue
            ours = ours_by_name[name]
            gaps[name] = angle_gap(sign * 30 + degree, ours["longitude"])
            if SIGNS[sign] != ours["sign"]:
                sign_mismatch.append(name)

        swe.set_sid_mode(swe.SIDM_LAHIRI)
        mean_node = swe.calc_ut(jd, swe.MEAN_NODE, swe.FLG_SIDEREAL | swe.FLG_MOSEPH)[0][0]
        ours_rahu = ours_by_name["Rahu"]
        gaps["Rahu (mean node)"] = angle_gap(mean_node, ours_rahu["longitude"])
        if SIGNS[int(mean_node // 30) % 12] != ours_rahu["sign"]:
            sign_mismatch.append("Rahu (mean node)")
        positions.append({"id": record["id"], "gaps": gaps, "sign_mismatch": sign_mismatch})

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_FILE.write_text(
        json.dumps(
            {
                "pyjhora_version": version("PyJHora"),
                "python_version": sys.version.split()[0],
                "missing_functions": missing,
                "mutated_globals": {name: sorted(fns) for name, fns in mutated.items()},
                "return_types": return_types,
                # PyJHora's sign-strength table, indexed [planet][sign], and the
                # score it calls "friend". Several of its yogas call a planet
                # strong at friend or better; compare.ts needs the same table to
                # explain where that differs from our exalted-or-own-sign rule.
                "strength_table": const.house_strengths_of_planets[:9],
                "strength_friend": const._FRIEND,
                "results": results,
                "positions": positions,
            }
        ),
        encoding="utf-8",
    )
    errored = sum(1 for r in results if r["errors"])
    print(
        f"PyJHora {version('PyJHora')}: judged {len(results)} charts with "
        f"{len(resolved)} yoga functions ({len(missing)} not found, "
        f"{errored} charts with an error). Wrote {RESULTS_FILE.name}."
    )


if __name__ == "__main__":
    main()
