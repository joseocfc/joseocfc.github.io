/* =============================================================================
   charts/kit.js — shared drawing helpers for the renderers
   Mark specs (dataviz references): bars ≤24px with a 4px rounded data end and a square
   baseline · 2px lines · dots r≥4 with a 2px surface ring · 2px surface gap between
   touching marks · hairline, solid, recessive grid · text never wears the data colour.
   ========================================================================== */

const NS = 'http://www.w3.org/2000/svg';
export const MARK = { bar: 24, r: 4, gap: 2, line: 2, dot: 4, ring: 2 };

/* ---- SVG root ------------------------------------------------------- */
export function svg(el, width, height, cls = '') {
  return window.d3.select(el).append('svg')
    .attr('class', `chart-svg ${cls}`.trim())
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false');
}

/* ---- Text measurement (same CSS as the chart text) -------------------- */
let mSvg = null;
const mCache = new Map();
window.__chartsMeasureReset = () => mCache.clear();
export function measure(text, cls = 'c-label') {
  const key = cls + '\u0000' + text;
  if (mCache.has(key)) return mCache.get(key);
  if (!mSvg || !mSvg.isConnected) {
    mSvg = document.createElementNS(NS, 'svg');
    mSvg.setAttribute('class', 'chart-svg chart-measure');
    mSvg.setAttribute('aria-hidden', 'true');
    mSvg.style.cssText = 'position:absolute;left:-10000px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden;pointer-events:none';
    document.body.append(mSvg);
  }
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('class', cls);
  t.textContent = text;
  mSvg.append(t);
  const w = t.getComputedTextLength();
  t.remove();
  mCache.set(key, w);
  return w;
}

/* ---- Mark paths ------------------------------------------------------ */
/** Column: square baseline at yTop+h, rounded data end at the top. */
export function colPath(x, yTop, w, h, r = MARK.r) {
  if (!(w > 0) || !(h > 0.01)) return '';
  r = Math.max(0, Math.min(r, w / 2, h));
  const b = yTop + h;
  return `M${x},${b}V${yTop + r}A${r},${r} 0 0 1 ${x + r},${yTop}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${yTop + r}V${b}Z`;
}
/** Plain rectangle path (interior stacked segments: square both ends). */
export function rectPath(x, y, w, h) {
  if (!(w > 0) || !(h > 0.01)) return '';
  return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
}
/** Bar: square baseline at x0, rounded data end on the right. */
export function barPath(x0, y, w, h, r = MARK.r) {
  if (!(w > 0.01) || !(h > 0)) return '';
  r = Math.max(0, Math.min(r, h / 2, w));
  return `M${x0},${y}H${x0 + w - r}A${r},${r} 0 0 1 ${x0 + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x0 + w - r},${y + h}H${x0}Z`;
}

/* ---- Motion ---------------------------------------------------------- */
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
/** Paths whose datum carries .path(t) → d. Draws final state, or grows them in. */
export function grow(sel, ctx, { duration = 650, delay = () => 0 } = {}) {
  if (!ctx.animate) { sel.attr('d', (d) => d.path(1)); return; }
  sel.attr('d', (d) => d.path(0))
    .transition().duration(duration).ease(easeOut).delay(delay)
    .attrTween('d', (d) => (t) => d.path(t));
}
/** Stroke draw-in for lines. */
export function drawIn(path, ctx, { duration = 1100, delay = 0 } = {}) {
  if (!ctx.animate) return;
  path.each(function () {
    const L = this.getTotalLength();
    window.d3.select(this)
      .attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L)
      .transition().duration(duration).delay(delay).ease(window.d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0)
      .on('end', function () { window.d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null); });
  });
}
export function fadeIn(sel, ctx, { delay = 0, duration = 350 } = {}) {
  if (!ctx.animate) return sel;
  sel.attr('opacity', 0).transition().delay(delay).duration(duration).attr('opacity', 1);
  return sel;
}

