"""Fit the true (osculating) lunar node as a trigonometric series.

    ~/.venvs/pyjhora/Scripts/python.exe scripts/true-node/fit-true-node.py
    (the PyJHora venv from `npm run pyjhora:setup`; bin/python off Windows;
    about six minutes; TRUE_NODE_TERMS=n sets the series length, default 300)

Writes lib/engines/true-node-series.ts. The series gives
true node - mean node, in arcseconds, as a sum of sine and cosine terms in the
Moon's fundamental arguments D, M, M', F (Meeus, Astronomical Algorithms
ch. 47), the mean node Omega, and Venus's A1 argument from the same chapter.

Why a fitted series and not the node of astronomy-engine's own Moon: the
osculating node is the line where the plane of the Moon's position and
velocity cuts the ecliptic. Because that plane is only ~5 degrees from the
ecliptic, an error in the Moon's latitude (or its rate) comes out roughly
twenty times larger in the node. astronomy-engine's lunar theory is truncated
(latitude good to ~0.4"), which gave a node 9" off at the median and 50" at
worst against Swiss Ephemeris. Swiss Ephemeris's Moshier Moon carries the full
lunar theory, so the series reproduces its swe.TRUE_NODE instead.

Term selection is greedy (matching pursuit): project the residual on every
candidate argument, take the ten strongest, refit all chosen terms by least
squares, repeat. The candidate set follows from where the node correction
comes from (the Moon's latitude series): F appears only in even multiples, and
Omega and Venus at most once. Picking from a full least-squares fit instead
overfits, and arguments of near-equal frequency (M + 6(M' - F) drifts 19
degrees a century) then cancel each other with coefficients of hundreds of
arcseconds.

The fit draws its dates from 1850-2150 with a fixed seed, and is checked on a
separate set of dates it never saw; the printed residuals are that check.
"""
import itertools
import json
import os
import sys

import numpy as np
import swisseph as swe

SEED = 20261104
N_FIT = 70_000
N_CHECK = 10_000
MAX_TERMS = int(os.environ.get("TRUE_NODE_TERMS", "300"))
T_TERMS = 12  # terms that also get a T * sin / T * cos part
FLAGS = swe.FLG_MOSEPH
JD_START = swe.julday(1850, 1, 1, 0.0)
JD_END = swe.julday(2150, 1, 1, 0.0)
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "lib", "engines", "true-node-series.ts")

rng = np.random.default_rng(SEED)


def sample(n):
    jds = rng.uniform(JD_START, JD_END, n)
    y = np.empty(n)
    for i, jd in enumerate(jds):
        true = swe.calc_ut(jd, swe.TRUE_NODE, FLAGS)[0][0]
        mean = swe.calc_ut(jd, swe.MEAN_NODE, FLAGS)[0][0]
        y[i] = ((true - mean + 540) % 360 - 180) * 3600
    return jds, y


# Kept identical to fundamentalArguments() in true-node-series.ts.
def arguments(jd_ut):
    jd_tt = jd_ut + np.array([swe.deltat(jd) for jd in jd_ut])
    T = (jd_tt - 2451545.0) / 36525.0
    D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T**2
    M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T**2
    Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T**2
    F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T**2
    Om = 125.0445479 - 1934.1362891 * T + 0.0020754 * T**2
    A1 = 119.75 + 131.849 * T
    return T, np.radians(np.vstack([D, M, Mp, F, Om, A1]))


candidates = []
for k in itertools.product(range(-6, 7), range(-2, 3), range(-4, 5), (-6, -4, -2, 0, 2, 4, 6), (-1, 0, 1), (-1, 0, 1)):
    if not any(k) or sum(abs(c) for c in k) > 10 or next(c for c in k if c) < 0:
        continue
    candidates.append(k)
K = np.array(candidates, dtype=float)


def design(chosen, T, G, with_t):
    phase = K[chosen] @ G
    parts = [np.sin(phase), np.cos(phase)]
    if with_t:
        parts += [T * np.sin(phase[with_t]), T * np.cos(phase[with_t])]
    return np.vstack(parts + [np.ones_like(T)[None], T[None]]).T


jds, y = sample(N_FIT)
T, G = arguments(jds)
chosen, residual = [], y.copy()
while len(chosen) < MAX_TERMS:
    amplitude = np.empty(len(candidates))
    for s in range(0, len(candidates), 200):
        phase = K[s:s + 200] @ G
        amplitude[s:s + 200] = np.hypot(np.sin(phase) @ residual, np.cos(phase) @ residual) * 2 / N_FIT
    amplitude[chosen] = 0
    chosen += [int(i) for i in np.argsort(-amplitude)[:10]]
    X = design(chosen, T, G, None)
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    residual = y - X @ coef

n = len(chosen)
strongest = [int(i) for i in np.argsort(-np.hypot(coef[:n], coef[n:2 * n]))[:T_TERMS]]
coef, *_ = np.linalg.lstsq(design(chosen, T, G, strongest), y, rcond=None)

jc, yc = sample(N_CHECK)
Tc, Gc = arguments(jc)
check = np.sort(np.abs(yc - design(chosen, Tc, Gc, strongest) @ coef))
summary = "median %.2f\", 95th percentile %.2f\", 99th %.2f\", worst %.2f\"" % (
    check[len(check) // 2], check[int(len(check) * 0.95)], check[int(len(check) * 0.99)], check[-1])
print(f"{n} terms; on {N_CHECK} unseen dates: {summary}", file=sys.stderr)

# Order the table by amplitude so the file reads from the main term down.
sin_c, cos_c = coef[:n], coef[n:2 * n]
t_sin = dict(zip(strongest, coef[2 * n:2 * n + T_TERMS]))
t_cos = dict(zip(strongest, coef[2 * n + T_TERMS:2 * n + 2 * T_TERMS]))
order = np.argsort(-np.hypot(sin_c, cos_c))


def num(x):
    return f"{x:.4f}".rstrip("0").rstrip(".") if abs(x) >= 0.00005 else "0"


rows = []
for i in order:
    idx = chosen[i]
    k = ", ".join(str(c) for c in candidates[idx])
    row = f"  [{k}, {num(sin_c[i])}, {num(cos_c[i])}"
    if idx in t_sin:
        row += f", {num(t_sin[idx])}, {num(t_cos[idx])}"
    rows.append(row + "],")

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(f"""// Generated by scripts/true-node/fit-true-node.py. Do not edit by hand; rerun it.
//
// True (osculating) lunar node minus the mean node, in arcseconds, fitted to
// Swiss Ephemeris {swe.version} swe.TRUE_NODE - swe.MEAN_NODE (Moshier) over
// 1850-2150. On {N_CHECK} dates the fit never saw: {summary}.
// See the script's docstring for why the node is fitted rather than taken
// from astronomy-engine's Moon.
//
// Each row: multipliers of D, M, M', F, Omega, A1, then the sine and cosine
// coefficients ("), then optionally the T * sine and T * cosine ones ("/century).

/** [d, m, m', f, omega, a1, sin, cos, tSin?, tCos?] */
type Term = readonly number[];

export const TRUE_NODE_CONSTANT = {{ c0: {num(coef[-2])}, c1: {num(coef[-1])} }};

export const TRUE_NODE_TERMS: readonly Term[] = [
{chr(10).join(rows)}
];
""")
print("wrote", os.path.normpath(OUT), file=sys.stderr)
