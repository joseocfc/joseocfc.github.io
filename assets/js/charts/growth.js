/* growth — the harness and the assumptions register grew together (SPEC §6.2)
   data-src: /data/bakery-metrics.json → assertion_count_over_time[{date,assertions}],
             assumptions_register_rows_over_time[{date,highest_a_number}]
   Form:     two small multiples on one shared time axis (never a dual axis), step lines with a
             10% wash, end labels "6,089 assertions" / "A2121", one crosshair across both panels.
   options:  data-height (plot height per panel) */
import { svg, yGridInline, baseline, monthAxis, drawIn, fadeIn, hover, clientPoint, measure, clamp, num, MARK } from './kit.js';

export default {
  pick(json) {
    return {
      assertion_count_over_time: json.assertion_count_over_time,
      assumptions_register_rows_over_time: json.assumptions_register_rows_over_time,
      harness: { latest_count_line: json.harness?.latest_count_line, source: json.harness?.latest_count_source },
      assumptions_register: json.assumptions_register,
    };
  },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, mobile, width: W, opts } = ctx;
    const panels = [
      {
        key: 'assertions', title: 'Automated assertions', sub: 'lines in a full harness run',
        series: data.assertion_count_over_time.map((d) => ({ date: fmt.parse(d.date), v: d.assertions })),
        end: (v) => [fmt.int(v), ' assertions'], tipLabel: 'assertions', tipValue: (v) => fmt.int(v),
      },
      {
        key: 'register', title: 'Assumptions register', sub: 'highest numbered assumption',
        series: data.assumptions_register_rows_over_time.map((d) => ({ date: fmt.parse(d.date), v: d.highest_a_number })),
        end: (v) => [`A${v}`, ''], tipLabel: 'highest assumption number', tipValue: (v) => `A${v}`,
      },
    ];

    const allDates = panels.flatMap((p) => p.series.map((d) => d.date));
    const d0 = d3.timeMonth.floor(d3.min(allDates));
    const d1 = d3.timeDay.offset(d3.max(allDates), 2);
    const gapX = 40, gapY = 30;
    const pw = mobile ? W : (W - gapX) / 2;
    const plotH = num(opts.height, mobile ? 150 : clamp(Math.round(pw * 0.42), 160, 220));
    const head = 44, axisH = 30, endPad = 26;
    const ph = head + plotH + axisH;
    const H = mobile ? ph * 2 + gapY : ph;
    const root = svg(el, W, H);
    const x = d3.scaleTime().domain([d0, d1]).range([0, pw]);

    const valueAt = (series, date) => {
      const i = d3.bisector((d) => d.date).right(series, date) - 1;
      return i >= 0 ? series[i] : null;
    };

    panels.forEach((p, pi) => {
      p.ox = mobile ? 0 : pi * (pw + gapX);
      p.oy = mobile ? pi * (ph + gapY) : 0;
      const g = root.append('g').attr('transform', `translate(${p.ox},${p.oy})`);
      p.g = g;
      g.append('text').attr('class', 'c-panel-title').attr('x', 0).attr('y', 14).text(p.title);
      g.append('text').attr('class', 'c-sub').attr('x', 0).attr('y', 31).text(p.sub);

      const top = head, base = head + plotH;
      const maxV = d3.max(p.series, (d) => d.v);
      const y = d3.scaleLinear().domain([0, maxV]).range([base, top + endPad]);
      p.y = y; p.base = base;
      const ticks = y.ticks(mobile ? 3 : 4).filter((t) => t > 0 && t <= maxV);
      yGridInline(g.append('g'), y, ticks, { x1: pw, fmt: fmt.int });
      baseline(g, 0, pw, base);
      monthAxis(g.append('g'), x, { y: base, ctx, year: true });

      const lastPt = p.series[p.series.length - 1];
      const area = d3.area().curve(d3.curveStepAfter).x((d) => x(d.date)).y0(base).y1((d) => y(d.v));
      const line = d3.line().curve(d3.curveStepAfter).x((d) => x(d.date)).y((d) => y(d.v));
      const a = g.append('path').attr('class', 'c-area').attr('d', area(p.series)).attr('fill', C.wash(C.accent, 0.1));
      fadeIn(a, ctx, { delay: 500, duration: 600 });
      const l = g.append('path').attr('class', 'c-line').attr('d', line(p.series)).attr('stroke', C.accent).attr('stroke-width', MARK.line);
      drawIn(l, ctx, { duration: 1200, delay: pi * 150 });

      // Start dot (first record) and end dot + end label.
      const first = p.series[0];
      g.append('circle').attr('class', 'c-dot-ring').attr('cx', x(first.date)).attr('cy', y(first.v)).attr('r', 3).attr('fill', C.accent).attr('stroke', C.surface);
      // First record, labelled quietly: left of the dot when there is room, else above it.
      const sx = x(first.date), sy = y(first.v);
      const sLabel = `${fmt.dateShort(first.date)}: ${p.tipValue(first.v)}`;
      const sw = measure(sLabel, 'c-sub');
      const sTxt = g.append('text').attr('class', 'c-sub c-halo');
      if (sx - 8 - sw > 0) sTxt.attr('x', sx - 8).attr('y', sy + 4).attr('text-anchor', 'end').text(sLabel);
      else sTxt.attr('x', Math.max(0, sx - 3)).attr('y', sy - 9).text(sLabel);
      fadeIn(sTxt, ctx, { delay: 300 });
      const ex = x(lastPt.date), ey = y(lastPt.v);
      const endG = g.append('g');
      endG.append('circle').attr('class', 'c-dot-ring').attr('cx', ex).attr('cy', ey).attr('r', MARK.dot).attr('fill', C.accent).attr('stroke', C.surface).attr('stroke-width', MARK.ring);
      const [big, small] = p.end(lastPt.v);
      const t = endG.append('text').attr('x', Math.min(pw, ex + MARK.dot)).attr('y', ey - 12).attr('text-anchor', 'end');
      t.append('tspan').attr('class', 'c-end-value').text(big);
      if (small) t.append('tspan').attr('class', 'c-end-unit').text(small);
      fadeIn(endG, ctx, { delay: 1100 + pi * 150 });

      // Crosshair parts (hidden until hover).
      p.cross = g.append('line').attr('class', 'c-cross').attr('y1', top + 4).attr('y2', base).attr('opacity', 0);
      p.dot = g.append('circle').attr('class', 'c-dot-ring').attr('r', MARK.dot).attr('fill', C.accent).attr('stroke', C.surface).attr('stroke-width', MARK.ring).attr('opacity', 0);
    });

    // One crosshair across both panels; the tooltip lists both values at that date.
    const dates = Array.from(new Set(allDates.map((d) => +d))).sort((a, b) => a - b).map((t) => new Date(t));
    const hit = root.append('rect').attr('class', 'c-hit').attr('width', W).attr('height', H);
    hover(ctx, el, {
      target: hit,
      count: dates.length,
      start: dates.length - 1,
      indexAt: (e) => {
        const [px, py] = d3.pointer(e, root.node());
        const p = mobile ? panels[py > ph + gapY / 2 ? 1 : 0] : panels[px > pw + gapX / 2 ? 1 : 0];
        const dt = x.invert(px - p.ox);
        const i = d3.bisector((d) => d).center(dates, dt);
        return i;
      },
      show: (i, pt) => {
        const date = dates[i];
        const rows = [];
        let anchor = null;
        panels.forEach((p) => {
          const v = valueAt(p.series, date);
          const xx = Math.round(x(date)) + 0.5;
          p.cross.attr('x1', xx).attr('x2', xx).attr('opacity', 1);
          if (v) {
            p.dot.attr('cx', x(date)).attr('cy', p.y(v.v)).attr('opacity', 1);
            if (!anchor) anchor = clientPoint(root.node(), p.ox + x(date), p.oy + p.y(v.v));
          } else p.dot.attr('opacity', 0);
          rows.push({ value: v ? p.tipValue(v.v) : 'not started', label: p.tipLabel, color: C.accent, key: 'line' });
        });
        ctx.tooltip.show(pt || anchor || clientPoint(root.node(), x(date), 60), { title: fmt.day(date), rows, notes: ['Last recorded value on or before this date'] }, el);
      },
      clear: () => panels.forEach((p) => { p.cross.attr('opacity', 0); p.dot.attr('opacity', 0); }),
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const a = new Map(data.assertion_count_over_time.map((d) => [d.date, d.assertions]));
    const r = new Map(data.assumptions_register_rows_over_time.map((d) => [d.date, d.highest_a_number]));
    const dates = Array.from(new Set([...a.keys(), ...r.keys()])).sort();
    return {
      caption: 'Assertions in a full harness run and the highest assumption number, by date recorded',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'assertions', label: 'Assertions', numeric: true },
        { key: 'register', label: 'Highest assumption', numeric: true },
      ],
      rows: dates.map((d) => ({ date: fmt.date(fmt.parse(d)), assertions: a.has(d) ? fmt.int(a.get(d)) : '', register: r.has(d) ? `A${r.get(d)}` : '' })),
    };
  },
};
