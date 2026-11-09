/* =============================================================================
   charts/index.js — chart runtime for José Ochoa's portfolio
   =============================================================================

   ADD A FIGURE
   -------------------------
   1. Load D3, then this module, at the end of <body> (D3 first; both are deferred):
        <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"
                integrity="sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i"
                crossorigin="anonymous" referrerpolicy="no-referrer" defer></script>
        <script type="module" src="/assets/js/charts/index.js"></script>
      If D3 is missing, this module injects that same script tag and waits for it.

   2. Paste the figure anatomy. Only data-chart and data-src are required:
        <figure class="figure" data-chart="timeline" data-src="/data/bakery-metrics.json" id="fig-timeline">
          <header>
            <p class="eyebrow">Figure 1 · Commits per day</p>
            <h3 class="figure-title">142 days from first commit to a live store</h3>
            <p class="figure-sub">Daily commits across all branches, with milestones.</p>
          </header>
          <div class="chart" role="img" aria-label="One-sentence description of the chart."></div>
          <figcaption>One-sentence takeaway.</figcaption>
          <footer class="figure-foot">
            <span>Source: git log --all, computed 2026-11-07</span>
            <span class="figure-actions"><button data-action="table">Table</button><a data-action="download" download>Data</a></span>
          </footer>
        </figure>
      If .chart or .figure-actions are missing, the runtime creates them, so every chart
      always ships a Table toggle and a Data download.

   3. Give the figure a unique id. It names the table (#<id>-table) and the download
      (<id>.json). Wider-than-prose figures: add class "bleed" (base.css).

   RENDERERS — data-chart → data-src → the keys each one reads
   ------------------------------------------------------------
     timeline    /data/bakery-metrics.json          commits_by_day, milestones, timeline
     growth      /data/bakery-metrics.json          assertion_count_over_time, assumptions_register_rows_over_time
     issues      /data/bakery-metrics.json          issues[], issues_summary
     heat        /data/bakery-metrics.json          commits_by_hour, commits_by_weekday
     rounds      /data/bakery-metrics.json          review_gate.mentions_in_records
     types       /data/bakery-metrics.json          commits_by_type
     models      /data/bakery-metrics.json          ai_coauthorship
     loc         /data/bakery-metrics.json          loc_by_area
     orders      /data/bakery-orders-week1.json     days[] {date,bakery,holiday}, totals
     ds-commits  /data/design-system-metrics.json   commits_by_day, design_system_commits_by_day, milestones, commits
     tokens      /data/design-system-metrics.json   tokens
     build-log   /data/build-log.json               generated, phases[], lanes[] {id,label,model,start,end|null,phase}

   OPTIONS — data-* attributes on the <figure> (all optional)
   ------------------------------------------------------------
     data-labels="6"          timeline/ds-commits: most milestone labels at ≥520px chart width
     data-labels-mobile="3"   …and below 520px. Labels that would collide drop to the tooltip.
     data-from / data-to      timeline/ds-commits/issues: YYYY-MM-DD window
     data-height="280"        plot height in px (the chart adds its own label/axis bands)
     data-highlight="key"     loc: emphasised area key (default "tests_php"; "" = none);
                              heat: night window as "22-2"
     data-animate="false"     never draw in (also off under prefers-reduced-motion)
     data-surface="paper-2"   the background the figure sits on (gaps and rings use it);
                              .figure--card sets this automatically

   CSS MODIFIERS (charts.css)
   ---------------------------
     .figure--card     figure on a --paper-2 card (rings and gaps follow)
     .figure--prose    cap a figure at the prose measure (680px) inside wider layouts
     .figure-pair      wrapper: two figures side by side from 900px, stacked below
     Inside .section--alt the chart surface switches to --paper-2 automatically.

   RENDERER CONTRACT — assets/js/charts/<name>.js, default export
   ---------------------------------------------------------------
     pick(json, opts)        → the JSON slice the chart uses (also what "Data" downloads)
     render(chartEl, slice, ctx)
     table(slice, ctx)       → { caption?, columns:[{key,label,numeric?}], rows:[{…}] } or an array of them
     ctx = { d3, theme, reduced, animate, width, mobile, opts, colors, fmt, tooltip,
             keys(handler), id, figure }
     Custom renderers: import { register } from '/assets/js/charts/index.js'; register('name', module).

   BEHAVIOUR
   ---------
     · First draw on first intersection (draw-in animation once; never under reduced motion).
     · Re-render (no animation) on width change (ResizeObserver, debounced), on the
       document 'themechange' event, on data-theme attribute changes, on OS scheme changes
       and when web fonts finish loading.
     · One shared tooltip (.chart-tip). Hover, tap (touch), and keyboard: focus a chart,
       then ←/→ (Shift = ×7), Home/End, Esc.
     · Every colour is read from CSS custom properties at render time (tokens.css).
     · window.charts = { refresh(), redraw(), fmt, readColors } for debugging and late markup.
   ========================================================================== */

