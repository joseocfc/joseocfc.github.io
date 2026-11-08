# Image manifest — `site/assets/img/`

Lane A3 · generated 2026-11-07 from the files on disk. Optimised copies of `research/assets/{bakery,figma,theme,other}/` (originals untouched).

**51 files · 7.3 MB total · every raster ≤ 1800px wide and < 400 KB · nothing upscaled.**

Encoding: JPEG q82, progressive, 4:2:0 for photo-heavy screens and 4:4:4 for UI (keeps coloured text crisp); PNG only where it came out smaller than the JPEG; one file stepped down to q78 to stay under 400 KB (menu). `q` column = what was used. Paths below are relative to `/assets/img/`.

Use the suggested alt text as a starting point; the copy lane may sharpen it. `.media--phone` suits the 375/390 captures; `.media--browser` suits the 1280/1440 ones.


## Bakery Orders (case study 1)

| File | Size (px) | Bytes | q | What it shows | Use on | Suggested alt |
|---|---|---:|---|---|---|---|
| `bakery/admin-bakery-dashboard-day-view-1280.jpg` | 1265×1622 | 222,858 | 82 | wp-admin bakery dashboard, day view: pickup-day rail, status filters, orders per store (local demo orders, no names). | Bakery §7 Outcome | The bakery's staff dashboard: a rail of pickup days and tomorrow's orders grouped by store |
| `bakery/admin-deli-dashboard-1280.jpg` | 1196×1600 | 214,979 | 82 | Deli dashboard with turkey stock tracker, pickup days, orders per store. Cropped before the customer column. | Bakery §7 Outcome | The deli's holiday dashboard with a turkey stock tracker and orders by store |
| `bakery/email-bakery-order-confirmed-1200.jpg` | 1200×3636 | 269,590 | 82 | Order-confirmed email, full length. Test customer 'Sam Baker', example.com address. | Bakery §7 Outcome; §3 insight 8 (emails use literal values) | The order-confirmed email: pickup day, items with photos, total and a change-or-cancel button |
| `bakery/photo-german-chocolate-cake.jpg` | 1800×1350 | 245,540 | 82 | Product photo, German chocolate cake on a stand with a slice (final 4:3 series). | Home bakery work-card or bakery §0/§7 accent | A German chocolate cake on a white stand with one slice on a plate |
| `bakery/photo-strawberry-cream-roll.jpg` | 1800×1350 | 359,531 | 82 | Product photo, strawberry cream roll with pastel buttercream flowers. | Bakery accent / Home card alternative | A sliced strawberry cream roll decorated with pastel buttercream flowers |
| `bakery/print-ticket-three-copies-1280.jpg` | 1280×1416 | 113,247 | 82 | Ticket in three copies (Production, Pickup/Routing, Office record). Test data, 555 phone number. | Bakery §3 insight 'print on a click' (featured) or §7 | A bakery order ticket printed in three copies: production, pickup and office record |
| `bakery/storefront-builder-step-1-pickup-1280.jpg` | 1280×919 | 84,523 | 82 | Builder step 1, Pickup: October calendar with three day states, store choice, running summary. | Bakery §3 insight 'pickup first' (featured) | Step one of the cake builder: choose a pickup date on a calendar, then a store |
| `bakery/storefront-builder-step-4-build-sheet-375.jpg` | 750×1624 | 98,217 | 82 | 375 builder with the current-selection build sheet open (frosting step). | Bakery §4 Design (media row) | The cake builder on a phone with the build summary sheet open |
| `bakery/storefront-builder-step-5-review-1280.jpg` | 1280×1040 | 122,986 | 82 | Step 5, extras and the review card at 1280. | Bakery §4 Design | The last builder step: message, finishing touches and a review of the whole order |
| `bakery/storefront-cart-1280.jpg` | 1280×1042 | 93,047 | 82 | Cart with pickup summary and a cross-sell row. | Bakery §4/§5 | The bakery cart with pickup details, two items and suggested add-ons |
| `bakery/storefront-confirmation-1280.jpg` | 1280×900 | 79,537 | 82 | Order confirmed: pickup details, change/cancel note, add-to-calendar. | Bakery §3 insight 13 (change window) or §7 | The order-confirmed screen with pickup details and an add-to-calendar button |
| `bakery/storefront-holiday-landing-1280.jpg` | 1280×1201 | 109,202 | 82 | Thanksgiving landing in season: leaf garland, deli menu cards (contains a table-spread food photo, no people). | Bakery §7 Outcome (holiday opened 2026-11-04) | The Thanksgiving ordering landing page with deli menu sections |
| `bakery/storefront-landing-1440.jpg` | 1440×1527 | 126,690 | 82 | Built bakery landing at 1440: header, 'Fresh From Our Ovens', seasonal specials, the menu categories. | Bakery §0 hero (`.media--browser`, paired with the 375 shot); Home work-card | The bakery ordering landing page at desktop width, with seasonal specials and menu categories |
| `bakery/storefront-landing-375.jpg` | 750×2268 | 139,787 | 82 | Same landing at 375 (2× capture). | Bakery §0 hero (`.media--phone`) | The bakery ordering landing page on a phone |
| `bakery/storefront-menu-view-all-1280.jpg` | 1280×3843 | 389,104 | 78 | Full menu, every category with product photos, diet filter chips, the Build Your Own banner. Tall (3843px). | Bakery §4 or §7 (scale of the catalog); crop with `object-fit` if shown in a frame | The full bakery menu: custom cakes, signature cakes, cupcakes, cheesecakes, cream rolls and cookies |

