# Webfonts

The two faces the site loads, kept in the repo so that no build or dev server
has to reach Google. `next/font/local` in `app/(desktop)/layout.tsx` and
`app/m/layout.tsx` reads them from here.

| File | Used by | What it is |
| --- | --- | --- |
| `cinzel-latin-wght-normal.woff2` | desktop `--font-display` | Cinzel, variable weight 400–900, Latin subset |
| `newsreader-latin-wght-normal.woff2` | desktop `--font-newsreader` | Newsreader, variable weight 200–800 at the 16pt optical size, Latin subset |
| `newsreader-latin-wght-italic.woff2` | desktop `--font-newsreader` | The italic of the above |
| `newsreader-latin-400-normal.woff2` | mobile `--font-display-m` | Newsreader Regular, static, Latin subset (22KB, for the handset budget) |

They are the files `fonts.googleapis.com/css2` served for the requests the
layouts used to make through `next/font/google`, Latin subset only. Nothing on
the site needs more: no UI string uses a character outside it, and a rare one,
such as the ł in a visitor's name, falls back to the size-matched serif.

To refresh one, request the stylesheet with a current browser user agent, for
example
`https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&display=swap`,
and download the woff2 listed under `/* latin */`.

Both are under the SIL Open Font License 1.1, which allows redistribution with
the license attached: `OFL-Cinzel.txt` and `OFL-Newsreader.txt`, from
[google/fonts](https://github.com/google/fonts).