const D3_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
const D3_SRI = 'sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i'; // same hash as the <script> tags
const D3_TIMEOUT = 15000;
const MOBILE_BELOW = 520;            // chart width (px) under which renderers use their narrow layout
const registry = new Map();          // name -> renderer module (default export)
const dataCache = new Map();         // url  -> Promise<json>
const instances = new Map();         // root element -> Chart

/* ---- D3 -------------------------------------------------------------- */
let d3Promise = null;
export function loadD3() {
  if (window.d3) return Promise.resolve(window.d3);
  if (d3Promise) return d3Promise;
  d3Promise = new Promise((resolve, reject) => {
    // Settle exactly once: on load, on error, or after D3_TIMEOUT so callers can show a fallback.
    let poll = 0, timer = 0;
    const done = (fn, v) => { clearInterval(poll); clearTimeout(timer); fn(v); };
    const s = document.createElement('script');
    s.src = D3_SRC;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.integrity = D3_SRI;
    s.referrerPolicy = 'no-referrer';
    s.addEventListener('load', () => (window.d3 ? done(resolve, window.d3) : done(reject, new Error('D3 loaded without a global'))));
    s.addEventListener('error', () => done(reject, new Error('D3 failed to load from ' + D3_SRC)));
    poll = setInterval(() => { if (window.d3) done(resolve, window.d3); }, 50);
    timer = setTimeout(() => done(reject, new Error(`D3 did not load within ${D3_TIMEOUT / 1000} s`)), D3_TIMEOUT);
    document.head.append(s);
  });
  // A failed attempt is not cached forever: a later call may retry.
  d3Promise.catch(() => { d3Promise = null; });
  return d3Promise;
}

/* ---- Data ------------------------------------------------------------ */
export function fetchJSON(url) {
  const key = new URL(url, document.baseURI).href;
  if (!dataCache.has(key)) {
    dataCache.set(key, fetch(key, { credentials: 'same-origin' }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
      return r.json();
    }));
  }
  return dataCache.get(key);
}

/* ---- Renderers ------------------------------------------------------- */
export function register(name, mod) { registry.set(name, mod); }

