/* ==========================================================================
   epoch-explorer.js — José Ochoa portfolio · the Epoch chart study
   Notable AI models (Epoch AI, CC BY 4.0): a dense scatter plot redrawn for a phone.

   ES module. D3 and JSON come from the shared loaders in charts/index.js (loadD3,
   fetchJSON); styles (.ex-*) live in assets/css/charts.css. Every colour is read
   from the site's CSS custom properties at render time; nothing is hardcoded.

   Mounts
   ------
   1. The explorer — a figure with a data source:
        <figure class="figure ex" data-epoch-explorer data-src="/data/epoch/notable_models.json">
          <header>…eyebrow, title, sub…</header>
          <figcaption>…</figcaption>
          <footer class="figure-foot"><span>Source …</span>
            <span class="figure-actions">
              <button type="button" data-ex-action="table">Table</button>
              <button type="button" data-ex-action="download">Data (CSV)</button></span></footer>
        </figure>
      The module inserts the control row, legend, plot, readout and table between
      the header and the figcaption. Under 768px the controls move into a bottom sheet.

   2. Trend cards — the "one dataset, three framings" stat cards:
        <section data-epoch-trends data-src="…">
          <fieldset data-ex-unit>…three radios value="x|doubling|oom"…</fieldset>
          <article class="stat-card" data-from="2010" data-to="2027" data-lead="Since 2010"
                   data-subject="training compute of notable models" data-tense="perfect">
            <p class="stat-label">…</p>
            <p class="stat-value" data-ex-value>…</p>
            <p class="stat-claim" data-ex-claim>…</p>
            <footer class="stat-meta" data-ex-meta>…</footer>
          </article> …
        </section>
      Static numbers in the HTML are the no-JS fallback; the module recomputes them.

   Statistics: ordinary least squares of log10(training compute) on fractional
   publication year. 90% CI = slope ± t(0.95, n−2) · SE(slope). The band drawn on
   the chart is the 90% confidence band of the fitted mean.
   ========================================================================== */

import { loadD3, fetchJSON } from '/assets/js/charts/index.js';

const MS_YEAR = 365.25 * 864e5;
const LOG10_2 = Math.log10(2);
const DATA_END = 2027; // right edge of the time axis (data runs to 2026-10)

const DOMAIN_ORDER = ['Language', 'Vision', 'Multimodal', 'Games', 'Speech', 'Biology', 'Robotics', 'Other'];

const RANGES = [
  // start: left edge of the axis (a little padding); from: first year of data shown.
  { key: 'all', label: 'All time', short: 'All time', start: 1948, from: -Infinity, fitFrom: [[-Infinity, 2010], [2010, Infinity]] },
  { key: 'dl', label: 'Deep learning era', short: '2010+', start: 2009.6, from: 2010, fitFrom: [[2010, Infinity]] },
  { key: 'recent', label: '2020+', short: '2020+', start: 2019.8, from: 2020, fitFrom: [[2020, Infinity]] },
];
const COLOR_BY = [
  { key: 'domain', label: 'Domain', field: 'domain_group' },
  { key: 'org', label: 'Organization', field: 'org_primary' },
  { key: 'country', label: 'Country', field: 'country_primary' },
];
const LABEL_MODES = [
  { key: 'top', budget: [12, 6] },     // [wide, compact]
  { key: 'more', budget: [30, 12] },
  { key: 'frontier', budget: [Infinity, Infinity] },
];
const labelModeText = (key, compact) => {
  const m = LABEL_MODES.find((d) => d.key === key);
  if (key === 'frontier') return 'Frontier only';
  return `Top ${m.budget[compact ? 1 : 0]}`;
};

/* --------------------------------------------------------------------------
   Small utilities
   -------------------------------------------------------------------------- */
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const pow10 = (e) => `10${sup(e)}`;
const THIN = ' ';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fy = (iso) => 1970 + Date.parse(`${iso}T00:00:00Z`) / MS_YEAR;
let uid = 0;

function sci(v, digits = 1) {
  if (v == null || !isFinite(v)) return '—';
  let e = Math.floor(Math.log10(v));
  let m = v / 10 ** e;
  let ms = m.toFixed(digits);
  if (Number(ms) >= 10) { e += 1; ms = (m / 10).toFixed(digits); }
  return `${ms} × ${pow10(e)}`;
}
// DOM version of sci(): a real <sup>, so monospaced digits keep their own width.
function sciNode(v, digits = 1) {
  const frag = document.createDocumentFragment();
  if (v == null || !isFinite(v)) { frag.append('—'); return frag; }
  let e = Math.floor(Math.log10(v));
  let m = (v / 10 ** e).toFixed(digits);
  if (Number(m) >= 10) { e += 1; m = (v / 10 ** e).toFixed(digits); }
  const sp = document.createElement('sup');
  sp.textContent = String(e);
  frag.append(`${m} × 10`, sp);
  return frag;
}
const orgText = (s) => (s || 'Unknown').replace(/,(?=\S)/g, ', ');
function compact(v) {
  if (v == null || !isFinite(v)) return '—';
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [base, u] of units) {
    if (v >= base) {
      const n = v / base;
      return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(2).replace(/\.?0+$/, '')}${THIN}${u}`;
    }
  }
  return String(Math.round(v));
}
const int = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
const dateFmt = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
};
function shortName(name) {
  // "Carnegie Mellon University (CMU)" → "CMU"; keeps everything else verbatim.
  const m = /\(([A-Z][A-Za-z.&]{1,8})\)\s*$/.exec(name);
  return m ? m[1] : name;
}
function truncate(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > n * 0.55 ? cut.slice(0, sp) : cut).replace(/[\s,(]+$/, '')}…`;
}
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sheetMQ = () => matchMedia('(max-width: 767.98px)');

/* --------------------------------------------------------------------------
   Statistics
   -------------------------------------------------------------------------- */
// Student t quantile at p = 0.95 (two-sided 90%) via the Cornish–Fisher expansion.
// Accurate to < 1e-4 for df ≥ 5, which every fit here clears by a wide margin.
export function tQuantile95(df) {
  const z = 1.6448536269514722;
  const z3 = z ** 3, z5 = z ** 5, z7 = z ** 7;
  return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df ** 2)
    + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3);
}

export function olsFit(points) {
  const n = points.length;
  if (n < 5) return null;
  let mx = 0, my = 0;
  for (const p of points) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let sxx = 0, sxy = 0, sst = 0;
  for (const p of points) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); sst += (p.y - my) ** 2; }
  const b = sxy / sxx;
  const a = my - b * mx;
  let sse = 0;
  for (const p of points) sse += (p.y - (a + b * p.x)) ** 2;
  const df = n - 2;
  const s = Math.sqrt(sse / df);
  const se = s / Math.sqrt(sxx);
  const t = tQuantile95(df);
  const xs = points.map((p) => p.x);
  return {
    n, a, b, se, t, df, mx, sxx, s,
    lo: b - t * se, hi: b + t * se,
    r2: 1 - sse / sst,
    x0: Math.min(...xs), x1: Math.max(...xs),
    yhat: (x) => a + b * x,
    halfBand: (x) => t * s * Math.sqrt(1 / n + (x - mx) ** 2 / sxx),
  };
}

