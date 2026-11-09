/* pickup — pickup dates the first week's holiday orders chose: one column per calendar day, the peak annotated
   data-src: /data/bakery-orders-week1.json → holiday_pickup{date: orders}, days[{date,holiday}], totals, source
   Form:     one column per day from the first to the last chosen pickup date (days nobody chose
             stay empty, not dropped), the busiest day in the accent and the rest in --ink-3,
             4px rounded data end, integer grid, day numbers under the columns, and one direct
             annotation above the busiest day ("20 of 23 holiday orders").
   options:  data-height (plot height in px) */
import { svg, note, yGridInline, baseline, colPath, grow, fadeIn, hover, clientPoint, measure, clamp, num, MARK } from './kit.js';

export default {
  pick(json) {
    const chosen = Object.entries(json.holiday_pickup || {}).sort(([a], [b]) => a.localeCompare(b));
    const placed = (json.days || []).filter((d) => d.holiday > 0).map((d) => d.date);
    return {
      source: json.source,
      unit: 'holiday orders by the pickup date the customer chose',
      placed: placed.length ? { from: placed[0], to: placed[placed.length - 1] } : null,
      holiday_orders: json.totals?.holiday_orders,
      pickup: chosen.map(([date, orders]) => ({ date, orders })),
    };
  },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, width: W, mobile, opts } = ctx;
    /* Every calendar day from the first to the last chosen date; days nobody chose are zero. */
    const byDate = new Map(data.pickup.map((d) => [d.date, d.orders]));
    const first = fmt.parse(data.pickup[0].date), last = fmt.parse(data.pickup[data.pickup.length - 1].date);
    const days = d3.timeDay.range(first, d3.timeDay.offset(last, 1)).map((day) => {
      const date = d3.timeFormat('%Y-%m-%d')(day);
      return { date, day, orders: byDate.get(date) || 0 };
    });
    const n = days.length;
    const total = data.holiday_orders ?? d3.sum(days, (d) => d.orders);
    const peak = d3.maxIndex(days, (d) => d.orders);

    const chosen = days.filter((d) => d.orders > 0).length;
    note(el, `${fmt.int(total)} holiday orders · ${fmt.int(chosen)} pickup days chosen`);

    /* Layout: an annotation band above the plot, day numbers and the month below it. */
    const plotH = num(opts.height, mobile ? 180 : clamp(Math.round(W * 0.28), 200, 260));
    const top = 40, base = top + plotH, H = base + 46;
    const root = svg(el, W, H);
    const step = W / n;
    const bw = Math.min(MARK.bar + 8, step - 6);
    const bx = (i) => i * step + (step - bw) / 2;
    const maxV = d3.max(days, (d) => d.orders) || 1;
    const y = d3.scaleLinear().domain([0, maxV]).range([base, top]);

    const gGrid = root.append('g'), gHi = root.append('g'), gBars = root.append('g'), gLab = root.append('g'), gAxis = root.append('g');
    const ticks = y.ticks(4).filter((t) => t > 0 && t <= maxV && Number.isInteger(t));
    yGridInline(gGrid, y, ticks, { x1: W, fmt: fmt.int, unit: 'orders' });
    baseline(gAxis, 0, W, base);

    /* Day labels: weekday + day when every label fits its column, else the day alone; month below. */
    const long = (d) => d3.timeFormat('%a %-d')(d.day);
    const short = (d) => d3.timeFormat('%-d')(d.day);
    const label = days.every((d) => measure(long(d), 'c-axis') <= step - 6) ? long : short;
    gAxis.selectAll('text.c-day').data(days).join('text').attr('class', 'c-axis c-day')
      .attr('x', (d, i) => bx(i) + bw / 2).attr('y', base + 18).attr('text-anchor', 'middle').text(label);
    gAxis.append('text').attr('class', 'c-axis').attr('x', bx(0)).attr('y', base + 38).text(d3.timeFormat('%B %Y')(first));

    /* Columns: the busiest day in the accent, the others neutral (--ink-3 keeps 3:1 in both themes). */
    const marks = days.map((d, i) => ({ i, d })).filter((m) => m.d.orders > 0);
    marks.forEach((m) => {
      const h = base - y(m.d.orders);
      m.path = (t) => colPath(bx(m.i), base - h * t, bw, h * t);
    });
    const bars = gBars.selectAll('path').data(marks).join('path').attr('class', 'c-mark')
      .attr('fill', (m) => (m.i === peak ? C.accent : C.ink3));
    grow(bars, ctx, { duration: 520, delay: (m) => m.i * 40 });

    /* Annotation: right-aligned over the busiest column when it sits near the right edge. */
    const pd = days[peak];
    const line1 = `${fmt.int(pd.orders)} of ${fmt.int(total)} holiday orders`;
    const line2 = `${d3.timeFormat('%A %-d %B')(pd.day)}`;
    const tw = Math.max(measure(line1, 'c-anno'), measure(line2, 'c-anno'));
    const cx = bx(peak) + bw / 2;
    const anchor = cx + tw / 2 > W ? 'end' : cx - tw / 2 < 0 ? 'start' : 'middle';
    const ax = anchor === 'end' ? bx(peak) + bw : anchor === 'start' ? bx(peak) : cx;
    const ay = y(pd.orders) - 10;
    const a1 = gLab.append('text').attr('class', 'c-anno-strong c-halo').attr('x', ax).attr('y', ay - 16).attr('text-anchor', anchor).text(line1);
    const a2 = gLab.append('text').attr('class', 'c-anno c-halo').attr('x', ax).attr('y', ay).attr('text-anchor', anchor).text(line2);
    fadeIn(a1.merge(a2), ctx, { delay: 520 + peak * 40 });

    /* Hover: one column per day, including the empty ones. */
    const hi = gHi.append('rect').attr('class', 'c-hover-col').attr('y', top - 2).attr('height', base - top + 2).attr('width', step).attr('opacity', 0);
    const hit = root.append('rect').attr('class', 'c-hit').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);
    hover(ctx, el, {
      target: hit,
      count: n,
      start: peak,
      indexAt: (e) => {
        const [px] = d3.pointer(e, root.node());
        return clamp(Math.floor(px / step), 0, n - 1);
      },
      show: (i, pt) => {
        const d = days[i];
        hi.attr('x', i * step).attr('opacity', 1);
        ctx.tooltip.show(pt || clientPoint(root.node(), bx(i) + bw / 2, y(d.orders)), {
          title: fmt.day(d.day),
          rows: [{ value: fmt.int(d.orders), label: d.orders === 1 ? 'holiday order picks up' : 'holiday orders pick up', color: i === peak ? C.accent : C.ink3, key: 'rect' }],
        }, el);
      },
      clear: () => hi.attr('opacity', 0),
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const rows = data.pickup.map((d) => ({ date: fmt.day(fmt.parse(d.date)), orders: fmt.int(d.orders) }));
    rows.push({ date: 'Total', orders: fmt.int(data.pickup.reduce((s, d) => s + d.orders, 0)) });
    return {
      caption: 'Holiday orders from the first week, by the pickup date the customer chose (dates with no orders omitted)',
      columns: [
        { key: 'date', label: 'Pickup date' },
        { key: 'orders', label: 'Holiday orders', numeric: true },
      ],
      rows,
    };
  },
};
