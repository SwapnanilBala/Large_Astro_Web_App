# Ultimate Module and yoga rules

This is a plain-English description of two rule sets: the Ultimate Module (the "Life areas" cards) and the yoga detector. It describes what the code does today. The code is the source of truth:

- Ultimate Module: `lib/engines/life-domain-rules.ts` (the rules) and `lib/engines/rule-engine.ts` (the seven areas, evidence families and sub-themes). Rules version `2026-09-domain-v6`.
- Yogas: `lib/engines/yoga-engine.ts` (200 yogas).

Both are fully deterministic. The same birth details always give the same result. No AI model decides anything here.

## Words used in this document

- **House**: one of the twelve houses of the birth chart. By default a house is one whole sign, counted from the Ascendant sign (the Ascendant sign is the 1st house).
- **Lord of a house**: the planet that rules the sign on that house. Example: if the 7th house is Libra, the 7th lord is Venus.
- **Angles** (kendras): houses 1, 4, 7 and 10.
- **Trines** (trikonas): houses 1, 5 and 9.
- **Hard houses** (dusthanas): houses 6, 8 and 12.
- **Growth houses** (upachayas): houses 3, 6, 10 and 11.
- **Strong sign**: a planet is exalted or in its own sign.
- **Weak sign**: a planet is debilitated.
- **Together** (conjunct): two planets in the same sign. Degrees are not checked.
- **Counted from a planet**: count signs starting from that planet's sign, which is number 1.

The two modules do not use the same planet groups. Keep this in mind when reading both parts.

| | Good planets (benefics) | Hard planets (malefics) |
|---|---|---|
| Ultimate Module | Jupiter, Venus | Mars, Saturn, Rahu, Ketu |
| Yogas | Jupiter, Venus, Mercury | Sun, Mars, Saturn, Rahu, Ketu |

The Moon is in neither group in either module.

---

# Part 1: The Ultimate Module (Life areas)

## What it does

The module reads seven life areas. Each area gets a list of rules that fired, three scores, a band, an evidence summary and a ranked list of sub-themes. The cards are shown most active first.

## The seven areas

Each area has a main house, a supporting house and an instinct planet.

- **Love Life**: main house 7, supporting house 5, instinct planet Venus.
- **Career**: main house 10, supporting house 6, instinct planet Saturn.
- **Family**: main house 4, supporting house 2, instinct planet Moon.
- **Inheritance**: main house 8, supporting house 2, instinct planet Jupiter.
- **Influence**: main house 11, supporting house 10, instinct planet Sun.
- **Life Cycle**: main house 1, supporting house 8, instinct planet Moon.
- **Travel & Destinations**: main house 9, supporting house 3, instinct planet Jupiter.

From these the engine finds three planets:

- The **main ruler**: the lord of the main house.
- The **supporting ruler**: the lord of the supporting house.
- The **instinct planet**: fixed for each area, as listed above.

Each area also has a wider list of houses and planets. Some rules use these lists.

- **Love Life**: houses 5, 7, 8, 12. Planets Venus, Jupiter, Moon.
- **Career**: houses 2, 6, 10, 11. Planets Saturn, Mercury, Sun, Jupiter.
- **Family**: houses 2, 4. Planets Moon, Jupiter.
- **Inheritance**: houses 2, 8. Planets Jupiter, Saturn.
- **Influence**: houses 3, 10, 11. Planets Sun, Mercury, Jupiter.
- **Life Cycle**: houses 1, 8, 12. Planets Moon, Saturn.
- **Travel & Destinations**: houses 3, 4, 9, 12. Planets Jupiter, Moon.

## How a rule works

Every rule that fires has one of four kinds:

- **Support**: helps the area.
- **Pressure**: makes the area harder.
- **Activation**: makes the area busy or visible.
- **Context**: a neutral note.

Every rule also has a weight, a small number such as 0.08. Bigger means more important. The weights are added up to make the scores. A rule can fire only once per area.

## How aspects are counted

A planet looks at (aspects) the house seven houses away from it. Count the planet's own house as number 1. Three planets look at extra houses:

- Mars also looks at the 4th and 8th houses from itself.
- Jupiter also looks at the 5th and 9th houses from itself.
- Saturn also looks at the 3rd and 10th houses from itself.

Rahu and Ketu only look at the 7th.

## The rules

### 1. How strong each of the three planets is

These rules run three times: for the main ruler, the supporting ruler and the instinct planet.

- If the planet is in a strong sign, that is **support**. Weight 0.14 for the main ruler, 0.10 for the instinct planet, 0.08 for the supporting ruler.
- If the planet is in a weak sign, that is **pressure**. Weight 0.14 for the main ruler, 0.10 for the instinct planet, 0.07 for the supporting ruler.
- Otherwise it is a neutral **context** note (0.02).
- If the planet is retrograde, that is **pressure**. Weight 0.06 for the main ruler, 0.04 for the others.
- If the planet is combust (too close to the Sun), that is **pressure**. Weight 0.07 for the main ruler, 0.045 for the others.

### 2. Which house the main ruler sits in

Only the first match counts, checked in this order.

- In house 6, 8 or 12: **pressure** (0.09). Results take more work.
- In house 1, 4, 7 or 10: **activation** (0.10). Results become visible.
- In house 5 or 9: **support** (0.08). Results get natural help.
- In house 3 or 11: **activation** (0.07). Results grow with repetition.
- In house 2: no rule.

### 3. The main house itself

