---
name: Decoded
description: AI research, explained for humans.
colors:
  vellum: "#f4f2ec"
  vellum-deep: "#ebe8df"
  hairline: "#dcd8cb"
  ink: "#171a16"
  ink-soft: "#4e534b"
  ink-faint: "#7c8179"
  moss: "#3d5233"
  moss-deep: "color-mix(in oklab, #3d5233 72%, #171a16)"
  moss-light: "color-mix(in oklab, #3d5233 45%, #f4f2ec)"
  moss-soft: "color-mix(in oklab, #3d5233 20%, #f4f2ec)"
  rust: "#96341f"
typography:
  display:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "calc(88 * var(--px))"
    fontWeight: 300
    lineHeight: 1.06
    letterSpacing: "-0.03em"
    fontVariation: "\"opsz\" auto"
  stat-hero:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "calc(96 * var(--px))"
    fontWeight: 300
    lineHeight: 0.95
    letterSpacing: "-0.04em"
    fontFeature: "\"tnum\" 1"
  ledger-value:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "calc(44 * var(--px))"
    fontWeight: 300
    lineHeight: 0.95
    letterSpacing: "-0.035em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "calc(34 * var(--px))"
    fontWeight: 300
    lineHeight: 1.26
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "calc(25 * var(--px))"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "calc(20 * var(--px))"
    fontWeight: 300
    lineHeight: 1.62
    fontFeature: "\"kern\" 1, \"liga\" 1"
  hook:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "calc(18 * var(--px))"
    fontWeight: 300
    lineHeight: 1.5
  label:
    fontFamily: "DM Mono, ui-monospace, monospace"
    fontSize: "calc(12 * var(--px))"
    fontWeight: 300
    letterSpacing: "0.14em"
  data:
    fontFamily: "DM Mono, ui-monospace, monospace"
    fontSize: "calc(12 * var(--px))"
    fontWeight: 300
    lineHeight: 1.45
    letterSpacing: "0.04em"
rounded:
  none: "0px"
  circle: "50%"
spacing:
  design-px: "clamp(0.86px, calc(100vw / 1512), 1.28px)"
  page-pad: "6.2vw"
  page-pad-tablet: "8vw"
  page-pad-phone: "20px"
  ledger-num: "calc(150 * var(--px))"
  ledger-num-phone: "calc(92 * var(--px))"
  ledger-gap: "calc(36 * var(--px))"
  ledger-gap-phone: "calc(18 * var(--px))"
  row: "calc(26 * var(--px))"
  row-phone: "calc(18 * var(--px))"
  section: "calc(72 * var(--px))"
  section-tablet: "calc(56 * var(--px))"
  section-head: "calc(32 * var(--px))"
  masthead-top: "calc(64 * var(--px))"
  masthead-bottom: "calc(48 * var(--px))"
components:
  ledger-row:
    textColor: "{colors.ink}"
    padding: "calc(26 * var(--px)) 0"
    typography: "{typography.title}"
  ledger-number:
    textColor: "{colors.moss}"
    typography: "{typography.ledger-value}"
    width: "calc(150 * var(--px))"
  link-action:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "0 0 calc(6 * var(--px))"
    rounded: "{rounded.none}"
  link-action-hover:
    textColor: "{colors.moss}"
  nav-link:
    textColor: "{colors.ink-faint}"
    typography: "{typography.label}"
    padding: "0 0 calc(5 * var(--px))"
  nav-link-current:
    textColor: "{colors.ink}"
  button-gate-primary:
    backgroundColor: "{colors.moss}"
    textColor: "{colors.vellum}"
    rounded: "{rounded.none}"
    padding: "calc(14 * var(--px)) calc(24 * var(--px))"
  button-gate-primary-hover:
    backgroundColor: "{colors.moss-deep}"
  option:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "calc(12 * var(--px)) calc(18 * var(--px))"
  option-right:
    backgroundColor: "{colors.moss}"
    textColor: "{colors.vellum}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.none}"
    padding: "calc(8 * var(--px)) calc(14 * var(--px))"
  chip-selected:
    textColor: "{colors.moss}"
  input-search:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.ledger-value}"
    padding: "0 0 calc(16 * var(--px))"
  inset:
    backgroundColor: "{colors.vellum-deep}"
    rounded: "{rounded.none}"
    padding: "calc(28 * var(--px)) calc(20 * var(--px)) calc(12 * var(--px))"
  play-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "54px"
---

# Design System: Decoded

## Overview

**Creative North Star: "The Offprint Ledger"**

Decoded reads like a printed offprint that keeps a ledger of findings. The page is vellum paper, the type is ink, and one green, moss, marks what belongs to the paper: its headline number, its own bar in a chart, the thing under the pointer. Structure comes from 1px hairline rules and whitespace on a 16-column grid, never from boxes, cards or shadows. Every list on the site is the same ledger: a number column on the left, title, hook and a mono data line on the right, so a reader scans what was found before what it is called.

