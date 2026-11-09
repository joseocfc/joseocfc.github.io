/* domain-multiples — notable AI models per publication year, one small panel per domain
   data-src: /data/epoch/notable_models.json → models[{date, domain_group}], meta.domain_order
   Form:     small multiples on one shared y scale (2 × 2 from 520px, stacked below): a column per
             year in the accent, rounded data end, panel title with the period total, first and
             last year under each panel. The four largest domains in the window ("Other" never
             gets a panel); the note counts how many of the window's models they hold.
   options:  data-from / data-to (years, default 2012 / 2025), data-height (panel plot height) */
import { svg, note, yGridInline, baseline, colPath, grow, hover, clientPoint, clamp, num, MARK } from './kit.js';

const PANELS = 4;

export default {
  pick(json, opts = {}) {
    const from = num(opts.from, 2012), to = num(opts.to, 2025);
    const years = [];
    for (let y = from; y <= to; y++) years.push(y);
    const counts = new Map();
    for (const m of json.models) {
      const yr = +m.date.slice(0, 4);
      if (yr < from || yr > to) continue;
      const g = m.domain_group || 'Other';
      if (!counts.has(g)) counts.set(g, new Map());
      counts.get(g).set(yr, (counts.get(g).get(yr) || 0) + 1);
    }
    const domains = [...counts.entries()]
      .map(([domain, c]) => ({ domain, total: [...c.values()].reduce((s, v) => s + v, 0), years: years.map((year) => ({ year, models: c.get(year) || 0 })) }))
      .sort((a, b) => b.total - a.total || a.domain.localeCompare(b.domain));
    const shown = domains.filter((d) => d.domain !== 'Other').slice(0, PANELS);
    const rest = domains.filter((d) => !shown.includes(d));
    return {
      source: `${json.meta?.source}, ${json.meta?.licence}, downloaded ${json.meta?.downloaded}`,
      unit: 'notable models with a training-compute estimate, per publication year',
      from, to,
      domains: shown,
      others: rest.map(({ domain, total }) => ({ domain, total })),
    };
  },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, width: W, mobile, opts } = ctx;
    const P = data.domains;
    const yrs = P[0].years.map((d) => d.year);
    const n = yrs.length;
    const cols = mobile ? 1 : 2;
    const gapX = 40, gapY = 26;
    const pw = (W - gapX * (cols - 1)) / cols;
    const plotH = num(opts.height, mobile ? 110 : clamp(Math.round(pw * 0.36), 120, 170));
    const head = 26, axisH = 26;
    const ph = head + plotH + axisH;
    const rows = Math.ceil(P.length / cols);
    const H = rows * ph + (rows - 1) * gapY;
    const shownN = d3.sum(P, (p) => p.total), allN = shownN + d3.sum(data.others, (o) => o.total);
    note(el, `${fmt.int(shownN)} of ${fmt.int(allN)} models, ${yrs[0]}–${yrs[n - 1]} · one shared scale`);
    const root = svg(el, W, H);

    const step = pw / n;
    const bw = Math.max(3, Math.min(MARK.bar, step - 4));
    const bx = (i) => i * step + (step - bw) / 2;
    const maxV = d3.max(P, (p) => d3.max(p.years, (d) => d.models)) || 1;
    const y = d3.scaleLinear().domain([0, maxV]).range([head + plotH, head + 6]);
    const ticks = y.ticks(3).filter((t) => t > 0 && t <= maxV && Number.isInteger(t));
    const base = head + plotH;

    const marks = [];
    P.forEach((p, pi) => {
      p.ox = (pi % cols) * (pw + gapX);
      p.oy = Math.floor(pi / cols) * (ph + gapY);
      const g = root.append('g').attr('transform', `translate(${p.ox},${p.oy})`);
      p.hi = g.append('rect').attr('class', 'c-hover-col').attr('y', head).attr('height', plotH).attr('width', step).attr('opacity', 0);
      g.append('text').attr('class', 'c-panel-title').attr('x', 0).attr('y', 14).text(`${p.domain} · ${fmt.int(p.total)}`);
      yGridInline(g.append('g'), y, ticks, { x1: pw, fmt: fmt.int });
      baseline(g, 0, pw, base);
      g.append('text').attr('class', 'c-axis').attr('x', bx(0)).attr('y', base + 18).text(yrs[0]);
      g.append('text').attr('class', 'c-axis').attr('x', bx(n - 1) + bw).attr('y', base + 18).attr('text-anchor', 'end').text(yrs[n - 1]);
      p.years.forEach((d, i) => {
        if (d.models > 0) marks.push({ pi, i, g, x: bx(i), yt: y(d.models), path: (t) => colPath(bx(i), base - (base - y(d.models)) * t, bw, (base - y(d.models)) * t) });
      });
    });
    marks.forEach((m) => m.g.append('path').datum(m).attr('class', 'c-mark').attr('fill', C.accent));
    grow(root.selectAll('path.c-mark'), ctx, { duration: 520, delay: (m) => m.pi * 120 + m.i * 30 });

    /* Hover / keys: one index across all panels (panel-major), so ←/→ walks every column. */
    const hit = root.append('rect').attr('class', 'c-hit').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);
    const clear = () => P.forEach((p) => p.hi.attr('opacity', 0));
    hover(ctx, el, {
      target: hit,
      count: P.length * n,
      start: 0,
      indexAt: (e) => {
        const [px, py] = d3.pointer(e, root.node());
        const pi = P.findIndex((p) => px >= p.ox && px <= p.ox + pw && py >= p.oy && py <= p.oy + ph);
        if (pi < 0) return -1;
        return pi * n + clamp(Math.floor((px - P[pi].ox) / step), 0, n - 1);
      },
      show: (k, pt) => {
        const pi = Math.floor(k / n), i = k % n, p = P[pi], d = p.years[i];
        clear();
        p.hi.attr('x', i * step).attr('opacity', 1);
        ctx.tooltip.show(pt || clientPoint(root.node(), p.ox + bx(i) + bw / 2, p.oy + y(d.models)), {
          title: `${p.domain}, ${d.year}`,
          rows: [{ value: fmt.int(d.models), label: d.models === 1 ? 'notable model' : 'notable models', color: C.accent, key: 'rect' }],
        }, el);
      },
      clear,
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const P = data.domains;
    const columns = [{ key: 'year', label: 'Year' }, ...P.map((p, i) => ({ key: `d${i}`, label: p.domain, numeric: true }))];
    const rows = P[0].years.map((d, yi) => Object.fromEntries([['year', String(d.year)], ...P.map((p, i) => [`d${i}`, fmt.int(p.years[yi].models)])]));
    rows.push(Object.fromEntries([['year', 'Total'], ...P.map((p, i) => [`d${i}`, fmt.int(p.total)])]));
    return {
      caption: `Notable AI models per publication year, ${data.from}–${data.to}, in the four largest domains`,
      columns,
      rows,
    };
  },
};
