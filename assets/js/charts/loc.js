/* loc — lines of code by area of the repo (SPEC §6.8)
   data-src: /data/bakery-metrics.json → loc_by_area { tests_php, docs_md, includes_php, … }
   Form:     ranked horizontal bars with the repo path under each label. Emphasis: the
             highlighted area in the accent, the rest in grey (default "tests_php").
   options:  data-highlight="tests_php" (comma list; "" or "none" = one hue for every bar) */
import { hbars } from './kit.js';

const AREAS = {
  tests_php: { label: 'Tests', sub: 'tests/ · PHP' },
  docs_md: { label: 'Docs', sub: 'docs/ · Markdown' },
  includes_php: { label: 'Plugin code', sub: 'includes/ · PHP' },
  assets_css: { label: 'Styles', sub: 'assets/ · CSS' },
  assets_js: { label: 'Scripts', sub: 'assets/ · JS' },
  assumptions_register_md: { label: 'Assumptions register', sub: 'docs/assumptions-register.md' },
  STATUS_md: { label: 'Status log', sub: 'STATUS.md' },
  CLAUDE_md: { label: 'Agent brief', sub: 'CLAUDE.md' },
};

export default {
  pick(json) { return { loc_by_area: json.loc_by_area, loc_by_language: json.loc_by_language }; },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, opts } = ctx;
    const hl = opts.highlight == null ? ['tests_php'] : String(opts.highlight).split(',').map((s) => s.trim()).filter((s) => s && s !== 'none');
    const total = d3.sum(Object.values(data.loc_by_area));
    const rows = Object.entries(data.loc_by_area)
      .map(([k, v]) => ({ key: k, label: AREAS[k]?.label || k, sub: AREAS[k]?.sub || '', value: v }))
      .sort((a, b) => d3.descending(a.value, b.value));
    rows.forEach((r) => {
      const on = !hl.length || hl.includes(r.key);
      r.color = on ? C.accent : C.muted;
      r.strong = hl.includes(r.key);
      r.tip = { title: `${r.label} · ${r.sub}`, rows: [{ value: fmt.int(r.value), label: 'lines', color: r.color, key: 'rect' }], notes: [`${fmt.pct(r.value / total, 1)} of ${fmt.int(total)} lines counted`] };
    });
    hbars(el, ctx, { rows, tipLabel: 'lines' });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const rows = Object.entries(data.loc_by_area).sort((a, b) => b[1] - a[1]);
    return {
      caption: 'Lines of code by area (git ls-files + wc -l)',
      columns: [{ key: 'area', label: 'Area' }, { key: 'path', label: 'Path', mono: true }, { key: 'lines', label: 'Lines', numeric: true }],
      rows: rows.map(([k, v]) => ({ area: AREAS[k]?.label || k, path: AREAS[k]?.sub || k, lines: fmt.int(v) })),
    };
  },
};
