/**
 * The books the knowledge passages are drawn from.
 *
 * Only texts that are out of copyright belong here, and the record says why
 * each one is: the year it was published and the library copy it was scanned
 * from, not an uploader's licence tag. A modern book with a public-domain label
 * on archive.org is still a modern book (see the Adawal encyclopedia, turned
 * down on 2026-10-04 for exactly that reason).
 *
 * `textMd5` pins the exact OCR file the corpus was built from. The build script
 * refuses any other file, so a re-run can only reproduce the checked-in corpus
 * or fail loudly; it cannot quietly re-cut the verses from a different scan.
 */
export interface KnowledgeSource {
  slug: string;
  title: string;
  author: string;
  translator: string;
  publisher: string;
  year: number;
  /** Why this text may be quoted in a paid product. */
  rights: string;
  /** The library record, for a reader who wants to check a passage. */
  url: string;
  textUrl: string;
  textMd5: string;
}

export const BRIHAT_JATAKA_1885: KnowledgeSource = {
  slug: "brihat-jataka-1885",
  title: "The Brihat Jataka of Varaha Mihira",
  author: "Varahamihira",
  translator: "N. Chidambaram Iyer",
  publisher: "Foster Press",
  year: 1885,
  rights:
    "Public domain: published in 1885, so out of copyright in the United States (before 1930) and in India (life plus 60 years, long past for a translator publishing in 1885). Scanned by Google from the Harvard University copy; archive.org marks it NOT_IN_COPYRIGHT.",
  url: "https://archive.org/details/brihatjatakavar00iyergoog",
  textUrl: "https://archive.org/download/brihatjatakavar00iyergoog/brihatjatakavar00iyergoog_djvu.txt",
  textMd5: "c4cd7f67be08cbfb4002e33fee48ea0b",
};

/*
 * For the palm reading. Chapter 68, "On the Features of Man", gives the marks
 * of the palm, fingers and nails (verses 39-50 in this translation), and
 * chapter 70, "On the Features of Women", gives a woman's (verses 10-14 and
 * 22). The palm reading named "Brihat Samhita Ch. 68" from memory until
 * 2026-10-04; this is the text itself.
 *
 * Two public-domain scans were compared on those chapters: this one, Harvard's
 * copy scanned by Google, and the Wellcome Library's (b29353130). Their OCR is
 * about equally damaged there, in different words; this one is pinned because
 * its chapter headings survive OCR intact and it is the same provenance as the
 * Brihat Jataka above.
 */
export const BRIHAT_SAMHITA_1884: KnowledgeSource = {
  slug: "brihat-samhita-1884",
  title: "The Brihat Samhita of Varaha Mihira",
  author: "Varahamihira",
  translator: "N. Chidambaram Iyer",
  publisher: "South Indian Press, Madura",
  year: 1884,
  rights:
    "Public domain: published in 1884, so out of copyright in the United States (before 1930) and in India (life plus 60 years, long past for a translator publishing in 1884). Scanned by Google from the Harvard University copy; archive.org marks it NOT_IN_COPYRIGHT.",
  url: "https://archive.org/details/bihatsahitvarah00iyergoog",
  textUrl: "https://archive.org/download/bihatsahitvarah00iyergoog/bihatsahitvarah00iyergoog_djvu.txt",
  textMd5: "6d7ef7e079c6aae131a4a0e91b6a3405",
};

export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSource> = {
  [BRIHAT_JATAKA_1885.slug]: BRIHAT_JATAKA_1885,
  [BRIHAT_SAMHITA_1884.slug]: BRIHAT_SAMHITA_1884,
};
