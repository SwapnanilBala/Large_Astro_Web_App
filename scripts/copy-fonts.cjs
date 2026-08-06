/**
 * Copies the PDF typefaces out of node_modules into public/fonts.
 *
 * The personal-story PDF is rendered in the browser (personal-story.tsx calls
 * pdf().toBlob()), so @react-pdf/renderer needs to fetch each face over HTTP --
 * a node_modules path only works for server-side rendering. Copying at build
 * time keeps the binaries out of git while still serving them as static assets.
 *
 * Runs from `predev` and `prebuild`. public/fonts is gitignored.
 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "public", "fonts");

const FACES = [
  ["@fontsource/cinzel", "cinzel-latin-400-normal.woff"],
  ["@fontsource/cinzel", "cinzel-latin-700-normal.woff"],
  ["@fontsource/eb-garamond", "eb-garamond-latin-400-normal.woff"],
  ["@fontsource/eb-garamond", "eb-garamond-latin-400-italic.woff"],
  ["@fontsource/eb-garamond", "eb-garamond-latin-600-normal.woff"],
];

fs.mkdirSync(OUT_DIR, { recursive: true });

let copied = 0;
for (const [pkg, file] of FACES) {
  const src = path.join(__dirname, "..", "node_modules", pkg, "files", file);
  if (!fs.existsSync(src)) {
    console.error(`[copy-fonts] missing ${pkg}/files/${file} -- run npm install`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(OUT_DIR, file));
  copied++;
}

// The OFL requires the copyright notice and licence to travel with the font
// files wherever they are redistributed, and public/ is served to the client.
for (const pkg of ["@fontsource/cinzel", "@fontsource/eb-garamond"]) {
  const src = path.join(__dirname, "..", "node_modules", pkg, "LICENSE");
  if (fs.existsSync(src)) {
    const name = `${pkg.split("/")[1]}-OFL.txt`;
    fs.copyFileSync(src, path.join(OUT_DIR, name));
    copied++;
  }
}

console.log(`[copy-fonts] copied ${copied} files to public/fonts`);
