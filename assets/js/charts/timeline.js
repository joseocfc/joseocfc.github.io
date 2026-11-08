/* timeline — bakery commits per day with milestone flags (SPEC §6.1)
   data-src: /data/bakery-metrics.json → commits_by_day[{date,count}], milestones[{date,label,source}]
   options:  data-labels (6), data-labels-mobile (3), data-from, data-to, data-height */
import { dailyBars, clamp, num, scrub } from './kit.js';

/* Editorial layer: short flag text and priority per milestone date. Anything not listed
   here still shows in the tooltip (its full label from the data) and on the rail. */
const EDIT = {
  '2026-11-01': { rank: 1, short: 'Live on production', strong: true },
  '2026-10-26': { rank: 2, short: 'Holiday build: 307 commits in a day', shortMobile: '307 commits in a day' },
  '2026-06-12': { rank: 3, short: 'First commit' },
  '2026-09-10': { rank: 4, short: 'Test harness + review gate' },
  '2026-07-07': { rank: 5, short: 'Assumptions register starts' },
  '2026-08-06': { rank: 6, short: 'Spec + 13 tickets in a day' },
  '2026-10-12': { rank: 7, short: 'Storefront on staging' },
  '2026-11-04': { rank: 8, short: 'Thanksgiving orders open' },
  '2026-10-22': { rank: 9, short: 'First hand-off file' },
  '2026-09-01': { rank: 10, short: 'STATUS.md is the source of truth' },
  '2026-07-13': { rank: 11, short: 'Menu import 47/47' },
  '2026-06-25': { rank: 12, short: 'CLAUDE.md + first deploy' },
};

export default {
  pick(json) {
    return {
      timeline: json.timeline,
      commits_by_day: json.commits_by_day,
      milestones: json.milestones.map((m) => ({ ...m, label: scrub(m.label) })),
      busiest_days: json.busiest_days,
    };
  },

  render(el, data, ctx) {
    const { fmt, opts, colors: C } = ctx;
    const from = opts.from ? fmt.parse(opts.from) : null;
    const to = opts.to ? fmt.parse(opts.to) : null;
    const days = data.commits_by_day
      .map((d) => ({ date: fmt.parse(d.date), total: d.count, values: [d.count] }))
      .filter((d) => (!from || d.date >= from) && (!to || d.date <= to));

    const milestones = data.milestones.map((m, i) => {
      const e = EDIT[m.date] || {};
      return {
        date: fmt.parse(m.date),
        rank: e.rank ?? 100 + i,
        short: e.short || m.label.split(/[;:,(]/)[0].trim(),
        shortMobile: e.shortMobile,
        long: m.label,
        strong: !!e.strong,
      };
    });

    const total = data.commits_by_day.reduce((s, d) => s + d.count, 0);
    dailyBars(el, ctx, {
      days,
      parts: [{ key: 'commits', label: 'Commits', color: C.accent }],
      milestones,
      maxLabels: ctx.mobile ? num(opts.labelsMobile, 3) : num(opts.labels, 6),
      plotH: num(opts.height, clamp(Math.round(ctx.width * 0.23), 168, 270)),
      unit: 'commits',
      startIndex: days.findIndex((d) => fmt.iso(d.date) === data.timeline?.launch),
      tip: (d) => ({
        title: fmt.day(d.date),
        rows: [{ value: fmt.int(d.total), label: d.total === 1 ? 'commit' : 'commits', color: C.accent, key: 'rect' }],
        notes: d.total ? [`${fmt.pct(d.total / total, 1)} of all ${fmt.int(total)} commits`] : [],
      }),
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const ms = new Map();
    data.milestones.forEach((m) => ms.set(m.date, [...(ms.get(m.date) || []), m.label]));
    return {
      caption: 'Commits per day, with milestones (days with commits or a milestone)',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'count', label: 'Commits', numeric: true },
        { key: 'milestone', label: 'Milestone' },
      ],
      rows: data.commits_by_day
        .filter((d) => d.count > 0 || ms.has(d.date))
        .map((d) => ({ date: fmt.date(fmt.parse(d.date)), count: fmt.int(d.count), milestone: (ms.get(d.date) || []).join(' · ') })),
    };
  },
};