- If any planet sits in the main house, that is **activation**. Weight 0.065 plus 0.02 for each planet, up to 0.13.
- If the main house is empty, that is a **context** note (0.02). The main ruler then matters more.
- If Jupiter or Venus sits in the main house or looks at it, that is **support**. Weight 0.055 plus 0.025 for each such planet, up to 0.12.
- If Mars, Saturn, Rahu or Ketu sits in the main house or looks at it, that is **pressure**. Weight 0.055 plus 0.025 for each such planet, up to 0.13.

### 4. Hemming (what sits on either side of the main house)

- If hard planets sit in both the house before and the house after the main house, that is **pressure** (0.08). The area is squeezed.
- Otherwise, if good planets sit in both of those houses, that is **support** (0.08). The area is shielded.

### 5. The main ruler counted from its own house

- If the main ruler is 6th, 8th or 12th counted from the main house, that is **pressure** (0.07).
- If the main ruler sits in the main house or looks at it, that is **support** (0.08). The ruler guards its house.

Both can fire at once.

### 6. The main ruler's company

- If Jupiter or Venus sits in the same house as the main ruler, that is **support**. Weight 0.05 plus 0.02 for each, up to 0.09.
- If Mars, Saturn, Rahu or Ketu sits in the same house as the main ruler, that is **pressure**. Weight 0.05 plus 0.02 for each, up to 0.09.

Both can fire at once.

### 7. The main ruler holds the same sign in two charts (vargottama)

- If the main ruler is in the same sign in the birth chart and the navamsa (D9), that is **support** (0.07).
- This is skipped for the Moon when the birth time is not exact, because the Moon's navamsa changes quickly.

### 8. The main ruler's weakness is cancelled (neecha bhanga)

- If the main ruler is in a weak sign, and either the lord of that sign or the lord of the ruler's exaltation sign is in an angle, that is **support** (0.08).
- The weak-sign pressure from rule 1 still stays. This rule adds the repair next to it.

This uses the same test as the Neecha Bhanga Raja Yoga in Part 2.

### 9. Links between the main and supporting sides

Only the first of these three counts:

- If the main ruler sits in the supporting house and the supporting ruler sits in the main house (an exchange), that is **activation** (0.15).
- Otherwise, if one planet rules both houses, that is **activation** (0.11).
- Otherwise, if either ruler sits in the other one's house, that is **activation** (0.075).

These two can fire as well:

- If the instinct planet sits in the main house, that is **activation** (0.10).
- If the instinct planet and the main ruler are different planets, and they share a house or either one looks at the other's house, that is **support** (0.065).

### 10. Area-wide checks

These use the area's wider list of houses and planets.

- If two or more of the area's houses have planets in them, that is **activation**. Weight 0.055 plus 0.018 for each occupied house, up to 0.12.
- If any of the area's planets is in a strong sign, that is **support**. Weight 0.055 plus 0.02 for each, up to 0.10.
- If any of the area's planets is in a weak sign or combust, that is **pressure**. Weight 0.055 plus 0.02 for each, up to 0.10.

### 11. Extra evidence

These checks need extra data: divisional charts, planet strength (Shadbala), house points (Ashtakavarga), yogas, the current dasha, and today's Jupiter and Saturn. The Life areas page always has this data. The PDF report has all of it except today's Jupiter and Saturn.

**First, the birth-time gate.** If the birth time is not exact, or a fallback time was used, none of the checks below run. Instead the area gets five small **context** notes (0.01 each) that say an exact birth time is needed.

The "relevant planets" below are the main ruler, the supporting ruler, the instinct planet and the area's planet list.

**Divisional charts.** Each area names the divisional charts that apply to the whole area:

- Love Life: D9.
- Career: D10.
- Family: D4 and D12.
- Influence: D10.
- Inheritance, Life Cycle and Travel: none at area level. Their divisional charts are used only for sub-themes (see below).

Then:

- If any relevant planet is in a strong sign in one of those charts, that is **support** (0.09).
- If any relevant planet is in a weak sign in one of those charts, that is **pressure** (0.085).

A divisional chart confirms or qualifies the birth chart. It never overrides it.

**Planet strength (Shadbala).**

- If a relevant planet has at least its required strength (ratio 1.0 or more), that is **support** (0.08).
- If a relevant planet is below 0.85 of its required strength, that is **pressure** (0.075).

**House points (Ashtakavarga).** The engine averages the points of the area's houses and compares that with the average of all twelve signs in this chart.

- At least 0.75 above the chart average: **support** (0.075).
- At least 1.75 below the chart average: **pressure** (0.075).
- Anything in between: a mixed **context** note (0.025).

**Yogas.** A yoga counts for an area only if all three are true: it is present, its id is on the area's yoga list, and it involves at least one relevant planet.

- If a counted yoga is not challenging and not cancelled, that is **support**. The strongest one is named. Weight 0.075 if it is strong, 0.05 otherwise.
- If a counted yoga is challenging or cancelled, that is **pressure** (0.065).

The yoga lists are:

- **Love Life**: 7th-lord yogas (Yuvati Kendra, Yuvati-Karma Parivartana, Yuvati Swagruhi), Sukha-Yuvati Parivartana, Venus yogas (Shukra Kendra Saundarya, Shukra Digbala, Shukra Vyaya Sthana, Shukra-Shani), Malavya, Hamsa.
- **Career**: 10th-lord yogas (Karma Kendra, Karma Trikona, Karma-Labha Parivartana, Karma Swagruhi, Karma-Sukha Sthana), Artha Support, Dharma-Karmadhipati, Parakrama-Karma Parivartana, Saturn yogas (Shani Upachaya, Shani-Budha, Shani Digbala), Mercury yogas (Budha Upachaya, Budha-Shukra, Budha Digbala), all nine Sun yogas whose names start with Surya, Kahala, Bheri, Akhanda Samrajya, Bhadra, Hamsa. The list also names `sasa`, which matches nothing (see Known quirks).
- **Family**: all 4th-lord yogas (names starting with Sukha), all thirteen Moon yogas whose names start with Chandra, Moksha Support, all 5th-lord yogas (names starting with Vidya), Hamsa.
- **Inheritance**: Randhra Transformation, all 2nd-lord yogas (names starting with Dhana), Dhanakaraka, Shatru Vijaya, Shatru-Vyaya Parivartana, Bhrigu-Mangal, Hamsa. Also `sasa`, which matches nothing.
- **Influence**: all 3rd-lord yogas (names starting with Parakrama), 10th-lord yogas, 11th-lord yogas (Labha Upachaya, Labha Swagruhi, Labha-Dhana Sthana), Mercury yogas, Sun yogas, Dharma-Karma Parivartana, Bhadra, Hamsa.
- **Life Cycle**: all fourteen yogas whose ids start with `lagna_` (1st-lord yogas, plus Lagna Benefic Flank and Lagna Adhi), Randhra Transformation, Vyaya Release, Moksha Support, Shatru Vijaya, Shatru-Vyaya Parivartana. Also `sasa`, which matches nothing.
- **Travel & Destinations**: 9th-lord yogas (Bhagya Trikona, Bhagya Kendra, Bhagya-Labha Parivartana, Bhagya Swagruhi, Bhagya-Vidya Sthana), Vyaya Release, Dharma Support, Hamsa.

**The current dasha.**

- If the current dasha lord or sub-period lord is a relevant planet, that is **activation** (0.075).
- If neither is, that is a **context** note (0.02). Timing is indirect.

**Today's Jupiter and Saturn (transits).** For each of the two, the engine finds the house it is passing through now. It is used only if it sits in or looks at one of the area's houses. It then gets a score for the sign it is in:

- Its own Ashtakavarga points in that sign, minus its own average across the twelve signs.
- Plus one seventh of: the chart's total points in that sign, minus the chart's average.

The scores of the planets used are averaged.

- The average is 0.5 or more: **support** (0.065).
- The average is −0.5 or less: **pressure** (0.065).
- Anything in between: a mixed **context** note (0.02).

## The three scores

The weights of all the rules that fired are added up by kind.

- **Support score** = 0.34 + all support weights. Kept between 0.20 and 0.96.
- **Pressure score** = 0.22 + all pressure weights. Kept between 0.20 and 0.96.
- **Activity score** = 0.57 + all activation weights + 0.42 × support weights − 0.35 × pressure weights. Kept between 0.55 and 0.94.

The activity score is also the area's confidence score. The cards are sorted by it, highest first.

**Band**, from the activity score:

- 0.78 or more: **prominent**.
- 0.58 or more: **active**.
- Below 0.58: **developing**. The score never goes below 0.55, so this band is narrow.

## Evidence families (the detailed page)

Rules are grouped into seven families. Each family gets a status.

- **Natal promise**: the main house and main ruler rules (rule 1 for the main ruler, rules 2 to 8, and the area-wide house check). The exchange and one-way link rules from rule 9 count here and in the next family too.
- **Supporting factors**: the supporting ruler, the instinct planet, the links in rule 9, the area-wide planet checks, and yogas.
- **Divisional confirmation**: the divisional-chart rules.
- **Delivery capacity**: the Shadbala rules.
- **House support**: the Ashtakavarga rules.
- **Combination support**: the yoga rules.
- **Timing and activation**: the dasha and transit rules.

A family's status:

- **Support** if it has only support or activation rules.
- **Pressure** if it has only pressure rules.
- **Mixed** if it has both.
- **Context** if it has neither.

A rule whose id no family covers still counts in the scores. It just does not show in this list.

### Confirmation status

Checked in this order. The first match wins.

1. **Confirmed**: the divisional family supports, and the natal family supports.
2. **Qualified**: the divisional family is pressure, and the natal family supports or is mixed.
3. **Improved**: the divisional family supports, but the natal family is pressure.
4. **Contradictory**: two or more families are mixed, or three or more are pressure, or at least two support while at least two are pressure.
5. **Qualified**: the divisional family has anything other than a context status.
6. **Insufficient**: none of the above.

When the result is contradictory, an extra "Contradiction check" entry is added to the list.

### Conclusion strength

The engine counts independent support groups. There are five:

- The natal family supports.
- The supporting family supports.
- Any of divisional, Shadbala or yoga supports. These three count as one group, because they tend to agree with each other.
- The house-support family supports.
- The timing family supports.

Then:

- **Strong**: the natal family supports, at least three groups support, at most one family is pressure, and the status is not contradictory.
- **Moderate**: at least two groups support, and the status is not contradictory.
- **Cautious**: everything else.

The engine also adds short notes, for example "a strong ruler is working with weaker house support". If the natal family does not support, a note says the natal baseline keeps the area below a strong conclusion.

## Sub-themes

Each area has five or six sub-themes, such as Career → Vocation, Daily work, Leadership, Entrepreneurship, Earnings and Professional recognition. Each sub-theme has its own houses, planets, families and divisional charts.

Each sub-theme's score:

- Start at 0.44.
- Add 0.055 for each of its houses that has a planet in it, up to 0.14.
- Add 0.05 for each of its planets that is in a strong sign or has a Shadbala ratio of 1.0 or more, up to 0.12.
- Subtract 0.045 for each of its planets that is in a weak sign or has a Shadbala ratio below 0.85, up to 0.10.
- With an exact birth time only: add 0.04 for each of its planets in a strong sign in its divisional charts, up to 0.08. Subtract 0.04 for each in a weak sign, up to 0.08.
- For each of its families: add 0.045 if that family supports, subtract 0.035 if it is pressure.
- Keep the result between 0.25 and 0.92.

Sub-theme band:

- 0.68 or more: **leading**.
- 0.52 or more: **supporting**.
- Below 0.52: **developing**.

Sub-themes are listed highest score first.

## The written text

- The card body is the area's fixed text plus the summary of the top rule. The top rule is the strongest support rule; if there is none, the strongest activation rule; if there is none, the strongest pressure rule.
- The **decision rule** says when to act. It names the main ruler, supporting ruler and instinct planet as the periods to watch.
- The **boundary rule** starts with the strongest pressure rule, then says what not to let happen.
- An optional AI brief (`/api/chart/domain-brief`) can reword the findings. The engine still decides every fact. If the AI is unavailable, the rule-based text stays.

---

# Part 2: Yogas

## General rules

- There are **200** yogas. Each one has a fixed test.
- Yogas are checked on the birth chart only (D1). No yoga uses the navamsa.
- Houses are whole signs counted from the Ascendant.
- "Looks at" in this part has a simpler meaning than in Part 1. Planet A fully aspects planet B if B is in the same sign as A, or in the 5th, 7th or 9th sign from A. This is the same for every planet.

### How strength is set

A single planet's strength:

- Exalted or in its own sign: **strong**.
- Debilitated: **weak**.
- Anything else: **moderate**.

When a yoga uses several planets, their strengths are combined:

- Some strong and none weak: **strong**.
- Some weak and none strong: **weak**.
- Anything else, including a mix of strong and weak: **moderate**.

Some yogas set strength their own way. Those are noted below.

### The percentage shown (occurrence chance)

- Start from the strength: strong 88, moderate 65, weak 40.
- Add by category: great-person (mahapurusha) +8, reversal (viparita) +6, wealth +5, good (benefic) +4, pattern (nabhasa) +2, challenging −5.
- Subtract 25 if the yoga is cancelled.
- Keep the result between 0 and 99.

### Which yogas are shown

- A yoga is shown only if its percentage is **30 or more**.
- In practice this means any yoga that is both weak and cancelled is hidden.
- Results are sorted strong first, then moderate, then weak. Inside each group, the highest percentage comes first.
- If one yoga's test fails with an error, that yoga is skipped and the rest still run.

A simulation of 20,000 random charts gave about 34 yogas per chart on average.

## 1. The five great-person yogas (Pancha Mahapurusha)

A planet must be in an angle and in a strong sign. Strength is **strong** if the planet is exalted and **moderate** if it is in its own sign.

- **Ruchaka**: Mars.
- **Bhadra**: Mercury.
- **Hamsa**: Jupiter.
- **Malavya**: Venus.
- **Shasha**: Saturn.

## 2. The original named yogas

- **Gajakesari** (wealth): Jupiter is 1st, 4th, 7th or 10th counted from the Moon. Strength comes from Jupiter's sign.
- **Budhaditya** (wealth): the Sun and Mercury are in the same sign. Moderate. If they are less than 3° apart, it is weak and marked cancelled (Mercury is combust), so it is hidden.
- **Dhana** (wealth): the 2nd lord is in an angle or a trine, or the 11th lord is in the 2nd house. Strength comes from the lords involved.
- **Raja** (wealth): one planet rules both a trine house and a different angle house, or a trine lord and an angle lord are in the same sign. The first match found is used.
- **Lakshmi** (wealth): the 9th lord is in a strong sign, and Venus is in a strong sign and in an angle or a trine. Always strong.
- **Chandra-Mangal** (benefic): the Moon and Mars are in the same sign.
- **Guru-Mangal** (benefic): Jupiter and Mars are in the same sign.
- **Amala** (benefic): Jupiter, Venus or Mercury is in the 10th house, or 10th counted from the Moon. Strength comes from that planet.
- **Saraswati** (benefic): Jupiter, Venus and Mercury are each in an angle, a trine or the 2nd house, and Jupiter is in a strong sign. Always strong.
- **Adhi** (benefic): at least two of Jupiter, Venus and Mercury are 6th, 7th or 8th counted from the Moon. Strong with all three, moderate with two.
- **Kemadruma** (challenging): no planet sits 2nd or 12th from the Moon (the Sun, Rahu and Ketu do not count). Strong. If the Moon is in an angle, or Jupiter is with the Moon or opposite it, it becomes weak and cancelled, so it is hidden.
- **Vish** (challenging): the Moon and Saturn are in the same sign. Moderate. If Jupiter is with the Moon or opposite it, it becomes weak and softened, so it is hidden.
- **Daridra** (challenging): the 11th lord is in house 6, 8 or 12. Weak if that lord is in a strong sign, otherwise moderate.
- **Grahan** (challenging): the Sun or the Moon is in the same sign as Rahu or Ketu. Strong if both the Sun and Moon are affected, otherwise moderate.
- **Viparita Raja** (reversal): the lord of house 6, 8 or 12 is in a different one of those houses. Strong if two or more such lords do this, otherwise moderate.
- **Kedara** (pattern): the seven classical planets are spread across exactly four signs. Always moderate.
- **Yava** (pattern): at least three signs hold exactly two classical planets each. Always moderate.

## 3. More named yogas