async function loadRenderer(name) {
  if (registry.has(name)) return registry.get(name);
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Bad chart name "${name}"`);
  const mod = await import(new URL(`./${name}.js`, import.meta.url).href);
  registry.set(name, mod.default || mod);
  return registry.get(name);
}

/* ---- Formatters (thousands separator in one place) -------------------- */
const SEP = ',';
const PT = 'America/Los_Angeles';
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: PT });
const timeSecFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: PT });
const lowerAmPm = (s) => s.replace(/\s?(AM|PM)$/, (m, p) => ' ' + p.toLowerCase());

export const fmt = {
  /** 1503 → "1,503" */
  int(n) {
    if (n == null || Number.isNaN(+n)) return '–';
    return window.d3.format(',')(Math.round(n)).replace(/,/g, SEP);
  },
  /** 17.33 → "17.3" */
  num(n, digits = 1) { return n == null ? '–' : window.d3.format(`,.${digits}f`)(n).replace(/,/g, SEP); },
  /** 62396 → "62K", 6089 → "6,089" (compact only from 10,000) */
  compact(n) {
    if (n == null) return '–';
    if (Math.abs(n) < 1e4) return fmt.int(n);
    return window.d3.format('.3~s')(n).replace('k', 'K').replace('G', 'B');
  },
  /** 0.488 → "49%" */
  pct(x, digits = 0) { return x == null ? '–' : window.d3.format(`.${digits}%`)(x); },
  /** "2026-10-26" → Date at local midnight (never UTC-shifted) */
  parse(s) { return s instanceof Date ? s : window.d3.timeParse('%Y-%m-%d')(String(s).slice(0, 10)); },
  iso(d) { return window.d3.timeFormat('%Y-%m-%d')(d); },
  date(d) { return window.d3.timeFormat('%b %-d, %Y')(d); },        // Oct 26, 2026
  dateShort(d) { return window.d3.timeFormat('%b %-d')(d); },        // Oct 26
  day(d) { return window.d3.timeFormat('%a, %b %-d, %Y')(d); },      // Mon, Oct 26, 2026
  month(d) { return window.d3.timeFormat('%b')(d); },                // Oct
  monthYear(d) { return window.d3.timeFormat('%b %Y')(d); },         // Oct 2026
  /** Clock time in Pacific time: "10:22 pm" */
  time(d) { return lowerAmPm(timeFmt.format(d)); },
  timeSec(d) { return lowerAmPm(timeSecFmt.format(d)); },
  /** 724000 → "12m 04s"; 3_900_000 → "1h 05m" */
  duration(ms) {
    if (ms == null || ms < 0) return '–';
    const s = Math.round(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = (v) => String(v).padStart(2, '0');
    return h ? `${h}h ${pad(m)}m` : `${m}m ${pad(sec)}s`;
  },
  /** Mentions a commit noun with the right plural: (1,'commit') → "1 commit" */
  count(n, noun, plural = noun + 's') { return `${fmt.int(n)} ${n === 1 ? noun : plural}`; },
};

/* ---- Colours: read every value from CSS custom properties ------------- */
const SEQ_STEPS = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700];

export function currentTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark' || t === 'light') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readColors(el = document.documentElement) {
  const d3 = window.d3;
  const cs = getComputedStyle(el);
  const v = (name, fallback = '') => cs.getPropertyValue(name).trim() || fallback;
  const theme = currentTheme();

  const c = {
    theme,
    paper: v('--paper', 'Canvas'),
    paper2: v('--paper-2', v('--paper', 'Canvas')),
    paper3: v('--paper-3', v('--paper-2', 'Canvas')),
    ink: v('--ink', 'CanvasText'),
    ink2: v('--ink-2', v('--ink', 'CanvasText')),
    ink3: v('--ink-3', 'GrayText'),
    inkMeta: v('--ink-meta', v('--ink-3', 'GrayText')),
    line: v('--line', 'GrayText'),
    lineStrong: v('--line-strong', v('--line', 'GrayText')),
    grid: v('--grid', v('--line', 'GrayText')),
    axis: v('--axis', v('--line-strong', 'GrayText')),
    accent: v('--accent', 'LinkText'),
    accentInk: v('--accent-ink', v('--accent', 'LinkText')),
    accentSoft: v('--accent-soft', v('--paper-2', 'Canvas')),
    good: v('--good'), warn: v('--warn'), bad: v('--bad'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--series-${i}`, v('--accent', 'LinkText'))),
    seq: {},
  };
  for (const s of SEQ_STEPS) c.seq[s] = v(`--seq-${s}`);
  // Fill missing ramp steps from the accent tokens so a partial token file never breaks a chart.
  const lo = c.accentSoft, hi = c.accentInk;
  SEQ_STEPS.forEach((s, i) => { if (!c.seq[s]) c.seq[s] = d3.interpolateLab(lo, hi)(i / (SEQ_STEPS.length - 1)); });

  // The surface the figure sits on: gaps and rings are drawn in this colour.
  const surf = v('--chart-surface');
  c.surface = surf || c.paper;

  const mix = (a, b, t) => {
    const ca = d3.color(a), cb = d3.color(b);
    if (!ca || !cb) return b || a;
    return d3.interpolateRgb(ca, cb)(t);
  };
  c.mix = mix;
  /** De-emphasis grey for "the rest" in emphasis charts. */
  c.muted = mix(c.surface, c.ink3, theme === 'dark' ? 0.5 : 0.42);
  /** Recessive tint of the accent (same hue, lighter step for the mode). */
  c.accentQuiet = theme === 'dark' ? c.seq[600] : c.seq[250];
  /** Area wash: the series hue at ~10% (alpha over the surface). */
  c.wash = (color, a = 0.1) => {
    const col = d3.color(color);
    if (!col) return color;
    col.opacity = a;
    return col.formatRgb();
  };
  /** Text colour for a label set inside a coloured fill: white or near-black by luminance. */
  const darkest = luminance(c.ink) < luminance(c.paper) ? c.ink : c.paper;
  c.onFill = (fill) => {
    const L = luminance(fill);
    const vsWhite = 1.05 / (L + 0.05), vsDark = (L + 0.05) / (luminance(darkest) + 0.05);
    return vsWhite >= vsDark ? 'white' : darkest;
  };
  /** Sequential ramp t∈[0,1] → colour; dark mode starts from the lighter end. */
  c.ramp = (t) => {
    const stops = theme === 'dark'
      ? [c.seq[650], c.seq[500], c.seq[400], c.seq[300], c.seq[200], c.seq[100]]
      : [c.seq[150], c.seq[250], c.seq[350], c.seq[450], c.seq[550], c.seq[650]];
    return d3.piecewise(d3.interpolateLab, stops)(Math.max(0, Math.min(1, t)));
  };
  return c;
}

