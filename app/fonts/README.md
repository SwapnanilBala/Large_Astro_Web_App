# Webfonts

The faces the site loads, kept in the repo so that no build or dev server
has to reach Google. `next/font/local` in `app/(desktop)/layout.tsx` and
`app/m/layout.tsx` reads them from here.

| File | Used by | What it is |
| --- | --- | --- |
| `marcellus-latin-400-normal.woff2` | desktop `--font-display` | Marcellus Regular (its only weight), Latin subset |
| `source-serif-4-latin-wght-normal.woff2` | desktop `--font-prose` | Source Serif 4, variable weight 400–700, Latin subset |
| `source-serif-4-latin-wght-italic.woff2` | desktop `--font-prose` | The italic of the above |
| `inter-latin-wght-normal.woff2` | desktop `--font-ui` | Inter, variable weight 400–700, Latin subset |
| `newsreader-latin-400-normal.woff2` | mobile `--font-display-m` | Newsreader Regular, static, Latin subset (22KB, for the handset budget) |

The desktop three replaced Cinzel and Newsreader on 2026-10-26, chosen by the
owner for clarity (see the comment in the desktop layout). The PDF report
draws with its own copies in `public/fonts`, which this did not change.

They are the files `fonts.googleapis.com/css2` served for these requests,
Latin subset only:

- `family=Marcellus`
- `family=Source+Serif+4:ital,wght@0,400..700;1,400..700`
- `family=Inter:wght@400..700`
- `family=Newsreader` (mobile, 400)

Asking for the weight axis alone keeps the variable files small: Source Serif
4 with its optical-size axis as well is 122KB a style, against 51KB. Nothing
on the site needs more than Latin: no UI string uses a character outside it,
and a rare one, such as the ł in a visitor's name, falls back to the
size-matched fallback face. Hindi and Bengali use the device's own fonts, as
before.

To refresh one, request the stylesheet with a current browser user agent and
download the woff2 listed under `/* latin */`.

All are under the SIL Open Font License 1.1, which allows redistribution with
the license attached: `OFL-Marcellus.txt`, `OFL-SourceSerif4.txt`,
`OFL-Inter.txt` and `OFL-Newsreader.txt`, from
[google/fonts](https://github.com/google/fonts).