- **Parvata** (benefic): at least two of Jupiter, Venus and Mercury are in angles, and at most one hard planet is in house 6, 8 or 12. Strong with three good planets in angles.
- **Kahala** (wealth): the 4th lord and the 9th lord are both in angles or trines.
- **Chamara** (benefic): the 1st lord is not in a weak sign, and Jupiter is with it or fully aspects it. Strength comes from the 1st lord.
- **Sankha** (benefic): the 5th lord and 6th lord are 1st, 4th, 7th or 10th from each other, and the 1st lord is not in a weak sign.
- **Bheri** (wealth): the 9th lord is not in a weak sign, and at least two of Jupiter, Venus and Mercury are in angles or trines. Strong with three.
- **Mridanga** (wealth): the 1st lord is not in a weak sign, and at least one other classical planet is in a strong sign in an angle or trine. Strong with two or more.
- **Vesi** (benefic): a classical planet other than the Moon is 2nd from the Sun. Strong with two or more.
- **Vosi** (benefic): a classical planet other than the Moon is 12th from the Sun. Strong with two or more.
- **Ubhayachari** (benefic): classical planets other than the Moon are both 2nd and 12th from the Sun. Strong with three or more in total.
- **Sunapha** (benefic): a classical planet other than the Sun is 2nd from the Moon. Strong with two or more.
- **Anapha** (benefic): a classical planet other than the Sun is 12th from the Moon. Strong with two or more.
- **Durudhara** (benefic): classical planets other than the Sun are both 2nd and 12th from the Moon. Strong with three or more in total.
- **Vasumati** (wealth): at least two of Jupiter, Venus and Mercury are in growth houses (3, 6, 10, 11), counted from the Ascendant or from the Moon. Strong with three.
- **Shubha Kartari** (benefic): good planets sit in both the 2nd and 12th houses. Strong with three or more.
- **Papa Kartari** (challenging): hard planets sit in both the 2nd and 12th houses. Strong with three or more.
- **Neecha Bhanga Raja** (reversal): a classical planet is in a weak sign, and the lord of that sign or the lord of its exaltation sign is in an angle. Strong if the weak planet is itself in an angle.
- **Harsha** (reversal): the 6th lord is in house 6, 8 or 12. Strong if it is in the 6th.
- **Sarala** (reversal): the 8th lord is in house 6, 8 or 12. Strong if it is in the 8th.
- **Vimala** (reversal): the 12th lord is in house 6, 8 or 12. Strong if it is in the 12th.
- **Shakata** (challenging): Jupiter is 6th, 8th or 12th from the Moon. Moderate. If Jupiter is in a strong sign it becomes weak and marked reduced, so it is hidden.
- **Kalanidhi** (benefic): Jupiter is in house 2, 5 or 9, and Mercury or Venus is with it or fully aspects it. Strong if both do.
- **Akhanda Samrajya** (wealth): Jupiter is not in a weak sign, and at least two of the 2nd, 9th and 11th lords are in angles or trines and not in weak signs. Strong if all three are.
- **Pushkala** (wealth): the lord of the Moon's sign is with the 1st lord or fully aspects it, and sits in an angle or a trine.
- **Bhrigu-Mangal** (wealth): Venus and Mars are in the same sign or fully aspect each other.
- **Dharma-Karmadhipati** (wealth): the 9th lord and 10th lord are the same planet, share a sign, fully aspect each other, or are 1st, 4th, 7th or 10th from each other.
- **Dhanakaraka** (wealth): Jupiter, Venus or Mercury is with the 2nd lord or the 11th lord, or fully aspects one of them. Strong with two or more.
- **Rajalakshana** (wealth): the 1st lord is not in a weak sign, and at least two of Jupiter, Venus and Mercury are in angles or trines. Strong with three.
- **Lagna Adhi** (benefic): at least two of Jupiter, Venus and Mercury are in houses 6, 7 or 8. Strong with three.

## 4. A house lord in a set of houses

Strength comes from the lord's sign.

- **Lagna Lord Kendra Yoga** (benefic): the 1st lord is in the 1st, 4th, 7th or 10th house.
- **Lagna Lord Trikona Yoga** (benefic): the 1st lord is in the 1st, 5th or 9th house.
- **Dhana Lord Kendra Yoga** (wealth): the 2nd lord is in the 1st, 4th, 7th or 10th house.
- **Dhana Lord Trikona Yoga** (wealth): the 2nd lord is in the 1st, 5th or 9th house.
- **Parakrama Upachaya Yoga** (benefic): the 3rd lord is in the 3rd, 6th, 10th or 11th house.
- **Sukha Kendra Yoga** (benefic): the 4th lord is in the 1st, 4th, 7th or 10th house.
- **Vidya Trikona Yoga** (benefic): the 5th lord is in the 1st, 5th or 9th house.
- **Vidya Kendra Yoga** (benefic): the 5th lord is in the 1st, 4th, 7th or 10th house.
- **Shatru Vijaya Yoga** (reversal): the 6th lord is in the 3rd, 6th, 10th or 11th house.
- **Yuvati Kendra Yoga** (benefic): the 7th lord is in the 1st, 4th, 7th or 10th house.
- **Randhra Transformation Yoga** (reversal): the 8th lord is in the 6th, 8th or 12th house.
- **Bhagya Trikona Yoga** (wealth): the 9th lord is in the 1st, 5th or 9th house.
- **Bhagya Kendra Yoga** (wealth): the 9th lord is in the 1st, 4th, 7th or 10th house.
- **Karma Kendra Yoga** (wealth): the 10th lord is in the 1st, 4th, 7th or 10th house.
- **Karma Trikona Yoga** (wealth): the 10th lord is in the 1st, 5th or 9th house.
- **Labha Upachaya Yoga** (wealth): the 11th lord is in the 3rd, 6th, 10th or 11th house.
- **Vyaya Release Yoga** (reversal): the 12th lord is in the 6th, 8th or 12th house.
- **Dharma Support Yoga** (benefic): the 9th lord is in the 2nd, 5th or 11th house.
- **Artha Support Yoga** (wealth): the 10th lord is in the 2nd, 6th, 10th or 11th house.
- **Moksha Support Yoga** (benefic): the 12th lord is in the 4th, 8th or 12th house.