## Figma — CFC System (design system + bakery design)

| File | Size (px) | Bytes | q | What it shows | Use on | Suggested alt |
|---|---|---:|---|---|---|---|
| `figma/bakery-components-final.jpg` | 1800×1950 | 190,394 | 82 | bakery/final component sheet: chips, option-cards, calendar, headers, build-summary variants, cart rows. | Bakery §4 media row (spec: 22-…) | The bakery component sheet in Figma: chips, option cards, calendar, headers and summaries |
| `figma/bakery-email-order-confirmed.jpg` | 1200×1878 | 153,967 | 82 | Email design board: 'Order confirmed' with copy notes. | Bakery §4 or §7 (design → built email) | Figma design of the order-confirmed email with annotation notes |
| `figma/bakery-f1-landing-375.jpg` | 375×1732 | 81,492 | 82 | F1 landing frame at 375 (image placeholders). | Bakery §4 — design vs build pair with storefront-landing-375 | Figma mobile frame of the bakery landing page |
| `figma/bakery-f11-cart-375.jpg` | 375×949 | 44,832 | 82 | F11 cart at 375 with cross-sell. | Bakery §4 (optional) | Figma mobile frame of the cart |
| `figma/bakery-f5-builder-pickup-375.jpg` | 375×1162 | 56,378 | 82 | F5 Builder step 1 Pickup (375 frame): progress, calendar, location cards, price drawer. | Bakery §4 media row (spec: 21-…) | Figma mobile frame of the pickup step with a calendar and two store options |
| `figma/bakery-final-journey-375.jpg` | 1800×1365 | 132,096 | 82 | Final Journey F1→F13 at 375 with flow arrows. | Bakery §4 media row (spec: 20-…) | The 13-screen mobile ordering journey in Figma, connected by flow arrows |
| `figma/bakery-meeting-deck-2026-07-29.jpg` | 1800×1115 | 155,857 | 82 | Stakeholder deck: the eight-step paper flow before/after, feature inventory, staff console. | Bakery §1 The problem / §2 Research | Meeting deck in Figma: the eight-step order flow before and after, and what the system does and does not do |
| `figma/bakery-page-overview.jpg` | 1800×1340 | 110,393 | 82 | Zoomed-out 'Online bakery' page: deck, wireframes, journey, parity set, emails. Details unreadable by design. | Bakery §4 Design (scale of the workspace) | Zoomed-out view of the whole bakery design workspace in Figma |
| `figma/board-of-directors-hub-1440.jpg` | 1340×2048 | 191,841 | 82 | Board of Directors page design reusing Header V2, Footer B, Button. Staff contact line removed. | Design system — the system reused on other pages | A co-op website page design built from the library header, footer and buttons |
| `figma/changelog.jpg` | 1276×1037 | 305,844 | 82 | Changelog page, five dated entries 2026-07-17 → 2026-08-21. | Design system — change protocol + 'what's weak' (stops in August) | The Figma changelog with five dated entries |
| `figma/ds-buttons-105-variants.jpg` | 1697×3200 | 343,646 | 82 | 05 Button component set: 7 variants × 3 sizes × 5 states + placement rules (higher-res capture). | Design system — 'buttons 105 variants' (strongest Figma proof); Home DS card | The Figma button component set: seven variants in three sizes and five states |
| `figma/ds-colors.jpg` | 1688×1556 | 161,608 | 82 | 01 Colors: 10 brand ordinals + dashed 'no senary' gap, neutral ramp, semantic WCAG pairs, 5 alpha steps. | Design system — six token families / Figma evidence | Figma colour section: ten brand swatches with slugs and hex values, a deliberate gap, neutrals and semantic pairs |
| `figma/ds-cover-frozen-v1.0.jpg` | 1172×1038 | 142,536 | 82 | Figma Cover: 'FROZEN v1.0 · 2026-07-17 · theme.json @ 1a43808' stamp, rule cards. | Design system — Figma evidence; 'what's weak' (still says PROVISIONAL) | The Figma file cover with the frozen v1.0 contract stamp and five rule cards |
| `figma/ds-elevation-effects.jpg` | 1486×1050 | 118,340 | 82 | 04 Shadow styles + the documented z ladder (not variables). | Design system — 'deliberately not variables' | Figma elevation section: four shadow styles and a documented z-index ladder |
| `figma/ds-header-footer.jpg` | 1428×951 | 108,097 | 82 | 06 Header V2 with Moss dropdown, Footer B, from library instances. | Design system — Figma evidence | Figma header and footer components for the co-op website |
| `figma/ds-icons.jpg` | 1528×410 | 54,325 | 82 | 07 Eight traced icons (currentColor). | Design system (optional) | Eight traced interface icons |
| `figma/ds-spacing-radius.png` | 1456×1078 | 101,496 | lossless | 03 Spacing ladder 8–64 and radius specimens to pill. | Design system — token families | Figma spacing ladder and corner-radius specimens |
| `figma/ds-typography.jpg` | 1672×1519 | 193,672 | 82 | 02 Typography: Mobile/Desktop specimens (variable modes = clamp endpoints), role map. | Design system — 'modes = clamp endpoints' | Figma typography section showing mobile and desktop sizes side by side |
| `figma/ds-usage-rules.jpg` | 1376×682 | 92,274 | 82 | 09 Usage & rules: the contract in four rules (freeze, mapping rule, change protocol, drift detection). | Design system — the change protocol | Figma usage card listing the four rules of the token contract |
| `figma/file-thumbnail-cfc-web-design-2026.jpg` | 1800×1012 | 89,691 | 82 | File thumbnail 'CFC Web Design 2026 · by Jose Ochoa' with sunburst. | Home design-system work-card (optional) | Title card reading CFC Web Design 2026, by José Ochoa |
| `figma/token-board.jpg` | 1497×3000 | 290,883 | 82 | Token Board: THEME / BAKERY-ONLY / PROPOSED columns, legend, sync note (tall, 1497×3000). | Design system — governance / parity | The Figma token board: every token in one of three columns, theme, bakery-only or proposed |