/* ---- Legend (HTML, wraps on phones) ------------------------------------ */
/** items: [{ label, color, kind: 'rect'|'line'|'dot' }]; note: right-aligned text */
export function legend(el, items, { note = null } = {}) {
  const ul = document.createElement('ul');
  ul.className = 'chart-legend';
  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'chart-legend__item';
    const key = document.createElement('span');
    key.className = `chart-legend__key chart-legend__key--${it.kind || 'rect'}`;
    key.style.setProperty('--key', it.color);
    const lab = document.createElement('span');
    lab.textContent = it.label;
    li.append(key, lab);
    ul.append(li);
  }
  if (note) {
    const li = document.createElement('li');
    li.className = 'chart-legend__note';
    li.textContent = note;
    ul.append(li);
  }
  el.append(ul);
  return ul;
}

/** Plain note line above a chart (single-series charts have no legend box). */
export function note(el, text) {
  const p = document.createElement('p');
  p.className = 'chart-note';
  p.textContent = text;
  el.append(p);
  return p;
}

/* ---- Grid + axes ------------------------------------------------------- */
/** Horizontal gridlines with labels sitting on the line at the left edge (editorial style). */
export function yGridInline(g, y, ticks, { x0 = 0, x1, fmt, unit = '', halo = true, labels = g, plate = false } = {}) {
  const top = Math.max(...ticks);
  for (const t of ticks) {
    const yy = Math.round(y(t)) + 0.5;
    g.append('line').attr('class', 'c-grid').attr('x1', x0).attr('x2', x1).attr('y1', yy).attr('y2', yy);
    const text = fmt(t) + (t === top && unit ? ` ${unit}` : '');
    // opt-in surface plate so a milestone pole at the left edge passes behind the label, not through it.
    if (plate) labels.append('rect').attr('class', 'c-plate').attr('x', x0 - 2).attr('y', yy - 15).attr('width', measure(text, 'c-axis') + 6).attr('height', 13);
    labels.append('text').attr('class', `c-axis${halo ? ' c-halo' : ''}`)
      .attr('x', x0).attr('y', yy - 4)
      .text(text);
  }
}
export function baseline(g, x0, x1, y) {
  const yy = Math.round(y) + 0.5;
  return g.append('line').attr('class', 'c-base').attr('x1', x0).attr('x2', x1).attr('y1', yy).attr('y2', yy);
}

/** Month ticks + labels under a time axis. Labels sit right of their tick; the first carries the year. */
export function monthAxis(g, x, { y, ctx, year = true } = {}) {
  const d3 = ctx.d3, fmt = ctx.fmt;
  const [d0, d1] = x.domain();
  const [r0, r1] = x.range();
  const items = [];
  if (+d3.timeMonth.floor(d0) !== +d0) items.push({ d: d0, partial: true });
  d3.timeMonth.range(d3.timeMonth.ceil(d0), d1).forEach((m) => items.push({ d: m }));
  let lastRight = -Infinity;
  items.forEach((it, idx) => {
    const xx = x(it.d);
    const nextX = idx + 1 < items.length ? x(items[idx + 1].d) : r1;
    let tx = it.partial ? xx : xx + 4;
    // The first label carries the year when it fits before the next month; else the month alone.
    let label = idx === 0 && year ? fmt.monthYear(it.d) : fmt.month(it.d);
    let w = measure(label, 'c-axis');
    if (idx === 0 && year && tx + w > nextX - 8) { label = fmt.month(it.d); w = measure(label, 'c-axis'); }
    let anchor = 'start';
    if (it.partial && tx + w > nextX - 6) return;          // a sliver of a month: no label
    if (tx + w > r1) { tx = r1; anchor = 'end'; }
    const left = anchor === 'end' ? tx - w : tx;
    if (!it.partial) {
      const xr = Math.round(xx) + 0.5;
      g.append('line').attr('class', 'c-tick').attr('x1', xr).attr('x2', xr).attr('y1', y).attr('y2', y + 5);
    }
    if (left < lastRight + 8 || left < r0 - 1) return;
    g.append('text').attr('class', 'c-axis').attr('x', tx).attr('y', y + 20).attr('text-anchor', anchor).text(label);
    lastRight = left + w;
  });
}

