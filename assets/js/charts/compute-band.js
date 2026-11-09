/* compute-band — training compute of notable AI models, per publication year: median line + middle-half band
   data-src: /data/epoch/notable_models.json → models[{date, compute}], meta
   Form:     one 2px accent line (the median, log10 FLOP) over a washed band from the 25th to the
             75th percentile of that year's models (d3/R-7 quantiles), dots at each year, direct
             labels ("median", "middle half"), y ticks labelled in powers of ten, one axis.
   options:  data-from / data-to (years, default 2012 / 2025: complete years with ≥ 8 models),
             data-height (plot height in px) */
import { svg, yGridInline, baseline, drawIn, fadeIn, hover, clientPoint, measure, clamp, num, MARK } from './kit.js';

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const pow = (e) => '10' + String(e).split('').map((c) => SUP[c]).join('');
/** 10^v as "3.7 × 10²⁴" */
const sci = (v) => { const e = Math.floor(v); return `${(10 ** (v - e)).toFixed(1)} × ${pow(e)}`; };
/** R-7 quantile of a sorted array (the method d3.quantile uses). */
const q = (s, p) => { const h = (s.length - 1) * p, i = Math.floor(h); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (h - i); };
const r2 = (v) => Math.round(v * 100) / 100;

export default {
  pick(json, opts = {}) {
    const from = num(opts.from, 2012), to = num(opts.to, 2025);
    const byYear = new Map();
    for (const m of json.models) {
      const yr = +m.date.slice(0, 4);
      if (yr < from || yr > to || !(m.compute > 0)) continue;
      if (!byYear.has(yr)) byYear.set(yr, []);
      byYear.get(yr).push(Math.log10(m.compute));
    }
    const years = [...byYear.keys()].sort((a, b) => a - b).map((year) => {
      const s = byYear.get(year).sort((a, b) => a - b);
      return { year, models: s.length, p25: r2(q(s, 0.25)), median: r2(q(s, 0.5)), p75: r2(q(s, 0.75)) };
    });
    return {
      source: `${json.meta?.source}, ${json.meta?.licence}, downloaded ${json.meta?.downloaded}`,
      unit: 'log10 of training compute (FLOP), per publication year',
      years,
    };
  },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, width: W, mobile, opts } = ctx;
    const ys = data.years;
    const n = ys.length;

    const plotH = num(opts.height, mobile ? 220 : clamp(Math.round(W * 0.34), 240, 320));
    const top = 12, base = top + plotH, H = base + 28;
    // Room for half a year label at the left and the direct labels at the right end.
    const padL = Math.ceil(measure('2020', 'c-axis') / 2), padR = Math.ceil(Math.max(measure('median'), measure('middle half'))) + 14;
    const root = svg(el, W, H);
    const x = d3.scaleLinear().domain([ys[0].year, ys[n - 1].year]).range([padL, W - padR]);
    const lo = Math.floor(d3.min(ys, (d) => d.p25)), hi = Math.ceil(d3.max(ys, (d) => d.p75));
    const y = d3.scaleLinear().domain([lo, hi]).range([base, top]);

    const gGrid = root.append('g'), gHi = root.append('g'), gBand = root.append('g'), gLine = root.append('g'), gLab = root.append('g'), gAxis = root.append('g');

    /* Powers of ten, every second order on narrow charts. */
    const every = mobile || hi - lo > 8 ? 2 : 1;
    const ticks = d3.range(lo + 1, hi + 1).filter((t) => (t - lo) % every === 0);
    yGridInline(gGrid, y, ticks, { x1: W, fmt: (t) => pow(t), unit: 'FLOP' });
    baseline(gAxis, 0, W, base);

    /* Year labels: every year when they fit, else every 2nd / 4th, counted back from the last year. */
    const step = (x(ys[n - 1].year) - x(ys[0].year)) / Math.max(1, n - 1);
    const lab = [1, 2, 4].find((k) => measure('2020', 'c-axis') + 8 <= step * k) || 4;
    gAxis.selectAll('text.c-axis').data(ys.filter((d, i) => (n - 1 - i) % lab === 0)).join('text')
      .attr('class', 'c-axis').attr('x', (d) => x(d.year)).attr('y', base + 18).attr('text-anchor', 'middle').text((d) => d.year);

    const band = d3.area().curve(d3.curveMonotoneX).x((d) => x(d.year)).y0((d) => y(d.p25)).y1((d) => y(d.p75));
    const line = d3.line().curve(d3.curveMonotoneX).x((d) => x(d.year)).y((d) => y(d.median));
    const b = gBand.append('path').attr('class', 'c-area').attr('d', band(ys)).attr('fill', C.wash(C.accent, 0.16));
    fadeIn(b, ctx, { delay: 300, duration: 600 });
    const l = gLine.append('path').attr('class', 'c-line').attr('d', line(ys)).attr('fill', 'none').attr('stroke', C.accent).attr('stroke-width', MARK.line);
    drawIn(l, ctx, { duration: 1200 });
    const dots = gLine.selectAll('circle').data(ys).join('circle').attr('class', 'c-mark')
      .attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.median)).attr('r', MARK.dot / 2 + 0.5).attr('fill', C.accent);
    fadeIn(dots, ctx, { delay: 900 });

    /* Direct labels at the right end: the line, and the band at its widest recent point. */
    const last = ys[n - 1];
    const lx = x(last.year) + 8;
    const tMed = gLab.append('text').attr('class', 'c-label c-halo').attr('x', lx).attr('y', y(last.median) + 4).text('median');
    const tBand = gLab.append('text').attr('class', 'c-band-label c-label c-halo').attr('x', lx).attr('y', Math.max(y(last.p25) + 16, y(last.median) + 20)).text('middle half');
    fadeIn(tMed.merge(tBand), ctx, { delay: 1100 });

    /* Hover: nearest year; a column highlight and the year's three values. */
    const hiCol = gHi.append('rect').attr('class', 'c-hover-col').attr('y', top).attr('height', base - top).attr('width', Math.max(6, step)).attr('opacity', 0);
    const ring = gLab.append('circle').attr('class', 'c-dot-ring').attr('r', MARK.dot + 1).attr('fill', 'none').attr('stroke', C.accent).attr('stroke-width', MARK.ring).attr('opacity', 0);
    const hit = root.append('rect').attr('class', 'c-hit').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);
    hover(ctx, el, {
      target: hit,
      count: n,
      start: n - 1,
      indexAt: (e) => {
        const [px] = d3.pointer(e, root.node());
        return clamp(Math.round((px - x(ys[0].year)) / step), 0, n - 1);
      },
      show: (i, pt) => {
        const d = ys[i];
        hiCol.attr('x', x(d.year) - Math.max(6, step) / 2).attr('opacity', 1);
        ring.attr('cx', x(d.year)).attr('cy', y(d.median)).attr('opacity', 1);
        ctx.tooltip.show(pt || clientPoint(root.node(), x(d.year), y(d.median)), {
          title: String(d.year),
          rows: [
            { value: sci(d.median), label: 'FLOP, median', color: C.accent, key: 'dot' },
            { value: `${sci(d.p25)} – ${sci(d.p75)}`, label: 'middle half', color: C.wash(C.accent, 0.4), key: 'rect' },
            { value: fmt.int(d.models), label: d.models === 1 ? 'model' : 'models', key: null },
          ],
        }, el);
      },
      clear: () => { hiCol.attr('opacity', 0); ring.attr('opacity', 0); },
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    return {
      caption: 'Training compute of notable AI models by publication year: 25th percentile, median and 75th percentile (FLOP)',
      columns: [
        { key: 'year', label: 'Year' },
        { key: 'models', label: 'Models', numeric: true },
        { key: 'p25', label: '25th pct', numeric: true },
        { key: 'median', label: 'Median', numeric: true },
        { key: 'p75', label: '75th pct', numeric: true },
      ],
      rows: data.years.map((d) => ({ year: String(d.year), models: fmt.int(d.models), p25: sci(d.p25), median: sci(d.median), p75: sci(d.p75) })),
    };
  },
};
