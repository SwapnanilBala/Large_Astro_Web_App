import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PersonalStory } from "@/lib/story-engine";

// Served from public/fonts, populated by scripts/copy-fonts.cjs at pre(dev|build).
// These must be URLs rather than node_modules paths: the document is rendered in
// the browser (personal-story.tsx calls pdf().toBlob()), so each face is fetched.
// Both families are SIL Open Font License 1.1; the licence ships alongside them.
Font.register({
  family: "Cinzel",
  fonts: [
    { src: "/fonts/cinzel-latin-400-normal.woff", fontWeight: 400 },
    { src: "/fonts/cinzel-latin-700-normal.woff", fontWeight: 700 },
  ],
});

Font.register({
  family: "EBGaramond",
  fonts: [
    { src: "/fonts/eb-garamond-latin-400-normal.woff", fontWeight: 400 },
    { src: "/fonts/eb-garamond-latin-400-italic.woff", fontWeight: 400, fontStyle: "italic" },
    { src: "/fonts/eb-garamond-latin-600-normal.woff", fontWeight: 600 },
  ],
});

// Garamond's ascenders and descenders are long, so it carries generous leading
// better than Helvetica did; hyphenation off keeps the ragged edge quiet.
Font.registerHyphenationCallback((word) => [word]);

export type PersonalStoryPdfProps = {
  story: PersonalStory;
  clientName?: string;
  locationLabel?: string;
  ascendant?: string;
  generatedOn?: string;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingBottom: 60,
    paddingHorizontal: 52,
    fontSize: 13,
    color: "#000000",
    fontFamily: "EBGaramond",
  },
  kicker: {
    fontSize: 11,
    fontFamily: "Cinzel", fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontFamily: "Cinzel", fontWeight: 700,
    marginBottom: 14,
  },
  intro: {
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 10,
  },
  metaLine: {
    fontSize: 11,
    lineHeight: 1.5,
    marginBottom: 16,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    marginVertical: 20,
  },
  chapterBlock: {
    marginBottom: 22,
  },
  chapterEyebrow: {
    fontSize: 11,
    fontFamily: "Cinzel", fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 19,
    fontFamily: "Cinzel", fontWeight: 700,
    marginBottom: 10,
  },
  body: {
    fontSize: 13,
    lineHeight: 1.55,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  bulletMark: {
    width: 14,
    fontSize: 13,
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 1.5,
  },
  footerNote: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 1.5,
  },
  pageNumber: {
    position: "absolute",
    bottom: 28,
    left: 52,
    right: 52,
    textAlign: "right",
    fontSize: 9,
  },
});

export function PersonalStoryPdfDocument({
  story,
  clientName,
  locationLabel,
  ascendant,
  generatedOn,
}: PersonalStoryPdfProps) {
  const metaParts = [
    clientName,
    ascendant ? `${ascendant} ascendant` : undefined,
    locationLabel,
    generatedOn ? `Generated ${generatedOn}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return (
    <Document title={story.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Personal synthesis</Text>
        <Text style={styles.title}>{story.title}</Text>
        <Text style={styles.intro}>{story.introduction}</Text>
        {metaParts.length > 0 && <Text style={styles.metaLine}>{metaParts.join("   •   ")}</Text>}

        <View style={styles.divider} />

        {story.chapters.map((chapter, index) => (
          <View key={chapter.id} style={styles.chapterBlock}>
            <Text style={styles.chapterEyebrow}>
              {String(index + 1).padStart(2, "0")} · {chapter.eyebrow}
            </Text>
            <Text style={styles.chapterTitle}>{chapter.title}</Text>
            <Text style={styles.body}>{chapter.body}</Text>

            {chapter.highlights.map((highlight) => (
              <View key={highlight} style={styles.bulletRow}>
                <Text style={styles.bulletMark}>{"•"}</Text>
                <Text style={styles.bulletText}>{highlight}</Text>
              </View>
            ))}

            {chapter.signals.map((signal) => (
              <View key={`${signal.label}-${signal.value}`} style={styles.bulletRow}>
                <Text style={styles.bulletMark}>{"•"}</Text>
                <Text style={styles.bulletText}>
                  {signal.label}: {signal.value}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.divider} />
        <Text style={styles.footerNote}>{story.reflectionNote}</Text>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export default PersonalStoryPdfDocument;