/* ---- Flag placement (milestone labels) --------------------------------
   items: [{ x, w, rank, … }] in priority order (index 0 = most important). Each flag is a
   pole at x with its label to the right ('start') or left ('end'). Row 0 sits right above
   the plot; a pole from row r crosses every row below it, so poles and labels are both
   obstacles. Placement is greedy by priority with a small bounded search: a flag is only
   dropped when no arrangement of the higher-priority flags leaves room for it. Among
   equal outcomes it prefers lower rows and labels to the right of their pole.
   Returns the flags that fit, with { row, anchor, x0, x1 }. The rest drop to the tooltip. */
export function placeFlags(items, { width, rows = 2, offset = 5, pad = 14, minX = 0 } = {}) {
  const n = items.length;
  const options = items.map((it) => {
    const o = [];
    for (let row = 0; row < rows; row++) {
      for (const anchor of ['start', 'end']) {
        const x0 = anchor === 'start' ? it.x : it.x - offset - it.w;
        const x1 = anchor === 'start' ? it.x + offset + it.w : it.x;
        if (x0 < minX || x1 > width) continue;
        o.push({ row, anchor, x0, x1, x: it.x, cost: row * 3 + (anchor === (it.prefer || 'start') ? 0 : 1) });
      }
    }
    return o.sort((a, b) => a.cost - b.cost);
  });
  const clash = (a, b) => {
    if (a.row === b.row && a.x0 < b.x1 + pad && a.x1 > b.x0 - pad) return true;
    if (a.row < b.row && b.x > a.x0 - 4 && b.x < a.x1 + 4) return true;   // b's pole through a's label
    if (b.row < a.row && a.x > b.x0 - 4 && a.x < b.x1 + 4) return true;   // a's pole through b's label
    return false;
  };
  const weight = (i) => 2 ** (n - i) * 1000;          // a higher-priority flag beats all lower ones
  const tail = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) tail[i] = tail[i + 1] + weight(i);
  const picks = new Array(n).fill(null);
  let best = { score: -Infinity, picks: [] };
  let budget = 60000;
  const dfs = (i, score) => {
    if (--budget < 0) return;
    if (score + tail[i] <= best.score) return;
    if (i === n) { best = { score, picks: picks.slice() }; return; }
    for (const o of options[i]) {
      if (picks.some((p) => p && clash(p, o))) continue;
      picks[i] = o;
      dfs(i + 1, score + weight(i) - o.cost);
      picks[i] = null;
    }
    dfs(i + 1, score);
  };
  dfs(0, 0);
  return items.map((it, i) => (best.picks[i] ? { ...it, ...best.picks[i] } : null)).filter(Boolean);
}

/* ---- Interaction: hover, tap, keyboard -------------------------------- */
export function clientPoint(svgNode, x, y) {
  const r = svgNode.getBoundingClientRect();
  return { x: r.left + x, y: r.top + y };
}

/**
 * hover(ctx, el, { target, count, indexAt(evt) → i | -1, show(i, point|null), clear(), start })
 * Mouse: pointermove. Touch/pen: tap. Keyboard: registered with the runtime (ctx.keys).
 * show() receives the client point for pointer input and null for keyboard input
 * (renderers then anchor the tooltip on the mark).
 */