// One dataset, three framings. Each unit returns the number, its CI (ordered low→high
// as displayed), and the copy fragments the sentence template needs.
export const UNITS = {
  x: {
    label: 'Increase/year',
    value: (f) => 10 ** f.b,
    ci: (f) => [10 ** f.lo, 10 ** f.hi],
    num: (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)),
    show: (v) => `${UNITS.x.num(v)}×`,
    unit: 'per year',
    arrow: true,
    ciText: (lo, hi) => `${UNITS.x.num(lo)}× to ${UNITS.x.num(hi)}×`,
    phrase: { perfect: (v) => `has grown ${v}× per year`, past: (v) => `grew ${v}× per year` },
  },
  doubling: {
    label: 'Doubling time',
    value: (f) => (12 * LOG10_2) / f.b,
    ci: (f) => [(12 * LOG10_2) / f.hi, (12 * LOG10_2) / f.lo], // faster growth = shorter time: bounds swap
    num: (v) => (v < 10 ? v.toFixed(1) : v.toFixed(0)),
    show: (v) => UNITS.doubling.num(v),
    unit: 'months',
    arrow: false,
    ciText: (lo, hi) => `${UNITS.doubling.num(lo)} to ${UNITS.doubling.num(hi)} months`,
    phrase: { perfect: (v) => `has doubled every ${v} months`, past: (v) => `doubled every ${v} months` },
  },
  oom: {
    label: 'OOM/year',
    value: (f) => f.b,
    ci: (f) => [f.lo, f.hi],
    num: (v) => v.toFixed(2),
    show: (v) => UNITS.oom.num(v),
    unit: 'OOM/year',
    arrow: true,
    ciText: (lo, hi) => `${UNITS.oom.num(lo)} to ${UNITS.oom.num(hi)} OOM`,
    phrase: {
      perfect: (v) => `has grown by ${v} orders of magnitude a year`,
      past: (v) => `grew by ${v} orders of magnitude a year`,
    },
  },
};
export function sentence(unitKey, fit, { lead, subject, tense = 'perfect' }) {
  const u = UNITS[unitKey];
  return `${lead}, ${subject} ${u.phrase[tense](u.num(u.value(fit)))}.`;
}

/* --------------------------------------------------------------------------
   Tokens — read from CSS custom properties at render time
   -------------------------------------------------------------------------- */
function readTokens(scope = document.documentElement) {
  const cs = getComputedStyle(scope);
  const v = (name, fallbackVar) => (cs.getPropertyValue(name).trim() || (fallbackVar ? cs.getPropertyValue(fallbackVar).trim() : ''));
  return {
    paper: v('--paper'), paper2: v('--paper-2'), paper3: v('--paper-3'),
    ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), meta: v('--ink-meta', '--ink-3'),
    line: v('--line'), grid: v('--grid', '--line'), axis: v('--axis', '--line'), accent: v('--accent'),
    series: Array.from({ length: 8 }, (_, i) => v(`--series-${i + 1}`)),
    fontText: v('--font-text') || 'system-ui, sans-serif',
    fontMono: v('--font-mono') || 'ui-monospace, monospace',
  };
}

/* --------------------------------------------------------------------------
   Data
   -------------------------------------------------------------------------- */
// fetchJSON caches the raw JSON per URL; this memo keeps one shaped copy per JSON object.
const shaped = new WeakMap();
function loadData(src) {
  return fetchJSON(src).then((json) => {
    if (!shaped.has(json)) {
      shaped.set(json, {
        meta: json.meta,
        models: json.models.map((m, i) => ({
          ...m, id: i, x: fy(m.date), y: Math.log10(m.compute), speculative: m.confidence === 'Speculative',
        })),
      });
    }
    return shaped.get(json);
  });
}

// Top-8 categories for a field over the WHOLE dataset (fixed, so a range change never
// repaints a survivor: colour follows the entity, not its rank in the current view).
function topCategories(models, field) {
  const counts = new Map();
  for (const m of models) {
    const k = m[field];
    if (!k || k === 'Unknown') continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map((d) => d[0]);
}

/* --------------------------------------------------------------------------
   Label placement
   Candidates: the largest model inside its rolling 6-month window (rank 0), then
   rank 1 and 2. To spread labels along the frontier instead of piling them at the
   top right, candidates are taken in turns from equal time slots across the view
   (one slot per label in the budget). Each label is placed greedily at the first
   free position around its dot (right, left, diagonals, above, below), else at a
   displaced position with a leader line, else skipped. Leader lines only when the
   label sits more than 8px from its dot.
   -------------------------------------------------------------------------- */
function windowRanks(vis) {
  const sorted = [...vis].sort((a, b) => a.x - b.x);
  const rank = new Map();
  let lo = 0;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    while (sorted[lo].x < p.x - 0.25) lo++;
    let r = 0;
    for (let j = lo; j < sorted.length && sorted[j].x <= p.x + 0.25; j++) if (sorted[j].compute > p.compute) r++;
    rank.set(p.id, r);
  }
  return rank;
}
function recordSetters(vis) {
  const out = [];
  let best = -Infinity;
  for (const p of [...vis].sort((a, b) => a.x - b.x || b.compute - a.compute)) {
    if (p.y > best) { best = p.y; out.push(p); }
  }
  return out;
}
function labelCandidates(vis, mode, budget, x0, x1) {
  if (mode === 'frontier') return recordSetters(vis).sort((a, b) => b.compute - a.compute);
  const rank = windowRanks(vis);
  const pool = vis.filter((p) => rank.get(p.id) <= 2);
  const k = Math.max(1, Math.min(budget, 40));
  const w = (x1 - x0) / k;
  const slots = Array.from({ length: k }, () => []);
  for (const p of pool) slots[clamp(Math.floor((p.x - x0) / w), 0, k - 1)].push(p);
  for (const s of slots) s.sort((a, b) => rank.get(a.id) - rank.get(b.id) || b.compute - a.compute);
  const order = [];
  for (let round = 0; order.length < pool.length; round++) {
    const batch = slots.filter((s) => s[round]).map((s) => s[round]);
    if (!batch.length) break;
    batch.sort((a, b) => rank.get(a.id) - rank.get(b.id) || b.compute - a.compute);
    order.push(...batch);
  }
  return order;
}

function rectsOverlap(a, b, pad = 2) {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}
function distToRect(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}
function nearestOnRect(px, py, r) {
  return [clamp(px, r.x, r.x + r.w), clamp(py, r.y, r.y + r.h)];
}
function positionsFor(px, py, rad, w, h) {
  const g = 3;
  const out = [
    { x: px + rad + g, y: py - h / 2, pref: 0 },
    { x: px - rad - g - w, y: py - h / 2, pref: 1 },
    { x: px + rad * 0.6, y: py - rad * 0.6 - h - 1, pref: 1.5 },
    { x: px - rad * 0.6 - w, y: py - rad * 0.6 - h - 1, pref: 2 },
    { x: px + rad * 0.6, y: py + rad * 0.6 + 1, pref: 2.2 },
    { x: px - rad * 0.6 - w, y: py + rad * 0.6 + 1, pref: 2.4 },
    { x: px - w / 2, y: py - rad - g - h, pref: 2.6 },
    { x: px - w / 2, y: py + rad + g, pref: 3 },
  ];
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
  for (const d of [16, 26, 38, 52]) {
    for (const [dx, dy] of dirs) {
      const n = Math.hypot(dx, dy);
      const ax = px + (dx / n) * d, ay = py + (dy / n) * d;
      const x = dx > 0 ? ax : dx < 0 ? ax - w : ax - w / 2;
      const y = dy > 0 ? ay : dy < 0 ? ay - h : ay - h / 2;
      out.push({ x, y, pref: 4 + d * 0.35 + (dy > 0 ? 1.5 : 0) });
    }
  }
  return out;
}
function placeLabels(cands, { budget, bounds, reserved, points, measure, rad, h }) {
  const placed = [];
  for (const c of cands) {
    if (placed.length >= budget) break;
    const w = measure(c.text);
    let best = null;
    for (const pos of positionsFor(c.px, c.py, rad, w, h)) {
      const r = { x: pos.x, y: pos.y, w, h };
      if (r.x < bounds.x0 || r.x + w > bounds.x1 || r.y < bounds.y0 || r.y + h > bounds.y1) continue;
      if (placed.some((p) => rectsOverlap(r, p.rect)) || reserved.some((q) => rectsOverlap(r, q, 3))) continue;
      let covered = 0;
      for (const p of points) {
        if (p.id === c.id) continue;
        if (p.px > r.x - rad && p.px < r.x + w + rad && p.py > r.y - rad && p.py < r.y + h + rad) covered++;
      }
      const score = pos.pref + covered * 2.2;
      if (!best || score < best.score) best = { score, rect: r };
      if (pos.pref < 1 && covered === 0) break;
    }
    if (!best) continue;
    const dist = distToRect(c.px, c.py, best.rect) - rad;
    placed.push({ ...c, rect: best.rect, leader: dist > 8 });
  }
  return placed;
}