## 5. A house lord in one exact house

Strength comes from the lord's sign.

- **Lagna Swagruhi Yoga** (benefic): the 1st lord is in the 1st house.
- **Dhana Swagruhi Yoga** (wealth): the 2nd lord is in the 2nd house.
- **Parakrama Swagruhi Yoga** (benefic): the 3rd lord is in the 3rd house.
- **Sukha Swagruhi Yoga** (benefic): the 4th lord is in the 4th house.
- **Vidya Swagruhi Yoga** (benefic): the 5th lord is in the 5th house.
- **Yuvati Swagruhi Yoga** (benefic): the 7th lord is in the 7th house.
- **Bhagya Swagruhi Yoga** (wealth): the 9th lord is in the 9th house.
- **Karma Swagruhi Yoga** (wealth): the 10th lord is in the 10th house.
- **Labha Swagruhi Yoga** (wealth): the 11th lord is in the 11th house.
- **Sukha-Karma Sthana Yoga** (wealth): the 4th lord is in the 10th house.
- **Karma-Sukha Sthana Yoga** (benefic): the 10th lord is in the 4th house.
- **Bhagya-Vidya Sthana Yoga** (wealth): the 9th lord is in the 5th house.
- **Vidya-Bhagya Sthana Yoga** (wealth): the 5th lord is in the 9th house.
- **Labha-Dhana Sthana Yoga** (wealth): the 11th lord is in the 2nd house.
- **Dhana-Bhagya Sthana Yoga** (wealth): the 2nd lord is in the 9th house.

## 6. Two house lords swap houses (parivartana)

Each lord sits in the other's house. Strength combines both lords.

- **Lagna-Dhana Parivartana Yoga** (wealth): 1st and 2nd lords.
- **Lagna-Sukha Parivartana Yoga** (benefic): 1st and 4th lords.
- **Lagna-Vidya Parivartana Yoga** (benefic): 1st and 5th lords.
- **Lagna-Shatru Parivartana Yoga** (reversal): 1st and 6th lords.
- **Lagna-Yuvati Parivartana Yoga** (benefic): 1st and 7th lords.
- **Lagna-Bhagya Parivartana Yoga** (wealth): 1st and 9th lords.
- **Lagna-Karma Parivartana Yoga** (wealth): 1st and 10th lords.
- **Lagna-Labha Parivartana Yoga** (wealth): 1st and 11th lords.
- **Lagna-Vyaya Parivartana Yoga** (reversal): 1st and 12th lords.
- **Dhana-Sukha Parivartana Yoga** (wealth): 2nd and 4th lords.
- **Dhana-Vidya Parivartana Yoga** (wealth): 2nd and 5th lords.
- **Dhana-Randhra Parivartana Yoga** (reversal): 2nd and 8th lords.
- **Dhana-Bhagya Parivartana Yoga** (wealth): 2nd and 9th lords.
- **Dhana-Karma Parivartana Yoga** (wealth): 2nd and 10th lords.
- **Dhana-Labha Parivartana Yoga** (wealth): 2nd and 11th lords.
- **Parakrama-Karma Parivartana Yoga** (benefic): 3rd and 10th lords.
- **Parakrama-Labha Parivartana Yoga** (benefic): 3rd and 11th lords.
- **Sukha-Vidya Parivartana Yoga** (benefic): 4th and 5th lords.
- **Sukha-Yuvati Parivartana Yoga** (benefic): 4th and 7th lords.
- **Sukha-Bhagya Parivartana Yoga** (wealth): 4th and 9th lords.
- **Sukha-Karma Parivartana Yoga** (wealth): 4th and 10th lords.
- **Sukha-Labha Parivartana Yoga** (wealth): 4th and 11th lords.
- **Vidya-Bhagya Parivartana Yoga** (benefic): 5th and 9th lords.
- **Vidya-Karma Parivartana Yoga** (wealth): 5th and 10th lords.
- **Vidya-Labha Parivartana Yoga** (wealth): 5th and 11th lords.
- **Shatru-Vyaya Parivartana Yoga** (reversal): 6th and 12th lords.
- **Yuvati-Karma Parivartana Yoga** (wealth): 7th and 10th lords.
- **Dharma-Karma Parivartana Yoga** (wealth): 9th and 10th lords.
- **Bhagya-Labha Parivartana Yoga** (wealth): 9th and 11th lords.
- **Karma-Labha Parivartana Yoga** (wealth): 10th and 11th lords.

**Khadga Yoga** (wealth) is a stricter version: the 2nd and 9th lords swap houses, and the 1st lord is also in an angle or a trine. The swap alone is not enough.

## 7. A planet in a set of houses

Strength comes from the planet's sign.

