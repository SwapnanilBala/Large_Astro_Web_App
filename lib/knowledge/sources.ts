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
  /** What a reading calls the book when it attributes a claim to it. */
  shortTitle: string;
  author: string;
  /** Null for a book written in English. */
  translator: string | null;
  publisher: string;
  year: number;
  /** One phrase introducing the book to the model that reads its passages. */
  described: string;
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
  shortTitle: "Brihat Jataka",
  author: "Varahamihira",
  translator: "N. Chidambaram Iyer",
  publisher: "Foster Press",
  year: 1885,
  described: "the Brihat Jataka, Varahamihira's classical text on birth charts, in N. Chidambaram Iyer's 1885 English translation",
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
  shortTitle: "Brihat Samhita",
  author: "Varahamihira",
  translator: "N. Chidambaram Iyer",
  publisher: "South Indian Press, Madura",
  year: 1884,
  described: "the Brihat Samhita, Varahamihira's encyclopaedia of omens and signs, in N. Chidambaram Iyer's 1884 English translation",
  rights:
    "Public domain: published in 1884, so out of copyright in the United States (before 1930) and in India (life plus 60 years, long past for a translator publishing in 1884). Scanned by Google from the Harvard University copy; archive.org marks it NOT_IN_COPYRIGHT.",
  url: "https://archive.org/details/bihatsahitvarah00iyergoog",
  textUrl: "https://archive.org/download/bihatsahitvarah00iyergoog/bihatsahitvarah00iyergoog_djvu.txt",
  textMd5: "6d7ef7e079c6aae131a4a0e91b6a3405",
};

/*
 * For women's charts, which the Brihat Jataka gives one chapter (24). Asked
 * for by the owner on 2026-10-05 ("we need more data for precise readings"),
 * and chosen over the fuller Strijataka chapters of Jataka Parijata (ch. 16,
 * V. Subrahmanya Sastri's 1932 translation) and Phaladeepika (ch. 11, 1937)
 * because those are still in copyright in the United States: Sastri died in
 * 1953, so his translations were protected in India on 1 January 1996, and the
 * URAA restored their US terms (95 years from publication, so 2028 and 2033).
 *
 * Only the FIRST EDITION is free. B. V. Raman, the author's grandson, is its
 * publisher and nothing more (the preface is the author's own); his later
 * revised editions are his work too, and in copyright until 2059.
 *
 * The book is Rao's own English, drawing on the Brihat Jataka, Jataka Parijata
 * and Sarvartha Chintamani, with no verse numbers; passages are numbered by
 * paragraph within a chapter. The Digital Library of India's scan of the
 * Bharatiya Vidya Bhavan copy lacks pages 3, 7, 8, 10 and 38, and every copy
 * on archive.org is that scan (in.ernet.dli.2015.142203 is the same OCR again,
 * differing only in spacing).
 */
export const STRIJATAKA_1931: KnowledgeSource = {
  slug: "strijataka-1931",
  title: "Strijataka, or Female Horoscopy",
  shortTitle: "Strijataka",
  author: "B. Suryanarain Rao",
  translator: null,
  publisher: "B. V. Raman, Bangalore",
  year: 1931,
  described:
    "Strijataka, or Female Horoscopy, B. Suryanarain Rao's 1931 English book on reading women's birth charts, drawn from the classical texts",
  rights:
    "Public domain. First edition, Bangalore 1931, by B. Suryanarain Rao, who died in March 1937: out of copyright in India since 1988 (life plus 50 years, the term until 1992, which did not revive expired works). In the United States it was published abroad without US formalities, and the URAA did not restore it, since it was already free in India on 1 January 1996; at the very latest, a 1931 publication is free there from 1 January 2027. Scanned by the Digital Library of India from the Bharatiya Vidya Bhavan Library, Mumbai, copy. Later editions revised by B. V. Raman are in copyright and are not used.",
  url: "https://archive.org/details/in.ernet.dli.2015.134461",
  textUrl:
    "https://archive.org/download/in.ernet.dli.2015.134461/2015.134461.Strijataka-Or-Female-Horoscopy-First-Edition_djvu.txt",
  textMd5: "0dd90c54e96fd0d838a946a6ca12a7cd",
};

export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSource> = {
  [BRIHAT_JATAKA_1885.slug]: BRIHAT_JATAKA_1885,
  [BRIHAT_SAMHITA_1884.slug]: BRIHAT_SAMHITA_1884,
  [STRIJATAKA_1931.slug]: STRIJATAKA_1931,
};
