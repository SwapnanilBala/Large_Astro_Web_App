// --------------------------------------------------------------------------
// CLASSICAL SOURCES
// --------------------------------------------------------------------------
/*
 * The texts the `source` field cites, and the editions its chapter numbers
 * follow. Naming the edition matters because the numbering is not stable: BPHS
 * carries the Nabhasa chapter as 35 in Santhanam and as 37 in editions that
 * split the earlier material, so a bare "BPHS ch. 35" is ambiguous on its own.
 *
 *   BPHS            Brihat Parashara Hora Shastra, tr. R. Santhanam
 *   Brihat Jataka   Varahamihira, tr. V. Subrahmanya Sastri (2nd ed.)
 *   Phaladeepika    Mantreswara, tr. S.S. Sareen
 *   Saravali        Kalyana Varma, tr. R. Santhanam
 *   Jataka Parijata Vaidyanatha Dikshita, tr. V. Subrahmanya Sastri
 *
 * What a citation claims, and what it does not. It says the *combination* is
 * described in that text at that place -- the planets, houses and lords that
 * have to line up. It does not claim the wording here is a translation of
 * anything: every description, effect and timing line below is written for this
 * project, because the classical results are stated in terms ("becomes a king",
 * "destroys his enemies") that no reading in this product is going to print.
 *
 * Where a record is deliberately stricter than its source it says so in
 * `description` rather than quietly narrowing the rule. The Akriti yogas are
 * the main case; see the note under NABHASA YOGAS.
 */

export const NABHASA_SOURCE =
  "Brihat Jataka ch. 12; BPHS Nabhasa Yoga adhyaya (ch. 35 Santhanam); Saravali ch. 33";

export const PARIVARTANA_SOURCE = "Phaladeepika (parivartana: Maha, Khala and Dainya classes)";

export const BHAVA_PHALA_SOURCE =
  "BPHS bhava-phala chapters; Phaladeepika (effects of the house lords in the twelve houses)";

export const DIGBALA_SOURCE = "BPHS (Digbala, directional strength); Saravali";

export const CONJUNCTION_SOURCE = "Saravali (results of two planets in conjunction); BPHS";

export const KARAKA_RELATIVE_SOURCE =
  "BPHS and Saravali (benefic and malefic placements reckoned from the Sun and the Moon)";
