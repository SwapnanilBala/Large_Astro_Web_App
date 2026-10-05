# German translation guide

`messages/de.json` holds every interface string in German (1,852 at the time
of writing). A new key needs its German alongside es, bn, hi, it and fr, in
the same staging file under `messages/fragments/` that the fold later merges
into the catalogs. The catalog tests check all six. These are the rules the
catalog was written to, so new strings read in the same voice.

## Voice

- **"du", never "Sie"**: du, dich, dir, dein, in lower case. This was the
  owner's choice. The classical notes the model writes are told the same,
  through `COMMENTARY_LANGUAGES.de` in `lib/varga-commentary.ts`.
- **Plain, warm and precise**, like the English. No exclamation marks the
  English does not have.
- **Never "KI"**, "künstliche Intelligenz" or "AI", as in every language.
  Naming sources ("aus dem Brihat Jataka") is fine.
- **Partners are gender-neutral.** The English always says "your partner".
  - Write "die Person an deiner Seite", "deine Partnerschaft" or "in deiner
    Partnerschaft".
  - Never write Ehemann or Ehefrau. Avoid a bare "dein Partner" or "deine
    Partnerin".
  - No gender star or colon.
  - The sex-at-birth answers are "Frau", "Mann" and "Keine Angabe".

## Mechanics

- **Keep every `{placeholder}`, `<b>` and `<strong>` tag**, "·" separator and
  glyph. A placeholder may move within the sentence.
- **A placeholder will hold a German word.** Build sentences that read
  correctly whatever lands there. Prefer forms without an article
  ("Aszendent {sign}", "{planet} in {sign}"), or a colon before a list
  ("Zum Fortfahren fehlt noch: {fields}.").
- **Typography:** „…“ quotation marks, spaced en dashes ( – ), a single "…"
  for an ellipsis, and ß as in standard German.
- **German runs about 30% longer than English.** Buttons, chips, tabs and
  column headers get the shortest natural word ("Haus", "Grad",
  "Ganzzeichen-Häuser"). The mobile chart and the settings summary are the
  tightest places.
- **Keep example inputs** ("Aarya Patel", "14 Mar 1995, 3:45 PM") as the
  English writes them. They show formats the intake accepts.

## Glossary

| English | German |
|---|---|
| birth chart / chart | Geburtshoroskop / Horoskop |
| reading / full reading | Deutung / vollständige Deutung |
| finding | Erkenntnis |
| placement | Stellung |
| ascendant, "{sign} rising" | Aszendent, "Aszendent {sign}" |
| lagna, graha, bhava, nakshatra, pada | Lagna, Graha, Bhava, Nakshatra, Pada |
| sign / zodiac sign | Zeichen / Tierkreiszeichen |
| Aries … Pisces | Widder, Stier, Zwillinge, Krebs, Löwe, Jungfrau, Waage, Skorpion, Schütze, Steinbock, Wassermann, Fische |
| planets | Sonne, Mond, Merkur, Venus, Mars, Jupiter, Saturn, Rahu, Ketu |
| chart abbreviations | So, Mo, Me, Ve, Ma, Ju, Sa, Ra, Ke; ascendant AC; retrograde R |
| house / house system | Haus / Häusersystem |
| Whole Sign / Equal / Porphyry houses | Ganzzeichen-Häuser / äquale Häuser / Porphyrius |
| lord (of a sign, house or nakshatra) | Herrscher |
| dasha, mahadasha, antardasha | die Dasha, Mahadasha, Antardasha |
| yoga | das Yoga (pl. Yogas); yoga names stay English ("Hamsa Yoga") |
| divisional chart | Teilhoroskop (Varga) |
| retrograde / combust | rückläufig / verbrannt |
| exalted / debilitated / own sign | erhöht / im Fall / eigenes Zeichen |
| benefic / malefic | wohltätig / übeltätig |
| aspect, conjunction, opposition, trine, square, sextile | Aspekt, Konjunktion, Opposition, Trigon, Quadrat, Sextil |
| sidereal / tropical | siderisch / tropisch |
| compatibility / synastry | Kompatibilität / Synastrie |
| palm reading (the feature) / palmistry (the art) | Handdeutung / Handlesekunst |
| life areas | Lebensbereiche |
| sign in / sign out / account | Anmelden / Abmelden / Konto |
| light / dark theme | helles / dunkles Design |
| date, time, place of birth | Geburtsdatum, Geburtszeit, Geburtsort |
| sex at birth | Geschlecht bei der Geburt |