## Live site — communityfood.coop (design system)

| File | Size (px) | Bytes | q | What it shows | Use on | Suggested alt |
|---|---|---:|---|---|---|---|
| `theme/live-cooking-classes-1440-cards.jpg` | 1440×1270 | 242,864 | 82 | Live cooking-classes filters and six class cards; Moss cards with the Outline Inverse 'Details' button (variant 7). | Design system — Outline Inverse in production | Cooking-class cards on the live site, dark green with outlined Details buttons |
| `theme/live-current-sales-1440-top.jpg` | 1440×1730 | 210,784 | 82 | Live 'Sales, Deals & Specials' at 1440: deal buttons, Honeysuckle category bar, produce grid. | Design system (optional, system in use) | The live deals page with a produce grid |
| `theme/live-home-1440-top.jpg` | 1440×1580 | 284,276 | 82 | Live communityfood.coop home at 1440, top: header, hero, member sale, turkey, meal rows (food photos only). Captured 2026-11-07. | Design system — live-site screenshot (home 1440) | The live co-op home page at desktop width |
| `theme/live-home-390-top.jpg` | 390×2440 | 181,941 | 82 | Live home at 390 (1×), top section through 'Custom Baked Treats'. | Design system — live-site screenshot (home 390) | The live co-op home page on a phone |

