import type {
  ConjunctionRecipe,
  HouseLordPlacementRecipe,
  MutualHouseLordRecipe,
  PlanetHouseRecipe,
  RelativePlanetRecipe,
  YogaDefinition,
} from "../types";
import { NATURAL_BENEFICS, NATURAL_MALEFICS } from "../tables";
import {
  createConjunctionYoga,
  createHouseLordPlacementYoga,
  createMutualHouseLordYoga,
  createPlanetHouseYoga,
  createRelativePlanetYoga,
} from "../factories";
import {
  BHAVA_PHALA_SOURCE,
  CONJUNCTION_SOURCE,
  DIGBALA_SOURCE,
  KARAKA_RELATIVE_SOURCE,
  PARIVARTANA_SOURCE,
} from "./sources";

// --------------------------------------------------------------------------
/*
 * Mantreswara sorts the 66 possible exchanges into three classes, and the
 * class is decided entirely by which houses are involved:
 *
 *   Maha    both lords belong to the eight good houses (1, 2, 4, 5, 7, 9,
 *           10, 11). 28 pairs. Read as straightforwardly favourable.
 *   Khala   the 3rd lord exchanges with one of those eight. 8 pairs. Mixed:
 *           effort is rewarded, but unevenly.
 *   Dainya  at least one of the six, eight or twelve is involved. 30 pairs.
 *           The difficult class, and the one where the repo already carries
 *           the 6-12 exchange as a viparita result rather than a plain loss.
 *
 * Eight exchanges already exist above. These are the rest of the ones worth
 * printing -- the exchange is a real and fairly common configuration, so the
 * cut is about which ones say something a reader can act on, not about which
 * ones are valid.
 */

