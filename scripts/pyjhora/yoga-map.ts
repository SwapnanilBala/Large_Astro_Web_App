/**
 * Which of our yogas has a counterpart in PyJHora, and what to expect of it.
 *
 * `ours` is a yoga_id from lib/engines/yoga-engine.ts. `theirs` is a function
 * in PyJHora's jhora.horoscope.chart.yoga module (called through its
 * `_from_planet_positions` form), or the special name "raja_yoga_pairs",
 * which asks jhora.horoscope.chart.raja_yoga for its raja yoga pairs.
 *
 * `expect` was first written from PyJHora's own one-line description of the
 * yoga, before any comparison was run. Where reading PyJHora's code later
 * showed the description does not match what the code checks, the pair
 * follows the code and its note says so (Srik, Shakata, Chatussagara).
 *
 *   same       the two describe the same combination, so a disagreement is
 *              a finding -- a bug on one side, or a reading of the rule that
 *              deserves a sentence in the docs.
 *   different  PyJHora's description already states a different rule, so
 *              disagreement is expected and the numbers only show how far
 *              apart the two definitions land.
 *
 * About 125 of our 200 yogas have no counterpart at all: the house-lord,
 * exchange, placement and karaka records are mostly this project's own
 * constructions, and PyJHora does not name them. Those are listed in the
 * report as unmatched rather than forced onto a near miss.
 */

export type YogaPair = {
  ours: string;
  theirs: string;
  expect: "same" | "different";
  note?: string;
};

