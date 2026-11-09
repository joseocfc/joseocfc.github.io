/* orders — first-week orders per day through the new bakery system, everyday bakery vs holiday
   data-src: /data/bakery-orders-week1.json → days[{date,bakery,holiday}], totals, source, unit
   Form:     one stacked column per day (bakery bottom in series-1, holiday on top in series-2,
             2px surface gap, 4px rounded data end), legend, integer grid, day labels under the
             columns ("Sun 1" … "Sun 8"; "1" … "8" when they would not fit), and one annotation
             on the first day with holiday orders.
   options:  data-height (plot height in px) */
import { svg, legend, yGridInline, baseline, colPath, rectPath, grow, fadeIn, hover, clientPoint, measure, clamp, num, MARK } from './kit.js';

export default {
  pick(json) {
    return {
      source: json.source,
      unit: json.unit,
      days: json.days.map(({ date, bakery, holiday }) => ({ date, bakery, holiday })),
      totals: { bakery_orders: json.totals?.bakery_orders, holiday_orders: json.totals?.holiday_orders },
    };
  },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, width: W, mobile, opts } = ctx;
    const parts = [
      { key: 'bakery', label: 'Everyday bakery', tip: 'bakery', color: C.series[0] },
      { key: 'holiday', label: 'Thanksgiving holiday', tip: 'holiday', color: C.series[1] },
    ];
    const days = data.days.map((d) => ({ ...d, day: fmt.parse(d.date), total: d.bakery + d.holiday }));
    const n = days.length;
    const sumB = d3.sum(days, (d) => d.bakery), sumH = d3.sum(days, (d) => d.holiday);

    legend(el, parts.map((p) => ({ label: p.label, color: p.color, kind: 'rect' })),
      { note: `${fmt.int(sumB + sumH)} orders · ${fmt.int(sumB)} bakery · ${fmt.int(sumH)} holiday` });

    /* Layout: an annotation row above the plot, day labels below it. */
    const plotH = num(opts.height, clamp(Math.round(W * 0.3), 180, 260));
    const top = 30, base = top + plotH, H = base + 30;
    const root = svg(el, W, H);
    const step = W / n;
    const bw = Math.min(MARK.bar, step - 8);
    const bx = (i) => i * step + (step - bw) / 2;
    const maxV = d3.max(days, (d) => d.total) || 1;
    const y = d3.scaleLinear().domain([0, maxV]).range([base, top]);

    const gGrid = root.append('g'), gHi = root.append('g'), gBars = root.append('g'), gLab = root.append('g'), gAxis = root.append('g');

    const ticks = y.ticks(3).filter((t) => t > 0 && t <= maxV && Number.isInteger(t));
    yGridInline(gGrid, y, ticks, { x1: W, fmt: fmt.int, unit: 'orders' });
    baseline(gAxis, 0, W, base);

    /* Day labels: weekday + date when every label fits its column, else the date alone. */
    const long = (d) => d3.timeFormat('%a %-d')(d.day);
    const short = (d) => d3.timeFormat('%-d')(d.day);
    const fits = days.every((d) => measure(long(d), 'c-axis') <= step - 6);
    const label = fits ? long : short;
    gAxis.selectAll('text.c-axis').data(days).join('text').attr('class', 'c-axis')
      .attr('x', (d, i) => bx(i) + bw / 2).attr('y', base + 18).attr('text-anchor', 'middle').text(label);

    /* Stacked columns: bottom first; only the top segment gets the rounded end. */
    const segs = [];
    days.forEach((d, i) => {
      const vals = parts.map((p) => d[p.key]);
      const topK = vals.reduce((k, v, j) => (v > 0 ? j : k), -1);
      let cum = 0;
      vals.forEach((v, k) => {
        if (!(v > 0)) return;
        const yb = y(cum) - (cum > 0 ? MARK.gap : 0);
        cum += v;
        segs.push({ i, k, x: bx(i), yb, yt: y(cum), round: k === topK, color: parts[k].color });
      });
    });
    segs.forEach((s) => {
      s.path = (t) => {
        const b = base - (base - s.yb) * t, tp = base - (base - s.yt) * t;
        return s.round ? colPath(s.x, tp, bw, b - tp) : rectPath(s.x, tp, bw, b - tp);
      };
    });
    const bars = gBars.selectAll('path').data(segs).join('path').attr('class', 'c-mark').attr('fill', (s) => s.color);
    grow(bars, ctx, { duration: 520, delay: (s) => s.i * 70 });

    /* Annotation: the first day with holiday orders. */
    const open = days.findIndex((d) => d.holiday > 0);
    if (open >= 0) {
      const text = 'Holiday opens';
      const tw = measure(text, 'c-anno');
      const cx = clamp(bx(open) + bw / 2, tw / 2, W - tw / 2);
      const a = gLab.append('text').attr('class', 'c-anno c-halo').attr('x', cx).attr('y', y(days[open].total) - 8).attr('text-anchor', 'middle').text(text);
      fadeIn(a, ctx, { delay: 520 + open * 70 });
    }

    /* Hover: one column per day; tooltip lists both parts and the total. */
    const hi = gHi.append('rect').attr('class', 'c-hover-col').attr('y', top - 2).attr('height', base - top + 2).attr('width', step).attr('opacity', 0);
    const hit = root.append('rect').attr('class', 'c-hit').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);
    hover(ctx, el, {
      target: hit,
      count: n,
      start: Math.max(0, open),
      indexAt: (e) => {
        const [px] = d3.pointer(e, root.node());
        return clamp(Math.floor(px / step), 0, n - 1);
      },
      show: (i, pt) => {
        const d = days[i];
        hi.attr('x', i * step).attr('opacity', 1);
        ctx.tooltip.show(pt || clientPoint(root.node(), bx(i) + bw / 2, y(d.total)), {
          title: fmt.day(d.day),
          rows: [
            ...parts.map((p) => ({ value: fmt.int(d[p.key]), label: p.tip, color: p.color, key: 'rect' })),
            { value: fmt.int(d.total), label: d.total === 1 ? 'order in total' : 'orders in total', key: null },
          ],
          notes: i === open ? ['First day of Thanksgiving holiday orders'] : [],
        }, el);
      },
      clear: () => hi.attr('opacity', 0),
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const rows = data.days.map((d) => ({
      date: fmt.day(fmt.parse(d.date)), bakery: fmt.int(d.bakery), holiday: fmt.int(d.holiday), total: fmt.int(d.bakery + d.holiday),
    }));
    const b = data.days.reduce((s, d) => s + d.bakery, 0), h = data.days.reduce((s, d) => s + d.holiday, 0);
    rows.push({ date: 'Total', bakery: fmt.int(b), holiday: fmt.int(h), total: fmt.int(b + h) });
    return {
      caption: 'Orders per day through the new bakery system, everyday bakery and Thanksgiving holiday',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'bakery', label: 'Bakery', numeric: true },
        { key: 'holiday', label: 'Holiday', numeric: true },
        { key: 'total', label: 'Total', numeric: true },
      ],
      rows,
    };
  },
};