## Supporting projects

| File | Size (px) | Bytes | q | What it shows | Use on | Suggested alt |
|---|---|---:|---|---|---|---|
| `other/figma-nanny-button-variants.jpg` | 911×105 | 9,720 | 82 | Figma button component set (style × size). | Optional (Figma evidence) | Figma button variants |
| `other/figma-nanny-tokens-colors.jpg` | 900×437 | 29,819 | 82 | Figma color tokens, 15 named swatches. | Optional (Figma evidence) | Figma colour tokens: fifteen named swatches with hex values |
| `other/figma-nanny-tokens-type.png` | 900×680 | 30,968 | png8-lossless | Figma type scale (Fraunces display, Nunito Sans body). | Optional (Figma evidence) | Figma type scale with display and body styles |
| `other/humboldt-site-plan-fence.png` | 687×480 | 43,742 | lossless | CAD site plan generated from city GIS: lot, house, fence run, posts every 6 ft (no address). | /process or /about (optional) | A dark CAD site plan with a fence line, posts and dimensions |
| `other/nanny-favicon.svg` | vector | 2,664 | copied | Nanny funnel monogram mark (vector). | Optional | Monogram mark for the nanny-care site |
| `other/nanny-flyer-a.jpg` | 816×1056 | 80,741 | 82 | Print flyer A (warm minimal) with QR. | Optional (print range) | A letter-size flyer with a QR code |
| `other/nanny-flyer-c.jpg` | 816×1056 | 95,207 | 82 | Print flyer C (story-led, pull quote) with QR. | Optional (print range) | A letter-size flyer with a pull quote and a QR code |
| `other/nanny-form-success-390.jpg` | 390×844 | 36,205 | 82 | Form success state at 390. | Optional | Form confirmation: thank you, your note is on its way |
| `other/nanny-site-desktop-1440-top.jpg` | 1440×1700 | 201,829 | 82 | Nanny funnel landing at 1440 (first live build; photo placeholder, no portrait). | Home 'More work' card (nanny funnel) | A nanny-care landing page with a serif headline and sage palette |
| `other/nanny-site-mobile-390-top.jpg` | 390×1300 | 51,140 | 82 | Same page at 390, top. | Home 'More work' (optional phone frame) | The nanny-care landing page on a phone |
| `other/project-net-logo.svg` | vector | 371 | copied | Project Net knot mark (vector). No screenshots of Project Net exist. | Home 'More work' card (Project Net) | Project Net mark: three interlocking rings |

## Source map