export const YOGA_PAIRS: YogaPair[] = [
  // ── Pancha Mahapurusha ──
  { ours: "ruchaka", theirs: "ruchaka_yoga", expect: "same" },
  { ours: "bhadra", theirs: "bhadra_yoga", expect: "same" },
  { ours: "hamsa", theirs: "hamsa_yoga", expect: "same", note: "PyJHora's description lists Capricorn, Jupiter's debilitation sign, among the qualifying signs." },
  { ours: "malavya", theirs: "maalavya_yoga", expect: "same" },
  { ours: "shasha", theirs: "sasa_yoga", expect: "same" },

  // ── Moon, Sun and pair yogas ──
  { ours: "budhaditya", theirs: "nipuna_yoga", expect: "same", note: "Ours hides it when Mercury is within 3° of the Sun; detection itself is the same." },
  { ours: "chandra_mangal", theirs: "chandra_mangala_yoga", expect: "same" },
  { ours: "guru_mangal", theirs: "guru_mangala_yoga", expect: "different", note: "PyJHora also counts Jupiter and Mars 7th from each other." },
  { ours: "gajakesari", theirs: "gaja_kesari_yoga", expect: "different", note: "PyJHora also needs a benefic with Jupiter and Jupiter free of debilitation, combustion and enemy signs." },
  { ours: "amala", theirs: "amala_yoga", expect: "different", note: "PyJHora needs only benefics in the 10th; ours needs one benefic there." },
  { ours: "adhi", theirs: "adhi_yoga", expect: "same" },
  { ours: "sunapha", theirs: "sunaphaa_yoga", expect: "same" },
  { ours: "anapha", theirs: "anaphaa_yoga", expect: "same" },
  { ours: "durudhara", theirs: "duradhara_yoga", expect: "same" },
  { ours: "vesi", theirs: "vesi_yoga", expect: "same" },
  { ours: "vosi", theirs: "vosi_yoga", expect: "same" },
  { ours: "ubhayachari", theirs: "ubhayachara_yoga", expect: "same" },
  { ours: "kemadruma", theirs: "kemadruma_yoga", expect: "different", note: "PyJHora also checks the Moon's own sign and the angles from the ascendant." },
  { ours: "vish", theirs: "nishturabhashi_yoga", expect: "different", note: "PyJHora's is Moon with Saturn *without* Jupiter's aspect -- the case our page shows." },
  // Our Moon-Jupiter Shakata has no counterpart: PyJHora's sakata_yoga is
  // described as that yoga, but its code checks the Nabhasa figure (paired
  // with shakata_nabhasa below).

  // ── House-lord yogas ──
  { ours: "daridra", theirs: "dharidhra_yoga", expect: "same" },
  { ours: "harsha", theirs: "harsha_yoga", expect: "different", note: "PyJHora needs the 6th lord in the 6th; ours accepts any of 6, 8, 12." },
  { ours: "sarala", theirs: "sarala_yoga", expect: "different", note: "PyJHora needs the 8th lord in the 8th." },
  { ours: "vimala", theirs: "vimala_yoga", expect: "different", note: "PyJHora needs the 12th lord in the 12th." },
  { ours: "raja", theirs: "raja_yoga_pairs", expect: "different", note: "PyJHora's pairs count more kinds of association than a shared sign." },
  { ours: "lakshmi", theirs: "lakshmi_yoga", expect: "different" },
  { ours: "saraswati", theirs: "saraswathi_yoga", expect: "same" },
  { ours: "sankha", theirs: "sankha_yoga", expect: "same" },
  { ours: "kahala", theirs: "kahala_yoga", expect: "different", note: "PyJHora needs the 4th and 9th lords in mutual angles and a strong 1st lord." },
  { ours: "chamara", theirs: "chaamara_yoga", expect: "different" },
  { ours: "bheri", theirs: "bheri_yoga", expect: "different" },
  { ours: "mridanga", theirs: "mridanga_yoga", expect: "different" },
  { ours: "parvata", theirs: "parvata_yoga", expect: "different" },
  { ours: "kalanidhi", theirs: "kalaanidhi_yoga", expect: "different", note: "PyJHora needs both Mercury and Venus, and only the 2nd or 5th." },
  { ours: "pushkala", theirs: "pushkala_yoga", expect: "different" },
  { ours: "rajalakshana", theirs: "rajalakshana_yoga", expect: "different" },
  { ours: "lagna_adhi", theirs: "lagnaadhi_yoga", expect: "different" },
  { ours: "vasumati", theirs: "vasumathi_yoga", expect: "same" },
  { ours: "shubha_kartari", theirs: "subha_yoga", expect: "different", note: "PyJHora also counts a benefic in the 1st." },
  { ours: "papa_kartari", theirs: "asubha_yoga", expect: "different", note: "PyJHora also counts a malefic in the 1st." },

  // ── Nabhasa: sign type ──
  { ours: "rajju", theirs: "rajju_yoga", expect: "same" },
  { ours: "musala", theirs: "musala_yoga", expect: "same" },
  { ours: "nala", theirs: "nala_yoga", expect: "same" },

  // ── Nabhasa: who holds the angles ──
  { ours: "mala", theirs: "srik_yoga", expect: "same", note: "PyJHora describes Srik as every benefic in an angle, as ours reads Mala, but its code just calls maalaa_yoga." },
  { ours: "mala", theirs: "maalaa_yoga", expect: "different", note: "PyJHora's Maalaa counts three angles held by benefics." },
  { ours: "sarpa_nabhasa", theirs: "sarpa_yoga", expect: "different", note: "PyJHora counts three angles held by malefics." },
  { ours: "vajra", theirs: "vajra_yoga", expect: "same" },
  { ours: "yava", theirs: "yava_yoga", expect: "same" },

  // ── Nabhasa: the shape the houses make ──
  { ours: "gada", theirs: "gadaa_yoga", expect: "same" },
  { ours: "shakata_nabhasa", theirs: "sakata_yoga", expect: "same", note: "PyJHora describes sakata_yoga as the Moon-Jupiter Shakata, but its code checks this figure." },
  { ours: "vihaga", theirs: "vihanga_yoga", expect: "same" },
  { ours: "shringataka", theirs: "sringaataka_yoga", expect: "same" },
  { ours: "hala", theirs: "hala_yoga", expect: "same" },
  { ours: "kamala", theirs: "kamala_yoga", expect: "same" },
  { ours: "vapi", theirs: "vaapi_yoga", expect: "same" },
  { ours: "yupa", theirs: "yoopa_yoga", expect: "same" },
  { ours: "shara", theirs: "sara_yoga", expect: "same" },
  { ours: "shakti_nabhasa", theirs: "sakti_yoga", expect: "same" },
  { ours: "danda", theirs: "danda_yoga", expect: "same" },
  { ours: "nauka", theirs: "naukaa_yoga", expect: "same" },
  { ours: "koota", theirs: "koota_yoga", expect: "same" },
  { ours: "chhatra", theirs: "chatra_yoga", expect: "same" },
  { ours: "chapa", theirs: "chaapa_yoga", expect: "same" },
  { ours: "ardha_chandra", theirs: "ardha_chandra_yoga", expect: "same" },
  { ours: "chakra", theirs: "chakra_yoga", expect: "same" },
  { ours: "samudra", theirs: "samudra_yoga", expect: "same" },

  // ── Nabhasa: how many signs ──
  { ours: "gola", theirs: "gola_yoga", expect: "same" },
  { ours: "yuga_nabhasa", theirs: "yuga_yoga", expect: "same" },
  { ours: "shula", theirs: "soola_yoga", expect: "same" },
  { ours: "kedara", theirs: "kedaara_yoga", expect: "same" },
  { ours: "pasa", theirs: "paasa_yoga", expect: "same" },
  { ours: "damini", theirs: "daama_yoga", expect: "same" },
  { ours: "veena", theirs: "veenaa_yoga", expect: "same" },

  // ── Named yogas written in full ──
  { ours: "chatussagara", theirs: "chatussagara_yoga", expect: "same", note: "PyJHora's description says every planet in an angle, but its code checks every angle occupied, as ours does." },
  { ours: "khadga", theirs: "khadga_yoga", expect: "same" },
  { ours: "kusuma", theirs: "kusuma_yoga", expect: "different", note: "PyJHora also needs a fixed-sign ascendant." },
  { ours: "matsya", theirs: "matsya_yoga", expect: "different", note: "PyJHora follows B.V. Raman's wording, which places the planets differently." },
  { ours: "kurma", theirs: "koorma_yoga", expect: "different" },

  // ── Navamsa yogas (PyJHora is handed a navamsa it builds from our longitudes) ──
  { ours: "gauri", theirs: "gouri_yoga", expect: "same" },
  { ours: "bharathi", theirs: "bhaarathi_yoga", expect: "same" },
  { ours: "kalpadruma", theirs: "kalpadruma_yoga", expect: "different", note: "PyJHora accepts each planet angular or trinal *or* exalted, and checks the navamsa too; ours needs both conditions in the birth chart." },
];