export function hover(ctx, el, { target, count, indexAt, show, clear = () => {}, start = 0 }) {
  const node = target.node ? target.node() : target;
  if (el.__hoverAbort) el.__hoverAbort.abort();
  const ac = new AbortController();
  el.__hoverAbort = ac;
  const opt = { signal: ac.signal };
  let active = -1;
  const reset = () => { active = -1; clear(); ctx.tooltip.hide(el); };
  node.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const i = indexAt(e);
    if (i < 0) { if (active >= 0) reset(); return; }
    active = i;
    show(i, { x: e.clientX, y: e.clientY });
  }, opt);
  node.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const i = indexAt(e);
    if (i < 0) return reset();
    active = i;
    show(i, { x: e.clientX, y: e.clientY });
  }, opt);
  node.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') reset(); }, opt);
  el.addEventListener('chart:reset', reset, opt);
  ctx.keys({ count, start, show: (i) => show(i, null), clear });
}

/* ---- Daily bars (timeline, ds-commits) ---------------------------------
   cfg = {
     days:  [{ date, values:[…per part, bottom first], total, … }]  contiguous days
     parts: [{ key, label, color }]                                    1 → no legend
     milestones: [{ date, short, long, rank, strong }]
     maxLabels, plotH, unit, band: { from, to, labels:[long…short] }, legendNote,
     tip(day, i) → tooltip content
   } */