function luminance(color) {
  const c = window.d3.color(color);
  if (!c) return 0.5;
  const { r, g, b } = c.rgb();
  const lin = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/* ---- The shared tooltip --------------------------------------------- */
export const tooltip = (() => {
  let el = null;
  let owner = null;
  let said = '';
  const ensure = () => {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'chart-tip';
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    document.body.append(el);
    return el;
  };
  const text = (tag, cls, str) => {
    const n = document.createElement(tag);
    n.className = cls;
    n.textContent = str;
    return n;
  };
  return {
    /**
     * show(point, content, ownerEl)
     * point:   { x, y } in client (viewport) coordinates
     * content: { title, rows:[{ value, label, color, key:'line'|'rect'|'dot'|null }], note | notes[] }
     */
    show(point, content, ownerEl = null) {
      const t = ensure();
      owner = ownerEl;
      t.replaceChildren();
      if (content.title) t.append(text('p', 'chart-tip__title', content.title));
      for (const r of content.rows || []) {
        const row = document.createElement('div');
        row.className = 'chart-tip__row';
        const key = document.createElement('span');
        key.className = `chart-tip__key chart-tip__key--${r.key || 'none'}`;
        if (r.color) key.style.setProperty('--key', r.color);
        row.append(key, text('span', 'chart-tip__value', r.value ?? ''), text('span', 'chart-tip__label', r.label ?? ''));
        t.append(row);
      }
      const notes = content.notes || (content.note ? [content.note] : []);
      said = [content.title, ...(content.rows || []).map((r) => `${r.value ?? ''} ${r.label ?? ''}`.trim()), ...notes]
        .filter(Boolean).join('. ');
      notes.forEach((n, i) => t.append(text('p', 'chart-tip__note' + (i ? ' chart-tip__note--more' : ''), n)));
      t.hidden = false;
      // Position: above-right of the point, flipped to stay inside the viewport.
      const w = t.offsetWidth, h = t.offsetHeight;
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      const off = 14;
      let x = point.x + off, y = point.y - off - h;
      if (x + w > vw - 8) x = point.x - off - w;
      if (x < 8) x = Math.max(8, Math.min(vw - w - 8, point.x - w / 2));
      if (y < 8) y = point.y + off + 6;
      if (y + h > vh - 8) y = Math.max(8, vh - h - 8);
      t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      t.classList.add('is-on');
    },
    hide(ownerEl = null) {
      if (!el || (ownerEl && owner && ownerEl !== owner)) return;
      el.classList.remove('is-on');
      el.hidden = true;
      owner = null;
    },
    get owner() { return owner; },
    get text() { return said; },
  };
})();

/* ---- Fonts: wait (briefly) so text measurement is right ---------------- */
let fontsReady = null;
function waitFonts() {
  if (!fontsReady) {
    fontsReady = document.fonts && document.fonts.ready
      ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1800))])
      : Promise.resolve();
  }
  return fontsReady;
}

