# Comparing our yogas with PyJHora

A local check of our yoga engine — `lib/engines/yoga/`, re-exported from `lib/engines/yoga-engine.ts` — against [PyJHora](https://pypi.org/project/PyJHora/), the open-source Python port of Jagannatha Hora. It runs on your own machine only. Nothing here is deployed, and the site never runs Python.

## Run it

Once, to install PyJHora and its dependencies into a Python 3.12 environment at `~/.venvs/pyjhora` (about 400 MB, mostly PyJHora's ephemeris data). You need Python 3.12 installed first:

```bash
npm run pyjhora:setup
```

Then, whenever you want a fresh comparison:

```bash
npm run compare:pyjhora
```

That takes about ten seconds and rewrites [`docs/pyjhora-yoga-comparison.md`](../../docs/pyjhora-yoga-comparison.md). Add a number for a different sample size, for example `npm run compare:pyjhora -- 500`.

## What it does

1. **`export-charts.ts`** builds 2,000 charts with our engine from a fixed seed (births 1940 to 2015, ten cities), so every run uses the same charts.
2. **`run_pyjhora.py`** hands PyJHora **our** planet positions for each chart and asks its yoga functions for a verdict, so both sides judge exactly the same chart. It also has PyJHora compute each chart itself, to check the two engines place the planets alike.
3. **`compare.ts`** pairs each of our yogas with its PyJHora counterpart (`yoga-map.ts`), counts where they agree, and uses `explain.ts` to find the reason for every disagreement on a pair that should match.

## Changing it

- **Pairing a yoga.** Add a line to `yoga-map.ts`. Mark it `same` only if PyJHora's *code* checks the same combination as ours; its one-line descriptions do not always match its code (Srik, Shakata and Chatussagara don't).
- **A new disagreement.** If the report lists disagreements "not explained by any known difference", read the PyJHora function (in `~/.venvs/pyjhora/Lib/site-packages/jhora/horoscope/chart/yoga.py`) and the example charts. Then either fix our yoga, or add the reason to `explain.ts`.
- **Upgrading PyJHora.** Change the version in `requirements.txt`, rerun setup, rerun the comparison. The explainers restate PyJHora 4.8.7's code, so a changed function shows up as new unexplained disagreements rather than going unnoticed.

## Licence

PyJHora is published under the AGPL (its PyPI page also says MIT). This setup only runs it locally for testing. None of its code is copied into the repo; `explain.ts` restates in our own words what a few of its functions check. Keep it that way: running it on a public server, or bundling its code, would bring the AGPL's source-sharing terms into play.