export function dailyBars(el, ctx, cfg) {
  const d3 = ctx.d3, C = ctx.colors, fmt = ctx.fmt, W = ctx.width, mobile = ctx.mobile;
  const { days, parts, milestones = [], band = null, unit = '' } = cfg;
  if (parts.length > 1) legend(el, parts.map((p) => ({ label: p.label, color: p.color, kind: 'rect' })), { note: cfg.legendNote });
  else if (cfg.legendNote) note(el, cfg.legendNote);

  const n = days.length;
  const start = days[0].date;
  const end = d3.timeDay.offset(days[n - 1].date, 1);
  const x = d3.scaleTime().domain([start, end]).range([0, W]);
  const step = W / n;
  const gap = step >= 6 ? MARK.gap : step >= 3.5 ? 1 : Math.max(0.35, step * 0.22);
  const bw = Math.max(0.8, Math.min(MARK.bar, step - gap));
  const bx = (i) => x(days[i].date) + (step - bw) / 2;
  const indexOf = (date) => d3.timeDay.count(start, date);

  /* Flags */
  const ROW = 20;
  const inRange = milestones.filter((m) => m.date >= start && m.date < end);
  const cands = inRange.slice().sort((a, b) => a.rank - b.rank).slice(0, cfg.maxLabels).map((m) => {
    const i = indexOf(m.date);
    const dt = fmt.dateShort(m.date).toUpperCase();
    const text = (mobile && m.shortMobile) || m.short;
    const cls = 'c-flag-text' + (m.strong ? ' is-strong' : '');
    const w = measure(dt, 'c-flag-date') + 6 + measure(text, cls);
    return { ...m, i, x: bx(i) + bw / 2, dt, text, cls, w };
  });
  const placed = placeFlags(cands, { width: W, rows: mobile ? 2 : 3 });
  const rowsUsed = placed.length ? d3.max(placed, (p) => p.row) + 1 : 0;
  const bandH = band ? ROW : 0;
  const top = bandH + rowsUsed * ROW + (rowsUsed || band ? 16 : 6);
  const base = top + cfg.plotH;
  const H = base + 32;

  const root = svg(el, W, H);
  const maxV = d3.max(days, (d) => d.total) || 1;
  const y = d3.scaleLinear().domain([0, maxV]).range([base, top + 2]);

  const gBand = root.append('g');
  const gGrid = root.append('g');
  const gHi = root.append('g');
  const gBars = root.append('g');
  const gFlags = root.append('g');
  const gTicks = root.append('g');
  const gAxis = root.append('g');

  /* Window band (full height, label at the top inside it) */
  if (band) {
    const x0 = x(band.from), x1 = x(d3.timeDay.offset(band.to, 1));
    gBand.append('rect').attr('class', 'c-band').attr('x', x0).attr('y', 0).attr('width', x1 - x0).attr('height', base);
    const room = x1 - x0 - 12;
    const label = band.labels.find((l) => measure(l.toUpperCase(), 'c-flag-date') <= room);
    if (label) gBand.append('text').attr('class', 'c-flag-date c-band-label').attr('x', x0 + 6).attr('y', 14).text(label.toUpperCase());
  }

  /* Grid */
  const ticks = y.ticks(mobile ? 3 : 4).filter((t) => t > 0 && t <= maxV);
  yGridInline(gGrid, y, ticks, { x1: W, fmt: fmt.int, unit, labels: gTicks, plate: true });
  baseline(gAxis, 0, W, base);

  /* Bars: stacked parts, bottom first; only the top segment gets the rounded end */
  const segs = [];
  days.forEach((d, i) => {
    let cum = 0;
    const topK = d.values.reduce((k, v, j) => (v > 0 ? j : k), -1);
    d.values.forEach((v, k) => {
      if (!(v > 0)) return;
      const yb = y(cum) - (cum > 0 ? MARK.gap : 0);
      cum += v;
      const yt = y(cum);
      segs.push({ i, k, x: bx(i), w: bw, yb, yt, round: k === topK, color: parts[k].color });
    });
  });
  segs.forEach((s) => {
    s.path = (t) => {
      const b = base - (base - s.yb) * t, tp = base - (base - s.yt) * t;
      const h = b - tp;
      return s.round ? colPath(s.x, tp, s.w, h) : rectPath(s.x, tp, s.w, h);
    };
  });
  const bars = gBars.selectAll('path').data(segs).join('path').attr('fill', (s) => s.color);
  grow(bars, ctx, { duration: 520, delay: (s) => (s.i / n) * 650 });

  /* Milestone rail: every milestone gets a dot; labelled ones get a flag */
  const labelled = new Set(placed.map((p) => +p.date));
  // Rail dots: labelled first, then the rest where they do not crowd a neighbour (≥5px apart).
  const railX = (m) => bx(indexOf(m.date)) + bw / 2;
  const rail = [];
  [...inRange].sort((a, b) => labelled.has(+b.date) - labelled.has(+a.date)).forEach((m) => {
    if (labelled.has(+m.date) || rail.every((r) => Math.abs(railX(r) - railX(m)) >= 5)) rail.push(m);
  });
  gAxis.selectAll('circle.c-rail').data(rail).join('circle')
    .attr('class', (m) => `c-rail${labelled.has(+m.date) ? ' is-labelled' : ''}`)
    .attr('cx', railX).attr('cy', base + 5)
    .attr('r', (m) => (labelled.has(+m.date) ? 2.75 : 2));

  const rowBase = (r) => top - 16 - r * ROW - 5;
  placed.forEach((p) => {
    const d = days[p.i];
    const by = d && d.total > 0 ? y(d.total) - 3 : base - 2;
    const ty = rowBase(p.row);
    const px = Math.round(p.x) + 0.5;
    const g = gFlags.append('g').attr('class', 'c-flag' + (p.strong ? ' is-strong' : ''));
    if (by > ty - 9) g.append('line').attr('class', 'c-flag-pole').attr('x1', px).attr('x2', px).attr('y1', ty - 9).attr('y2', by);
    const t = g.append('text').attr('y', ty).attr('x', p.anchor === 'start' ? p.x + 5 : p.x - 5).attr('text-anchor', p.anchor === 'start' ? 'start' : 'end');
    t.append('tspan').attr('class', 'c-flag-date').text(p.dt);
    t.append('tspan').attr('class', p.cls).attr('dx', 6).text(p.text);
    fadeIn(g, ctx, { delay: 520 + (p.i / n) * 650 });
  });

  monthAxis(gAxis, x, { y: base, ctx });

  /* Hover column + tooltip */
  const hi = gHi.append('rect').attr('class', 'c-hover-col').attr('y', top - 2).attr('height', base - top + 2).attr('width', step).attr('opacity', 0);
  const hit = root.append('rect').attr('class', 'c-hit').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);
  const msByDay = d3.group(inRange, (m) => +m.date);
  hover(ctx, el, {
    target: hit,
    count: n,
    start: cfg.startIndex ?? 0,
    indexAt: (e) => {
      const [px] = d3.pointer(e, root.node());
      return Math.max(0, Math.min(n - 1, Math.floor(px / step)));
    },
    show: (i, pt) => {
      const d = days[i];
      hi.attr('x', x(d.date)).attr('opacity', 1);
      const content = cfg.tip(d, i);
      const ms = msByDay.get(+d.date) || [];
      content.notes = [...(content.notes || []), ...ms.map((m) => m.long || m.short)];
      ctx.tooltip.show(pt || clientPoint(root.node(), bx(i) + bw / 2, d.total ? y(d.total) : base), content, el);
    },
    clear: () => hi.attr('opacity', 0),
  });
  return { x, y, root, base, top };
}