/* ---- One chart ------------------------------------------------------- */
let uid = 0;
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');

class Chart {
  constructor(root) {
    this.root = root;
    this.figure = root.closest('figure') || root;
    this.name = root.dataset.chart;
    this.src = root.dataset.src || this.figure.dataset.src || '';
    this.id = this.figure.id || root.id || `chart-${this.name}-${++uid}`;
    if (!this.figure.id) this.figure.id = this.id;
    this.el = root.classList.contains('chart') ? root : root.querySelector('.chart');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'chart';
      const head = root.querySelector(':scope > header');
      head ? head.after(this.el) : root.prepend(this.el);
    }
    this.el.setAttribute('aria-busy', 'true');
    if (!this.el.hasAttribute('role')) this.el.setAttribute('role', 'img');
    this.width = 0;
    this.drawn = false;
    this.keyHandler = null;
    this.keyIndex = -1;
  }

  get opts() { return { ...this.figure.dataset, ...this.root.dataset }; }

  async init() {
    try {
      const [d3, mod, json] = await Promise.all([
        loadD3(),
        loadRenderer(this.name),
        this.src ? fetchJSON(this.src) : Promise.resolve(null),
      ]);
      await waitFonts();
      this.d3 = d3;
      this.mod = mod;
      this.json = json;
      this.slice = mod.pick ? mod.pick(json, this.opts) : json;
      this.wireActions();
      this.wireLive();
      this.wireKeys();
      this.observe();
    } catch (err) {
      this.fail(err);
    }
  }

  fail(err) {
    console.error(`[charts] ${this.name} (#${this.id}):`, err);
    this.el.removeAttribute('aria-busy');
    const p = document.createElement('p');
    p.className = 'chart-error';
    p.textContent = 'This chart could not load. ';
    if (this.src) {
      const a = document.createElement('a');
      a.href = this.src;
      a.textContent = 'Open the data (JSON)';
      p.append(a);
    }
    this.el.replaceChildren(p);
  }

  observe() {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      this.draw(true);
      this.watchResize();
    }, { threshold: 0.12 });
    io.observe(this.el);
    this.io = io;
  }

  watchResize() {
    if (this.ro) this.ro.disconnect();
    let t = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        const w = Math.round(this.el.getBoundingClientRect().width);
        if (w && Math.abs(w - this.width) >= 1) this.draw(false);
      }, 120);
    });
    ro.observe(this.el);
    this.ro = ro;
  }

  draw(animate = false) {
    if (!this.mod) return;
    const width = Math.round(this.el.getBoundingClientRect().width);
    if (!width) return;
    this.width = width;
    const reduced = reducedMQ.matches || this.opts.animate === 'false';
    const colors = readColors(this.figure);
    const ctx = {
      d3: this.d3,
      theme: colors.theme,
      reduced,
      animate: animate && !reduced,
      width,
      mobile: width < MOBILE_BELOW,
      opts: this.opts,
      colors,
      fmt,
      tooltip,
      id: this.id,
      figure: this.figure,
      keys: (handler) => { this.keyHandler = handler; },
    };
    if (tooltip.owner === this.el) tooltip.hide();
    this.keyHandler = null;
    this.el.replaceChildren();
    try {
      this.mod.render(this.el, this.slice, ctx);
    } catch (err) {
      this.fail(err);
      return;
    }
    this.el.removeAttribute('aria-busy');
    this.el.classList.toggle('is-interactive', !!this.keyHandler);
    if (this.keyHandler && !this.el.hasAttribute('tabindex')) this.el.tabIndex = 0;
    if (this.keyIndex >= 0 && document.activeElement === this.el && this.keyHandler) {
      this.keyIndex = Math.min(this.keyIndex, this.keyHandler.count - 1);
      this.keyHandler.show(this.keyIndex);
    }
    this.drawn = true;
  }

  /* One polite live region per figure, outside .chart (which is redrawn), so keyboard
     users hear the point they moved to. Pointer hover is not announced. */
  wireLive() {
    const live = document.createElement('p');
    live.className = 'visually-hidden';
    live.setAttribute('aria-live', 'polite');
    this.el.after(live);
    this.live = live;
  }

  announce() {
    if (!this.live) return;
    this.live.textContent = tooltip.owner === this.el ? tooltip.text : '';
  }

  /* Keyboard: the chart element itself is the single tab stop. */
  wireKeys() {
    this.el.addEventListener('keydown', (e) => {
      const h = this.keyHandler;
      if (!h || !h.count) return;
      let i = this.keyIndex < 0 ? (h.start ?? 0) : this.keyIndex;
      const step = e.shiftKey ? 7 : 1;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': i += step; break;
        case 'ArrowLeft': case 'ArrowUp': i -= step; break;
        case 'Home': i = 0; break;
        case 'End': i = h.count - 1; break;
        case 'Escape': this.keyIndex = -1; h.clear && h.clear(); tooltip.hide(this.el); return;
        default: return;
      }
      e.preventDefault();
      this.keyIndex = Math.max(0, Math.min(h.count - 1, i));
      h.show(this.keyIndex);
      this.announce();
    });
    this.el.addEventListener('focus', () => {
      const h = this.keyHandler;
      if (!h || !h.count || !this.el.matches(':focus-visible')) return;
      if (this.keyIndex < 0) this.keyIndex = h.start ?? 0;
      h.show(this.keyIndex);
      this.announce();
    });
    this.el.addEventListener('blur', () => {
      this.keyIndex = -1;
      this.keyHandler && this.keyHandler.clear && this.keyHandler.clear();
      tooltip.hide(this.el);
    });
  }

  /* Table toggle + Data download. */
  wireActions() {
    let actions = this.figure.querySelector('.figure-actions');
    if (!actions) {
      let foot = this.figure.querySelector('.figure-foot');
      if (!foot) {
        foot = document.createElement('footer');
        foot.className = 'figure-foot';
        this.figure.append(foot);
      }
      actions = document.createElement('span');
      actions.className = 'figure-actions';
      foot.append(actions);
    }
    let tbtn = actions.querySelector('[data-action="table"]');
    if (!tbtn) {
      tbtn = document.createElement('button');
      tbtn.dataset.action = 'table';
      tbtn.textContent = 'Table';
      actions.append(tbtn);
    }
    let dl = actions.querySelector('[data-action="download"]');
    if (!dl) {
      dl = document.createElement('a');
      dl.dataset.action = 'download';
      dl.textContent = 'Data';
      actions.append(dl);
    }

    const tableId = `${this.id}-table`;
    tbtn.type = 'button';
    tbtn.setAttribute('aria-expanded', 'false');
    const label = tbtn.textContent.trim() || 'Table';
    tbtn.addEventListener('click', () => {
      // aria-controls is set once the table exists, so it never points at a missing id.
      if (!this.tableEl) { this.buildTable(tableId); tbtn.setAttribute('aria-controls', tableId); }
      const open = this.tableEl.hidden;
      this.tableEl.hidden = !open;
      tbtn.setAttribute('aria-expanded', String(open));
      tbtn.textContent = open ? 'Hide table' : label;
    });

    if (this.mod.table == null) tbtn.hidden = true;
    // The markup ships a static <details class="figure-data"> table for readers without JS
    // (generated by lanes/r2/work/tables/build_tables.py). Once the Table toggle works, hide it
    // so the figure never shows two tables.
    else this.figure.querySelectorAll('details.figure-data').forEach((d) => { d.hidden = true; });

    const title = this.figure.querySelector('.figure-title')?.textContent.trim() || this.name;
    const payload = {
      figure: this.id,
      chart: this.name,
      title,
      source: this.src ? new URL(this.src, document.baseURI).href : null,
      generated: this.json?.generated ?? null,
      method: this.json?.method ?? this.json?.source ?? null,
      license: 'CC BY 4.0 — José Ochoa',
      data: this.slice,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    dl.href = URL.createObjectURL(blob);
    if (!dl.getAttribute('download')) dl.setAttribute('download', `${this.id}.json`);
    if (!dl.hasAttribute('aria-label')) dl.setAttribute('aria-label', `Download the data for “${title}” (JSON)`);
    if (!tbtn.hasAttribute('aria-label')) tbtn.setAttribute('aria-label', `Show the data table for “${title}”`);
  }

  buildTable(tableId) {
    const ctx = { d3: this.d3, fmt, opts: this.opts, theme: currentTheme() };
    let specs = this.mod.table(this.slice, ctx);
    specs = Array.isArray(specs) ? specs : [specs];
    const wrap = document.createElement('div');
    wrap.className = 'chart-table';
    wrap.id = tableId;
    wrap.hidden = true;
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    const title = this.figure.querySelector('.figure-title')?.textContent.trim() || this.name;
    wrap.setAttribute('aria-label', `Data table: ${title}`);
    for (const spec of specs) {
      const table = document.createElement('table');
      table.className = 'table table--compact';
      const cap = document.createElement('caption');
      cap.textContent = spec.caption || title;
      table.append(cap);
      const thead = table.createTHead();
      const hr = thead.insertRow();
      spec.columns.forEach((col) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = col.label;
        if (col.numeric) th.className = 'num';
        hr.append(th);
      });
      const tbody = table.createTBody();
      for (const row of spec.rows) {
        const tr = tbody.insertRow();
        spec.columns.forEach((col, ci) => {
          const cell = document.createElement(ci === 0 ? 'th' : 'td');
          if (ci === 0) cell.scope = 'row';
          const val = row[col.key];
          cell.textContent = val == null || val === '' ? '—' : String(val);
          if (col.numeric) cell.className = 'num';
          if (col.mono) cell.classList.add('mono');
          tr.append(cell);
        });
      }
      wrap.append(table);
    }
    this.el.after(wrap);
    this.tableEl = wrap;
  }
}

