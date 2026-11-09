# joseocfc.github.io

José Ochoa's portfolio: https://joseocfc.github.io/

Three case studies (a bakery ordering system, a design system, a chart study
of Epoch AI's notable-models data), a process page and an about page.

## Stack

- Hand-written HTML, one `index.html` per page directory (`/work/bakery-orders/`,
  `/process/`, …). `404.html` is served by GitHub Pages for missing URLs.
- Plain CSS in `assets/css/`: `tokens.css` → `base.css` → `components.css` →
  `charts.css` (pages with charts only) → one `pages/<page>.css`.
- Plain JavaScript modules. `assets/js/site.js` runs the header, theme toggle
  and reveal-on-scroll; `assets/js/charts/` is the chart runtime; D3 7.9 is
  loaded from cdnjs only on pages that draw charts.
- Every number a chart draws lives in `data/*.json`. Each figure has a Table
  toggle and a Data download, so the numbers can be checked without the chart.
- Fonts are self-hosted in `assets/fonts/` (licences in `LICENSE.txt`).

**No build step.** No bundler, no package.json, no generated files. What is
in the repo is what is served.

## Run it locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/. Absolute paths (`/assets/…`) need a server
at the root, so opening the files directly from disk will not work. Check
every changed page at 390 px and 1440 px wide, in light and dark.

## Deploy

Push to `main`. GitHub Pages serves the branch root and redeploys in about a
minute. There is no staging copy, so run the checks below before pushing.

## Rules for changing styles

- **Colour values go only in `assets/css/tokens.css`.** Everywhere else, use
  the variables: `var(--ink)`, `var(--accent)`, `var(--series-1)` … The one
  exception is the pair of `theme-color` meta tags in each `<head>`, which
  repeat the paper colours for the browser's own UI.
- Dark mode is declared twice in `tokens.css` (OS preference and the explicit
  toggle). Edit both blocks together; the header comment explains why.
- Type, spacing, radius and motion also come from tokens. Components use the
  classes in `components.css`; page files add layout only.
- Do not add `style=""` attributes; put the rule in the page's stylesheet.
- Charts read colours from the CSS variables at render time, so a token change
  restyles every chart in both themes.

## Charts

Markup, renderer API and behaviour are documented in the header comment of
`assets/js/charts/index.js`. In short: a `<figure data-chart="name"
data-src="/data/….json">` loads `assets/js/charts/<name>.js`, which exports
`render(el, data, ctx)` and `table(data, ctx)`. Shared drawing helpers and
mark sizes are in `assets/js/charts/kit.js`. `/charts-demo.html` renders every
chart type with real data.

The Epoch study's chart is `assets/js/epoch-explorer.js`, drawn from
`data/epoch/notable_models.json` (CC BY 4.0, see `data/epoch/README.md`).
`tools/epoch_chart.py` draws the same chart in matplotlib.

## Checks

The same three checks run in GitHub Actions on every push and pull request
(`.github/workflows/check.yml`).

```sh
# 1. Every served file is referenced by a page, stylesheet, script, JSON file
#    or the sitemap. Lists the orphans and exits 1 if there are any.
python3 tools/check_refs.py

# 2 and 3. HTML and CSS linters. Install them outside the repo so no
#    node_modules lands in the tree.
npm install --prefix /tmp/site-lint html-validate@9 stylelint@16 stylelint-config-standard@39
/tmp/site-lint/node_modules/.bin/html-validate $(git ls-files '*.html')
/tmp/site-lint/node_modules/.bin/stylelint "assets/css/**/*.css" --config-basedir /tmp/site-lint
```

`tools/check_refs.py` has a short allowlist for files that are live without a
link (the internal style guide and chart demo, the font licence); each entry
says why. When you delete a page or an image, run it to catch what the
deletion orphaned.

Linter settings are in `.htmlvalidate.json` and `.stylelintrc.json`. Rules
that only enforce formatting the CSS does not follow (one-line rules, BEM
class names, blank lines) are off. Three html-validate rules are warnings
because the shared figure markup trips them on purpose: `<footer>` after
`<figcaption>` in a figure, `<a download>` whose `href` the chart runtime
fills in, and a stat card's `<footer>` inside a page `<header>`.
