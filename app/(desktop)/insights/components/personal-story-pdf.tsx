import React from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  PersonalStory,
  PersonalStoryChapter,
  StorySupportLevel,
} from "@/lib/story-engine";

const shouldRegisterBrowserFonts =
  typeof window !== "undefined" && typeof document !== "undefined";

if (shouldRegisterBrowserFonts) {
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
}

Font.registerHyphenationCallback((word) => [word]);

export type PersonalStoryPdfProps = {
  story: PersonalStory;
  clientName?: string;
  locationLabel?: string;
  ascendant?: string;
  generatedOn?: string;
};

const COLORS = {
  paper: "#F7F4EE",
  paperDeep: "#EEE9DF",
  ink: "#171915",
  muted: "#68675F",
  faint: "#928F86",
  gold: "#9B783B",
  goldSoft: "#D8C8A8",
  green: "#315D50",
  greenSoft: "#DDE8E2",
  rose: "#7C5048",
  roseSoft: "#EEE0DC",
  line: "#D8D2C6",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 56,
    paddingHorizontal: 52,
    backgroundColor: COLORS.paper,
    color: COLORS.ink,
    fontFamily: "EBGaramond",
    fontSize: 13.5,
  },
  cover: {
    paddingTop: 62,
    paddingBottom: 54,
    paddingHorizontal: 58,
    backgroundColor: COLORS.paper,
    color: COLORS.ink,
    fontFamily: "EBGaramond",
  },
  coverTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.line,
  },
  brand: {
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 11.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  edition: {
    color: COLORS.faint,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  coverBody: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 50,
  },
  coverRule: {
    width: 44,
    borderTopWidth: 2,
    borderTopColor: COLORS.gold,
    marginBottom: 28,
  },
  coverKicker: {
    color: COLORS.gold,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 11.5,
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  coverName: {
    maxWidth: 450,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 38,
    lineHeight: 1.14,
    marginBottom: 13,
    textTransform: "uppercase",
  },
  coverTitle: {
    color: COLORS.gold,
    fontFamily: "Cinzel",
    fontSize: 22,
    letterSpacing: 0.8,
    marginBottom: 21,
  },
  coverDeck: {
    width: 360,
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 1.55,
  },
  coverMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 18,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
  },
  coverMetaText: {
    width: 330,
    color: COLORS.muted,
    fontSize: 11.5,
    lineHeight: 1.45,
  },
  verificationBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0.75,
    borderColor: COLORS.green,
    borderRadius: 12,
    backgroundColor: COLORS.greenSoft,
    color: COLORS.green,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  header: {
    position: "absolute",
    top: 25,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
    color: COLORS.faint,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  pageNumber: {
    position: "absolute",
    bottom: 25,
    left: 52,
    right: 52,
    color: COLORS.faint,
    fontSize: 10,
    textAlign: "right",
  },
  sectionKicker: {
    color: COLORS.gold,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 10.5,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 26,
    lineHeight: 1.2,
    marginBottom: 10,
  },
  sectionIntro: {
    width: 460,
    color: COLORS.muted,
    fontSize: 14.5,
    lineHeight: 1.55,
    marginBottom: 22,
  },
  prefaceBlock: {
    paddingVertical: 18,
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: COLORS.line,
    marginBottom: 22,
  },
  prefaceParagraph: {
    color: COLORS.ink,
    fontSize: 15,
    lineHeight: 1.62,
    marginBottom: 9,
  },
  glanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 21,
  },
  glanceCard: {
    width: 235,
    minHeight: 78,
    padding: 11,
    borderWidth: 0.75,
    borderColor: COLORS.line,
    borderRadius: 5,
    backgroundColor: COLORS.white,
  },
  glanceLabel: {
    color: COLORS.faint,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 9.5,
    letterSpacing: 0.8,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  glanceValue: {
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 4,
  },
  glanceContext: {
    color: COLORS.muted,
    fontSize: 11.5,
    lineHeight: 1.35,
  },
  themeList: {
    paddingTop: 12,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
  },
  miniHeading: {
    color: COLORS.gold,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  themeRow: {
    flexDirection: "row",
    marginBottom: 7,
  },
  themeNumber: {
    width: 22,
    color: COLORS.gold,
    fontFamily: "Cinzel",
    fontSize: 11,
  },
  themeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 1.42,
  },
  chapterNumber: {
    color: COLORS.goldSoft,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 42,
    lineHeight: 1,
    marginBottom: 2,
  },
  chapterEyebrow: {
    color: COLORS.gold,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 10.5,
    letterSpacing: 1.4,
    marginBottom: 9,
    textTransform: "uppercase",
  },
  chapterTitle: {
    maxWidth: 470,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 25,
    lineHeight: 1.22,
    marginBottom: 15,
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  supportPill: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  supportStrong: {
    color: COLORS.green,
    backgroundColor: COLORS.greenSoft,
  },
  supportNormal: {
    color: COLORS.gold,
    backgroundColor: COLORS.paperDeep,
  },
  supportCaution: {
    color: COLORS.rose,
    backgroundColor: COLORS.roseSoft,
  },
  supportNote: {
    flex: 1,
    color: COLORS.faint,
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  chapterOpening: {
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.gold,
    color: COLORS.ink,
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 1.55,
    marginBottom: 17,
  },
  narrativeParagraph: {
    color: COLORS.ink,
    fontSize: 14,
    lineHeight: 1.62,
    marginBottom: 11,
  },
  practiceBox: {
    marginTop: 8,
    padding: 14,
    borderWidth: 0.75,
    borderColor: COLORS.line,
    borderRadius: 5,
    backgroundColor: COLORS.white,
  },
  practiceRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  practiceMark: {
    width: 16,
    color: COLORS.gold,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 10,
  },
  practiceText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 1.4,
  },
  reflectionBox: {
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
  },
  reflectionText: {
    color: COLORS.muted,
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 1.45,
  },
  evidenceBox: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
  },
  evidenceRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  evidenceLabel: {
    width: 102,
    color: COLORS.faint,
    fontSize: 10.5,
  },
  evidenceValue: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  timeline: {
    marginTop: 13,
    marginBottom: 14,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 11,
  },
  timelineRail: {
    width: 15,
    alignItems: "center",
  },
  timelineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
    marginTop: 3,
  },
  timelineLine: {
    flex: 1,
    width: 0.75,
    backgroundColor: COLORS.line,
    marginTop: 3,
  },
  timelineCopy: {
    flex: 1,
    paddingLeft: 8,
  },
  timelineTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  timelineLabel: {
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 11,
  },
  timelineWindow: {
    color: COLORS.gold,
    fontSize: 10.5,
  },
  timelineNarrative: {
    color: COLORS.muted,
    fontSize: 11.5,
    lineHeight: 1.4,
  },
  verificationSummary: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  verificationMetric: {
    flex: 1,
    padding: 12,
    borderWidth: 0.75,
    borderColor: COLORS.line,
    borderRadius: 5,
    backgroundColor: COLORS.white,
  },
  metricValue: {
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 21,
    marginBottom: 3,
  },
  metricLabel: {
    color: COLORS.faint,
    fontSize: 10,
    textTransform: "uppercase",
  },
  methodTable: {
    marginBottom: 18,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
  },
  methodRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.line,
  },
  methodLabel: {
    width: 125,
    color: COLORS.faint,
    fontSize: 11,
  },
  methodValue: {
    flex: 1,
    fontSize: 11.5,
  },
  checkRow: {
    width: 152,
    minHeight: 61,
    padding: 7,
    borderWidth: 0.5,
    borderColor: COLORS.line,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  checkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  checkStatus: {
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  checkCopy: {
    flex: 1,
  },
  checkLabel: {
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 10,
    marginBottom: 2,
  },
  checkDetail: {
    color: COLORS.muted,
    fontSize: 9.5,
    lineHeight: 1.3,
  },
  closingNote: {
    marginTop: 18,
    padding: 13,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.gold,
    color: COLORS.muted,
    fontSize: 11.5,
    lineHeight: 1.45,
  },
  /* The apparatus page's heading. Smaller than a chapter title -- it is a
     continuation, not a new chapter -- but present, which is the whole point
     of it. */
  apparatusTitle: {
    maxWidth: 470,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 1.24,
    marginBottom: 20,
  },
  /* ── The closing page ──
     Replaces a calculation appendix. See the page itself for why. */
  closingLead: {
    color: COLORS.ink,
    fontSize: 15,
    lineHeight: 1.62,
    marginBottom: 26,
  },
  closingList: {
    paddingTop: 16,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
  },
  closingRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  closingMark: {
    width: 22,
    color: COLORS.gold,
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 13,
  },
  closingCopy: {
    flex: 1,
  },
  closingHeading: {
    fontFamily: "Cinzel",
    fontWeight: 700,
    fontSize: 12.5,
    lineHeight: 1.3,
    marginBottom: 4,
  },
  closingText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 1.55,
  },
  signOff: {
    marginTop: 30,
    paddingTop: 18,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
    color: COLORS.ink,
    fontFamily: "EBGaramond",
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 1.55,
  },
  /* The whole calculation record, as one line of small print. A reader who
     wants the provenance gets it; a reader who does not is not handed a page
     of tables on the way out. */
  provenance: {
    marginTop: "auto",
    paddingTop: 14,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
    color: COLORS.faint,
    fontSize: 9.5,
    lineHeight: 1.5,
  },
});