Density is tight and editorial rather than airy: no full-screen sections, a fluid design pixel (`--px`, one design pixel at a 1512px viewport, floored at 0.86px so phone type never drops below about 86% of the drawing) and a rhythm of 26px rows and 72px sections. Two light-weight faces split the work: Literata for anything read, DM Mono for anything that is data. Motion is printed-matter motion: rules draw left to right, numbers rise after their rule, lines of a title rise out of a mask.

The site ships pinned to the light theme (`data-theme="light"` on `<html>`). Dark palette values exist in the stylesheet for a future toggle only and are not part of this system until that toggle ships.

**Key Characteristics:**
- Vellum ground, ink text, moss for the paper's own numbers and live state.
- Hairline rules instead of containers; zero corner radius everywhere.
- Literata 300 carries prose and numbers; DM Mono 300 carries labels, dates, units and IDs.
- One list grammar, the findings ledger, on every page.
- Fluid sizing off a single design pixel; mobile collapses to one column at 900px.
- Rule-draw-then-number-rise entrance; no motion without a reduced-motion fallback.

## Colors

A warm paper-and-ink palette with a single dark-green accent that appears where the paper speaks.

### Primary
- **Moss** (`{colors.moss}`): the headline number in every ledger row, the hero stat on the paper page, the "ours" bar in charts, selected chips, active tabs flagged `data-on`, link hover, focus outlines, the correct answer in guess-then-reveal, and the account gate's primary button fill.
- **Moss Deep** (`{colors.moss-deep}`): hover fill of the gate's primary button only.
- **Moss Soft** (`{colors.moss-soft}`): search-match highlight in ledger meta, the fill of "model" nodes in the flow diagram.
- **Moss Light** (`{colors.moss-light}`): the dotted underline of vocabulary terms before hover.

### Neutral
- **Vellum** (`{colors.vellum}`): the page ground, the sticky header ground, text on moss fills.
- **Vellum Deep** (`{colors.vellum-deep}`): the one surface tone; insets that need a floor (flow diagram, code, equations) and skeleton blocks.
- **Hairline** (`{colors.hairline}`): every 1px structural rule (row tops, section heads, rail heads, header bottom, footer top), resting chip/option borders, inactive chart bars, text selection.
- **Ink** (`{colors.ink}`): body text and titles; also the strong 1px rule that marks a hard boundary (hero stat top, gate top, search underline, active tab underline, ledger row rule on hover).
- **Ink Soft** (`{colors.ink-soft}`): hooks, leads, secondary prose, notes.
- **Ink Faint** (`{colors.ink-faint}`): mono labels, nav at rest, meta lines, counts, placeholders, axis text.

### Tertiary
- **Rust** (`{colors.rust}`): errors only, as the label and left rule of an error note.

### Named Rules
**The Paper Speaks in Moss Rule.** Moss marks what the paper found or what is live under the pointer. It is never a section background, a decorative tint or a heading color. Solid moss fills are reserved for three things: the paper's own bar, a correct guess, and the gate's primary action.

**The Two Rule Weights Rule.** A hairline rule (1px, `{colors.hairline}`) divides; an ink rule (1px, `{colors.ink}`) marks a boundary the reader must notice. There is no third weight and no 2px structural line.

## Typography

**Display Font:** Literata, optical-size axis, normal and italic (with Georgia, serif)
**Body Font:** Literata (same family; the `opsz` axis serves 12px through 128px)
**Label/Mono Font:** DM Mono 300 (with ui-monospace, monospace)

**Character:** One light serif reads as both headline and prose, so the page feels typeset rather than designed; a light mono stamps the data the way a journal stamps receipt dates and DOIs.

### Hierarchy
- **Display** (300, `calc(88 * var(--px))`, 56 design px at 900px and below, line-height 1.06, -0.03em): the page title in every masthead. Steps down to 0.66x for titles of 29 to 72 characters and 0.54x above 72, so long paper titles stay on a few lines.
- **Stat Hero** (300, 96 design px, line-height 0.95, -0.04em, tabular, moss): the paper page's headline number; the unit sits at 0.42em glued to the value.
- **Ledger Value** (300, 44 design px; 32 when the value runs past 5 characters, 26 past 7; 34/25/19 on phones; tabular, moss): the number column of every list.
- **Headline** (300, 34 design px, line-height 1.26, -0.02em): empty-state sentences, the gate's title, large callouts; capped near 30ch.
- **Title** (400, 25 design px, 21 on phones, line-height 1.25, -0.012em): ledger row titles, max 40ch. Weight 400 appears only here, on step titles, flow-node labels and the gate's primary button.
- **Body** (300, 20 design px, line-height 1.62): prose at 64ch, leads at 52ch.
- **Hook** (300, 18 design px, 17 on phones, line-height 1.5, ink soft): the one-line hook under a ledger title, max 62ch, clamped to two lines on phones.
- **Label** (DM Mono 300, 12 design px, 13 on phones, 0.14em, uppercase, ink faint): nav, section heads, rail heads, ledger column heads, meta rows, inline actions.
- **Data** (DM Mono 300, 12 design px, 0.04em, sentence case): the ledger's number label ("accuracy on GSM8K"), chart sources, counts.

