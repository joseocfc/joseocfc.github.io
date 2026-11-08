/* models — which Claude model is named in each commit's co-author trailer (SPEC §6.7)
   data-src: /data/bakery-metrics.json → ai_coauthorship { by_model{…}, commits_with_claude_coauthor_trailer, total_commits }
   Form:     ranked horizontal bars, one hue, value at the tip; a thin meter above for the
             share of commits that carry a trailer at all. */
import { hbars } from './kit.js';

const clean = (name) => name.replace(/^Claude\s+/, '').replace(/\s*\(1M context\)/, ' · 1M context');

export default {
  pick(json) { return { ai_coauthorship: json.ai_coauthorship }; },

  render(el, data, ctx) {
    const { d3, fmt, colors: C } = ctx;
    const a = data.ai_coauthorship;
    const withT = a.commits_with_claude_coauthor_trailer, total = a.total_commits;

    // Meter: share of all commits that carry a Claude co-author trailer.
    const meter = document.createElement('div');
    meter.className = 'chart-meter';
    const lab = document.createElement('p');
    lab.className = 'chart-meter__label';
    const strong = document.createElement('strong');
    strong.textContent = `${fmt.int(withT)} of ${fmt.int(total)}`;
    lab.append(strong, document.createTextNode(` commits carry a Claude co-author trailer (${fmt.pct(withT / total, 1)})`));
    const track = document.createElement('div');
    track.className = 'chart-meter__track';
    track.style.setProperty('--track', C.accentQuiet);
    const fill = document.createElement('div');
    fill.className = 'chart-meter__fill';
    fill.style.setProperty('--fill', C.accent);
    fill.style.setProperty('--share', String(withT / total));
    if (ctx.animate) fill.classList.add('is-drawing');
    track.append(fill);
    meter.append(lab, track);
    el.append(meter);

    const rows = Object.entries(a.by_model)
      .map(([k, v]) => ({ key: k, label: clean(k), value: v }))
      .sort((p, q) => d3.descending(p.value, q.value));
    rows.forEach((r) => {
      r.tip = { title: r.key, rows: [{ value: fmt.int(r.value), label: 'commits', color: C.accent, key: 'rect' }], notes: [`${fmt.pct(r.value / withT, 1)} of trailer-carrying commits`] };
    });
    hbars(el, ctx, { rows, tipLabel: 'commits' });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const a = data.ai_coauthorship;
    const rows = Object.entries(a.by_model).sort((p, q) => q[1] - p[1]);
    return {
      caption: `Commits by the Claude model named in the Co-Authored-By trailer (${fmt.int(a.commits_with_claude_coauthor_trailer)} of ${fmt.int(a.total_commits)} commits)`,
      columns: [{ key: 'model', label: 'Model' }, { key: 'commits', label: 'Commits', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
      rows: [
        ...rows.map(([k, v]) => ({ model: k, commits: fmt.int(v), share: fmt.pct(v / a.commits_with_claude_coauthor_trailer, 1) })),
        { model: 'No trailer', commits: fmt.int(a.total_commits - a.commits_with_claude_coauthor_trailer), share: '' },
      ],
    };
  },
};