function cleanText(value: string | undefined): string {
  return (value ?? "")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseStatus(status: string): string {
  return status.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function supportStyle(level: StorySupportLevel | undefined) {
  if (level === "well-supported") return styles.supportStrong;
  if (level === "exploratory") return styles.supportCaution;
  return styles.supportNormal;
}

function RunningElements({ clientName }: { clientName?: string }) {
  return (
    <>
      <View style={styles.header} fixed>
        <Text>Lagna Atelier - Personal Reading</Text>
        <Text>{cleanText(clientName)}</Text>
      </View>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        fixed
      />
    </>
  );
}

/*
 * A chapter is two pages, and that is a decision rather than an overflow.
 *
 * It used to be one `<Page>` holding everything, which fitted because the
 * engine's prose was a single short paragraph -- and left the page forty per
 * cent blank. With written prose and readable type it cannot fit, and the
 * arithmetic says so plainly: an A4 page carries 732pt between the margins,
 * the chapter furniture and the opening take about 220 of it, and the worst
 * case apparatus (four practices, a reflection, an evidence table) takes about
 * 350. That leaves 160pt for the reading itself -- seven lines, one paragraph,
 * which is the document we were trying to get away from.
 *
 * So the prose gets a page and the apparatus gets a page. The second one
 * carries its own heading, because the difference between a designed page and
 * a spill is entirely whether it announces itself.
 */
function ChapterProsePage({
  chapter,
  index,
  clientName,
}: {
  chapter: PersonalStoryChapter;
  index: number;
  clientName?: string;
}) {
  const narrative = chapter.narrative?.length ? chapter.narrative : [chapter.body];
  const opening = cleanText(chapter.opening);
  const paragraphs = narrative
    .map(cleanText)
    .filter((paragraph) => paragraph && paragraph !== opening);

  return (
    <Page size="A4" style={styles.page}>
      <RunningElements clientName={clientName} />
      <Text style={styles.chapterNumber}>{String(index + 1).padStart(2, "0")}</Text>
      <Text style={styles.chapterEyebrow}>{cleanText(chapter.eyebrow)}</Text>
      <Text style={styles.chapterTitle}>{cleanText(chapter.title)}</Text>

      <View style={styles.supportRow}>
        <Text style={[styles.supportPill, supportStyle(chapter.support)]}>
          {titleCaseStatus(chapter.support ?? "supported")}
        </Text>
        <Text style={styles.supportNote}>{cleanText(chapter.supportNote)}</Text>
      </View>

      {opening && <Text style={styles.chapterOpening}>{opening}</Text>}
      {paragraphs.map((paragraph) => (
        <Text key={paragraph} style={styles.narrativeParagraph}>{paragraph}</Text>
      ))}
    </Page>
  );
}

function ChapterApparatusPage({
  chapter,
  index,
  story,
  clientName,
}: {
  chapter: PersonalStoryChapter;
  index: number;
  story: PersonalStory;
  clientName?: string;
}) {
  const practices = chapter.practices?.length ? chapter.practices : chapter.highlights;
  const isTiming = chapter.id === "timing" && story.timeline.length > 0;

  return (
    <Page size="A4" style={styles.page}>
      <RunningElements clientName={clientName} />
      <Text style={styles.sectionKicker}>
        {`Chapter ${String(index + 1).padStart(2, "0")} - working with it`}
      </Text>
      <Text style={styles.apparatusTitle}>{cleanText(chapter.title)}</Text>

      {isTiming && (
        <View style={styles.timeline}>
          <Text style={styles.miniHeading}>The seasons currently in view</Text>
          {story.timeline.map((item, itemIndex) => (
            <View key={`${item.label}-${item.window}`} style={styles.timelineItem}>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {itemIndex < story.timeline.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineCopy}>
                <View style={styles.timelineTop}>
                  <Text style={styles.timelineLabel}>{cleanText(item.label)}</Text>
                  <Text style={styles.timelineWindow}>{cleanText(item.window)}</Text>
                </View>
                <Text style={styles.timelineNarrative}>{cleanText(item.narrative)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {practices.length > 0 && (
        <View style={styles.practiceBox} wrap={false}>
          <Text style={styles.miniHeading}>Carry this forward</Text>
          {practices.map((practice, practiceIndex) => (
            <View key={practice} style={styles.practiceRow}>
              <Text style={styles.practiceMark}>{String(practiceIndex + 1).padStart(2, "0")}</Text>
              <Text style={styles.practiceText}>{cleanText(practice)}</Text>
            </View>
          ))}
        </View>
      )}

      {chapter.reflectionPrompt && (
        <View style={styles.reflectionBox} wrap={false}>
          <Text style={styles.miniHeading}>A question to sit with</Text>
          <Text style={styles.reflectionText}>{cleanText(chapter.reflectionPrompt)}</Text>
        </View>
      )}

      {chapter.signals.length > 0 && (
        <View style={styles.evidenceBox} wrap={false}>
          <Text style={styles.miniHeading}>Why this chapter appears</Text>
          {chapter.signals.slice(0, 4).map((signal) => (
            <View key={`${signal.label}-${signal.value}`} style={styles.evidenceRow}>
              <Text style={styles.evidenceLabel}>{cleanText(signal.label)}</Text>
              <Text style={styles.evidenceValue}>{cleanText(signal.value)}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}


/*
 * The closing page's three notes.
 *
 * Fixed copy rather than generated: this is the publisher talking about how to
 * use the document, not the reading talking about the reader, and it is the
 * same in every report. Keeping it out of the model's hands also keeps it out
 * of the prose budget.
 */
const CLOSING_NOTES = [
  {
    heading: "Take one chapter at a time",
    body:
      "Each was written to stand on its own. The report is not an argument that "
      + "has to be followed end to end, and the chapter that matters most to you "
      + "this year may not be the first one.",
  },
  {
    heading: "Trust the note under each title",
    body:
      "Where a chapter is marked exploratory, it rests on thinner evidence and is "
      + "worth holding lightly. That label is calculated, not editorial, and it is "
      + "the most useful thing on the page.",
  },
  {
    heading: "Come back to the questions",
    body:
      "The question at the end of each chapter is the part only you can answer. "
      + "They are worth returning to, because the answers move even when the chart "
      + "does not.",
  },
];

/**
 * The calculation record, as one sentence.
 *
 * Everything the appendix used to tabulate, in the order a reader would ask
 * for it, and phrased so the qualification count is a fact about the report
 * rather than a warning about the reader.
 */
function provenanceLine(story: PersonalStory): string {
  const profile = story.verification.calculationProfile;
  const total =
    story.verification.passedCount
    + story.verification.warningCount
    + story.verification.failedCount;
  const checks = story.verification.warningCount > 0
    ? `${story.verification.passedCount} of ${total} internal consistency checks passed cleanly; `
      + `${story.verification.warningCount} returned a qualification, which is reflected in the `
      + `support note of the chapters it affects.`
    : `All ${total} internal consistency checks passed.`;
  return `Calculated with ${profile.provider} (${profile.engine}), ${profile.ayanamsha} ayanamsha, `
    + `${profile.houseSystem} houses, from a birth time recorded as `
    + `${profile.birthTimeReliability.toLowerCase()}. ${checks}`;
}

export function PersonalStoryPdfDocument({
  story,
  clientName,
  locationLabel,
  ascendant,
  generatedOn,
}: PersonalStoryPdfProps) {
  const metaParts = [
    ascendant ? `${ascendant} ascendant` : undefined,
    locationLabel,
    generatedOn ? `Prepared ${generatedOn}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return (
    <Document
      title={cleanText(story.title)}
      author="Lagna Atelier"
      subject="Verified client-focused astrological reading"
      keywords="astrology, personal reading, client report"
    >
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverTop}>
          <Text style={styles.brand}>Lagna Atelier</Text>
          <Text style={styles.edition}>Personal Story Edition</Text>
        </View>
        <View style={styles.coverBody}>
          <View style={styles.coverRule} />
          <Text style={styles.coverKicker}>A personal astrological portrait</Text>
          <Text style={styles.coverName}>{cleanText(clientName || story.title.replace(/ story$/i, ""))}</Text>
          <Text style={styles.coverTitle}>Your Story</Text>
          <Text style={styles.coverDeck}>{cleanText(story.subtitle)}</Text>
        </View>
        <View style={styles.coverMeta}>
          <Text style={styles.coverMetaText}>{cleanText(metaParts.join(" - "))}</Text>
          <Text style={styles.verificationBadge}>
            {story.verification.status === "verified" ? "Verified report" : "Qualified report"}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <RunningElements clientName={clientName} />
        <Text style={styles.sectionKicker}>Begin here</Text>
        <Text style={styles.sectionTitle}>The shape of your story</Text>
        <Text style={styles.sectionIntro}>{cleanText(story.introduction)}</Text>

        <View style={styles.prefaceBlock}>
          {story.preface.map((paragraph) => (
            <Text key={paragraph} style={styles.prefaceParagraph}>{cleanText(paragraph)}</Text>
          ))}
        </View>

        <Text style={styles.miniHeading}>At a glance</Text>
        <View style={styles.glanceGrid}>
          {story.atAGlance.map((item) => (
            <View key={item.label} style={styles.glanceCard} wrap={false}>
              <Text style={styles.glanceLabel}>{cleanText(item.label)}</Text>
              <Text style={styles.glanceValue}>{cleanText(item.value)}</Text>
              <Text style={styles.glanceContext}>{cleanText(item.context)}</Text>
            </View>
          ))}
        </View>

        {story.centralThemes.length > 0 && (
          <View style={styles.themeList}>
            <Text style={styles.miniHeading}>Three threads to notice</Text>
            {story.centralThemes.slice(0, 3).map((theme, index) => (
              <View key={theme} style={styles.themeRow}>
                <Text style={styles.themeNumber}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={styles.themeText}>{cleanText(theme)}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>

      {story.chapters.map((chapter, index) => (
        <React.Fragment key={chapter.id}>
          <ChapterProsePage chapter={chapter} index={index} clientName={clientName} />
          <ChapterApparatusPage
            chapter={chapter}
            index={index}
            story={story}
            clientName={clientName}
          />
        </React.Fragment>
      ))}

      {/*
        THE CLOSING PAGE.

        This was a calculation appendix: a three-metric scoreboard, a five-row
        method table, and every consistency check the verifier ran, each with
        its status and detail. All of it true, none of it what a reader wants
        on the last page of something written about them -- they close the
        document on an audit log.

        The provenance is still here. It is one line of small print at the
        foot, which is where the same information lives in a printed book, and
        it says the same things: which engine, which ayanamsha, which house
        system, how the birth time was recorded, and whether the checks passed.
        What is gone is the presentation of that as the report's final word.
      */}
      <Page size="A4" style={styles.page}>
        <RunningElements clientName={clientName} />
        <Text style={styles.sectionKicker}>Before you close this</Text>
        <Text style={styles.sectionTitle}>How to keep using it</Text>
        <Text style={styles.closingLead}>{cleanText(story.reflectionNote)}</Text>

        <View style={styles.closingList}>
          {CLOSING_NOTES.map((note, index) => (
            <View key={note.heading} style={styles.closingRow} wrap={false}>
              <Text style={styles.closingMark}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={styles.closingCopy}>
                <Text style={styles.closingHeading}>{note.heading}</Text>
                <Text style={styles.closingText}>{note.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.signOff}>
          Nothing here is a verdict. A chart describes the weather you were born
          into, not what you will do about it.
        </Text>

        <Text style={styles.provenance}>{cleanText(provenanceLine(story))}</Text>
      </Page>
    </Document>
  );
}

export default PersonalStoryPdfDocument;