### Named Rules
**The Two Faces, Two Jobs Rule.** If it is read, it is Literata. If it is a value, unit, date, ID, axis or label, it is DM Mono. Never set prose in mono or labels in the serif.

**The Light Hand Rule.** Default weight is 300 in both faces. Nothing on a shipped surface is bold; emphasis comes from size, color (moss) or an ink rule.

## Layout

A 16-column page grid with fluid gutters (`--gap` is 24/90 of a column), side padding of 6.2vw (8vw at 900px and below, 20px at 640px and below). Everything scales off the design pixel `--px`.

- **Page grammar:** a masthead spans the full grid; below it a reading column of 10 columns and a sticky rail of 4 (columns 13 to 16), two columns of air between them. The rail sticks at 104 design px from the top. Wide sections may take the whole grid.
- **Masthead:** title, optional lead, then a meta row under a hairline (dates, counts, actions in mono). There is no kicker or eyebrow above the title; page data lives in the meta row. An aside takes columns 12 to 16; a plate (figure) takes 11 to 16 with the text in 9 columns.
- **Sections:** 72 design px apart (56 at 900px and below). Each opens with a section head: a hairline above, a mono label left, mono context right, 32 design px before content.
- **Ledger:** a number column of 150 design px and a 36 design px gap (92 and 18 on phones); rows are 26 design px top and bottom (18 on phones).
- **Home:** on desktop the rail rises to the masthead so its first rule sits level with the title; on phones the lead sentence is hidden and the list starts under the title and meta row.
- **Breakpoints:** 900px collapses everything to one column with 40 design px row gaps and un-sticks the rail (a rail holding only hidden content disappears); 640px narrows the ledger, turns the header into wordmark plus account over a horizontally scrolling nav that fades out at the right edge.

**The No Full Screen Rule.** Nothing is sized to the viewport height. Rhythm is vertical and tight; the first phone viewport shows the statement and the start of the list.

## Elevation & Depth

Flat. The system has no shadows. Depth is conveyed by the one surface tone (`{colors.vellum-deep}`) under insets that need a floor, by the ink rule versus hairline contrast, and by the sticky header's vellum ground over a hairline bottom edge.

### Named Rules
**The Flat Paper Rule.** No `box-shadow`, no blur, no glass. If something needs to sit apart, give it the surface tone or an ink rule above it.

## Shapes

Printed, not app-like: `--radius` is 0 and the Tailwind radius scale is pinned to 0px. Borders are 1px lines. The only round forms are true circles: the 54px audio play button, the custom cursor dot (7px, opening to a 54px moss ring over links), and the range-slider thumb. Glyphs and icons are drawn in thin stroke with square caps; flow-diagram nodes are square-cornered rectangles, with dashed strokes for inputs and data.

**The Zero Radius Rule.** Corners are square. A circle is allowed only when the object is a circle (a play button, a cursor, a thumb), never as a softened rectangle or pill.

## Components

### Buttons
The system has almost no buttons; most actions are inline links.
- **Inline action** (the default action everywhere): mono label, uppercase, 0.14em, ink text over a hairline underline with 6 design px clearance; hover turns text and underline moss; `data-on` darkens the underline to ink; disabled at 45% opacity. Arrows and plus/minus are drawn icons (below).
- **Gate primary** (one per page, the sign-up action in the account gate): moss fill, vellum text, Literata 400 at 18 design px, 14 by 24 design px padding, square; hover deepens to moss deep; focus is a 1px moss outline at 3px offset.
- **Play** (audio): 54px ink-outlined circle, transparent; hover turns the outline and icon moss.

### Chips
- **Style:** transparent, 1px hairline border, Literata 300 at 16 design px in ink soft, 8 by 14 design px padding, square.
- **State:** hover borders ink faint and text ink; selected (`aria-selected`) borders and text go moss. Used for glossary terms on the paper page.

### Guess options
Same square, hairline-bordered form as chips at 17 design px with 12 by 18 padding. Hover borders ink. After the reveal: the right answer fills moss with vellum text; a wrong pick turns ink faint with a strike-through; the rest fade to ink faint.

