/* issues — GitHub issues opened vs closed, cumulative (SPEC §6.3)
   data-src: /data/bakery-metrics.json → issues[{number,title,created,closed,state}], issues_summary
   Form:     two step lines on one axis (series-1 opened, series-2 closed), the open backlog
             between them as a 10% wash, end labels, median-days-to-close as the legend note.
   options:  data-from, data-to, data-height */
import { svg, legend, yGridInline, baseline, monthAxis, drawIn, fadeIn, hover, clientPoint, measure, clamp, num, MARK } from './kit.js';

export default {
  pick(json) {
    return {
      generated: json.generated,
      issues: json.issues.map(({ number, title, created, closed, state }) => ({ number, title, created, closed, state })),
      issues_summary: json.issues_summary,
    };
  },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, mobile, width: W, opts } = ctx;
    const cOpen = C.series[0], cClosed = C.series[1];
    const sum = data.issues_summary || {};
    const legendNote = sum.median_days_to_close != null ? `Median ${sum.median_days_to_close} days to close · ${sum.closed_same_day} closed the same day` : null;

    const created = data.issues.map((i) => fmt.parse(i.created));
    const closed = data.issues.filter((i) => i.closed).map((i) => fmt.parse(i.closed));
    const first = fmt.parse(opts.from || d3.min(created));
    const lastEvent = d3.max([...created, ...closed]);
    const last = fmt.parse(opts.to || data.generated || fmt.iso(lastEvent));
    const days = d3.timeDay.range(first, d3.timeDay.offset(last, 1));
    const cO = d3.rollup(created, (v) => v.length, (d) => +d);
    const cC = d3.rollup(closed, (v) => v.length, (d) => +d);
    let o = created.filter((d) => d < first).length, c = closed.filter((d) => d < first).length;
    const series = days.map((date) => {
      o += cO.get(+date) || 0;
      c += cC.get(+date) || 0;
      return { date, opened: o, closed: c, open: o - c, newO: cO.get(+date) || 0, newC: cC.get(+date) || 0 };
    });

    // On phones the end values ride in the legend; on wider charts they label the line ends.
    const endNow = series[series.length - 1];
    legend(el, [
      { label: mobile ? `Opened · ${fmt.int(endNow.opened)}` : 'Opened', color: cOpen, kind: 'line' },
      { label: mobile ? `Closed · ${fmt.int(endNow.closed)}` : 'Closed', color: cClosed, kind: 'line' },
      { label: mobile ? `Still open · ${fmt.int(endNow.open)}` : 'Still open', color: C.wash(cOpen, 0.22), kind: 'rect' },
    ], { note: legendNote });

    const plotH = num(opts.height, mobile ? 210 : clamp(Math.round(W * 0.26), 220, 300));
    const top = 10, base = top + plotH, H = base + 30;
    const root = svg(el, W, H);
    const x = d3.scaleTime().domain([first, d3.timeDay.offset(last, 1)]).range([0, W]);
    const maxV = d3.max(series, (d) => d.opened);
    const y = d3.scaleLinear().domain([0, maxV]).range([base, top + 22]);
    // Step lines span the whole day: extend the final value to the domain end.
    const pts = [...series, { ...series[series.length - 1], date: d3.timeDay.offset(last, 1) }];

    const ticks = y.ticks(mobile ? 3 : 4).filter((t) => t > 0 && t <= maxV);
    yGridInline(root.append('g'), y, ticks, { x1: W, fmt: fmt.int, unit: 'issues' });
    baseline(root, 0, W, base);
    monthAxis(root.append('g'), x, { y: base, ctx });

    const gap = d3.area().curve(d3.curveStepAfter).x((d) => x(d.date)).y0((d) => y(d.closed)).y1((d) => y(d.opened));
    const a = root.append('path').attr('class', 'c-area').attr('d', gap(pts)).attr('fill', C.wash(cOpen, 0.12));
    fadeIn(a, ctx, { delay: 700, duration: 600 });

    const mk = (key, color, delay) => {
      const l = root.append('path').attr('class', 'c-line')
        .attr('d', d3.line().curve(d3.curveStepAfter).x((d) => x(d.date)).y((d) => y(d[key]))(pts))
        .attr('stroke', color).attr('stroke-width', MARK.line);
      drawIn(l, ctx, { duration: 1300, delay });
      return l;
    };
    mk('closed', cClosed, 150);
    mk('opened', cOpen, 0);

    // End labels: opened above its line, closed below its line (they never stack).
    const end = series[series.length - 1];
    const lab = root.append('g');
    if (!mobile) {
      const t1 = lab.append('text').attr('class', 'c-halo').attr('x', W).attr('y', y(end.opened) - 8).attr('text-anchor', 'end');
      t1.append('tspan').attr('class', 'c-end-value').text(fmt.int(end.opened));
      t1.append('tspan').attr('class', 'c-end-unit').text(' opened');
      const t2 = lab.append('text').attr('class', 'c-halo').attr('x', W).attr('y', y(end.closed) + 18).attr('text-anchor', 'end');
      t2.append('tspan').attr('class', 'c-end-value').text(fmt.int(end.closed));
      t2.append('tspan').attr('class', 'c-end-unit').text(' closed');
    }

    // The widest backlog, labelled inside the wash when it fits.
    const peak = series.reduce((m, d) => (d.open > m.open ? d : m), series[0]);
    const peakIdx = series.indexOf(peak);
    let runEnd = peakIdx;
    while (runEnd + 1 < series.length && series[runEnd + 1].open === peak.open) runEnd++;
    const px = (x(peak.date) + x(d3.timeDay.offset(series[runEnd].date, 1))) / 2;
    const gapPx = y(peak.closed) - y(peak.opened);
    const peakText = `${peak.open} open`;
    const pw = measure(peakText, 'c-anno');
    if (gapPx >= 18 && px - pw / 2 > 0 && px + pw / 2 < W - 80) {
      lab.append('text').attr('class', 'c-anno c-halo').attr('x', px).attr('y', (y(peak.closed) + y(peak.opened)) / 2 + 4).attr('text-anchor', 'middle').text(peakText);
    }
    fadeIn(lab, ctx, { delay: 1200 });

    // Crosshair
    const cross = root.append('line').attr('class', 'c-cross').attr('y1', top + 4).attr('y2', base).attr('opacity', 0);
    const dO = root.append('circle').attr('class', 'c-dot-ring').attr('r', MARK.dot).attr('fill', cOpen).attr('stroke', C.surface).attr('stroke-width', MARK.ring).attr('opacity', 0);
    const dC = root.append('circle').attr('class', 'c-dot-ring').attr('r', MARK.dot).attr('fill', cClosed).attr('stroke', C.surface).attr('stroke-width', MARK.ring).attr('opacity', 0);
    const hit = root.append('rect').attr('class', 'c-hit').attr('width', W).attr('height', H);
    const step = W / series.length;
    hover(ctx, el, {
      target: hit,
      count: series.length,
      start: series.length - 1,
      indexAt: (e) => {
        const [px2] = d3.pointer(e, root.node());
        return clamp(Math.floor(px2 / step), 0, series.length - 1);
      },
      show: (i, pt) => {
        const d = series[i];
        const cx = x(d.date) + step / 2;
        const xx = Math.round(cx) + 0.5;
        cross.attr('x1', xx).attr('x2', xx).attr('opacity', 1);
        dO.attr('cx', cx).attr('cy', y(d.opened)).attr('opacity', 1);
        dC.attr('cx', cx).attr('cy', y(d.closed)).attr('opacity', 1);
        const notes = [];
        if (d.newO || d.newC) notes.push(`That day: ${d.newO} opened, ${d.newC} closed`);
        ctx.tooltip.show(pt || clientPoint(root.node(), cx, y(d.opened)), {
          title: fmt.day(d.date),
          rows: [
            { value: fmt.int(d.opened), label: 'opened to date', color: cOpen, key: 'line' },
            { value: fmt.int(d.closed), label: 'closed to date', color: cClosed, key: 'line' },
            { value: fmt.int(d.open), label: 'still open', color: C.wash(cOpen, 0.35), key: 'rect' },
          ],
          notes,
        }, el);
      },
      clear: () => { cross.attr('opacity', 0); dO.attr('opacity', 0); dC.attr('opacity', 0); },
    });
  },

  table(data, ctx) {
    const { fmt, d3 } = ctx;
    return {
      caption: 'Every GitHub issue: opened, closed, days to close',
      columns: [
        { key: 'number', label: 'Issue', numeric: true },
        { key: 'title', label: 'Title' },
        { key: 'created', label: 'Opened' },
        { key: 'closed', label: 'Closed' },
        { key: 'days', label: 'Days to close', numeric: true },
      ],
      rows: data.issues.map((i) => ({
        number: `#${i.number}`,
        title: i.title,
        created: fmt.date(fmt.parse(i.created)),
        closed: i.closed ? fmt.date(fmt.parse(i.closed)) : 'open',
        days: i.closed ? d3.timeDay.count(fmt.parse(i.created), fmt.parse(i.closed)) : '',
      })),
    };
  },
};
