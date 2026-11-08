/* ds-commits — cfc-theme commits per day, design-system work emphasised (SPEC §6.9)
   data-src: /data/design-system-metrics.json → commits_by_day[{date,commits}],
             design_system_commits_by_day[{date,commits}], milestones[{date,event}], commits.design_system_window
   Marks:    stacked daily bars (design-system commits in the accent, the rest of the theme in grey),
             the design-system window shaded, a flag at 2026-07-17 "v1.0 frozen".
   options:  data-labels (4), data-labels-mobile (1), data-from, data-to, data-height */
import { dailyBars, clamp, num } from './kit.js';

const EDIT = {
  '2026-07-17': { rank: 1, short: 'v1.0 frozen: 94 commits in a day', shortMobile: 'v1.0 frozen', strong: true },
  '2026-07-24': { rank: 2, short: 'v1.1 additive' },
  '2026-03-04': { rank: 3, short: 'First commit' },
  '2026-08-21': { rank: 4, short: 'Parity PASS 94/60' },
  '2026-07-03': { rank: 5, short: 'Button system' },
  '2026-07-01': { rank: 6, short: '8px spacing ladder' },
};

export default {
  pick(json) {
    return {
      repo: json.repo?.name,
      commits_by_day: json.commits_by_day,
      design_system_commits_by_day: json.design_system_commits_by_day,
      design_system_window: json.commits?.design_system_window,
      busiest_day: json.commits?.busiest_day,
      milestones: json.milestones,
    };
  },

  render(el, data, ctx) {
    const { d3, fmt, opts, colors: C } = ctx;
    const all = new Map(data.commits_by_day.map((d) => [d.date, d.commits]));
    const ds = new Map(data.design_system_commits_by_day.map((d) => [d.date, d.commits]));
    const first = fmt.parse(opts.from || data.commits_by_day[0].date);
    const last = fmt.parse(opts.to || data.commits_by_day[data.commits_by_day.length - 1].date);
    const days = d3.timeDay.range(first, d3.timeDay.offset(last, 1)).map((date) => {
      const k = fmt.iso(date);
      const total = all.get(k) || 0;
      const sys = Math.min(ds.get(k) || 0, total);
      return { date, total, sys, other: total - sys, values: [sys, total - sys] };
    });

    const win = data.design_system_window || { from: '2026-06-25', to: '2026-08-21' };
    const wFrom = fmt.parse(win.from), wTo = fmt.parse(win.to);
    const span = `${fmt.dateShort(wFrom)} – ${fmt.dateShort(wTo)}`;
    const milestones = data.milestones.map((m, i) => {
      const e = EDIT[m.date] || {};
      return { date: fmt.parse(m.date), rank: e.rank ?? 100 + i, short: e.short || m.event.split(/[;:,(]/)[0].trim(), shortMobile: e.shortMobile, long: m.event, strong: !!e.strong };
    });

    const totalSys = d3.sum(days, (d) => d.sys), totalAll = d3.sum(days, (d) => d.total);
    dailyBars(el, ctx, {
      days,
      parts: [
        { key: 'sys', label: 'Design-system commits', color: C.accent },
        { key: 'other', label: 'Other theme commits', color: C.muted },
      ],
      legendNote: `${fmt.int(totalSys)} of ${fmt.int(totalAll)} commits touch the system`,
      milestones,
      band: { from: wFrom, to: wTo, labels: [`Design-system window · ${span}`, 'Design-system window', 'System window', 'Window'] },
      maxLabels: ctx.mobile ? num(opts.labelsMobile, 1) : num(opts.labels, 4),
      plotH: num(opts.height, clamp(Math.round(ctx.width * 0.2), 150, 230)),
      unit: 'commits',
      startIndex: days.findIndex((d) => fmt.iso(d.date) === '2026-07-17'),
      tip: (d) => ({
        title: fmt.day(d.date),
        rows: [
          { value: fmt.int(d.sys), label: 'design-system commits', color: C.accent, key: 'rect' },
          { value: fmt.int(d.other), label: 'other theme commits', color: C.muted, key: 'rect' },
        ],
        notes: d.date >= wFrom && d.date <= wTo ? [`Inside the design-system window (${span})`] : [],
      }),
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const ds = new Map(data.design_system_commits_by_day.map((d) => [d.date, d.commits]));
    const ms = new Map(data.milestones.map((m) => [m.date, m.event]));
    return {
      caption: 'cfc-theme commits per day (days with commits), design-system share and milestones',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'all', label: 'All commits', numeric: true },
        { key: 'ds', label: 'Design-system', numeric: true },
        { key: 'milestone', label: 'Milestone' },
      ],
      rows: data.commits_by_day.map((d) => ({
        date: fmt.date(fmt.parse(d.date)), all: fmt.int(d.commits), ds: fmt.int(ds.get(d.date) || 0), milestone: ms.get(d.date) || '',
      })),
    };
  },
};
