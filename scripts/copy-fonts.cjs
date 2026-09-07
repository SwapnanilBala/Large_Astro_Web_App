/**
 * Copies the PDF typefaces out of node_modules into public/fonts.
 *
 * The personal-story PDF is rendered in the browser (personal-story.tsx calls
 * pdf().toBlob()), so @react-pdf/renderer needs to fetch each face over HTTP --
 * a node_modules path only works for server-side rendering. Copying at build
 * time keeps the binaries out of git while still serving them as static assets.
 *
 * Runs from `predev` and `prebuild`. public/fonts is gitignored.
 *
 * Because those are npm lifecycle hooks, anything that builds the app has to
 * go through npm for them to fire -- `vercel.json` therefore sets buildCommand
 * to `npm run build`, not `next build`. Calling the binary directly skips the
 * hook, ships a deployment with no public/fonts, and the story PDF fails in the
 * browser with a 404 on the first typeface.
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

/**
 * Locates a file inside an installed package by asking Node to resolve it,
 * returning null when the package genuinely is not there.
 *
 * Joining __dirname to "../node_modules" would be shorter but only works in the
 * primary checkout. Git worktrees never get a node_modules of their own -- it
 * is the first line of .gitignore, so git does not materialise it -- and instead
 * pick the dependencies up from the primary checkout further up the tree, the
 * way `next` and `tsc` already do. A literal path skips that lookup and fails in
 * every worktree even though the font is sitting right there for require().
 */
function resolveInPackage(pkg, relPath) {
  try {
    return require.resolve(`${pkg}/${relPath}`);
  } catch {
    // A package whose "exports" map does not publish this subpath still exports
    // its own package.json by convention, so resolve that and walk from its dir.
    try {
      const src = path.join(path.dirname(require.resolve(`${pkg}/package.json`)), relPath);
      return fs.existsSync(src) ? src : null;
    } catch {
      return null;
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let copied = 0;
for (const [pkg, file] of FACES) {
  const src = resolveInPackage(pkg, `files/${file}`);
  if (!src) {
    console.error(`[copy-fonts] missing ${pkg}/files/${file} -- run npm install`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(OUT_DIR, file));
  copied++;
}

// The OFL requires the copyright notice and licence to travel with the font
// files wherever they are redistributed, and public/ is served to the client.
for (const pkg of ["@fontsource/cinzel", "@fontsource/eb-garamond"]) {
  const src = resolveInPackage(pkg, "LICENSE");
  if (src) {
    const name = `${pkg.split("/")[1]}-OFL.txt`;
    fs.copyFileSync(src, path.join(OUT_DIR, name));
    copied++;
  }
}

console.log(`[copy-fonts] copied ${copied} files to public/fonts`);