/* ---- Boot + global re-render triggers --------------------------------- */
export function refresh(scope = document) {
  scope.querySelectorAll('[data-chart]').forEach((root) => {
    if (instances.has(root)) return;
    // A .chart inside a [data-chart] figure is the render target, not a second chart.
    if (root.classList.contains('chart') && root.parentElement?.closest('[data-chart]')) return;
    const c = new Chart(root);
    instances.set(root, c);
    c.init();
  });
}

let raf = 0;
export function redraw() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    for (const c of instances.values()) if (c.drawn) c.draw(false);
  });
}

function drawAllStatic() {
  for (const c of instances.values()) {
    if (!c.mod) continue;
    if (!c.drawn) { c.io && c.io.disconnect(); c.watchResize(); }
    c.draw(false);
  }
}

document.addEventListener('themechange', redraw);
new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
if (document.fonts) document.fonts.addEventListener('loadingdone', () => { window.__chartsMeasureReset?.(); redraw(); });
window.addEventListener('beforeprint', drawAllStatic);

// A tap outside any chart dismisses a touch tooltip; scrolling dismisses too.
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest || !e.target.closest('.chart')) {
    tooltip.hide();
    document.querySelectorAll('.chart.is-interactive').forEach((el) => el.dispatchEvent(new CustomEvent('chart:reset')));
  }
}, { passive: true });
window.addEventListener('scroll', () => {
  if (tooltip.owner && tooltip.owner !== document.activeElement) {
    tooltip.owner.dispatchEvent(new CustomEvent('chart:reset'));
    tooltip.hide();
  }
}, { passive: true });

window.charts = { refresh, redraw, fmt, readColors, register, instances };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => refresh());
else refresh();