/* --------------------------------------------------------------------------
   Controls
   -------------------------------------------------------------------------- */
const ICON_SLIDERS = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 6h8M15 6h2M3 14h2M9 14h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="13" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="14" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const ICON_X = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

function segmented(name, legendText, options, value, onChange) {
  const fs = el('fieldset', { class: 'ex-group', 'data-group': name });
  fs.append(el('legend', { class: 'ex-group__label', text: legendText }));
  const seg = el('div', { class: 'ex-seg' });
  for (const o of options) {
    const input = el('input', { type: 'radio', name: `${name}-${uid}`, value: o.key });
    input.checked = o.key === value;
    input.addEventListener('change', () => input.checked && onChange(o.key));
    const span = el('span');
    if (o.short && o.short !== o.label) span.append(el('span', { class: 'ex-long', text: o.label }), el('span', { class: 'ex-short', text: o.short }));
    else span.textContent = o.label;
    seg.append(el('label', { class: 'ex-seg__opt' }, input, span));
  }
  fs.append(seg);
  return fs;
}

/* --------------------------------------------------------------------------
   The explorer
   -------------------------------------------------------------------------- */
class Explorer {
  constructor(root, data, d3) {
    uid += 1;
    this.uid = uid;
    this.root = root;
    this.d3 = d3;
    this.data = data;
    this.models = data.models;
    this.compact = false;
    this.drawn = false;
    this.selected = null;
    this.pinned = false;
    this.tableOpen = false;
    this.sort = { key: 'date', dir: 'descending' };
    this.cats = {
      domain: DOMAIN_ORDER,
      org: topCategories(this.models, 'org_primary'),
      country: topCategories(this.models, 'country_primary'),
    };
    this.state = {
      range: 'dl', // opens on the deep-learning era: 481 of 543 points, and the period the title's claim is about
      colorBy: 'domain',
      labels: 'top',
      trend: true,
      focus: null,
    };
    this.build();
    this.observe();
  }

  /* ---------- DOM scaffold ---------- */
  build() {
    const { root } = this;
    root.classList.add('ex');
    const header = root.querySelector(':scope > header');
    const caption = root.querySelector(':scope > figcaption');

    this.toolbar = el('div', { class: 'ex-toolbar', role: 'group', 'aria-label': 'Chart settings' });
    this.groups = {
      range: segmented('range', 'Range', RANGES, this.state.range, (v) => this.set({ range: v })),
      color: segmented('color', 'Color by', COLOR_BY, this.state.colorBy, (v) => this.set({ colorBy: v, focus: null })),
      labels: segmented('labels', 'Labels', LABEL_MODES.map((m) => ({ key: m.key, label: labelModeText(m.key, false) })), this.state.labels, (v) => this.set({ labels: v })),
      trend: this.buildSwitch(),
    };
    this.customize = el('button', { type: 'button', class: 'ex-customize', 'aria-haspopup': 'dialog' });
    this.customize.innerHTML = ICON_SLIDERS;
    this.customize.append(el('span', { text: 'Customize' }));
    this.customize.addEventListener('click', () => this.openSheet());
    this.toolbar.append(this.groups.range, this.groups.color, this.groups.labels, this.groups.trend, this.customize);

    this.legend = el('ul', { class: 'ex-legend', 'aria-label': 'Legend' });
    // WCAG 2.5.3: the visible text ("Language 243") is the button's name; the hint is a description.
    this.legendHint = el('p', { class: 'ex-sr', text: 'Models in view. Press to show only this group; press again to show all.' });
    this.legendHint.id = `ex-legend-hint-${this.uid}`;
    this.stage = el('div', { class: 'ex-stage', tabindex: '0', role: 'group' });
    this.svg = this.d3.select(this.stage).append('svg').attr('aria-hidden', 'true').attr('focusable', 'false');
    this.tip = el('div', { class: 'ex-tip', 'aria-hidden': 'true' });
    this.live = el('p', { class: 'ex-sr', 'aria-live': 'polite' });
    this.stage.append(this.tip);
    this.readout = el('div', { class: 'ex-readout' });
    this.readout.id = `ex-readout-${this.uid}`;
    this.stage.setAttribute('aria-describedby', this.readout.id);
    this.tableWrap = el('div', { class: 'ex-table-wrap', hidden: true, tabindex: '0', role: 'region', 'aria-label': 'Table of models in the current view' });

    const after = header || null;
    const frag = document.createDocumentFragment();
    frag.append(this.toolbar, this.legend, this.legendHint, this.stage, this.live, this.readout, this.tableWrap);
    if (after) after.after(frag); else root.prepend(frag);
    if (caption && caption.previousElementSibling !== this.tableWrap) this.tableWrap.after(caption);

    this.buildSheet();
    this.buildSvg();
    this.bindActions();
    this.bindPointer();
  }

  buildSwitch() {
    const wrap = el('div', { class: 'ex-group', 'data-group': 'trend' });
    wrap.append(el('span', { class: 'ex-group__label', 'aria-hidden': 'true', text: 'Trend' }));
    const input = el('input', { type: 'checkbox', role: 'switch' });
    input.checked = this.state.trend;
    input.addEventListener('change', () => this.set({ trend: input.checked }));
    wrap.append(el('label', { class: 'ex-switch' }, input, el('span', { class: 'ex-switch__track', 'aria-hidden': 'true' }), el('span', { text: 'Regression, 90% CI' })));
    return wrap;
  }

  buildSheet() {
    const titleId = `ex-sheet-title-${this.uid}`;
    this.sheet = el('dialog', { class: 'ex-sheet', 'aria-labelledby': titleId });
    const close = el('button', { type: 'button', class: 'ex-sheet__x', 'aria-label': 'Close settings' });
    close.innerHTML = ICON_X;
    close.addEventListener('click', () => this.sheet.close());
    this.sheetBody = el('div', { class: 'ex-sheet__body' });
    const done = el('button', { type: 'button', class: 'ex-sheet__done', text: 'Show chart' });
    done.addEventListener('click', () => this.sheet.close());
    this.sheet.append(
      el('span', { class: 'ex-sheet__grip', 'aria-hidden': 'true' }),
      el('div', { class: 'ex-sheet__head' }, el('p', { class: 'ex-sheet__title', id: titleId, text: 'Customize chart' }), close),
      this.sheetBody,
      el('div', { class: 'ex-sheet__foot' }, done),
    );
    this.sheet.addEventListener('click', (e) => { if (e.target === this.sheet) this.sheet.close(); });
    this.sheet.addEventListener('close', () => this.customize.focus({ preventScroll: true }));
    this.root.append(this.sheet);
  }

