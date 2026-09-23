import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/*
 * The card a shared link shows, rendered once at build time.
 *
 * Deliberately about the site rather than any one chart. A chart URL carries a
 * name, birth date and birthplace; a preview that printed them would publish
 * someone's details to every person in the chat the link was pasted into.
 *
 * Set in the app's own faces (Cinzel for the name, EB Garamond for the words),
 * read from public/fonts, which the prebuild step copies out of node_modules --
 * the same files the story PDF uses. Satori needs woff or ttf, not woff2.
 */
export const alt = "Lagna Atelier — your Vedic birth chart, read clearly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const root = process.cwd();
  const [cinzel, garamond, garamondItalic, icon] = await Promise.all([
    readFile(join(root, "public/fonts/cinzel-latin-700-normal.woff")),
    readFile(join(root, "public/fonts/eb-garamond-latin-400-normal.woff")),
    readFile(join(root, "public/fonts/eb-garamond-latin-400-italic.woff")),
    readFile(join(root, "public/icon.svg"), "utf8"),
  ]);
  const iconSrc = `data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: "linear-gradient(135deg, #0D0C14 0%, #141024 100%)",
          color: "#F5F0E6",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div
            style={{
              fontFamily: "EB Garamond",
              fontSize: 26,
              letterSpacing: 6,
              color: "#2DA89A",
              textTransform: "uppercase",
            }}
          >
            Vedic birth chart
          </div>
          <div
            style={{
              fontFamily: "Cinzel",
              fontSize: 76,
              lineHeight: 1.05,
              color: "#E8C87A",
              marginTop: 18,
            }}
          >
            Lagna Atelier
          </div>
          <div
            style={{
              fontFamily: "EB Garamond",
              fontStyle: "italic",
              fontSize: 46,
              lineHeight: 1.2,
              marginTop: 26,
            }}
          >
            Your chart, read clearly.
          </div>
          <div style={{ fontFamily: "EB Garamond", fontSize: 30, color: "#A8A090", marginTop: 22 }}>
            Rising sign · Life areas · The timing ahead
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>; next/image cannot run here */}
        <img src={iconSrc} width={340} height={340} alt="" />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cinzel", data: cinzel, weight: 700, style: "normal" },
        { name: "EB Garamond", data: garamond, weight: 400, style: "normal" },
        { name: "EB Garamond", data: garamondItalic, weight: 400, style: "italic" },
      ],
    },
  );
}