const CLASSICAL_MUTUAL_LORD_RECIPES: MutualHouseLordRecipe[] = [
  // ── Maha parivartana ──
  { id: "lagna_sukha_parivartana", name: "Lagna-Sukha Parivartana Yoga", sanskrit: "लग्न-सुख परिवर्तन", category: "benefic", houseA: 1, houseB: 4, source: PARIVARTANA_SOURCE,
    description: "The 1st and 4th lords exchange houses.", effects: "Ties who you are to where you live. Home, land and family become the ground your confidence stands on, and a settled base is worth more to you than most people assume.", activation_timing: "moves, property decisions, and the periods of the 1st and 4th lords", key_traits: ["rootedness", "belonging", "security"] },
  { id: "lagna_vidya_parivartana", name: "Lagna-Vidya Parivartana Yoga", sanskrit: "लग्न-विद्या परिवर्तन", category: "benefic", houseA: 1, houseB: 5, source: PARIVARTANA_SOURCE,
    description: "The 1st and 5th lords exchange houses.", effects: "What you make is read as who you are. Creative work, teaching and children carry your identity, and recognition tends to arrive through something you produced rather than a post you held.", activation_timing: "creative projects, the birth or raising of children, and the periods of the 1st and 5th lords", key_traits: ["creativity", "self-expression", "recognition"] },
  { id: "lagna_yuvati_parivartana", name: "Lagna-Yuvati Parivartana Yoga", sanskrit: "लग्न-युवति परिवर्तन", category: "benefic", houseA: 1, houseB: 7, source: PARIVARTANA_SOURCE,
    description: "The 1st and 7th lords exchange houses.", effects: "Identity and partnership are hard to separate. You define yourself through the people you commit to, which makes partnership unusually decisive for better and worse.", activation_timing: "marriage, business partnerships, and the periods of the 1st and 7th lords", key_traits: ["partnership", "reciprocity", "dependence"] },
  { id: "lagna_bhagya_parivartana", name: "Lagna-Bhagya Parivartana Yoga", sanskrit: "लग्न-भाग्य परिवर्तन", category: "wealth", houseA: 1, houseB: 9, source: PARIVARTANA_SOURCE,
    description: "The 1st and 9th lords exchange houses.", effects: "One of the strongest exchanges. Luck attaches to the person rather than the circumstance: doors open, mentors appear, and long odds come in more often than they should.", activation_timing: "periods of the 1st and 9th lords, higher study, and long journeys", key_traits: ["fortune", "guidance", "conviction"] },
  { id: "lagna_karma_parivartana", name: "Lagna-Karma Parivartana Yoga", sanskrit: "लग्न-कर्म परिवर्तन", category: "wealth", houseA: 1, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 1st and 10th lords exchange houses.", effects: "Your work is your name. Standing is built personally rather than institutionally, which makes reputation portable and also makes it yours to lose.", activation_timing: "promotions, changes of profession, and the periods of the 1st and 10th lords", key_traits: ["standing", "ambition", "visibility"] },
  { id: "lagna_labha_parivartana", name: "Lagna-Labha Parivartana Yoga", sanskrit: "लग्न-लाभ परिवर्तन", category: "wealth", houseA: 1, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 1st and 11th lords exchange houses.", effects: "Gains follow from being yourself in public. Networks form around you rather than being joined, and income tends to arrive through people who already know your name.", activation_timing: "periods of the 1st and 11th lords, and stretches of widening social reach", key_traits: ["gain", "network", "influence"] },
  { id: "dhana_sukha_parivartana", name: "Dhana-Sukha Parivartana Yoga", sanskrit: "धन-सुख परिवर्तन", category: "wealth", houseA: 2, houseB: 4, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 4th lords exchange houses.", effects: "Money turns into property and property back into money. Savings tend to take physical form -- a house, land, things kept rather than spent.", activation_timing: "property purchases, inheritance, and the periods of the 2nd and 4th lords", key_traits: ["assets", "thrift", "domestic comfort"] },
  { id: "dhana_vidya_parivartana", name: "Dhana-Vidya Parivartana Yoga", sanskrit: "धन-विद्या परिवर्तन", category: "wealth", houseA: 2, houseB: 5, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 5th lords exchange houses.", effects: "Earning follows from something you made or knew first. Speculation, teaching and creative work pay, and the family's resources often back the first venture.", activation_timing: "creative ventures, investments, and the periods of the 2nd and 5th lords", key_traits: ["earning", "invention", "speculation"] },
  { id: "dhana_bhagya_parivartana", name: "Dhana-Bhagya Parivartana Yoga", sanskrit: "धन-भाग्य परिवर्तन", category: "wealth", houseA: 2, houseB: 9, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 9th lords exchange houses.", effects: "Wealth and good fortune reinforce each other, often through family, teachers or a tradition you were handed. Generosity with money tends to return more than it costs.", activation_timing: "inheritance, patronage, and the periods of the 2nd and 9th lords", key_traits: ["prosperity", "patronage", "generosity"] },
  { id: "dhana_karma_parivartana", name: "Dhana-Karma Parivartana Yoga", sanskrit: "धन-कर्म परिवर्तन", category: "wealth", houseA: 2, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 10th lords exchange houses.", effects: "Income and profession are the same engine. Career decisions are also money decisions, and the surest route to more of one is more of the other.", activation_timing: "salary negotiations, career moves, and the periods of the 2nd and 10th lords", key_traits: ["income", "profession", "practicality"] },
  { id: "sukha_vidya_parivartana", name: "Sukha-Vidya Parivartana Yoga", sanskrit: "सुख-विद्या परिवर्तन", category: "benefic", houseA: 4, houseB: 5, source: PARIVARTANA_SOURCE,
    description: "The 4th and 5th lords exchange houses.", effects: "Home is where the making happens. Study, creative work and children are bound up with the household, and a settled domestic base is what unlocks the rest.", activation_timing: "study at home, raising children, and the periods of the 4th and 5th lords", key_traits: ["learning", "nurture", "domestic creativity"] },
  { id: "sukha_bhagya_parivartana", name: "Sukha-Bhagya Parivartana Yoga", sanskrit: "सुख-भाग्य परिवर्तन", category: "wealth", houseA: 4, houseB: 9, source: PARIVARTANA_SOURCE,
    description: "The 4th and 9th lords exchange houses.", effects: "Fortune arrives through roots -- family, land, an inherited belief or a place you came from. Moving far from that source tends to cost more than it gains.", activation_timing: "property and ancestral matters, pilgrimage, and the periods of the 4th and 9th lords", key_traits: ["inheritance", "faith", "place"] },
  { id: "sukha_karma_parivartana", name: "Sukha-Karma Parivartana Yoga", sanskrit: "सुख-कर्म परिवर्तन", category: "wealth", houseA: 4, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 4th and 10th lords exchange houses.", effects: "Home and career trade places repeatedly: working from home, a family business, or a profession that keeps relocating the household. Neither settles without the other.", activation_timing: "relocations for work, and the periods of the 4th and 10th lords", key_traits: ["balance", "relocation", "family enterprise"] },
  { id: "vidya_karma_parivartana", name: "Vidya-Karma Parivartana Yoga", sanskrit: "विद्या-कर्म परिवर्तन", category: "wealth", houseA: 5, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 5th and 10th lords exchange houses.", effects: "You are paid for what you invent. Career advances through original work rather than seniority, and the best professional years follow a creative risk rather than precede one.", activation_timing: "launches, publications, and the periods of the 5th and 10th lords", key_traits: ["originality", "advancement", "risk"] },
  { id: "vidya_labha_parivartana", name: "Vidya-Labha Parivartana Yoga", sanskrit: "विद्या-लाभ परिवर्तन", category: "wealth", houseA: 5, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 5th and 11th lords exchange houses.", effects: "Creative work converts directly into gain and into a following. Audiences, students and communities form around what you make.", activation_timing: "the periods of the 5th and 11th lords, and stretches when an audience grows", key_traits: ["audience", "return", "invention"] },
  { id: "yuvati_karma_parivartana", name: "Yuvati-Karma Parivartana Yoga", sanskrit: "युवति-कर्म परिवर्तन", category: "wealth", houseA: 7, houseB: 10, source: PARIVARTANA_SOURCE,
    description: "The 7th and 10th lords exchange houses.", effects: "Career runs on partnership: a co-founder, a spouse who is also a colleague, or clients who become collaborators. Working alone underperforms the chart.", activation_timing: "partnership agreements, joint ventures, and the periods of the 7th and 10th lords", key_traits: ["collaboration", "negotiation", "joint work"] },
  { id: "bhagya_labha_parivartana", name: "Bhagya-Labha Parivartana Yoga", sanskrit: "भाग्य-लाभ परिवर्तन", category: "wealth", houseA: 9, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 9th and 11th lords exchange houses.", effects: "Luck and gain feed each other. Mentors turn into opportunities and opportunities into income, often through a wider circle than the immediate one.", activation_timing: "the periods of the 9th and 11th lords, and stretches of travel or higher study", key_traits: ["opportunity", "mentorship", "gain"] },
  { id: "sukha_labha_parivartana", name: "Sukha-Labha Parivartana Yoga", sanskrit: "सुख-लाभ परिवर्तन", category: "wealth", houseA: 4, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 4th and 11th lords exchange houses.", effects: "Comfort and income are linked: gains go into the home, and the home is itself a source of gain. Vehicles and property feature more than average.", activation_timing: "property and vehicle purchases, and the periods of the 4th and 11th lords", key_traits: ["comfort", "acquisition", "provision"] },

  // ── Khala parivartana -- the 3rd lord's exchanges ──
  { id: "parakrama_labha_parivartana", name: "Parakrama-Labha Parivartana Yoga", sanskrit: "पराक्रम-लाभ परिवर्तन", category: "benefic", houseA: 3, houseB: 11, source: PARIVARTANA_SOURCE,
    description: "The 3rd and 11th lords exchange houses -- a Khala exchange, where effort and gain are tied together but unevenly.", effects: "Gains come from initiative rather than position: self-started work, side ventures, siblings and peers. Rewards are real but arrive in steps rather than at once.", activation_timing: "the periods of the 3rd and 11th lords, and stretches of independent effort", key_traits: ["initiative", "enterprise", "incremental gain"] },

  // ── Dainya parivartana -- one lord from the difficult houses ──
  { id: "lagna_shatru_parivartana", name: "Lagna-Shatru Parivartana Yoga", sanskrit: "लग्न-शत्रु परिवर्तन", category: "viparita", houseA: 1, houseB: 6, source: PARIVARTANA_SOURCE,
    description: "The 1st and 6th lords exchange houses -- a Dainya exchange, read here as the viparita case rather than a plain loss.", effects: "You are defined partly by what you are up against. Health, debts and rivals demand attention early, and the competence built in handling them becomes the thing you are known for.", activation_timing: "the periods of the 1st and 6th lords, and stretches of open competition", key_traits: ["struggle", "competence", "endurance"] },
  { id: "lagna_vyaya_parivartana", name: "Lagna-Vyaya Parivartana Yoga", sanskrit: "लग्न-व्यय परिवर्तन", category: "viparita", houseA: 1, houseB: 12, source: PARIVARTANA_SOURCE,
    description: "The 1st and 12th lords exchange houses -- a Dainya exchange touching identity and release.", effects: "Identity is bound up with what is given away, withdrawn from or done elsewhere. Foreign places, solitude and behind-the-scenes work suit better than the front of the room.", activation_timing: "the periods of the 1st and 12th lords, foreign residence, and retreats", key_traits: ["retreat", "detachment", "foreign ground"] },
  { id: "dhana_randhra_parivartana", name: "Dhana-Randhra Parivartana Yoga", sanskrit: "धन-रन्ध्र परिवर्तन", category: "viparita", houseA: 2, houseB: 8, source: PARIVARTANA_SOURCE,
    description: "The 2nd and 8th lords exchange houses -- the classic Dainya exchange on the money axis.", effects: "Earned money and other people's money keep changing places: inheritance, joint accounts, insurance, debt. Fortunes shift suddenly in both directions, and what arrives unearned rarely stays unexamined.", activation_timing: "inheritance, settlements, and the periods of the 2nd and 8th lords", key_traits: ["upheaval", "inheritance", "reversal"] },
];

// --------------------------------------------------------------------------
// House-lord placements -- the bhava-phala material
// --------------------------------------------------------------------------
/*
 * The classical texts spend their longest chapters on one question: what
 * happens when the lord of house X sits in house Y. Nine of these are the
 * simplest and strongest case -- a lord in its own house, which every text
 * treats as a plain statement of that department working. The other six are
 * the cross-placements that carry a named, specific result.
 */

const CLASSICAL_HOUSE_LORD_RECIPES: HouseLordPlacementRecipe[] = [
  { id: "lagna_lord_own_house", name: "Lagna Swagruhi Yoga", sanskrit: "लग्न स्वगृही योग", category: "benefic", fromHouse: 1, targetHouses: [1], source: BHAVA_PHALA_SOURCE,
    description: "The 1st lord occupies the 1st house.", effects: "Self-possession that does not need propping up. Health and constitution are sound, and the sense of who you are stays stable through changes that unsettle other people.", activation_timing: "the period of the 1st lord, and any stretch demanding a clear sense of self", key_traits: ["self-possession", "vitality", "steadiness"] },
  { id: "dhana_lord_own_house", name: "Dhana Swagruhi Yoga", sanskrit: "धन स्वगृही योग", category: "wealth", fromHouse: 2, targetHouses: [2], source: BHAVA_PHALA_SOURCE,
    description: "The 2nd lord occupies the 2nd house.", effects: "Money stays where it is put. Savings accumulate without drama, family resources hold, and speech carries a weight that helps in negotiation.", activation_timing: "the period of the 2nd lord, and stretches of consolidation", key_traits: ["savings", "stability", "articulacy"] },
  { id: "parakrama_lord_own_house", name: "Parakrama Swagruhi Yoga", sanskrit: "पराक्रम स्वगृही योग", category: "benefic", fromHouse: 3, targetHouses: [3], source: BHAVA_PHALA_SOURCE,
    description: "The 3rd lord occupies the 3rd house.", effects: "Nerve and initiative are reliable rather than occasional. Siblings and peers are a genuine resource, and self-started effort usually finds its footing.", activation_timing: "the period of the 3rd lord, and any stretch requiring you to start something alone", key_traits: ["courage", "initiative", "stamina"] },
  { id: "sukha_lord_own_house", name: "Sukha Swagruhi Yoga", sanskrit: "सुख स्वगृही योग", category: "benefic", fromHouse: 4, targetHouses: [4], source: BHAVA_PHALA_SOURCE,
    description: "The 4th lord occupies the 4th house.", effects: "A secure base: home, land and the people in it hold steady. Peace of mind is available at home in a way it is not everywhere else.", activation_timing: "the period of the 4th lord, property matters, and family stretches", key_traits: ["security", "comfort", "belonging"] },
  { id: "vidya_lord_own_house", name: "Vidya Swagruhi Yoga", sanskrit: "विद्या स्वगृही योग", category: "benefic", fromHouse: 5, targetHouses: [5], source: BHAVA_PHALA_SOURCE,
    description: "The 5th lord occupies the 5th house.", effects: "Intelligence and creative capacity work without being forced. Learning comes readily, judgement is sound, and children and creative work both go well.", activation_timing: "the period of the 5th lord, study, and creative projects", key_traits: ["intelligence", "creativity", "judgement"] },
  { id: "yuvati_lord_own_house", name: "Yuvati Swagruhi Yoga", sanskrit: "युवति स्वगृही योग", category: "benefic", fromHouse: 7, targetHouses: [7], source: BHAVA_PHALA_SOURCE,
    description: "The 7th lord occupies the 7th house.", effects: "Partnership holds its shape. Agreements stick, the spouse or business partner is a genuine counterweight, and negotiation is a strength rather than a chore.", activation_timing: "the period of the 7th lord, marriage, and contract negotiations", key_traits: ["partnership", "agreement", "balance"] },
  { id: "bhagya_lord_own_house", name: "Bhagya Swagruhi Yoga", sanskrit: "भाग्य स्वगृही योग", category: "wealth", fromHouse: 9, targetHouses: [9], source: BHAVA_PHALA_SOURCE,
    description: "The 9th lord occupies the 9th house.", effects: "Good fortune is structural rather than lucky. Teachers, father and belief all support rather than complicate, and long journeys tend to repay themselves.", activation_timing: "the period of the 9th lord, higher study, and long journeys", key_traits: ["fortune", "conviction", "guidance"] },
  { id: "karma_lord_own_house", name: "Karma Swagruhi Yoga", sanskrit: "कर्म स्वगृही योग", category: "wealth", fromHouse: 10, targetHouses: [10], source: BHAVA_PHALA_SOURCE,
    description: "The 10th lord occupies the 10th house.", effects: "Professional standing is solid and self-sustaining. Work is recognised on its merits, and authority once given is not easily taken back.", activation_timing: "the period of the 10th lord, and the stretches that set professional direction", key_traits: ["standing", "competence", "authority"] },
  { id: "labha_lord_own_house", name: "Labha Swagruhi Yoga", sanskrit: "लाभ स्वगृही योग", category: "wealth", fromHouse: 11, targetHouses: [11], source: BHAVA_PHALA_SOURCE,
    description: "The 11th lord occupies the 11th house.", effects: "Income arrives reliably and from more than one direction. Friendships and networks are durable, and what you ask for is usually granted.", activation_timing: "the period of the 11th lord, and stretches of widening contact", key_traits: ["gain", "network", "fulfilment"] },

  { id: "sukha_lord_karma", name: "Sukha-Karma Sthana Yoga", sanskrit: "सुख-कर्म स्थान योग", category: "wealth", fromHouse: 4, targetHouses: [10], source: BHAVA_PHALA_SOURCE,
    description: "The 4th lord occupies the 10th house.", effects: "The home life is carried into the working one: a family trade, a profession built on property or land, or work that visibly provides for the household.", activation_timing: "the period of the 4th lord, and career stretches involving property", key_traits: ["provision", "enterprise", "duty"] },
  { id: "karma_lord_sukha", name: "Karma-Sukha Sthana Yoga", sanskrit: "कर्म-सुख स्थान योग", category: "benefic", fromHouse: 10, targetHouses: [4], source: BHAVA_PHALA_SOURCE,
    description: "The 10th lord occupies the 4th house.", effects: "Work is conducted from home, or for the sake of it. Career ambitions are measured against domestic peace, and the chart is content to trade some of the first for the second.", activation_timing: "the period of the 10th lord, and stretches of working from a home base", key_traits: ["contentment", "home enterprise", "balance"] },
  { id: "bhagya_lord_vidya", name: "Bhagya-Vidya Sthana Yoga", sanskrit: "भाग्य-विद्या स्थान योग", category: "wealth", fromHouse: 9, targetHouses: [5], source: BHAVA_PHALA_SOURCE,
    description: "The 9th lord occupies the 5th house.", effects: "Fortune comes through learning and through children. Advice given is taken, teaching pays, and the second half of life is the better half.", activation_timing: "the period of the 9th lord, teaching work, and matters concerning children", key_traits: ["wisdom", "merit", "teaching"] },
  { id: "vidya_lord_bhagya_placement", name: "Vidya-Bhagya Sthana Yoga", sanskrit: "विद्या-भाग्य स्थान योग", category: "wealth", fromHouse: 5, targetHouses: [9], source: BHAVA_PHALA_SOURCE,
    description: "The 5th lord occupies the 9th house.", effects: "What you make carries further than expected. Creative and intellectual work finds an audience beyond its origin, often abroad or across a generation.", activation_timing: "the period of the 5th lord, publication, and long journeys", key_traits: ["reach", "merit", "recognition"] },
  { id: "labha_lord_dhana", name: "Labha-Dhana Sthana Yoga", sanskrit: "लाभ-धन स्थान योग", category: "wealth", fromHouse: 11, targetHouses: [2], source: BHAVA_PHALA_SOURCE,
    description: "The 11th lord occupies the 2nd house.", effects: "Gains convert straight into holdings rather than being spent on the way. Income from several directions collects in one place.", activation_timing: "the period of the 11th lord, and stretches of consolidation", key_traits: ["accumulation", "income", "consolidation"] },
  { id: "dhana_lord_bhagya", name: "Dhana-Bhagya Sthana Yoga", sanskrit: "धन-भाग्य स्थान योग", category: "wealth", fromHouse: 2, targetHouses: [9], source: BHAVA_PHALA_SOURCE,
    description: "The 2nd lord occupies the 9th house.", effects: "Money follows belief and mentorship. Resources arrive through teachers, family tradition or work done far from home, and giving some of it away is part of how it grows.", activation_timing: "the period of the 2nd lord, patronage, and long journeys", key_traits: ["patronage", "prosperity", "generosity"] },
];

// --------------------------------------------------------------------------
// Directional strength and classical single-planet placements
// --------------------------------------------------------------------------
/*
 * Digbala -- directional strength -- is the oldest single-planet rule in the
 * system and the least ambiguous: each planet has one house where it is at
 * full power, and the four answers pair up. Mercury and Jupiter are strongest
 * rising, the Sun and Mars at the midheaven, the Moon and Venus at the nadir,
 * Saturn setting. Seven records, one per planet, plus four placements that
 * carry a distinct classical result of their own.
 */

const CLASSICAL_PLANET_HOUSE_RECIPES: PlanetHouseRecipe[] = [
  { id: "budha_digbala", name: "Budha Digbala Yoga", sanskrit: "बुध दिग्बल योग", category: "benefic", planet: "Mercury", targetHouses: [1], source: DIGBALA_SOURCE,
    description: "Mercury occupies the 1st house, its place of directional strength.", effects: "Thinking and speaking are the chart's sharpest instruments. Quick comprehension, fluency under pressure, and a manner that reads as younger than the age.", activation_timing: "Mercury periods, examinations, negotiations, and any work built on explanation", key_traits: ["intellect", "fluency", "quickness"] },
  { id: "guru_digbala", name: "Guru Digbala Yoga", sanskrit: "गुरु दिग्बल योग", category: "benefic", planet: "Jupiter", targetHouses: [1], source: DIGBALA_SOURCE,
    description: "Jupiter occupies the 1st house, its place of directional strength.", effects: "Protection that shows up in the person rather than the circumstances. Optimism, a settled moral sense, and the benefit of the doubt from people who barely know you.", activation_timing: "Jupiter periods, and stretches where reputation or goodwill decides the outcome", key_traits: ["protection", "optimism", "good faith"] },
  { id: "surya_digbala", name: "Surya Digbala Yoga", sanskrit: "सूर्य दिग्बल योग", category: "wealth", planet: "Sun", targetHouses: [10], source: DIGBALA_SOURCE,
    description: "The Sun occupies the 10th house, its place of directional strength.", effects: "Authority in the working life is the chart's clearest promise. Visible position, a name that carries, and the expectation of being in charge rather than consulted.", activation_timing: "Sun periods, promotions, and stretches of public responsibility", key_traits: ["authority", "visibility", "command"] },
  { id: "mangala_digbala", name: "Mangala Digbala Yoga", sanskrit: "मङ्गल दिग्बल योग", category: "wealth", planet: "Mars", targetHouses: [10], source: DIGBALA_SOURCE,
    description: "Mars occupies the 10th house, its place of directional strength.", effects: "Drive applied directly to work. Capacity for hard, technical or contested professions, and a habit of finishing what is started even when the cost rises.", activation_timing: "Mars periods, competitive appointments, and stretches of sustained effort", key_traits: ["drive", "execution", "competitiveness"] },
  { id: "chandra_digbala", name: "Chandra Digbala Yoga", sanskrit: "चन्द्र दिग्बल योग", category: "benefic", planet: "Moon", targetHouses: [4], source: DIGBALA_SOURCE,
    description: "The Moon occupies the 4th house, its place of directional strength.", effects: "Emotional footing is sound and home is genuinely restorative. Instinct about people is accurate, and the mother or the place you were raised remains a resource.", activation_timing: "Moon periods, domestic stretches, and any time the ground needs steadying", key_traits: ["contentment", "instinct", "nurture"] },
  { id: "shukra_digbala", name: "Shukra Digbala Yoga", sanskrit: "शुक्र दिग्बल योग", category: "benefic", planet: "Venus", targetHouses: [4], source: DIGBALA_SOURCE,
    description: "Venus occupies the 4th house, its place of directional strength.", effects: "Comfort and beauty gather at home: pleasant surroundings, vehicles, a household people want to be in. Taste is a real asset rather than a decoration.", activation_timing: "Venus periods, property and vehicle purchases, and domestic improvement", key_traits: ["comfort", "taste", "ease"] },
  { id: "shani_digbala", name: "Shani Digbala Yoga", sanskrit: "शनि दिग्बल योग", category: "benefic", planet: "Saturn", targetHouses: [7], source: DIGBALA_SOURCE,
    description: "Saturn occupies the 7th house, its place of directional strength.", effects: "Commitments are entered slowly and kept. Partnership matures late and lasts, and agreements carry a seriousness other people rely on.", activation_timing: "Saturn periods, long contracts, and marriage later rather than earlier", key_traits: ["durability", "commitment", "patience"] },

  { id: "guru_dhana_sthana", name: "Guru Dhana Sthana Yoga", sanskrit: "गुरु धन स्थान योग", category: "wealth", planet: "Jupiter", targetHouses: [2], source: BHAVA_PHALA_SOURCE,
    description: "Jupiter occupies the 2nd house.", effects: "Resources expand rather than merely accumulate, and speech carries authority. Family wealth and learning tend to arrive together.", activation_timing: "Jupiter periods, and stretches of family or financial expansion", key_traits: ["abundance", "authority", "learning"] },
  { id: "shukra_vyaya_sthana", name: "Shukra Vyaya Sthana Yoga", sanskrit: "शुक्र व्यय स्थान योग", category: "benefic", planet: "Venus", targetHouses: [12], source: BHAVA_PHALA_SOURCE,
    description: "Venus occupies the 12th house -- counted a strong placement for Venus specifically, where the same house weakens most planets.", effects: "Pleasure in solitude, in foreign places, and in what is given away. Private life is richer than the public one, and comfort abroad comes easily.", activation_timing: "Venus periods, foreign residence, and retreats", key_traits: ["privacy", "indulgence", "foreign comfort"] },
  { id: "chandra_bhagya_sthana", name: "Chandra Bhagya Sthana Yoga", sanskrit: "चन्द्र भाग्य स्थान योग", category: "benefic", planet: "Moon", targetHouses: [9], source: BHAVA_PHALA_SOURCE,
    description: "The Moon occupies the 9th house.", effects: "Belief is felt rather than argued. Long journeys settle the mind, teachers are found at the right moment, and the instinct about which direction to take is usually right.", activation_timing: "Moon periods, pilgrimage and long journeys, and stretches of study", key_traits: ["faith", "instinct", "journeying"] },
  { id: "guru_labha_sthana", name: "Guru Labha Sthana Yoga", sanskrit: "गुरु लाभ स्थान योग", category: "wealth", planet: "Jupiter", targetHouses: [11], source: BHAVA_PHALA_SOURCE,
    description: "Jupiter occupies the 11th house.", effects: "Gains arrive steadily and from people who mean well. Elder friends and patrons matter, and what is asked for is usually granted in some form.", activation_timing: "Jupiter periods, and stretches when a network widens", key_traits: ["gain", "patronage", "fulfilment"] },
];

// --------------------------------------------------------------------------
// Two-planet combinations
// --------------------------------------------------------------------------
/*
 * Saravali works through the pairs systematically -- what it means when any
 * two grahas share a sign. Five of those pairs are already above; these are
 * eleven more, including the two the tradition treats as genuinely difficult
 * rather than merely mixed (Moon with Saturn, Jupiter with Rahu).
 */

const CLASSICAL_CONJUNCTION_RECIPES: ConjunctionRecipe[] = [
  { id: "surya_shani_yoga", name: "Surya-Shani Yoga", sanskrit: "सूर्य-शनि योग", category: "challenging", planets: ["Sun", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "The Sun and Saturn are conjunct.", effects: "Authority and restraint pull against each other. Recognition comes late and has to be earned twice; the compensation is a capacity for responsibility that younger people do not have.", activation_timing: "Sun and Saturn periods, and stretches involving fathers, superiors or delayed recognition", key_traits: ["restraint", "delay", "responsibility"] },
  { id: "surya_guru_yoga", name: "Surya-Guru Yoga", sanskrit: "सूर्य-गुरु योग", category: "benefic", planets: ["Sun", "Jupiter"], source: CONJUNCTION_SOURCE,
    description: "The Sun and Jupiter are conjunct.", effects: "Standing and principle reinforce each other. Advice is sought, positions of trust arrive, and authority is exercised with a light enough hand to be accepted.", activation_timing: "Sun and Jupiter periods, advisory appointments, and teaching work", key_traits: ["integrity", "counsel", "standing"] },
  { id: "chandra_budha_yoga", name: "Chandra-Budha Yoga", sanskrit: "चन्द्र-बुध योग", category: "benefic", planets: ["Moon", "Mercury"], source: CONJUNCTION_SOURCE,
    description: "The Moon and Mercury are conjunct.", effects: "Feeling and articulation work together. What is sensed can be said, which makes for persuasive writing and speech and an unusually accurate read on a room.", activation_timing: "Moon and Mercury periods, writing and speaking work, and negotiations", key_traits: ["expression", "perception", "wit"] },
  { id: "chandra_shukra_yoga", name: "Chandra-Shukra Yoga", sanskrit: "चन्द्र-शुक्र योग", category: "benefic", planets: ["Moon", "Venus"], source: CONJUNCTION_SOURCE,
    description: "The Moon and Venus are conjunct.", effects: "Warmth that people are drawn to. Aesthetic instinct is strong, domestic life is pleasant, and affection is given freely enough to be returned.", activation_timing: "Moon and Venus periods, and stretches of domestic or artistic focus", key_traits: ["charm", "affection", "artistry"] },
  { id: "chandra_shani_yoga", name: "Chandra-Shani Yoga", sanskrit: "चन्द्र-शनि योग", category: "challenging", planets: ["Moon", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "The Moon and Saturn are conjunct -- the combination the tradition calls Punarphoo.", effects: "A serious cast of mind and a habit of expecting less than is on offer. Decisions get revisited and commitments deferred; what it buys is realism and staying power once a choice is finally made.", activation_timing: "Moon and Saturn periods, and stretches where a decision is repeatedly postponed", key_traits: ["gravity", "hesitation", "realism"] },
  { id: "mangala_budha_yoga", name: "Mangala-Budha Yoga", sanskrit: "मङ्गल-बुध योग", category: "benefic", planets: ["Mars", "Mercury"], source: CONJUNCTION_SOURCE,
    description: "Mars and Mercury are conjunct.", effects: "Thinking with an edge on it: argument, debate, engineering, surgery, anything that rewards a quick mind used decisively. Sharpness in speech is worth watching.", activation_timing: "Mars and Mercury periods, technical work, and disputes", key_traits: ["acuity", "argument", "technical skill"] },
  { id: "mangala_shani_yoga", name: "Mangala-Shani Yoga", sanskrit: "मङ्गल-शनि योग", category: "challenging", planets: ["Mars", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "Mars and Saturn are conjunct.", effects: "Drive and restriction in the same place: effort meets resistance, and frustration is the recurring note. The compensation is real -- hard, dangerous or grinding work gets done that others abandon.", activation_timing: "Mars and Saturn periods, and stretches of obstructed effort", key_traits: ["friction", "persistence", "hard work"] },
  { id: "guru_shani_yoga", name: "Guru-Shani Yoga", sanskrit: "गुरु-शनि योग", category: "benefic", planets: ["Jupiter", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "Jupiter and Saturn are conjunct.", effects: "Expansion and discipline held together, which is rarer than either alone. Plans are large and also costed; growth is slow, structural and hard to reverse.", activation_timing: "Jupiter and Saturn periods, and the long build-out of an institution or practice", key_traits: ["structure", "prudence", "durability"] },
  { id: "guru_budha_yoga", name: "Guru-Budha Yoga", sanskrit: "गुरु-बुध योग", category: "benefic", planets: ["Jupiter", "Mercury"], source: CONJUNCTION_SOURCE,
    description: "Jupiter and Mercury are conjunct.", effects: "Breadth and precision in the same mind. Suited to scholarship, law, editing and advice -- work where being right and being clear are the same job.", activation_timing: "Jupiter and Mercury periods, study, publication, and advisory work", key_traits: ["scholarship", "clarity", "judgement"] },
  { id: "shukra_shani_yoga", name: "Shukra-Shani Yoga", sanskrit: "शुक्र-शनि योग", category: "benefic", planets: ["Venus", "Saturn"], source: CONJUNCTION_SOURCE,
    description: "Venus and Saturn are conjunct.", effects: "Affection is slow, deliberate and durable. Relationships form late and hold; taste runs to the spare and well-made rather than the abundant.", activation_timing: "Venus and Saturn periods, and commitments entered later than expected", key_traits: ["loyalty", "restraint", "craftsmanship"] },
  { id: "guru_chandala_yoga", name: "Guru-Chandala Yoga", sanskrit: "गुरु-चाण्डाल योग", category: "challenging", planets: ["Jupiter", "Rahu"], source: CONJUNCTION_SOURCE,
    description: "Jupiter and Rahu are conjunct -- the combination named Guru-Chandala.", effects: "Received wisdom is questioned rather than inherited, which cuts both ways: genuine originality in belief and learning, and a tendency to discard good advice along with bad. Teachers are outgrown quickly.", activation_timing: "Jupiter and Rahu periods, and stretches of breaking with a tradition or an institution", key_traits: ["unorthodoxy", "questioning", "restlessness"] },
];

// --------------------------------------------------------------------------
// Placements reckoned from a karaka
// --------------------------------------------------------------------------
/*
 * The same principle behind Sunapha, Anapha and Vesi: benefics and malefics
 * counted not from the ascendant but from the Sun or the Moon. Five more of
 * those, covering the cases the existing records leave out -- malefics
 * surrounding the Moon from the difficult houses, and the upachaya and
 * angular placements reckoned from each luminary.
 */

const CLASSICAL_RELATIVE_RECIPES: RelativePlanetRecipe[] = [
  { id: "chandra_dusthana_papa", name: "Chandra Dusthana Papa Yoga", sanskrit: "चन्द्र दुःस्थान पाप योग", category: "challenging", basePlanet: "Moon", allowedPlanets: NATURAL_MALEFICS, relativeHouses: [6, 8, 12], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more natural malefics occupy the 6th, 8th or 12th signs counted from the Moon.", effects: "The mind carries more weight than it shows. Worry is habitual and rest is hard to come by; the discipline that develops in response is genuine, but it is bought rather than given.", activation_timing: "the periods of the malefics involved, and stretches of sustained strain", key_traits: ["strain", "vigilance", "resilience"] },
  { id: "surya_kendra_shubha", name: "Surya Kendra Shubha Yoga", sanskrit: "सूर्य केन्द्र शुभ योग", category: "benefic", basePlanet: "Sun", allowedPlanets: NATURAL_BENEFICS, relativeHouses: [1, 4, 7, 10], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more natural benefics occupy angular signs counted from the Sun.", effects: "Authority is cushioned by goodwill. Positions of responsibility come with allies attached, and the exercise of power attracts less resistance than it usually would.", activation_timing: "Sun periods, appointments, and stretches of public responsibility", key_traits: ["support", "standing", "goodwill"] },
  { id: "surya_upachaya_papa", name: "Surya Upachaya Papa Yoga", sanskrit: "सूर्य उपचय पाप योग", category: "benefic", basePlanet: "Sun", allowedPlanets: NATURAL_MALEFICS, relativeHouses: [3, 6, 11], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more natural malefics occupy the 3rd, 6th or 11th signs counted from the Sun -- the growing houses, where malefics are read as an asset.", effects: "Difficulty is converted into capability. Rivals sharpen rather than obstruct, and the harder stretches of a career are the ones that end up paying.", activation_timing: "the periods of the malefics involved, and competitive stretches", key_traits: ["competitiveness", "grit", "advancement"] },
  { id: "chandra_upachaya_shubha", name: "Chandra Upachaya Shubha Yoga", sanskrit: "चन्द्र उपचय शुभ योग", category: "benefic", basePlanet: "Moon", allowedPlanets: NATURAL_BENEFICS, relativeHouses: [3, 6, 11], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more natural benefics occupy the 3rd, 6th or 11th signs counted from the Moon.", effects: "Effort is met with help. Initiative attracts backing, and the people who turn up when something is being started tend to be the useful ones.", activation_timing: "the periods of the benefics involved, and stretches of independent effort", key_traits: ["encouragement", "enterprise", "gain"] },
  { id: "guru_kendra_shubha", name: "Guru Kendra Shubha Yoga", sanskrit: "गुरु केन्द्र शुभ योग", category: "benefic", basePlanet: "Jupiter", allowedPlanets: ["Mercury", "Venus", "Moon"], relativeHouses: [1, 4, 7, 10], minCount: 2, source: KARAKA_RELATIVE_SOURCE,
    description: "Two or more of Mercury, Venus and the Moon occupy angular signs counted from Jupiter.", effects: "Good judgement is kept company by the skills that make it useful -- articulacy, taste and instinct. Advice given is both sound and well received.", activation_timing: "Jupiter periods, advisory and teaching work, and stretches requiring persuasion", key_traits: ["judgement", "persuasion", "cultivation"] },
];

/*
 * Order is load-bearing: detectYogas sorts with a stable sort, so ties in
 * strength and occurrence chance fall back to the order the definitions were
 * declared in. This is the order the single file had.
 */
export const CLASSICAL_RECIPE_DEFINITIONS: YogaDefinition[] = [
  ...CLASSICAL_MUTUAL_LORD_RECIPES.map(createMutualHouseLordYoga),
  ...CLASSICAL_HOUSE_LORD_RECIPES.map(createHouseLordPlacementYoga),
  ...CLASSICAL_PLANET_HOUSE_RECIPES.map(createPlanetHouseYoga),
  ...CLASSICAL_CONJUNCTION_RECIPES.map(createConjunctionYoga),
  ...CLASSICAL_RELATIVE_RECIPES.map(createRelativePlanetYoga),
];