### Cards / Containers
There are no cards. Grouping is done with hairline rules (row tops, section heads, rail heads) and the inset surface (`{colors.vellum-deep}`, no border, no radius) for diagrams, code and equations. Notes ("Where it breaks") are a 1px moss rule on the left with 20 design px indent, mono label in moss, body at 17 design px in ink soft; error notes swap moss for rust.

### Inputs / Fields
- **Search:** no box. Literata 300 at 44 design px on a transparent ground over a 1px ink underline, placeholder ink faint, native cancel button hidden.
- **Slider:** 1px track, circular thumb, moss for the live value.
- **Focus:** global `:focus-visible` is a 2px moss outline at 4px offset; ledger rows, options, chips and sliders use a 1px moss outline at a tighter offset.

### Navigation
- **Header:** sticky, vellum ground, hairline bottom, 20 design px vertical padding. Wordmark in Literata 300 at 22 design px, -0.02em. Nav in mono labels, ink faint, 30 design px apart, each link with a transparent 1px underline; current page goes ink with an ink underline; hover goes ink. "Sign up" is emphasized as ink text over a hairline underline.
- **Tabs and filters:** the same mono labels over a shared hairline; the selected tab gets an ink underline, a `data-on` tab a moss one.
- **Footer:** mono labels, ink faint, hairline top; links hover moss.
- **Mobile:** at 640px the header becomes two rows, wordmark and account above, a horizontally scrolling nav below that fades out over its last 36px.

### Findings Ledger (signature)
The list used on every page: home, archive, topics, authors, institutions, search, library, listen. A mono column head row ("Finding / Paper", "Papers / Topic", "Change / Topic") sits above rows separated by hairline top rules, with a closing hairline at the bottom.
- **Number column:** the value in moss Literata, with `%` and `×` glued to the number at 0.56em; any word unit ("faster", "pts", "papers") drops to its own line at 16 design px in moss; the mono data label sits below in ink faint. A unit already said in the label is not repeated. A decoded paper without a number shows a moss uppercase "Decoded" label; an undecoded one shows a redaction bar and "Not decoded yet".
- **Body:** title (Title role), hook (Hook role), meta line in uppercase mono labels (relative date, up to two categories, Hacker News mention count).
- **Hover:** the row's top rule darkens to ink and the title turns moss; the custom cursor opens to a ring reading "read".
- **Entrance:** each row's top rule draws left to right over 0.9s on the expo curve (`cubic-bezier(0.19, 1, 0.22, 1)`), then the number column fades and rises 0.6em, 0.14s behind its rule. Without JavaScript, and under reduced motion, everything shows at once.

### Compact rows
For short lists (topics in the rail, collaborators, suggestions): Literata 300 label left and mono count right on a baseline, hairline-separated, sizes xs (19 design px), s (28), m (34) and default (40). Hover turns the row moss and nudges it 14px right.

### Icons and glyphs
- **Text icons:** arrow right, arrow left, arrow out, plus, minus, drawn on a 16 grid at 1.05em, 1.3 stroke, square caps, in the current color. They replace Unicode arrows in every link.
- **Glyphs:** 24-grid hand-drawn line glyphs in the text color (or moss for the paper's own steps and gate list), never filled or multicolored.

### Account gate
Below the open part of a paper: an ink rule above, a few redacted ghost lines that show text exists, a Headline-size title at 24ch, a list of what the account unlocks with moss glyphs, then the gate primary button beside an inline action. Loading and failure states keep the same rule and title shape.

## Do's and Don'ts

### Do:
- **Do** size everything in design pixels: `calc(N * var(--px))`, with mobile overrides at 900px and 640px.
- **Do** open every list with the ledger number column, its value in moss and its label in mono.
- **Do** separate with 1px hairlines (`{colors.hairline}`) and reserve the 1px ink rule for hard boundaries.
- **Do** keep page data (dates, counts, actions) in the masthead's meta row under the title.
- **Do** use the drawn text icons for arrows and plus/minus.
- **Do** keep weight 300 as the default and 400 only for ledger titles, step titles, node labels and the gate's primary button.
- **Do** give every entrance a no-JS and reduced-motion state that shows the content immediately.

### Don't:
- **Don't** add corner radius, pills or shadows; the only round shapes are true circles.
- **Don't** wrap content in cards or bordered boxes; use rules and the inset surface.
- **Don't** put a kicker or eyebrow label above a page title.
- **Don't** use Unicode arrows, checkmarks or chevrons as icons.
- **Don't** use moss as a background, heading color or decoration; solid moss fills are the paper's own bar, a correct guess and the gate's primary action.
- **Don't** set prose in DM Mono or labels in Literata.
- **Don't** size sections to the viewport height.