| File | Source in `research/assets/` | Treatment |
|---|---|---|
| `bakery/admin-bakery-dashboard-day-view-1280.jpg` | `bakery/admin-bakery-dashboard-day-view-1280.png` | re-encoded |
| `bakery/admin-deli-dashboard-1280.jpg` | `bakery/admin-deli-dashboard-kurt-screen-1280.png` | cropped to 1196×1600 (removes the customer name/phone/email column) |
| `bakery/email-bakery-order-confirmed-1200.jpg` | `bakery/email-bakery-order-confirmed-1200.png` | re-encoded |
| `bakery/photo-german-chocolate-cake.jpg` | `bakery/photo-german-chocolate-cake-hero.jpg` | resized to ≤1800px |
| `bakery/photo-strawberry-cream-roll.jpg` | `bakery/photo-strawberry-cream-roll-hero.jpg` | resized to ≤1800px |
| `bakery/print-ticket-three-copies-1280.jpg` | `bakery/print-ticket-three-copies-1280.png` | re-encoded |
| `bakery/storefront-builder-step-1-pickup-1280.jpg` | `bakery/storefront-builder-step-1-pickup-1280.png` | re-encoded |
| `bakery/storefront-builder-step-4-build-sheet-375.jpg` | `bakery/storefront-builder-step-4-build-sheet-375.png` | re-encoded |
| `bakery/storefront-builder-step-5-review-1280.jpg` | `bakery/storefront-builder-step-5-review-1280.png` | re-encoded |
| `bakery/storefront-cart-1280.jpg` | `bakery/storefront-cart-1280.png` | re-encoded |
| `bakery/storefront-confirmation-1280.jpg` | `bakery/storefront-confirmation-1280.png` | re-encoded |
| `bakery/storefront-holiday-landing-1280.jpg` | `bakery/storefront-holiday-landing-1280.png` | re-encoded |
| `bakery/storefront-landing-1440.jpg` | `bakery/storefront-landing-1440.png` | re-encoded |
| `bakery/storefront-landing-375.jpg` | `bakery/storefront-landing-375.png` | re-encoded |
| `bakery/storefront-menu-view-all-1280.jpg` | `bakery/storefront-menu-view-all-1280.png` | re-encoded |
| `figma/bakery-components-final.jpg` | `figma/22-bakery-components-final.png` | resized to ≤1800px |
| `figma/bakery-email-order-confirmed.jpg` | `figma/24-bakery-email-order-confirmed.png` | re-encoded |
| `figma/bakery-f1-landing-375.jpg` | `figma/23-bakery-f1-landing-mobile.png` | re-encoded |
| `figma/bakery-f11-cart-375.jpg` | `figma/25-bakery-f11-cart-mobile.png` | re-encoded |
| `figma/bakery-f5-builder-pickup-375.jpg` | `figma/21-bakery-f5-builder-step1-pickup-mobile.png` | re-encoded |
| `figma/bakery-final-journey-375.jpg` | `figma/20-bakery-final-journey-375-all-13-screens.png` | resized to ≤1800px |
| `figma/bakery-meeting-deck-2026-07-29.jpg` | `figma/26-bakery-meeting-deck-2026-07-29.png` | resized to ≤1800px |
| `figma/bakery-page-overview.jpg` | `figma/19-online-bakery-page-overview.png` | resized to ≤1800px |
| `figma/board-of-directors-hub-1440.jpg` | `figma/30-board-of-directors-hub.png` | staff name/phone/email line painted out |
| `figma/changelog.jpg` | `figma/11-changelog.png` | re-encoded |
| `figma/ds-buttons-105-variants.jpg` | `theme/figma-05-buttons.png` | from the higher-res theme/ capture (figma/05 is a 1063px duplicate) |
| `figma/ds-colors.jpg` | `figma/01-ds-colors.png` | re-encoded |
| `figma/ds-cover-frozen-v1.0.jpg` | `figma/00-cover-frozen-v1.0.png` | re-encoded |
| `figma/ds-elevation-effects.jpg` | `figma/04-ds-elevation-effects.png` | re-encoded |
| `figma/ds-header-footer.jpg` | `figma/06-ds-header-footer.png` | re-encoded |
| `figma/ds-icons.jpg` | `figma/07-ds-icons.png` | re-encoded |
| `figma/ds-spacing-radius.png` | `figma/03-ds-spacing-radius.png` | re-encoded |
| `figma/ds-typography.jpg` | `figma/02-ds-typography.png` | re-encoded |
| `figma/ds-usage-rules.jpg` | `figma/09-ds-usage-rules.png` | re-encoded |
| `figma/file-thumbnail-cfc-web-design-2026.jpg` | `figma/00b-thumbnail-cfc-web-design-2026.png` | resized to ≤1800px |
| `figma/token-board.jpg` | `theme/figma-token-board.png` | from the higher-res theme/ capture (figma/10 is a 1022px duplicate) |
| `theme/live-cooking-classes-1440-cards.jpg` | `theme/live-cooking-classes-1440.png` | cropped to y 1080–2350 (filters + cards; hero and classroom photos with people excluded) |
| `theme/live-current-sales-1440-top.jpg` | `theme/live-current-sales-1440.png` | cropped to the top 1730px |
| `theme/live-home-1440-top.jpg` | `theme/live-home-1440.png` | cropped to the top 1580px (above the first photo with people) |
| `theme/live-home-390-top.jpg` | `theme/live-home-390.png` | cropped to the top 2440px (above the first photo with people) |
| `other/figma-nanny-button-variants.jpg` | `other/figma-nanny-button-variants.png` | re-encoded |
| `other/figma-nanny-tokens-colors.jpg` | `other/figma-nanny-tokens-colors.png` | re-encoded |
| `other/figma-nanny-tokens-type.png` | `other/figma-nanny-tokens-type.png` | re-encoded |
| `other/humboldt-site-plan-fence.png` | `other/humboldt-site-plan-fence-6ft.png` | re-encoded |
| `other/nanny-favicon.svg` | `other/nanny-favicon.svg` | copied as-is |
| `other/nanny-flyer-a.jpg` | `other/nanny-flyer-a.png` | re-encoded |
| `other/nanny-flyer-c.jpg` | `other/nanny-flyer-c.png` | re-encoded |
| `other/nanny-form-success-390.jpg` | `other/nanny-form-success-mobile.png` | re-encoded |
| `other/nanny-site-desktop-1440-top.jpg` | `other/nanny-site-desktop-1440.png` | cropped to the top 1700px |
| `other/nanny-site-mobile-390-top.jpg` | `other/nanny-site-mobile-390.png` | cropped to the top 1300px |
| `other/project-net-logo.svg` | `other/project-net-logo.svg` | copied as-is |

