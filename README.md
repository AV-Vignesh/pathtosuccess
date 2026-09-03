# CTO Track

A single-page, dependency-free curriculum and evidence tracker for engineers working toward technology executive roles in large IT services and consulting firms.

Three parts:

- **The ladder** — five stages from technical authority to chief technology officer, expressed as 41 verifiable gates rather than titles, plus a 10-axis competency self-rating, a 40-row evidence ledger, and a gap ledger naming the areas where deep technical work produces no evidence at all.
- **Finance** — 51 lessons across two modules: how a financial system actually works underneath (general ledger, procure-to-pay, order-to-cash, revenue recognition, close, multi-currency, ERP integration patterns), and the financial argument above it (statements, unit economics, capex versus opex, services economics, pricing, FinOps).
- **Technology** — 82 lessons across 12 modules: networking, operating systems, databases, distributed systems, cloud, integration, security, delivery, observability, data platform, AI engineering, and architecture governance.

Every lesson has four to five key points, a level tag, one concrete exercise, and a notes field.

## Running it

Open `index.html`. That is all. No build step, no package manager, no CDN, no network access required.

Content is loaded via plain `<script>` tags rather than `fetch`, so it works from `file://` as well as over HTTP.

### GitHub Pages

Push to a public repository and enable Pages from the `main` branch, root folder. The `.nojekyll` file stops Jekyll from processing the directory.

## Where your progress lives

`localStorage`, in the browser you use, under the key `ctoTrack.v1`. Nothing is sent anywhere. Clearing site data erases it, and it does not follow you to another device.

Export from the Progress view once a month. Import replaces the whole stored state — it does not merge.

## How the numbers work

| Number | Definition |
| --- | --- |
| Learning | Lessons marked done, over 133 total |
| Readiness | Mean of gate completion, evidence completion, and average self-rating over 5 |
| Overall | 0.6 × readiness + 0.4 × learning |

Readiness is weighted higher because it is the part someone else could verify. A high learning score with a low readiness score means you have been reading instead of accumulating evidence, which is the failure mode this app exists to make visible.

## AI tutor (optional)

Settings accepts an Anthropic API key so you can ask questions against any lesson's context. The key is stored in `localStorage` only and is never committed.

Understand the trade-off before using it: a key used from a browser page is readable by anything running on that page and by anyone who opens developer tools. Use a personal key with a low spend limit. Do not use a shared or employer key.

## Interface

Dark product-app UI. Left rail navigation on desktop, a scrolling pill bar on mobile. The ladder is split into four tabs (gates, competencies, evidence, gaps) rather than one long scroll, and each curriculum track uses a module chip selector so you look at one module at a time instead of twelve stacked accordions.

Preferences: six themes (Midnight, Graphite, Slate, Dim, Light, Contrast), seven accents, four text sizes, three typefaces, three densities, reduced motion, and a focus mode that hides every figure while you read.

Charts are hand-drawn SVG — a competency radar and a snapshot trend line. No chart library.

## Content scope

Deliberately vendor-neutral and employer-neutral. NetSuite is used as the running example in the ERP module and cloud examples lean Azure, but the concepts transfer. No company names, client names, internal project names or colleague names appear anywhere in this repository.

## Layout

```
index.html
assets/styles.css
assets/app.js
content/ladder.js     stages, gates, competencies, evidence, gaps
content/finance.js    ERP and corporate finance lessons
content/tech.js       technology lessons
```

To add a lesson, append an object to the relevant module's `lessons` array with a unique `id`, a `lvl` of `F`, `P`, `A` or `L`, four or more `k` bullets, and a `do` exercise. Nothing else needs changing; counts and percentages are computed at runtime.

## Licence

MIT.
