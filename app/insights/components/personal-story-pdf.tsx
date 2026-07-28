import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PersonalStory } from "@/lib/story-engine";

export type PersonalStoryPdfProps = {
  story: PersonalStory;
  clientName?: string;
  locationLabel?: string;
  ascendant?: string;
  generatedOn?: string;
};

const COLORS = {
  ink: "#1a1207",
  inkSoft: "#4b3f2a",
  gold: "#8f5a06",
  paper: "#fffdf6",
  card: "#f7f1e1",
  border: "#d8c9a3",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    backgroundColor: COLORS.paper,
    fontSize: 11,
    color: COLORS.inkSoft,
    fontFamily: "Helvetica",
  },
  coverKicker: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: COLORS.gold,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 14,
  },
  coverIntro: {
    fontSize: 12.5,
    lineHeight: 1.6,
    color: COLORS.inkSoft,
    marginBottom: 16,
  },
  coverMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  coverMetaItem: {
    fontSize: 9.5,
    color: COLORS.inkSoft,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  chapterBlock: {
    marginBottom: 20,
  },
  chapterHeader: {
    marginBottom: 8,
  },
  chapterEyebrow: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    color: COLORS.gold,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
  },
  chapterBody: {
    fontSize: 11,
    lineHeight: 1.6,
    marginTop: 8,
    marginBottom: 10,
  },
  highlightRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  highlightBullet: {
    width: 12,
    fontSize: 11,
    color: COLORS.gold,
  },
  highlightText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.5,
  },
  signalsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  signalBox: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: "2%",
    marginBottom: 8,
  },
  signalLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: COLORS.gold,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  signalValue: {
    fontSize: 9.5,
    color: COLORS.inkSoft,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginVertical: 18,
  },
  footerNote: {
    marginTop: 12,
    fontSize: 9,
    lineHeight: 1.5,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "right",
    fontSize: 8,
    color: COLORS.inkSoft,
  },
});

export function PersonalStoryPdfDocument({
  story,
  clientName,
  locationLabel,
  ascendant,
  generatedOn,
}: PersonalStoryPdfProps) {
  return (
    <Document title={story.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.coverKicker}>Personal synthesis</Text>
        <Text style={styles.coverTitle}>{story.title}</Text>
        <Text style={styles.coverIntro}>{story.introduction}</Text>
        <View style={styles.coverMetaRow}>
          {clientName ? <Text style={styles.coverMetaItem}>{clientName}</Text> : null}
          {ascendant ? <Text style={styles.coverMetaItem}>{ascendant} ascendant</Text> : null}
          {locationLabel ? <Text style={styles.coverMetaItem}>{locationLabel}</Text> : null}
          {generatedOn ? <Text style={styles.coverMetaItem}>Generated {generatedOn}</Text> : null}
        </View>

        <View style={styles.divider} />

        {story.chapters.map((chapter, index) => (
          <View key={chapter.id} style={styles.chapterBlock}>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterEyebrow}>
                {String(index + 1).padStart(2, "0")} · {chapter.eyebrow}
              </Text>
              <Text style={styles.chapterTitle}>{chapter.title}</Text>
            </View>
            <Text style={styles.chapterBody}>{chapter.body}</Text>

            {chapter.highlights.map((highlight) => (
              <View key={highlight} style={styles.highlightRow}>
                <Text style={styles.highlightBullet}>{"•"}</Text>
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}

            {chapter.signals.length > 0 && (
              <View style={styles.signalsWrap}>
                {chapter.signals.map((signal) => (
                  <View key={`${signal.label}-${signal.value}`} style={styles.signalBox}>
                    <Text style={styles.signalLabel}>{signal.label}</Text>
                    <Text style={styles.signalValue}>{signal.value}</Text>
                  </View>
                ))}
              </View>
            )}
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
