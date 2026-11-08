/* heat — when the commits happen: by hour of day and by weekday (SPEC §6.4)
   data-src: /data/bakery-metrics.json → commits_by_hour[{hour,count}], commits_by_weekday{Mon…Sun}
   Form:     two small bar charts side by side (stacked on phones). One measure, so one hue:
             the story bars (the night window, Mondays) in the accent, the rest a lighter step
             of the same ramp. The day starts at 6 am so the night reads as one block.
   options:  data-highlight="22-2" (night window, inclusive start/end hour), data-height */
import { svg, yGridInline, baseline, colPath, grow, fadeIn, hover, clientPoint, measure, clamp, num, MARK } from './kit.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LONG = { Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays', Thu: 'Thursdays', Fri: 'Fridays', Sat: 'Saturdays', Sun: 'Sundays' };

function hourLabel(h, long = false) {
  if (h === 0) return long ? 'midnight' : '12 am';
  if (h === 12) return 'noon';
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export default {
  pick(json) {
    return { commits_by_hour: json.commits_by_hour, commits_by_weekday: json.commits_by_weekday, timezone: 'America/Los_Angeles (local commit time)' };
  },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, mobile, width: W, opts } = ctx;
    const [h0, h1] = String(opts.highlight || '22-2').split('-').map(Number);
    const inNight = (h) => (h0 <= h1 ? h >= h0 && h <= h1 : h >= h0 || h <= h1);
    const byHour = new Map(data.commits_by_hour.map((d) => [d.hour, d.count]));
    const order = d3.range(6, 24).concat(d3.range(0, 6));
    const hours = order.map((h) => ({ key: h, label: hourLabel(h), value: byHour.get(h) || 0, hot: inNight(h) }));
    const total = d3.sum(hours, (d) => d.value);
    const week = DAYS.map((k) => ({ key: k, label: k, value: data.commits_by_weekday[k] || 0 }));
    const topDay = week.reduce((m, d) => (d.value > m.value ? d : m), week[0]);
    week.forEach((d) => { d.hot = d === topDay; });

    const nightSum = d3.sum(hours.filter((d) => d.hot), (d) => d.value);
    const endH = (h1 + 1) % 24;
    const panels = [
      {
        key: 'hour', title: 'By hour of day', sub: 'Pacific time, local commit clock', bars: hours,
        callout: `${hourLabel(h0)} – ${hourLabel(endH)} · ${fmt.pct(nightSum / total)}`,
        tickEvery: mobile ? 6 : 3, tipTitle: (d) => `${hourLabel(d.key)} – ${hourLabel((d.key + 1) % 24)} PT`,
      },
      {
        key: 'day', title: 'By weekday', sub: 'Jun 12 – Nov 7, 2026', bars: week,
        callout: `${DAY_LONG[topDay.key]} · ${fmt.pct(topDay.value / total)}`,
        tickEvery: 1, tipTitle: (d) => DAY_LONG[d.key],
      },
    ];

    const gapX = 40, gapY = 30, head = 44, room = 40, axisH = 28;
    const plotH = num(opts.height, mobile ? 140 : 170);
    const ph = head + room + plotH + axisH;
    const pwHour = mobile ? W : Math.round((W - gapX) * 0.7);
    const pwDay = mobile ? W : W - gapX - pwHour;
    const H = mobile ? ph * 2 + gapY : ph;
    const root = svg(el, W, H);
    const quiet = C.theme === 'dark' ? C.seq[600] : C.seq[250];

    const marks = [];
    panels.forEach((p, pi) => {
      const pw = pi === 0 ? pwHour : pwDay;
      p.ox = mobile ? 0 : pi === 0 ? 0 : pwHour + gapX;
      p.oy = mobile ? pi * (ph + gapY) : 0;
      const g = root.append('g').attr('transform', `translate(${p.ox},${p.oy})`);
      g.append('text').attr('class', 'c-panel-title').attr('x', 0).attr('y', 14).text(p.title);
      g.append('text').attr('class', 'c-sub').attr('x', 0).attr('y', 31).text(p.sub);
      const top = head + room, base = top + plotH;
      const maxV = d3.max(p.bars, (d) => d.value);
      const y = d3.scaleLinear().domain([0, maxV]).range([base, top]);
      yGridInline(g.append('g'), y, y.ticks(3).filter((t) => t > 0 && t <= maxV), { x1: pw, fmt: fmt.int });
      baseline(g, 0, pw, base);

      // Bars start after a gutter so the inline tick labels never sit under a tall first bar.
      const gutter = Math.ceil(measure(fmt.int(d3.max(y.ticks(3))), 'c-axis')) + 10;
      p.gutter = gutter;
      const n = p.bars.length, step = (pw - gutter) / n;
      const bw = Math.min(MARK.bar, step - Math.max(MARK.gap, step * 0.28));
      p.bars.forEach((d, i) => {
        d.cx = gutter + i * step + step / 2;
        d.x = d.cx - bw / 2;
        d.top = y(d.value);
        d.path = (t) => colPath(d.x, base - (base - d.top) * t, bw, (base - d.top) * t);
        marks.push({ p, d, i, gx: p.ox, gy: p.oy });
      });
      const sel = g.append('g').selectAll('path').data(p.bars).join('path')
        .attr('class', 'c-mark').attr('fill', (d) => (d.hot ? C.accent : quiet));
      grow(sel, ctx, { duration: 600, delay: (d, i) => pi * 200 + i * (420 / n) });
      p.sel = sel;

      // X labels
      p.bars.forEach((d, i) => {
        if (p.key === 'hour' && (d.key % p.tickEvery !== 0)) return;
        g.append('text').attr('class', 'c-axis').attr('x', d.cx).attr('y', base + 18).attr('text-anchor', 'middle').text(d.label);
      });

      // Bracket + callout over the story bars
      const hot = p.bars.filter((d) => d.hot);
      if (hot.length) {
        const bx0 = d3.min(hot, (d) => d.x), bx1 = d3.max(hot, (d) => d.x + bw);
        const by = y(d3.max(hot, (d) => d.value)) - 12;
        const cg = g.append('g').attr('class', 'c-callout');
        const yy = Math.round(by) + 0.5;
        cg.append('path').attr('class', 'c-bracket').attr('d', `M${bx0},${yy + 5}V${yy}H${bx1}V${yy + 5}`);
        const cw = measure(p.callout, 'c-anno-strong');
        const cx = clamp((bx0 + bx1) / 2, cw / 2, pw - cw / 2);
        cg.append('text').attr('class', 'c-anno-strong').attr('x', cx).attr('y', yy - 8).attr('text-anchor', 'middle').text(p.callout);
        fadeIn(cg, ctx, { delay: 750 + pi * 200 });
      }
    });

    // Bars are the hit targets (the whole column band).
    const hit = root.append('rect').attr('class', 'c-hit').attr('width', W).attr('height', H);
    hover(ctx, el, {
      target: hit,
      count: marks.length,
      indexAt: (e) => {
        const [px, py] = d3.pointer(e, root.node());
        const p = mobile ? panels[py > ph + gapY / 2 ? 1 : 0] : panels[px > pwHour + gapX / 2 ? 1 : 0];
        const pw = p === panels[0] ? pwHour : pwDay;
        const lx = px - p.ox - p.gutter;
        if (lx < 0 || lx > pw - p.gutter) return -1;
        const i = clamp(Math.floor(lx / ((pw - p.gutter) / p.bars.length)), 0, p.bars.length - 1);
        return marks.findIndex((m) => m.p === p && m.i === i);
      },
      show: (k, pt) => {
        const m = marks[k];
        panels.forEach((p) => p.sel.classed('is-dim', (d) => p === m.p && d !== m.d));
        panels.forEach((p) => { if (p !== m.p) p.sel.classed('is-dim', false); });
        ctx.tooltip.show(pt || clientPoint(root.node(), m.gx + m.d.cx, m.gy + m.d.top), {
          title: m.p.tipTitle(m.d),
          rows: [{ value: fmt.int(m.d.value), label: 'commits', color: m.d.hot ? C.accent : quiet, key: 'rect' }],
          notes: [`${fmt.pct(m.d.value / total, 1)} of ${fmt.int(total)} commits`],
        }, el);
      },
      clear: () => panels.forEach((p) => p.sel.classed('is-dim', false)),
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const total = data.commits_by_hour.reduce((s, d) => s + d.count, 0);
    return [
      {
        caption: 'Commits by hour of day (Pacific time)',
        columns: [{ key: 'hour', label: 'Hour' }, { key: 'count', label: 'Commits', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
        rows: data.commits_by_hour.map((d) => ({ hour: `${hourLabel(d.hour)} – ${hourLabel((d.hour + 1) % 24)}`, count: fmt.int(d.count), share: fmt.pct(d.count / total, 1) })),
      },
      {
        caption: 'Commits by weekday',
        columns: [{ key: 'day', label: 'Weekday' }, { key: 'count', label: 'Commits', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
        rows: DAYS.map((k) => ({ day: k, count: fmt.int(data.commits_by_weekday[k]), share: fmt.pct(data.commits_by_weekday[k] / total, 1) })),
      },
    ];
  },
};