- **Surya Kendra Prabha Yoga** (benefic): the Sun is in the 1st, 4th, 7th or 10th house.
- **Chandra Kendra Saumya Yoga** (benefic): the Moon is in the 1st, 4th, 7th or 10th house.
- **Chandra Trikona Soma Yoga** (benefic): the Moon is in the 1st, 5th or 9th house.
- **Budha Upachaya Yoga** (benefic): Mercury is in the 3rd, 6th, 10th or 11th house.
- **Shukra Kendra Saundarya Yoga** (benefic): Venus is in the 1st, 4th, 7th or 10th house.
- **Mangala Upachaya Yoga** (benefic): Mars is in the 3rd, 6th, 10th or 11th house.
- **Guru Trikona Kripa Yoga** (benefic): Jupiter is in the 1st, 5th or 9th house.
- **Shani Upachaya Yoga** (benefic): Saturn is in the 3rd, 6th, 10th or 11th house.
- **Rahu Upachaya Yoga** (benefic): Rahu is in the 3rd, 6th, 10th or 11th house.
- **Ketu Moksha Yoga** (benefic): Ketu is in the 4th, 8th or 12th house.

## 8. A planet in one exact house

Strength comes from the planet's sign. The first seven are directional strength (digbala).

- **Budha Digbala Yoga** (benefic): Mercury is in the 1st house.
- **Guru Digbala Yoga** (benefic): Jupiter is in the 1st house.
- **Chandra Digbala Yoga** (benefic): the Moon is in the 4th house.
- **Shukra Digbala Yoga** (benefic): Venus is in the 4th house.
- **Shani Digbala Yoga** (benefic): Saturn is in the 7th house.
- **Surya Digbala Yoga** (wealth): the Sun is in the 10th house.
- **Mangala Digbala Yoga** (wealth): Mars is in the 10th house.
- **Guru Dhana Sthana Yoga** (wealth): Jupiter is in the 2nd house.
- **Guru Labha Sthana Yoga** (wealth): Jupiter is in the 11th house.
- **Chandra Bhagya Sthana Yoga** (benefic): the Moon is in the 9th house.
- **Shukra Vyaya Sthana Yoga** (benefic): Venus is in the 12th house.

## 9. Planets counted from the Sun, Moon or Jupiter

The planet counted from is never counted as one of the others. Strength is **strong** if there is at least one more planet than the minimum, otherwise **moderate**.

At least one planet needed:

- **Chandra Benefic Trine Yoga** (benefic): Jupiter, Venus or Mercury is 5th or 9th from the Moon.
- **Chandra Benefic Kendra Yoga** (benefic): Jupiter, Venus or Mercury is 1st, 4th, 7th or 10th from the Moon.
- **Moon Protected Yoga** (benefic): Jupiter or Venus is 1st, 5th, 7th or 9th from the Moon.
- **Chandra Malefic Upachaya Yoga** (benefic): the Sun, Mars, Saturn, Rahu or Ketu is 3rd, 6th, 10th or 11th from the Moon.
- **Surya Benefic Trine Yoga** (benefic): Jupiter, Venus or Mercury is 5th or 9th from the Sun.
- **Surya Malefic Upachaya Yoga** (benefic): Mars, Saturn, Rahu or Ketu is 3rd, 6th, 10th or 11th from the Sun.
- **Lagna Benefic Flank Yoga** (benefic): Jupiter, Venus or Mercury is 2nd or 12th from the Sun. Despite its name, this is counted from the Sun, not the Ascendant.

At least two planets needed:

- **Chandra Dusthana Papa Yoga** (challenging): two or more of the Sun, Mars, Saturn, Rahu and Ketu are 6th, 8th or 12th from the Moon.
- **Chandra Upachaya Shubha Yoga** (benefic): two or more of Jupiter, Venus and Mercury are 3rd, 6th or 11th from the Moon.
- **Surya Kendra Shubha Yoga** (benefic): two or more of Jupiter, Venus and Mercury are 1st, 4th, 7th or 10th from the Sun.
- **Surya Upachaya Papa Yoga** (benefic): two or more of Mars, Saturn, Rahu and Ketu are 3rd, 6th or 11th from the Sun.
- **Guru Kendra Shubha Yoga** (benefic): two or more of Mercury, Venus and the Moon are 1st, 4th, 7th or 10th from Jupiter.

## 10. Two planets in the same sign

Strength combines both planets. (Chandra-Mangal and Guru-Mangal in section 2 work the same way.)

- **Budha-Shukra Yoga** (benefic): Mercury and Venus.
- **Surya-Mangala Yoga** (benefic): the Sun and Mars.
- **Surya-Guru Yoga** (benefic): the Sun and Jupiter.
- **Surya-Shani Yoga** (challenging): the Sun and Saturn.
- **Chandra-Budha Yoga** (benefic): the Moon and Mercury.
- **Chandra-Shukra Yoga** (benefic): the Moon and Venus.
- **Chandra-Shani Yoga** (challenging): the Moon and Saturn.
- **Mangala-Budha Yoga** (benefic): Mars and Mercury.
- **Mangala-Shani Yoga** (challenging): Mars and Saturn.
- **Guru-Budha Yoga** (benefic): Jupiter and Mercury.
- **Guru-Shukra Yoga** (benefic): Jupiter and Venus.
- **Guru-Shani Yoga** (benefic): Jupiter and Saturn.
- **Guru-Chandala Yoga** (challenging): Jupiter and Rahu.
- **Shani-Budha Yoga** (benefic): Saturn and Mercury.
- **Shukra-Shani Yoga** (benefic): Venus and Saturn.
- **Rahu-Budha Yoga** (benefic): Rahu and Mercury.

## 11. Whole-chart patterns (Nabhasa)

These look at the shape of the whole chart. They use only the seven classical planets (Sun to Saturn) and ignore Rahu and Ketu. If any of the seven is missing, none of these are checked. Strength combines all the planets involved.

