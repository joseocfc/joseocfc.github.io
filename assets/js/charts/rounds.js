/* rounds — how many review rounds a change needed to pass 9/10 (SPEC §6.5)
   data-src: /data/bakery-metrics.json → review_gate.mentions_in_records {"9/10 in 1 round": 90, …, "10/10": 4}
   Form:     horizontal bars in round order (ordinal, so not re-sorted), one hue; the 10/10
             count is a different measure, so it sits apart below a hairline.
   Note:     these are mentions in the records (a ticket can be mentioned more than once),
             so the chart reads as the shape of the distribution, not a ticket count. */
import { hbars } from './kit.js';

function rowsOf(data) {
  const m = data.review_gate.mentions_in_records;
  const rounds = Object.entries(m)
    .map(([k, v]) => ({ k, v, n: +(k.match(/in (\d+) round/) || [])[1] }))
    .filter((r) => r.n)
    .sort((a, b) => a.n - b.n);
  const passTotal = rounds.reduce((s, r) => s + r.v, 0);
  const perfect = m['10/10'];
  return { rounds, passTotal, perfect };
}

export default {
  pick(json) { return { review_gate: json.review_gate }; },

  render(el, data, ctx) {
    const { fmt, colors: C } = ctx;
    const { rounds, passTotal, perfect } = rowsOf(data);
    const rows = rounds.map((r) => ({
      key: r.k,
      label: r.n === 1 ? '1 round' : `${r.n} rounds`,
      value: r.v,
      strong: r.n === 1,
      tip: {
        title: `Passed 9/10 in ${r.n === 1 ? '1 round' : `${r.n} rounds`}`,
        rows: [{ value: fmt.int(r.v), label: 'mentions in the records', color: C.accent, key: 'rect' }],
        notes: [`${fmt.pct(r.v / passTotal)} of ${fmt.int(passTotal)} pass mentions`],
      },
    }));
    if (perfect != null) {
      rows.push({
        key: '10/10', label: 'Scored 10/10', value: perfect, gapBefore: true, color: C.accentQuiet,
        tip: { title: 'A perfect 10/10 review', rows: [{ value: fmt.int(perfect), label: 'mentions', color: C.accentQuiet, key: 'rect' }], notes: ['Counted separately: a score, not a round count'] },
      });
    }
    hbars(el, ctx, { rows, tipLabel: 'mentions' });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const { rounds, passTotal, perfect } = rowsOf(data);
    return {
      caption: 'Review-gate outcomes: mentions in STATUS.md, docs/agents and docs/parity',
      columns: [{ key: 'outcome', label: 'Outcome' }, { key: 'mentions', label: 'Mentions', numeric: true }, { key: 'share', label: 'Share of passes', numeric: true }],
      rows: [
        ...rounds.map((r) => ({ outcome: `9/10 in ${r.n} round${r.n > 1 ? 's' : ''}`, mentions: fmt.int(r.v), share: fmt.pct(r.v / passTotal, 1) })),
        ...(perfect != null ? [{ outcome: '10/10', mentions: fmt.int(perfect), share: '' }] : []),
      ],
    };
  },
};