## Not copied, and why

| Source (`research/assets/…`) | Reason |
|---|---|
| `figma/31-homepage-newsletter-popup-split.png` | Real people's faces (festival crowd photo in the pop-up). |
| `figma/32-email-newsletter-direction-2.1.png` | Real person's face in the masthead photo; names a staff member in a pull quote. |
| `other/nanny-og-share-card-1200x630.png` | Portrait of José's partner (SPEC §1: no partner photo). |
| `other/figma-nanny-poster-a.png` | Same portrait. |
| `other/figma-nanny-landing-desktop.png` | Same portrait in the hero. |
| `other/humboldt-site-plan-gis.png` | José's home address in the title block plus the surrounding parcels; the fence detail plan is used instead. |
| `theme/live-cooking-classes-390.png` | Hero and classroom photos show people; the 1440 cards crop covers the point. |
| `theme/live-current-sales-390.png` | Not needed (13,410px tall, duplicates the 1440 crop); no privacy issue. |
| `theme/figma-00-cover.png` | Byte-identical to `figma/00-cover-frozen-v1.0.png`. |
| `theme/figma-01-colors.png` … `figma-04-elevation.png`, `figma-06-header-footer.png` | Section captures with padding; the tighter frame captures from `figma/` are used. |
| `figma/05-ds-buttons-component-set.png`, `figma/10-token-board.png` | Lower-resolution duplicates of the `theme/` captures used instead. |
| `theme/repo/*` (logo, stickers, 404 illustration, poster template, PDFs, HTML) | Co-op brand property or third-party product photography, not José's design work; none is called for in SPEC §7. |

Test data visible in kept images is fictional (555 numbers, `example.com`, demo order numbers); business addresses and store phone numbers are the co-op's public ones.