/* ---- Horizontal bars (rounds, models, loc, tokens) ----------------------
   cfg = {
     rows: [{ key, label, sub?, value, color?, strong?, gapBefore?, tip? }],
     format(v), valueText(row), max, units: false | true (one square per unit),
     tipLabel: 'mentions', color
   } */
export function hbars(el, ctx, cfg) {
  const d3 = ctx.d3, C = ctx.colors, W = ctx.width, mobile = ctx.mobile;
  const rows = cfg.rows;
  const format = cfg.format || ctx.fmt.int;
  const vText = (r) => (cfg.valueText ? cfg.valueText(r) : format(r.value));
  const hasSub = rows.some((r) => r.sub);
  const valCls = (r) => 'c-value' + (r.strong ? ' is-strong' : '');
  const valueW = d3.max(rows, (r) => measure(vText(r), valCls(r))) + 10;
  const labelW = mobile ? 0 : Math.min(W * 0.42, d3.max(rows, (r) => Math.max(measure(r.label, 'c-label'), r.sub ? measure(r.sub, 'c-sub') : 0)) + 24);
  const x0 = labelW;
  const thick = mobile ? 14 : 18;
  const pitch = mobile ? (hasSub ? 50 : 42) : (hasSub ? 48 : 36);
  const barTop = mobile ? (hasSub ? 26 : 22) : (pitch - thick) / 2;
  const space = Math.max(40, W - x0 - valueW);
  const max = cfg.max ?? d3.max(rows, (r) => r.value);

  let units = null;
  if (cfg.units) {
    const g = 3;
    let s = mobile ? 9 : 11;
    while (s > 4 && max * (s + g) - g > space) s -= 1;
    units = { s, g, size: (v) => v * (s + g) - g };
  }
  const x = units ? (v) => units.size(v) : d3.scaleLinear().domain([0, max]).range([0, space]);

  let yy = 2;
  rows.forEach((r) => { if (r.gapBefore) yy += 16; r._y = yy; yy += pitch; });
  const H = yy + 2;
  const root = svg(el, W, H);
  const gSep = root.append('g'), gRows = root.append('g');

  rows.forEach((r) => {
    if (r.gapBefore) {
      const sy = Math.round(r._y - 8) + 0.5;
      gSep.append('line').attr('class', 'c-grid').attr('x1', 0).attr('x2', W).attr('y1', sy).attr('y2', sy);
    }
  });

  const g = gRows.selectAll('g.c-row').data(rows).join('g')
    .attr('class', 'c-row').attr('transform', (r) => `translate(0,${r._y})`);

  // Labels
  g.each(function (r) {
    const gg = d3.select(this);
    if (mobile) {
      const t = gg.append('text').attr('class', 'c-label' + (r.strong ? ' is-strong' : '')).attr('x', 0).attr('y', 14);
      t.append('tspan').text(r.label);
      if (r.sub && measure(r.label, 'c-label') + 10 + measure(r.sub, 'c-sub') < W) t.append('tspan').attr('class', 'c-sub').attr('dx', 8).text(r.sub);
    } else if (r.sub) {
      gg.append('text').attr('class', 'c-label' + (r.strong ? ' is-strong' : '')).attr('x', 0).attr('y', pitch / 2 - 3).text(r.label);
      gg.append('text').attr('class', 'c-sub').attr('x', 0).attr('y', pitch / 2 + 12).text(r.sub);
    } else {
      gg.append('text').attr('class', 'c-label' + (r.strong ? ' is-strong' : '')).attr('x', 0).attr('y', pitch / 2 + 4.5).text(r.label);
    }
  });

  // Marks
  if (units) {
    g.each(function (r, ri) {
      const cells = d3.range(r.value);
      const sq = d3.select(this).append('g').attr('class', 'c-mark').selectAll('rect').data(cells).join('rect')
        .attr('x', (k) => x0 + k * (units.s + units.g)).attr('y', barTop + (thick - units.s) / 2)
        .attr('width', units.s).attr('height', units.s).attr('rx', Math.min(2.5, units.s / 4))
        .attr('fill', r.color || cfg.color || C.accent);
      if (ctx.animate) sq.attr('opacity', 0).transition().delay((k) => ri * 70 + k * 18).duration(160).attr('opacity', 1);
    });
  } else {
    const marks = g.append('path').attr('class', 'c-mark').attr('fill', (r) => r.color || cfg.color || C.accent);
    marks.each((r) => { r.path = (t) => barPath(x0, barTop, x(r.value) * t, thick); });
    grow(marks, ctx, { duration: 700, delay: (r, i) => i * 60 });
  }

  // Values at the tip
  const vals = g.append('text').attr('class', valCls)
    .attr('x', (r) => x0 + x(r.value) + 6).attr('y', barTop + thick / 2 + 4).text(vText);
  fadeIn(vals, ctx, { delay: 450 + rows.length * 60 });

  if (!mobile && !units) {
    const bx = Math.round(x0) + 0.5;
    root.append('line').attr('class', 'c-base').attr('x1', bx).attr('x2', bx).attr('y1', rows[0]._y + barTop - 4).attr('y2', rows[rows.length - 1]._y + barTop + thick + 4);
  }

  // Hover: the whole row is the hit target; the other rows recede.
  const hits = g.append('rect').attr('class', 'c-hit').attr('x', 0).attr('y', 0).attr('width', W).attr('height', pitch);
  const showRow = (i, pt) => {
    const r = rows[i];
    g.classed('is-dim', (_, j) => j !== i);
    const content = r.tip || { title: r.label, rows: [{ value: vText(r), label: cfg.tipLabel || '', color: r.color || cfg.color || C.accent, key: 'rect' }] };
    ctx.tooltip.show(pt || clientPoint(root.node(), x0 + x(r.value), r._y + barTop), content, el);
  };
  hover(ctx, el, {
    target: root,
    count: rows.length,
    indexAt: (e) => {
      const [, py] = d3.pointer(e, root.node());
      return rows.findIndex((r) => py >= r._y && py < r._y + pitch);
    },
    show: showRow,
    clear: () => g.classed('is-dim', false),
  });
  hits.lower();
  return { root, H };
}

/* ---- Small utilities ------------------------------------------------- */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const num = (v, dflt) => (v == null || v === '' || Number.isNaN(+v) ? dflt : +v);
/** Staff names never appear in charts: "the deli lead". */
export const scrub = (s) => (typeof s === 'string' ? s.replace(/\bKurt's\b/g, "the deli lead's").replace(/\bKurt\b/g, 'the deli lead') : s);