"Every house in the set is occupied" means each house in the set has at least one planet, and no classical planet is outside the set. This is stricter than the old texts, on purpose, so that one chart does not fire a dozen patterns.

**By sign type:**

- **Rajju**: all seven are in movable signs (Aries, Cancer, Libra, Capricorn).
- **Musala**: all seven are in fixed signs (Taurus, Leo, Scorpio, Aquarius).
- **Nala**: all seven are in dual signs (Gemini, Virgo, Sagittarius, Pisces).

**Who holds the angles:**

- **Mala**: Jupiter, Venus and Mercury are all in angles.
- **Sarpa**: the Sun, Mars and Saturn are all in angles.

**The shape the houses make** (every house in the set is occupied):

- **Gada**: two neighbouring angles: 1 and 4, 4 and 7, 7 and 10, or 10 and 1.
- **Shakata (pattern)**: houses 1 and 7. This is different from the Moon–Jupiter Shakata in section 3.
- **Vihaga**: houses 4 and 10.
- **Shringataka**: houses 1, 5 and 9.
- **Hala**: houses 2, 6 and 10, or 3, 7 and 11, or 4, 8 and 12.
- **Kamala**: houses 1, 4, 7 and 10.
- **Vapi**: houses 2, 5, 8 and 11, or 3, 6, 9 and 12.
- **Yupa**: houses 1 to 4.
- **Shara**: houses 4 to 7.
- **Shakti**: houses 7 to 10.
- **Danda**: houses 10 to 1 (10, 11, 12, 1).
- **Nauka**: houses 1 to 7, one planet in each.
- **Koota**: houses 4 to 10, one planet in each.
- **Chhatra**: houses 7 to 1, one planet in each.
- **Chapa**: houses 10 to 4, one planet in each.
- **Ardha Chandra**: seven houses in a row starting from a house that is not an angle, one planet in each.
- **Chakra**: the odd houses 1, 3, 5, 7, 9, 11.
- **Samudra**: the even houses 2, 4, 6, 8, 10, 12.

**Good and hard planets split:**

- **Vajra**: Jupiter, Venus and Mercury are all in house 1 or 7, and the Sun, Mars and Saturn are all in house 4 or 10. The Moon can be anywhere.

**How many signs the seven planets use:**

- **Gola**: one sign.
- **Yuga**: two signs.
- **Shula**: three signs.
- **Kedara**: four signs (section 2).
- **Pasa**: five signs.
- **Damini**: six signs.
- **Veena**: seven signs.

## 12. Six named yogas written in full

- **Chatussagara** (wealth): all four angles (1, 4, 7, 10) have at least one planet each.
- **Khadga** (wealth): the 2nd and 9th lords swap houses, and the 1st lord is in an angle or a trine.
- **Kusuma** (wealth): Venus is in an angle and in a fixed sign, the Moon is in the 5th or 9th house with a good planet sharing its sign or fully aspecting it, and Saturn is in the 10th house. Strength combines Venus, the Moon and Saturn.
- **Matsya** (benefic): hard planets are in the 1st and the 9th, the 5th has both a good and a hard planet, and there is no good planet in the 4th or the 8th. An empty 4th or 8th is fine.
- **Dhwaja** (wealth): every good planet is in the 1st house, and every classical hard planet (Sun, Mars, Saturn) is in the 8th. Strength comes from the good planets only.
- **Kurma** (benefic): every good planet is in house 5, 6 or 7, every classical hard planet is in house 1, 3 or 11, and every one of them is in a strong sign. Always strong. The old text also allows strength in the navamsa; this engine reads only the birth chart, so that option is left out.

---

# Known quirks

These are notes on how the code behaves today. They are not fixed here.

1. **`sasa` matches no yoga.** Career, Inheritance and Life Cycle list the yoga id `sasa`, but the Saturn great-person yoga's id is `shasha`. So Shasha Yoga never counts as yoga support for those three areas. (`lib/engines/life-domain-rules.ts`, `LIFE_DOMAIN_EVIDENCE_CONFIG`.)
2. **Every chart gets exactly one "how many signs" pattern.** Seven planets always fill between one and seven signs, so one of Gola, Yuga, Shula, Kedara, Pasa, Damini or Veena is always present. The code comment notes that the old texts use these only when no other pattern applies. The code does not apply that rule.
3. **Three yogas can never happen.** Mercury counts as a good planet here, and Mercury is never more than one sign away from the Sun. That makes these impossible:
   - Vajra (Mercury in 1st or 7th with the Sun in 4th or 10th).
   - Dhwaja (Mercury in the 1st with the Sun in the 8th).
   - Kurma (Mercury in 5th, 6th or 7th with the Sun in 1st, 3rd or 11th).

   In 20,000 random charts these three never appeared. Shakata (pattern), Vihaga, Kamala, Nauka, Chhatra and Gola also never appeared, but they are possible, just very rare.
4. **Some cancellations are never shown.** A weak yoga that is also cancelled scores below 30 and is hidden. So a cancelled Kemadruma, a combust Budhaditya, a Jupiter-softened Vish and a reduced Shakata never reach the page. The yoga simply disappears.
5. **Yava is not the classical Yava.** Here it means "at least three signs with exactly two planets each". Any chart like that also has Kedara.
6. **Very common yogas.** In 20,000 random charts, Dhanakaraka appeared about 96% of the time, Raja about 94%, and Chandra Malefic Upachaya about 90%. On their own they do not say much about one chart.
7. **The two modules use different good and hard planet lists** (see the table at the top). A planet can count as hard in a yoga and not count at all in the Ultimate Module. The Sun is the main example.
