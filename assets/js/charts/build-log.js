/* build-log — this site's own build: one row per worker terminal (SPEC §6.11)
   data-src: /data/build-log.json → { generated, phases:[{id,label}], lanes:[{id,label,model,start,end|null,phase}] }
   Form:     a Gantt on a clock-time axis (Pacific). Bars float (no baseline), so both ends are
             rounded; colour = phase (series slots in order, legend). A lane with "end": null is
             still running at "generated": its bar stops at the snapshot line and says so.
   options:  none */
import { svg, legend, measure, fadeIn, hover, clientPoint, clamp } from './kit.js';

export default {
  pick(json) { return json; },

  render(el, data, ctx) {
    const { d3, fmt, colors: C, width: W, mobile } = ctx;
    const gen = new Date(data.generated);
    const phases = phaseList(data);
    const pColor = new Map(phases.map((p, i) => [p.id, C.series[i % 8]]));
    const lanes = data.lanes.map((l) => {
      const s = new Date(l.start), e = l.end ? new Date(l.end) : null;
      return { ...l, s, e, running: !e, until: e || gen, ms: (e || gen) - s, color: pColor.get(l.phase) || C.accent };
    }).sort((a, b) => a.s - b.s);
    const anyRunning = lanes.some((l) => l.running);
    legend(el, phases.map((p) => ({ label: p.label, color: pColor.get(p.id), kind: 'rect' })),
      { note: `${lanes.length} terminals · ${new Set(lanes.map((l) => l.model)).size} models` });

    const t0 = d3.timeMinute.every(5).floor(d3.min(lanes, (l) => l.s));
    const t1 = d3.timeMinute.every(5).ceil(new Date(Math.max(+d3.max(lanes, (l) => l.until), +gen)));

    const idW = d3.max(lanes, (l) => measure(l.id, 'c-sub')) + 10;
    const labelW = mobile ? 0 : Math.min(W * 0.38, d3.max(lanes, (l) => idW + Math.max(measure(l.label, 'c-label'), measure(l.model, 'c-sub'))) + 24);
    const durW = d3.max(lanes, (l) => measure(l.running ? 'running' : fmt.duration(l.ms), 'c-value')) + 12;
    const x0 = labelW, x1 = W - durW;
    const x = d3.scaleTime().domain([t0, t1]).range([x0, x1]);
    const thick = mobile ? 12 : 14;
    const pitch = mobile ? 44 : 36;
    const barTop = mobile ? 24 : (pitch - thick) / 2;
    const top = anyRunning ? 22 : 6;

    // Phones: the label sits on the bar's row when the bar starts to its right, else above it.
    lanes.forEach((l) => {
      const lw = measure(l.id, 'c-sub') + 8 + measure(l.label, 'c-label') + 8 + measure(l.model, 'c-sub');
      l.inline = !mobile || lw + 12 < x(l.s);
      l.pitch = mobile && !l.inline ? pitch : 30;
      if (!mobile) l.pitch = pitch;
      l.barTop = mobile && !l.inline ? barTop : (l.pitch - thick) / 2;
    });
    let yy = top;
    let prev = null;
    lanes.forEach((l) => { if (prev && prev !== l.phase) yy += 14; l._y = yy; yy += l.pitch; prev = l.phase; });
    const plotBottom = yy;
    const H = plotBottom + 30;
    const root = svg(el, W, H);

    // Clock grid (vertical hairlines) + axis
    const every = mobile ? 20 : 10;
    const ticks = d3.timeMinute.every(every).range(t0, d3.timeMinute.offset(t1, 1));
    const gGrid = root.append('g');
    let lastRight = -Infinity;
    ticks.forEach((t) => {
      const xx = Math.round(x(t)) + 0.5;
      gGrid.append('line').attr('class', 'c-grid').attr('x1', xx).attr('x2', xx).attr('y1', top - 4).attr('y2', plotBottom);
      const lab = fmt.time(t);
      const w = measure(lab, 'c-axis');
      if (xx - w / 2 < lastRight + 10 || xx + w / 2 > W) return;
      gGrid.append('text').attr('class', 'c-axis').attr('x', xx).attr('y', plotBottom + 18).attr('text-anchor', 'middle').text(lab);
      lastRight = xx + w / 2;
    });
    const by = Math.round(plotBottom) + 0.5;
    root.append('line').attr('class', 'c-base').attr('x1', x0).attr('x2', x1).attr('y1', by).attr('y2', by);

    // Snapshot line for lanes still running
    if (anyRunning) {
      const gx = Math.round(x(gen)) + 0.5;
      root.append('line').attr('class', 'c-now').attr('x1', gx).attr('x2', gx).attr('y1', 14).attr('y2', plotBottom);
      const lab = `SNAPSHOT ${fmt.time(gen).toUpperCase()} PT`;
      const lw = measure(lab, 'c-flag-date');
      root.append('text').attr('class', 'c-flag-date').attr('x', gx + lw + 4 > W ? gx - 4 : gx + 4).attr('text-anchor', gx + lw + 4 > W ? 'end' : 'start').attr('y', 10).text(lab);
    }

    const rows = root.append('g').selectAll('g').data(lanes).join('g').attr('class', 'c-row').attr('transform', (l) => `translate(0,${l._y})`);
    rows.each(function (l, i) {
      const g = d3.select(this);
      if (mobile) {
        // C1 QA: halo so the grid and snapshot lines pass behind the label instead of striking through it.
        const t = g.append('text').attr('class', 'c-halo').attr('x', 0).attr('y', l.inline ? l.pitch / 2 + 4 : 14);
        t.append('tspan').attr('class', 'c-sub').text(l.id);
        t.append('tspan').attr('class', 'c-label').attr('dx', 8).text(l.label);
        t.append('tspan').attr('class', 'c-sub').attr('dx', 8).text(l.model);
      } else {
        g.append('text').attr('class', 'c-sub').attr('x', 0).attr('y', pitch / 2 + 4).text(l.id);
        const t = g.append('text').attr('x', idW).attr('y', pitch / 2 + 4);
        // C1 QA: the label column is capped at 38% of the width; long labels ran under the bars and grid.
        // Trim the job label to fit (model always shown); the tooltip and table keep the full text.
        const room = labelW - 24 - idW - 8 - measure(l.model, 'c-sub');
        let job = l.label;
        if (measure(job, 'c-label') > room) {
          while (job.length > 1 && measure(job + '…', 'c-label') > room) job = job.slice(0, -1);
          job = job.trimEnd() + '…';
        }
        t.append('tspan').attr('class', 'c-label').text(job);
        t.append('tspan').attr('class', 'c-sub').attr('dx', 8).text(l.model);
      }
      const bx = x(l.s), bw = Math.max(thick, x(l.until) - x(l.s));
      const bar = g.append('rect').attr('class', 'c-mark').attr('x', bx).attr('y', l.barTop).attr('height', thick).attr('rx', 4)
        .attr('fill', l.color).attr('width', ctx.animate ? 0 : bw);
      if (ctx.animate) bar.transition().delay(i * 70).duration(700).ease(d3.easeCubicOut).attr('width', bw);
      // Duration at the bar end, on a surface-coloured plate so grid and snapshot lines pass behind it.
      const vText = l.running ? 'running' : fmt.duration(l.ms);
      const vCls = l.running ? 'c-sub' : 'c-value';
      const v = g.append('g');
      v.append('rect').attr('x', bx + bw + 3).attr('y', l.barTop - 2).attr('width', measure(vText, vCls) + 7).attr('height', thick + 4).attr('fill', C.surface);
      v.append('text').attr('class', vCls).attr('x', bx + bw + 6).attr('y', l.barTop + thick / 2 + 4).text(vText);
      fadeIn(v, ctx, { delay: 600 + i * 70 });
    });

    hover(ctx, el, {
      target: root,
      count: lanes.length,
      indexAt: (e) => {
        const [, py] = d3.pointer(e, root.node());
        return lanes.findIndex((l) => py >= l._y && py < l._y + l.pitch);
      },
      show: (i, pt) => {
        const l = lanes[i];
        rows.classed('is-dim', (_, j) => j !== i);
        ctx.tooltip.show(pt || clientPoint(root.node(), clamp(x(l.until), 0, W), l._y + l.barTop), {
          title: `${l.id} · ${l.label}`,
          rows: [
            { value: l.running ? `${fmt.duration(l.ms)}+` : fmt.duration(l.ms), label: l.running ? 'so far (running)' : 'wall-clock', color: l.color, key: 'rect' },
            { value: l.model, label: 'model', key: null },
          ],
          notes: [`${fmt.timeSec(l.s)} → ${l.running ? 'still running' : fmt.timeSec(l.e)} PT`],
        }, el);
      },
      clear: () => rows.classed('is-dim', false),
    });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const label = new Map(phaseList(data).map((p) => [p.id, p.label]));
    return {
      caption: `This site's build, one row per worker terminal (snapshot ${fmt.timeSec(new Date(data.generated))} PT)`,
      columns: [
        { key: 'id', label: 'Lane', mono: true }, { key: 'label', label: 'Job' }, { key: 'model', label: 'Model' }, { key: 'phase', label: 'Phase' },
        { key: 'start', label: 'Start (PT)', numeric: true }, { key: 'end', label: 'End (PT)', numeric: true }, { key: 'dur', label: 'Duration', numeric: true },
      ],
      rows: data.lanes.map((l) => ({
        id: l.id, label: l.label, model: l.model, phase: label.get(l.phase) || l.phase,
        start: fmt.timeSec(new Date(l.start)), end: l.end ? fmt.timeSec(new Date(l.end)) : 'running',
        dur: l.end ? fmt.duration(new Date(l.end) - new Date(l.start)) : '',
      })),
    };
  },
};

// C1 QA: build-log.json now ships `phases` as plain strings and lists only some of the lanes' phases. Accept
// strings or {id,label}, keep the listed order, then append any lane phase it misses (in lane start order).
function phaseList(data) {
  const listed = (data.phases || []).map((p) => (typeof p === 'string' ? { id: p, label: p } : p)).filter((p) => p && p.id != null);
  const seen = new Set(listed.map((p) => p.id));
  [...data.lanes].sort((a, b) => new Date(a.start) - new Date(b.start)).forEach((l) => {
    if (l.phase != null && !seen.has(l.phase)) { seen.add(l.phase); listed.push({ id: l.phase, label: l.phase }); }
  });
  return listed;
}