  placeControls() {
    const sheetMode = sheetMQ().matches;
    this.root.classList.toggle('ex--sheet', sheetMode);
    const { color, labels, trend } = this.groups;
    if (sheetMode) {
      if (color.parentNode !== this.sheetBody) this.sheetBody.append(color, labels, trend);
    } else {
      if (this.sheet.open) this.sheet.close();
      if (color.parentNode !== this.toolbar) {
        for (const grp of [color, labels, trend]) this.toolbar.insertBefore(grp, this.customize);
      }
    }
    // Label budgets follow the plot size ("Top 12" becomes "Top 6" on a phone).
    this.groups.labels.querySelectorAll('.ex-seg__opt').forEach((opt) => {
      const input = opt.querySelector('input');
      opt.querySelector('span').textContent = labelModeText(input.value, this.compact);
    });
    this.customize.setAttribute('aria-label', `Customize chart: color by ${COLOR_BY.find((c) => c.key === this.state.colorBy).label}, ${labelModeText(this.state.labels, this.compact)} labels, trend ${this.state.trend ? 'on' : 'off'}`);
  }

  openSheet() {
    if (typeof this.sheet.showModal === 'function') this.sheet.showModal();
    else this.sheet.setAttribute('open', '');
  }

  bindActions() {
    this.root.querySelectorAll('[data-ex-action]').forEach((btn) => {
      const action = btn.getAttribute('data-ex-action');
      if (action === 'table') {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', (this.tableWrap.id = `ex-table-${this.uid}`));
        btn.addEventListener('click', () => {
          this.tableOpen = !this.tableOpen;
          this.tableWrap.hidden = !this.tableOpen;
          btn.setAttribute('aria-expanded', String(this.tableOpen));
          btn.textContent = this.tableOpen ? 'Hide table' : 'Table';
          if (this.tableOpen) this.renderTable();
        });
      } else if (action === 'download') {
        btn.addEventListener('click', () => this.download());
      }
    });
  }

