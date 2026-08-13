import { mkdirSync } from "node:fs";
import path from "node:path";
import React from "react";
import { Font, renderToFile } from "@react-pdf/renderer";
import type { ChartApiResponse } from "@/lib/astro-types";
import { buildChart } from "@/lib/engines/chart-service";
import type { BirthDetailsInput } from "@/lib/engines/compatibility-service";
import { buildPersonalStory } from "@/lib/story-engine";
import { verifyChartForStory } from "@/lib/story-verification";
import { PersonalStoryPdfDocument } from "@/app/insights/components/personal-story-pdf";

const root = process.env.STORY_PDF_ROOT || path.resolve(__dirname, "..");
const fonts = path.join(root, "public", "fonts");
const outputDir = path.join(root, "output", "pdf");

Font.register({
  family: "Cinzel",
  fonts: [
    { src: path.join(fonts, "cinzel-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(fonts, "cinzel-latin-700-normal.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "EBGaramond",
  fonts: [
    { src: path.join(fonts, "eb-garamond-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(fonts, "eb-garamond-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
    { src: path.join(fonts, "eb-garamond-latin-600-normal.woff"), fontWeight: 600 },
  ],
});

const birth: BirthDetailsInput = {
  name: "Ananya Mehra",
  birth_date: "1990-06-15",
  birth_time: "14:30",
  latitude: 28.6139,
  longitude: 77.209,
  timezone_offset_minutes: 330,
  country: "India",
  state: "Delhi",
  city: "New Delhi",
  town: "",
  time_zone_id: "Asia/Kolkata",
  engine_id: "lahiri_classic",
  birth_time_accuracy: "exact",
  birth_time_source: "exact",
  birth_time_fallback: false,
};

async function main() {
  const payload = buildChart(birth, {
    includeTransits: true,
    includePremium: true,
    includeUltimate: true,
    deferLifeDomains: false,
  }) as unknown as ChartApiResponse;
  const verification = verifyChartForStory(payload);
  if (verification.status === "failed") {
    throw new Error("Sample report did not pass verification.");
  }
  const story = buildPersonalStory(payload, { verification });

  mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "sample-client-personal-story.pdf");

  await renderToFile(
    <PersonalStoryPdfDocument
      story={story}
      clientName={payload.client.name}
      ascendant={payload.chart.ascendant.sign}
      locationLabel="New Delhi, Delhi, India"
      generatedOn="August 13, 2026"
    />,
    outputPath,
  );

  console.log(outputPath);
}

void main();
