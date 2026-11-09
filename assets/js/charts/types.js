/* types — what the 1,503 commits were, by conventional-commit prefix
   data-src: /data/bakery-metrics.json → commits_by_type { docs, feat, fix, test, merge, other, chore }
   Form:     one whole split into parts → the tall segmented bar (28px, 4px corners, 2px gaps),
             ≤6 parts (the smallest tail folds into "other"), share printed inside where it fits,
             a legend of names in block order, and a bracket that calls out docs honestly. */
import { svg, legend, measure, fadeIn, hover, clientPoint } from './kit.js';

const NAMES = { docs: 'docs', feat: 'feat', fix: 'fix', test: 'test', merge: 'merge', other: 'other', chore: 'chore' };
const MEANING = {
  docs: 'Specs, hand-offs, status and review records',
  feat: 'New behavior',
  fix: 'Bug fixes',
  test: 'Harness checks and assertions',
  merge: 'Branch merges',
  other: 'Unprefixed commits',
  chore: 'Housekeeping',
};

function parts(byType) {
  const all = Object.entries(byType).map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value);
  const named = all.filter((p) => p.key !== 'other' && p.key !== 'chore').slice(0, 5);
  const rest = all.filter((p) => !named.includes(p));
  const out = named.map((p) => ({ ...p, label: NAMES[p.key] || p.key, members: [p.key] }));
  if (rest.length) out.push({ key: 'other', label: rest.length > 1 ? 'other + ' + rest.filter((r) => r.key !== 'other').map((r) => r.key).join(' + ') : rest[0].key, value: rest.reduce((s, r) => s + r.value, 0), members: rest.map((r) => r.key) });
  return out;
}

export default {
  pick(json) { return { commits_by_type: json.commits_by_type, total_commits: json.timeline?.total_commits }; },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, width: W, mobile } = ctx;
    const ps = parts(data.commits_by_type);
    const total = d3.sum(ps, (p) => p.value);
    ps.forEach((p, i) => { p.color = C.series[i]; p.share = p.value / total; });
    legend(el, ps.map((p) => ({ label: p.label, color: p.color, kind: 'rect' })));

    const barH = 28, top = 2, gap = 2;
    const usable = W - gap * (ps.length - 1);
    let cx = 0;
    ps.forEach((p) => { p.x = cx; p.w = Math.max(0, usable * p.share); cx += p.w + gap; });

    const docs = ps.find((p) => p.key === 'docs');
    const callH = docs ? 44 : 0;
    const H = top + barH + callH + 4;
    const root = svg(el, W, H);
    const blocks = root.append('g').selectAll('g').data(ps).join('g').attr('class', 'c-seg');
    const rects = blocks.append('rect')
      .attr('x', (p) => p.x).attr('y', top).attr('height', barH).attr('rx', 4)
      .attr('width', (p) => (ctx.animate ? 0 : p.w)).attr('fill', (p) => p.color);
    if (ctx.animate) {
      let acc = 0;
      rects.each(function (p) {
        const delay = acc;
        acc += 120 + p.share * 500;
        d3.select(this).transition().delay(delay).duration(140 + p.share * 520).ease(d3.easeCubicOut).attr('width', p.w);
      });
    }

    // Share inside the block at the leading edge; the name too when the block is wide.
    blocks.each(function (p) {
      const pct = fmt.pct(p.share);
      const both = `${p.label} ${pct}`;
      const pad = 8;
      let text = null;
      if (measure(both, 'c-inside') + pad * 2 <= p.w) text = both;
      else if (measure(pct, 'c-inside') + pad * 2 <= p.w) text = pct;
      if (!text) return;
      const t = d3.select(this).append('text').attr('class', 'c-inside').attr('x', p.x + pad).attr('y', top + barH / 2 + 4.5).style('fill', C.onFill(p.color)).text(text);
      fadeIn(t, ctx, { delay: 900 });
    });

    // Honest call-out: nearly half the commits are docs.
    if (docs) {
      const yy = top + barH + 9.5;
      const g = root.append('g').attr('class', 'c-callout');
      g.append('path').attr('class', 'c-bracket').attr('d', `M${docs.x + 0.5},${yy - 5}V${yy}H${docs.x + docs.w - 0.5}V${yy - 5}`);
      const t = g.append('text').attr('x', docs.x).attr('y', yy + 19);
      t.append('tspan').attr('class', 'c-anno-strong').text(`${fmt.int(docs.value)} docs commits`);
      t.append('tspan').attr('class', 'c-anno').attr('dx', 6).text(mobile ? `· ${fmt.pct(docs.share)} of all` : `· ${fmt.pct(docs.share)} of all ${fmt.int(total)}: the build is written down as it happens`);
      fadeIn(g, ctx, { delay: 1100 });
    }

    hover(ctx, el, {
      target: root,
      count: ps.length,
      indexAt: (e) => {
        const [px, py] = d3.pointer(e, root.node());
        if (py > top + barH + 6) return -1;
        return ps.findIndex((p) => px >= p.x - gap / 2 && px < p.x + p.w + gap / 2);
      },
      show: (i, pt) => {
        const p = ps[i];
        blocks.classed('is-dim', (_, j) => j !== i);
        ctx.tooltip.show(pt || clientPoint(root.node(), p.x + p.w / 2, top), {
          title: p.label,
          rows: [{ value: fmt.int(p.value), label: `commits · ${fmt.pct(p.share, 1)}`, color: p.color, key: 'rect' }],
          notes: [p.members.map((m) => MEANING[m] || m).join('; ')],
        }, el);
      },
      clear: () => blocks.classed('is-dim', false),
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const rows = Object.entries(data.commits_by_type).sort((a, b) => b[1] - a[1]);
    const total = rows.reduce((s, [, v]) => s + v, 0);
    return {
      caption: 'Commits by conventional-commit prefix (all seven types, unfolded)',
      columns: [{ key: 'type', label: 'Type', mono: true }, { key: 'meaning', label: 'What it covers' }, { key: 'commits', label: 'Commits', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
      rows: [...rows.map(([k, v]) => ({ type: k, meaning: MEANING[k] || '', commits: fmt.int(v), share: fmt.pct(v / total, 1) })), { type: 'total', meaning: '', commits: fmt.int(total), share: '100%' }],
    };
  },
};