  observe() {
    const mq = sheetMQ();
    const onMQ = () => { this.placeControls(); this.render({ animate: false }); };
    if (mq.addEventListener) mq.addEventListener('change', onMQ); else mq.addListener(onMQ);
    let raf = 0, lastW = 0;
    this.ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      clearTimeout(this.roT);
      this.roT = setTimeout(() => { raf = requestAnimationFrame(() => this.render({ animate: false })); }, 90);
    });
    this.ro.observe(this.stage);
    document.addEventListener('themechange', () => this.render({ animate: false }));
    new MutationObserver(() => this.render({ animate: false }))
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const dark = matchMedia('(prefers-color-scheme: dark)');
    if (dark.addEventListener) dark.addEventListener('change', () => this.render({ animate: false }));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.render({ animate: false }));
    const animateIn = !reducedMotion() && 'IntersectionObserver' in window;
    this.drawn = !animateIn;
    this.placeControls();
    this.render({ animate: false, initial: true });
    if (animateIn) {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); this.drawIn(); }
      }, { threshold: 0.15 });
      io.observe(this.stage);
    }
  }

  set(patch) {
    const prev = { ...this.state };
    Object.assign(this.state, patch);
    if ('range' in patch && patch.range !== prev.range) this.clearSelection();
    this.placeControls();
    this.render({ animate: !reducedMotion() });
    if (this.tableOpen) this.renderTable();
  }

  /* ---------- derived data ---------- */
  range() { return RANGES.find((r) => r.key === this.state.range); }
  visible() {
    const r = this.range();
    return this.models.filter((m) => m.x >= r.from && m.x <= DATA_END);
  }
  catOf(m) {
    const cb = COLOR_BY.find((c) => c.key === this.state.colorBy);
    const k = m[cb.field];
    if (this.state.colorBy === 'domain') return k;
    return this.cats[this.state.colorBy].includes(k) ? k : 'Other';
  }
  categories() {
    const names = this.cats[this.state.colorBy];
    const list = names.map((n, i) => ({ key: n, label: shortName(n), slot: i }));
    if (this.state.colorBy !== 'domain') list.push({ key: 'Other', label: 'Other', slot: -1 });
    return list;
  }
  colorFor(cat, T) {
    if (this.state.colorBy === 'domain') return T.series[DOMAIN_ORDER.indexOf(cat)] || T.ink3;
    const i = this.cats[this.state.colorBy].indexOf(cat);
    return i >= 0 ? T.series[i] : T.ink3;
  }
  fits(vis) {
    const r = this.range();
    return r.fitFrom.map(([a, b]) => {
      const pts = vis.filter((m) => m.x >= a && m.x < b);
      const f = olsFit(pts);
      return f && { ...f, era: a === -Infinity ? 'pre' : 'main', from: a, to: b };
    }).filter(Boolean);
  }

  /* ---------- svg scaffold ---------- */
  buildSvg() {
    const clipId = `ex-clip-${this.uid}`;
    this.clip = this.svg.append('defs').append('clipPath').attr('id', clipId).append('rect');
    const g = this.svg.append('g').attr('class', 'ex-plot');
    this.g = {
      root: g,
      era: g.append('g').attr('class', 'ex-era'),
      grid: g.append('g').attr('class', 'ex-grid'),
      xaxis: g.append('g').attr('class', 'ex-xaxis'),
      yaxis: g.append('g').attr('class', 'ex-yaxis'),
      band: g.append('g').attr('class', 'ex-band'),
      frontier: g.append('g').attr('class', 'ex-frontier'),
      dots: g.append('g').attr('class', 'ex-dots'),
      trend: g.append('g').attr('class', 'ex-trend'),
      leaders: g.append('g').attr('class', 'ex-leaders'),
      labels: g.append('g').attr('class', 'ex-labels'),
      tlabels: g.append('g').attr('class', 'ex-tlabels'),
      hover: g.append('g').attr('class', 'ex-hover'),
    };
    for (const k of ['band', 'frontier', 'dots', 'trend']) this.g[k].attr('clip-path', `url(#${clipId})`);
    this.ytitle = this.svg.append('text').attr('class', 'ex-ytitle');
  }

  layout() {
    const W = Math.max(280, Math.round(this.stage.clientWidth || this.root.clientWidth || 360));
    const compact = W < 600;
    const M = compact ? { t: 30, r: 8, b: 30, l: 36 } : { t: 34, r: 20, b: 34, l: 50 };
    const H = compact ? clamp(Math.round(W * 1.18), 380, 540) : clamp(Math.round(W * 0.54), 420, 600);
    return { W, H, M, iw: W - M.l - M.r, ih: H - M.t - M.b, compact, rad: compact ? 3.4 : 4.2, ring: compact ? 1.25 : 1.5 };
  }

  /* ---------- render ---------- */
  render({ animate = false, initial = false } = {}) {
    const { d3 } = this;
    const T = readTokens(this.root);
    const L = this.layout();
    const wasCompact = this.compact;
    this.compact = L.compact;
    this.root.classList.toggle('ex--compact', L.compact);
    if (wasCompact !== L.compact || initial) this.placeControls();
    const dur = animate && this.drawn ? 560 : 0;
    const vis = this.visible();
    const r = this.range();
    const measure = this.measurer();

    // Scales (y works in log10 space; ticks are labelled as powers of ten)
    const x = d3.scaleLinear().domain([r.start, DATA_END]).range([0, L.iw]);
    const ext = d3.extent(vis, (d) => d.y);
    const yLo = Math.floor(ext[0] - 0.35), yHi = Math.ceil(ext[1] + 0.25);
    const y = d3.scaleLinear().domain([yLo, yHi]).range([L.ih, 0]);
    const px = this.prev || { x, y };
    for (const m of this.models) { m.px = x(m.x); m.py = y(m.y); }

    this.svg.attr('viewBox', `0 0 ${L.W} ${L.H}`).attr('width', L.W).attr('height', L.H);
    this.g.root.attr('transform', `translate(${L.M.l},${L.M.t})`);
    this.clip.attr('x', -L.rad - 3).attr('y', -L.rad - 3).attr('width', L.iw + 2 * L.rad + 6).attr('height', L.ih + 2 * L.rad + 6);

    // Y axis — powers of ten; step chosen so labels sit ≥ 42px (34px on a phone) apart.
    const decades = yHi - yLo;
    const step = [1, 2, 3, 4, 5, 6].find((k) => (L.ih / decades) * k >= (L.compact ? 34 : 42)) || 6;
    const yTicks = d3.range(Math.ceil(yLo / step) * step, yHi + 0.001, step);
    const yPos = (sc) => (e) => Math.round(sc(e)) + 0.5;
    this.join(this.g.grid, 'line', yTicks, (e) => e, dur, {
      place: (s) => s.attr('y1', yPos(y)).attr('y2', yPos(y)),
      placePrev: (s) => s.attr('y1', yPos(px.y)).attr('y2', yPos(px.y)),
    }).attr('x1', 0).attr('x2', L.iw).attr('stroke', T.grid).attr('stroke-width', 1).attr('shape-rendering', 'crispEdges');
    this.join(this.g.yaxis, 'text', yTicks, (e) => e, dur, {
      place: (s) => s.attr('y', (e) => y(e)),
      placePrev: (s) => s.attr('y', (e) => px.y(e)),
    }).attr('class', 'ex-tick ex-ytick').attr('x', -8).attr('text-anchor', 'end').attr('dominant-baseline', 'central')
      .each(function (e) {
        const t = d3.select(this);
        if (t.attr('data-e') === String(e)) return;
        t.attr('data-e', e).text('10').append('tspan').attr('class', 'ex-sup').attr('dy', '-0.42em').text(e);
      });
    this.ytitle.attr('x', 0).attr('y', 14).attr('text-anchor', 'start').text('Training compute (FLOP, log scale)');

    // X axis — years, thinned by pixel spacing.
    const span = DATA_END - r.start;
    const xStep = [1, 2, 5, 10, 20].find((k) => (L.iw / span) * k >= (L.compact ? 44 : 76)) || 20;
    const xTicks = d3.range(Math.ceil(r.start / xStep) * xStep, 2026.01, xStep);
    this.g.xaxis.selectAll('line.ex-base').data([0]).join('line').attr('class', 'ex-base')
      .attr('x1', 0).attr('x2', L.iw).attr('y1', L.ih + 0.5).attr('y2', L.ih + 0.5).attr('stroke', T.axis).attr('shape-rendering', 'crispEdges');
    const xt = this.join(this.g.xaxis, 'g', xTicks, (v) => v, dur, {
      cls: 'ex-xt',
      place: (s) => s.attr('transform', (v) => `translate(${Math.round(x(v)) + 0.5},0)`),
      placePrev: (s) => s.attr('transform', (v) => `translate(${Math.round(px.x(v)) + 0.5},0)`),
    });
    xt.selectAll('line').data([0]).join('line').attr('y1', L.ih).attr('y2', L.ih + 4).attr('stroke', T.axis).attr('shape-rendering', 'crispEdges');
    xt.selectAll('text').data((v) => [v]).join('text').attr('class', 'ex-tick').attr('y', L.ih + 18).attr('text-anchor', 'middle').text((v) => v);

    // Deep-learning era band (All time only)
    const eraOn = r.key === 'all';
    const eraX = x(2010);
    const eraText = L.compact ? 'DL era' : 'Deep learning era';
    this.g.era.selectAll('rect').data(eraOn ? [0] : []).join('rect')
      .attr('x', eraX).attr('y', 0).attr('width', Math.max(0, L.iw - eraX)).attr('height', L.ih).attr('fill', T.paper2);
    this.g.era.selectAll('text').data(eraOn ? [0] : []).join('text').attr('class', 'ex-era-label')
      .attr('x', eraX + 8).attr('y', 15).text(eraText);
    const reserved = [];
    if (eraOn) reserved.push({ x: eraX + 4, y: 3, w: measure(eraText.toUpperCase(), 400, 10.5, T.fontMono) + eraText.length * 0.84 + 8, h: 16 });

    // Points
    const focus = this.state.focus;
    const isOther = (m) => this.state.colorBy !== 'domain' && m.cat === 'Other';
    for (const m of vis) { m.cat = this.catOf(m); m.color = this.colorFor(m.cat, T); }
    const sorted = [...vis].sort((a, b) => isOther(b) - isOther(a) || a.x - b.x);
    const dots = this.g.dots.selectAll('circle').data(sorted, (d) => d.id).join(
      (enter) => enter.append('circle').attr('cx', (d) => px.x(d.x)).attr('cy', (d) => px.y(d.y)).attr('r', L.rad).attr('opacity', 0),
      (update) => update,
      (exit) => { this.tr(exit, dur).attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y)).attr('opacity', 0).remove(); },
    );
    dots.order().attr('stroke-width', (d) => (d.speculative ? 1.4 : L.ring));
    this.tr(dots, dur)
      .attr('cx', (d) => d.px).attr('cy', (d) => d.py)
      .attr('r', (d) => (d.speculative ? L.rad - 0.6 : L.rad))
      .attr('fill', (d) => (d.speculative ? T.paper : d.color))
      .attr('stroke', (d) => (d.speculative ? d.color : T.paper))
      .attr('opacity', (d) => (!this.drawn ? 0 : focus && d.cat !== focus ? 0.12 : 1));

    // Trend lines with the 90% confidence band of the fitted mean
    const fits = this.state.trend ? this.fits(vis) : [];
    this.fitsNow = fits;
    const samples = (f) => d3.range(0, 41).map((i) => f.x0 + ((f.x1 - f.x0) * i) / 40);
    const bandD = (f) => d3.area().x((t) => x(t)).y0((t) => y(f.yhat(t) - f.halfBand(t))).y1((t) => y(f.yhat(t) + f.halfBand(t)))(samples(f));
    const lineD = (f) => `M${x(f.x0)},${y(f.yhat(f.x0))}L${x(f.x1)},${y(f.yhat(f.x1))}`;
    this.g.band.selectAll('path').data(fits, (f) => f.era).join('path')
      .attr('fill', (f) => (f.era === 'pre' ? T.ink3 : T.ink)).attr('fill-opacity', 0.1).attr('d', bandD)
      .attr('opacity', this.drawn ? 1 : 0);
    this.g.trend.selectAll('path.ex-halo').data(fits, (f) => f.era).join('path').attr('class', 'ex-halo')
      .attr('fill', 'none').attr('stroke', T.paper).attr('stroke-width', 5).attr('stroke-linecap', 'round').attr('stroke-opacity', 0.9).attr('d', lineD);
    this.g.trend.selectAll('path.ex-line').data(fits, (f) => f.era).join('path').attr('class', 'ex-line')
      .attr('fill', 'none').attr('stroke', (f) => (f.era === 'pre' ? T.ink2 : T.ink)).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('d', lineD);
    this.g.trend.selectAll('path').attr('opacity', this.drawn ? 1 : 0);

    // Trend callout. The upper-left of a rising scatter is empty, so the rate in words and its
    // 90% CI sit there as a keyed legend for the line(s) — never on top of the points.
    const tl = [];
    let cy = 6;
    const ordered = [...fits].sort((p, q) => (p.era === 'main' ? -1 : 1) - (q.era === 'main' ? -1 : 1));
    for (const f of ordered) {
      const lead = fits.length > 1 ? (f.era === 'pre' ? 'Before 2010' : 'Since 2010') : `Trend since ${Math.max(Math.floor(f.x0), f.from)}`;
      const rate = `${lead}: ${UNITS.x.num(10 ** f.b)}× per year`;
      const ci = L.compact ? `90% CI ${UNITS.x.ciText(10 ** f.lo, 10 ** f.hi)}` : `90% CI ${UNITS.x.ciText(10 ** f.lo, 10 ** f.hi)} · doubling every ${UNITS.doubling.num(UNITS.doubling.value(f))} months`;
      const w = 26 + Math.max(measure(rate, 600, L.compact ? 12 : 12.5, T.fontText), measure(ci, 400, 10.5, T.fontMono)) + 4;
      const rect = { x: 6, y: cy, w, h: 32 };
      reserved.push(rect);
      tl.push({ f, rect, rate, ci });
      cy += 40;
    }
    const tg = this.g.tlabels.selectAll('g').data(tl, (d) => d.f.era).join((en) => {
      const g = en.append('g');
      g.append('line').attr('class', 'ex-tkey');
      g.append('text').attr('class', 'ex-tlabel');
      g.append('text').attr('class', 'ex-tlabel-ci');
      return g;
    });
    tg.attr('transform', (d) => `translate(${d.rect.x},${d.rect.y})`).attr('opacity', this.drawn ? 1 : 0);
    tg.select('.ex-tkey').attr('x1', 2).attr('x2', 20).attr('y1', 9.5).attr('y2', 9.5)
      .attr('stroke', (d) => (d.f.era === 'pre' ? T.ink2 : T.ink)).attr('stroke-width', 2).attr('stroke-linecap', 'round');
    tg.select('.ex-tlabel').attr('x', 26).attr('y', 14).text((d) => d.rate);
    tg.select('.ex-tlabel-ci').attr('x', 26).attr('y', 29).text((d) => d.ci);

    // Frontier step line (shown with "Frontier only" labels)
    const rec = this.state.labels === 'frontier' ? recordSetters(vis) : [];
    const recPts = rec.length ? [...rec, { px: L.iw, py: rec[rec.length - 1].py }] : [];
    this.g.frontier.selectAll('path').data(rec.length ? [recPts] : []).join('path')
      .attr('fill', 'none').attr('stroke', T.ink3).attr('stroke-width', 1).attr('stroke-opacity', 0.75).attr('stroke-linejoin', 'round')
      .attr('d', d3.line().x((d) => d.px).y((d) => d.py).curve(d3.curveStepAfter));

    // Model labels
    const mode = this.state.labels;
    const budget = LABEL_MODES.find((m) => m.key === mode).budget[L.compact ? 1 : 0];
    const fontPx = L.compact ? 11 : 12;
    const maxChars = L.compact ? 18 : 26;
    const cands = labelCandidates(vis, mode, budget, r.start, DATA_END)
      .filter((m) => !focus || m.cat === focus)
      .map((m) => ({ id: m.id, m, px: m.px, py: m.py, text: truncate(m.model, maxChars) }));
    const placed = placeLabels(cands, {
      budget,
      bounds: { x0: 2, x1: L.iw + L.M.r - 2, y0: 2, y1: L.ih - 2 },
      reserved,
      points: vis,
      measure: (s) => measure(s, 500, fontPx, T.fontText) + 1,
      rad: L.rad + 1,
      h: fontPx + 2,
    });
    this.placed = placed;
    const labelSel = this.g.labels.selectAll('text').data(placed, (d) => d.id).join('text').attr('class', 'ex-label')
      .attr('x', (d) => d.rect.x).attr('y', (d) => d.rect.y + d.rect.h / 2 + 0.5).attr('dominant-baseline', 'central')
      .text((d) => d.text);
    const leaders = this.g.leaders.selectAll('line').data(placed.filter((d) => d.leader), (d) => d.id).join('line')
      .attr('stroke', T.ink3).attr('stroke-width', 1)
      .each(function (d) {
        const [ex, ey] = nearestOnRect(d.px, d.py, d.rect);
        const a = Math.atan2(ey - d.py, ex - d.px);
        const rr = L.rad + 1.5;
        d3.select(this).attr('x1', d.px + Math.cos(a) * rr).attr('y1', d.py + Math.sin(a) * rr).attr('x2', ex).attr('y2', ey);
      });
    for (const sel of [labelSel, leaders]) {
      sel.interrupt().attr('opacity', 0);
      if (this.drawn) sel.transition().delay(dur ? dur * 0.75 : 0).duration(dur ? 240 : 0).attr('opacity', 1);
    }

    // Legend, readout, accessible name
    this.renderLegend(this.categories(), vis, T);
    this.renderReadout(fits, vis);
    const main = fits.find((f) => f.era === 'main');
    this.stage.setAttribute('aria-label', `Scatter plot of training compute against publication date for ${vis.length} notable AI models, ${r.label.toLowerCase()}, log scale from ${pow10(yLo)} to ${pow10(yHi)} FLOP${main ? `; trend ${UNITS.x.num(10 ** main.b)}× per year` : ''}. Arrow keys step through models by date.`);

    // Pointer index
    this.prev = { x, y };
    this.layoutNow = L;
    this.vis = vis;
    this.delaunay = d3.Delaunay.from(vis, (d) => d.px, (d) => d.py);
    if (this.selected && !vis.includes(this.selected)) this.clearSelection();
    else if (this.selected) this.showTip(this.selected, { pinned: this.pinned, silent: true });
  }

  measurer() {
    if (!this.ctx) this.ctx = document.createElement('canvas').getContext('2d');
    const ctx = this.ctx;
    return (s, weight, size, family) => { ctx.font = `${weight} ${size}px ${family}`; return ctx.measureText(s).width; };
  }

  // Keyed join whose entering marks start where the previous scale had them and whose
  // exiting marks travel with the new scale, so ticks slide with the data.
  join(parent, tag, data, key, dur, { cls, place, placePrev } = {}) {
    const sel = parent.selectAll(cls ? `${tag}.${cls}` : tag).data(data, key).join(
      (enter) => {
        const n = enter.append(tag);
        if (cls) n.attr('class', cls);
        (placePrev || place)(n.attr('opacity', 0));
        return n;
      },
      (update) => update,
      (exit) => { const t = this.tr(exit, dur); place(t); t.attr('opacity', 0).remove(); },
    );
    const t = this.tr(sel, dur);
    place(t);
    t.attr('opacity', 1);
    return sel;
  }
  tr(sel, dur) { return dur ? sel.transition().duration(dur).ease(this.d3.easeCubicInOut) : sel; }

  drawIn() {
    const { d3 } = this;
    this.drawn = true;
    const L = this.layoutNow;
    if (!L) return;
    const focus = this.state.focus;
    this.g.dots.selectAll('circle')
      .attr('opacity', 0)
      .transition().delay((d) => (d.px / L.iw) * 650).duration(320).ease(d3.easeCubicOut)
      .attr('opacity', (d) => (focus && d.cat !== focus ? 0.12 : 1));
    this.g.trend.selectAll('path').attr('opacity', 1).each(function () {
      const len = this.getTotalLength ? this.getTotalLength() : 0;
      d3.select(this).attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
        .transition().delay(380).duration(800).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0)
        .on('end', function () { d3.select(this).attr('stroke-dasharray', null); });
    });
    this.g.band.selectAll('path').attr('opacity', 0).transition().delay(500).duration(600).attr('opacity', 1);
    this.g.tlabels.selectAll('g').transition().delay(900).duration(300).attr('opacity', 1);
    this.g.labels.selectAll('text').transition().delay(820).duration(320).attr('opacity', 1);
    this.g.leaders.selectAll('line').transition().delay(820).duration(320).attr('opacity', 1);
  }

  renderLegend(cats, vis, T) {
    const counts = new Map();
    for (const m of vis) counts.set(m.cat, (counts.get(m.cat) || 0) + 1);
    this.legend.replaceChildren();
    for (const c of cats) {
      const n = counts.get(c.key) || 0;
      const btn = el('button', { type: 'button', 'aria-pressed': String(this.state.focus === c.key), title: c.key === c.label ? null : c.key });
      const dot = el('span', { class: 'ex-legend__dot', 'aria-hidden': 'true' });
      dot.style.background = this.colorFor(c.key, T);
      btn.append(dot, el('span', { text: c.label }), el('span', { class: 'ex-legend__n', text: int(n) }));
      btn.setAttribute('aria-describedby', this.legendHint.id);
      btn.addEventListener('click', () => this.set({ focus: this.state.focus === c.key ? null : c.key }));
      btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !this.state.focus) this.peek(c.key); });
      btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !this.state.focus) this.peek(null); });
      this.legend.append(el('li', { class: `ex-legend__item${n ? '' : ' is-empty'}` }, btn));
    }
    const meta = el('li', { class: 'ex-legend__meta' });
    meta.append(el('span', { text: `${int(vis.length)} of ${int(this.models.length)} models` }), el('span', { 'aria-hidden': 'true', text: '·' }), el('span', { class: 'ex-legend__hollow', 'aria-hidden': 'true' }), el('span', { text: 'speculative estimate' }));
    this.legend.append(meta);
  }

  peek(cat) {
    this.g.dots.selectAll('circle').interrupt().attr('opacity', (d) => (cat && d.cat !== cat ? 0.12 : 1));
  }

  renderReadout(fits, vis) {
    this.readout.replaceChildren();
    this.readout.hidden = !fits.length;
    const end = Math.floor(d3max(vis.map((m) => m.x)));
    for (const f of [...fits].reverse()) {
      const p = el('p');
      const label = f.era === 'pre' ? `Before 2010 (${Math.floor(f.x0)}–2009)` : `Trend, ${Math.max(Math.floor(f.x0), f.from)}–${end}`;
      p.append(el('span', { class: `ex-key${f.era === 'pre' ? ' ex-key--pre' : ''}`, 'aria-hidden': 'true' }));
      p.append(el('strong', { text: `${label}: ` }));
      p.append(`training compute grew ${UNITS.x.num(10 ** f.b)}× per year (90% CI ${UNITS.x.ciText(10 ** f.lo, 10 ** f.hi)}), doubling every ${UNITS.doubling.num(UNITS.doubling.value(f))} months. `);
      p.append(el('span', { class: 'ex-m', text: `OLS on log₁₀ FLOP · n = ${int(f.n)} · R² = ${f.r2.toFixed(2)}` }));
      this.readout.append(p);
    }
  }

  /* ---------- pointer, touch, keyboard ---------- */
  bindPointer() {
    const st = this.stage;
    const local = (e) => {
      const rect = st.getBoundingClientRect();
      const L = this.layoutNow;
      const sx = L.W / rect.width;
      return [(e.clientX - rect.left) * sx - L.M.l, (e.clientY - rect.top) * sx - L.M.t];
    };
    const nearest = (e, maxD) => {
      if (!this.delaunay || !this.vis.length) return null;
      const [mx, my] = local(e);
      const i = this.delaunay.find(mx, my);
      const d = this.vis[i];
      return d && Math.hypot(d.px - mx, d.py - my) <= maxD ? d : null;
    };
    st.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || this.pinned) return;
      const d = nearest(e, 24);
      if (d) this.showTip(d); else this.hideTip();
    });
    st.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !this.pinned) this.hideTip(); });
    let down = null;
    st.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
    st.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return; }
      down = null;
      if (e.pointerType === 'mouse') { if (this.pinned) this.clearSelection(); return; }
      const d = nearest(e, 34);
      if (d && !(this.pinned && this.selected === d)) this.showTip(d, { pinned: true });
      else this.clearSelection();
    });
    st.addEventListener('keydown', (e) => {
      if (!this.vis || !this.vis.length) return;
      const byDate = [...this.vis].sort((a, b) => a.x - b.x || a.compute - b.compute);
      let i = this.selected ? byDate.indexOf(this.selected) : -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') i = Math.min(byDate.length - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') i = i < 0 ? byDate.length - 1 : Math.max(0, i - 1);
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = byDate.length - 1;
      else if (e.key === 'Escape') { this.clearSelection(); return; }
      else return;
      e.preventDefault();
      this.showTip(byDate[i], { pinned: true });
    });
    st.addEventListener('blur', () => { if (this.pinned && !this.stage.matches(':hover')) this.clearSelection(); });
    document.addEventListener('pointerdown', (e) => { if (this.pinned && !st.contains(e.target) && !this.tableWrap.contains(e.target)) this.clearSelection(); });
  }

  showTip(d, { pinned = false, silent = false } = {}) {
    const { d3 } = this;
    const T = readTokens(this.root);
    const L = this.layoutNow;
    this.selected = d;
    this.pinned = pinned;
    // highlight ring
    this.g.hover.selectAll('circle').data([d]).join('circle')
      .attr('cx', d.px).attr('cy', d.py).attr('r', L.rad + 3.5)
      .attr('fill', d.color).attr('stroke', T.ink).attr('stroke-width', 2);
    this.g.labels.selectAll('text').classed('is-hot', (p) => p.id === d.id);

    const tip = this.tip;
    const cb = COLOR_BY.find((c) => c.key === this.state.colorBy);
    tip.replaceChildren();
    const v = el('p', { class: 'ex-tip__v' });
    v.append(sciNode(d.compute), el('small', { text: ' FLOP' }));
    const key = el('span', { class: 'ex-tip__key', 'aria-hidden': 'true' });
    key.style.background = d.color;
    const catText = this.state.colorBy === 'domain' ? d.domain_group : `${shortName(d[cb.field])}${d.cat === 'Other' ? ' (Other)' : ''}`;
    const dl = el('dl', { class: 'ex-tip__dl' });
    const add = (k, val) => { if (val) dl.append(el('dt', { text: k }), el('dd', { text: val })); };
    add('Published', dateFmt(d.date));
    if (this.state.colorBy !== 'org') add('Org', truncate(orgText(d.organization), 40));
    if (this.state.colorBy !== 'domain') add('Domain', d.domain_group);
    add('Params', d.parameters ? compact(d.parameters) : null);
    add('Estimate', d.confidence);
    tip.append(v, el('p', { class: 'ex-tip__name', text: d.model }), el('p', { class: 'ex-tip__row' }, key, el('span', { text: catText })), dl);

    // position: beside the dot on wide screens, above it (clear of the finger) on compact
    tip.classList.add('is-on');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const rect = this.stage.getBoundingClientRect();
    const k = rect.width / L.W;
    const cx = (d.px + L.M.l) * k, cy = (d.py + L.M.t) * k;
    let left, top;
    if (L.compact) {
      left = clamp(cx - tw / 2, 0, rect.width - tw);
      top = cy - th - 16;
      if (top < -8) top = cy + 18;
    } else {
      left = cx + 16;
      if (left + tw > rect.width) left = cx - tw - 16;
      top = clamp(cy - th / 2, -10, rect.height - th);
    }
    tip.style.transform = '';
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    if (!silent && pinned) this.live.textContent = `${d.model}, ${dateFmt(d.date)}, ${sci(d.compute)} FLOP, ${catText}.`;
    void d3;
  }
  hideTip() {
    this.tip.classList.remove('is-on');
    this.g.hover.selectAll('circle').remove();
    this.g.labels.selectAll('text').classed('is-hot', false);
    this.selected = null;
  }
  clearSelection() { this.pinned = false; this.hideTip(); }

  /* ---------- table + download ---------- */
  rows() {
    const vis = this.visible();
    const T = readTokens(this.root);
    for (const m of vis) { m.cat = this.catOf(m); m.color = this.colorFor(m.cat, T); }
    const { key, dir } = this.sort;
    const sgn = dir === 'ascending' ? 1 : -1;
    const get = { model: (m) => m.model.toLowerCase(), org: (m) => (m.organization || '').toLowerCase(), date: (m) => m.x, cat: (m) => m.cat, compute: (m) => m.compute, params: (m) => m.parameters ?? -1, conf: (m) => m.confidence }[key];
    return vis.sort((a, b) => (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0) * sgn);
  }
  renderTable() {
    const rows = this.rows();
    const cb = COLOR_BY.find((c) => c.key === this.state.colorBy);
    const cols = [
      { key: 'model', label: 'Model' }, { key: 'org', label: 'Organization' }, { key: 'date', label: 'Published' },
      { key: 'cat', label: cb.label }, { key: 'compute', label: 'Training compute (FLOP)', num: true },
      { key: 'params', label: 'Parameters', num: true }, { key: 'conf', label: 'Estimate' },
    ];
    const table = el('table', { class: 'ex-table' });
    table.append(el('caption', { text: `${int(rows.length)} models in the current view (${this.range().label}). Sorted by ${cols.find((c) => c.key === this.sort.key).label.toLowerCase()}, ${this.sort.dir}. Select a column to sort.` }));
    const tr = el('tr');
    for (const c of cols) {
      const th = el('th', { scope: 'col', class: c.num ? 'num' : null, 'aria-sort': this.sort.key === c.key ? this.sort.dir : null });
      const b = el('button', { type: 'button', text: c.label });
      b.addEventListener('click', () => {
        this.sort = { key: c.key, dir: this.sort.key === c.key && this.sort.dir === 'descending' ? 'ascending' : 'descending' };
        this.renderTable();
        this.tableWrap.querySelector(`th[aria-sort] button`)?.focus();
      });
      th.append(b);
      tr.append(th);
    }
    table.append(el('thead', {}, tr));
    const tb = el('tbody');
    for (const m of rows) {
      const sw = el('span', { class: 'ex-swatch', 'aria-hidden': 'true' });
      sw.style.background = m.color;
      const row = el('tr', {},
        el('td', { text: m.model }),
        el('td', { text: truncate(orgText(m.organization), 42) }),
        el('td', { text: m.date }),
        el('td', {}, sw, shortName(m.cat)),
        el('td', { class: 'num' }, sciNode(m.compute)),
        el('td', { class: 'num', text: compact(m.parameters) }),
        el('td', { text: m.confidence }));
      row.addEventListener('pointerenter', () => { if (this.vis.includes(m)) this.showTip(m); });
      row.addEventListener('pointerleave', () => { if (!this.pinned) this.hideTip(); });
      tb.append(row);
    }
    table.append(tb);
    this.tableWrap.replaceChildren(table);
  }
  download() {
    const rows = this.rows();
    const cols = ['model', 'organization', 'date', 'domain', 'domain_group', 'country', 'compute', 'parameters', 'dataset_size', 'notability', 'confidence'];
    const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const head = `# Source: Epoch AI, 'Notable AI Models' (CC BY 4.0), downloaded 2026-11-07 from epoch.ai/data/ai-models. Trimmed and redrawn by José Ochoa; not affiliated with Epoch AI. View: ${this.range().label}.`;
    const csv = [head, cols.join(','), ...rows.map((m) => cols.map((c) => esc(m[c])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `epoch-notable-models-${this.state.range}.csv` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
}
const d3max = (arr) => arr.reduce((a, b) => (b > a ? b : a), -Infinity);

/* --------------------------------------------------------------------------
   Trend cards with the unit switch
   -------------------------------------------------------------------------- */
class TrendCards {
  constructor(root, data) {
    this.root = root;
    this.models = data.models;
    this.cards = [...root.querySelectorAll('[data-from]')].map((card) => {
      const from = Number(card.dataset.from), to = Number(card.dataset.to);
      const fit = olsFit(this.models.filter((m) => m.x >= from && m.x < to));
      return { card, fit, lead: card.dataset.lead, subject: card.dataset.subject, tense: card.dataset.tense || 'perfect' };
    });
    this.live = root.querySelector('[data-ex-live]') || el('p', { class: 'ex-sr', 'aria-live': 'polite' });
    if (!this.live.isConnected) root.append(this.live);
    const radios = root.querySelectorAll('[data-ex-unit] input[type="radio"]');
    radios.forEach((r) => r.addEventListener('change', () => r.checked && this.setUnit(r.value, true)));
    const checked = root.querySelector('[data-ex-unit] input:checked');
    this.setUnit(checked ? checked.value : 'x', false);
  }
  setUnit(unit, animate) {
    const u = UNITS[unit];
    if (!u) return;
    const write = () => {
      for (const c of this.cards) {
        if (!c.fit) continue;
        const v = u.value(c.fit);
        const [lo, hi] = u.ci(c.fit);
        const val = c.card.querySelector('[data-ex-value]');
        const claim = c.card.querySelector('[data-ex-claim]');
        const meta = c.card.querySelector('[data-ex-meta]');
        if (val) {
          val.replaceChildren();
          if (u.arrow) val.append(el('span', { class: 'ex-arrow', 'aria-hidden': 'true', text: '↑' }));
          val.append(u.show(v), el('span', { class: 'stat-unit', text: ` ${u.unit}` }));
        }
        if (claim) claim.textContent = sentence(unit, c.fit, c);
        if (meta) {
          const ci = meta.querySelector('[data-ex-ci]');
          const n = meta.querySelector('[data-ex-n]');
          if (ci) ci.textContent = `90% CI ${u.ciText(lo, hi)}`;
          if (n) n.textContent = `n = ${int(c.fit.n)}`;
        }
      }
      this.live.textContent = `Growth shown as ${u.label.toLowerCase()}.`;
    };
    if (!animate || reducedMotion()) { write(); return; }
    const targets = this.root.querySelectorAll('[data-ex-value],[data-ex-claim]');
    targets.forEach((t) => t.classList.add('is-swapping'));
    setTimeout(() => { write(); requestAnimationFrame(() => targets.forEach((t) => t.classList.remove('is-swapping'))); }, 140);
  }
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
async function boot() {
  const figs = [...document.querySelectorAll('[data-epoch-explorer]')];
  const cards = [...document.querySelectorAll('[data-epoch-trends]')];
  if (!figs.length && !cards.length) return;
  for (const root of cards) {
    loadData(root.dataset.src || '/data/epoch/notable_models.json')
      .then((data) => new TrendCards(root, data))
      .catch((err) => console.error('[epoch-explorer] trend cards:', err));
  }
  if (!figs.length) return;
  let d3;
  try { d3 = await loadD3(); } catch (err) {
    figs.forEach((f) => f.querySelector('header')?.after(el('p', { class: 'ex-fallback', text: 'The interactive chart could not load (D3 unavailable). The static version in “Same data, in Python” below shows the same encoding, and the data is downloadable.' })));
    console.error('[epoch-explorer]', err);
    return;
  }
  for (const root of figs) {
    try {
      const data = await loadData(root.dataset.src || '/data/epoch/notable_models.json');
      root.explorer = new Explorer(root, data, d3);
    } catch (err) {
      root.querySelector('header')?.after(el('p', { class: 'ex-fallback', text: 'The chart data could not load. The JSON is linked in the source line below.' }));
      console.error('[epoch-explorer]', err);
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
