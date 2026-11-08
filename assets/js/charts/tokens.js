/* tokens — the 94 contract tokens of the CFC design system, by family (SPEC §6.10)
   data-src: /data/design-system-metrics.json → tokens { brand_colors, neutrals, semantic_status_colors,
             font_sizes, font_families, spacing_steps, radius, alpha, shadows, transitions,
             z_ladder, button_contract_tokens, custom_keys, contract_total }
   Form:     a unit chart: one square per token, a row per family, ranked; count at the end.
   Derived:  "Structure" = custom_keys − every other custom family (z ladder, layout, scalars). */
import { hbars, note } from './kit.js';

function families(t) {
  const semantic = (t.semantic_status_colors || 0) + (t.neutrals || 0);
  const shape = (t.radius || 0) + (t.alpha || 0) + (t.shadows || 0) + (t.transitions || 0);
  const button = t.button_contract_tokens || 0;
  const structure = Math.max(0, (t.custom_keys || 0) - semantic - shape - button);
  const list = [
    { key: 'button', label: 'Button contract', sub: 'radius, padding, min-heights, focus', value: button },
    { key: 'shape', label: 'Radius · alpha · shadow · motion', sub: `${t.radius} · ${t.alpha} · ${t.shadows} · ${t.transitions}`, value: shape },
    { key: 'semantic', label: 'Semantic + neutral colour', sub: `${t.semantic_status_colors} status · ${t.neutrals} neutral`, value: semantic },
    { key: 'structure', label: 'Structure', sub: `z ladder ${t.z_ladder} · layout + scalars ${structure - (t.z_ladder || 0)}`, value: structure, derived: true },
    { key: 'brand', label: 'Brand colour', sub: 'primary … undenary (no senary)', value: t.brand_colors || 0 },
    { key: 'type', label: 'Type', sub: `${t.font_sizes} fluid sizes · ${t.font_families} families`, value: (t.font_sizes || 0) + (t.font_families || 0) },
    { key: 'spacing', label: 'Spacing', sub: (t.spacing_px || []).join(' · ') + ' px', value: t.spacing_steps || 0 },
  ];
  return list.sort((a, b) => b.value - a.value);
}

export default {
  pick(json) {
    const t = json.tokens;
    return { tokens: t, families: families(t).map(({ key, label, value, derived }) => ({ key, label, value, ...(derived ? { derived: true } : {}) })) };
  },

  render(el, data, ctx) {
    const { fmt, colors: C } = ctx;
    const fam = families(data.tokens);
    const sum = fam.reduce((s, f) => s + f.value, 0);
    note(el, `${fmt.int(sum)} contract tokens · one square per token · contract ${data.tokens.contract_version}, frozen ${fmt.date(fmt.parse(data.tokens.frozen_date))}`);
    const rows = fam.map((f) => ({
      ...f,
      tip: {
        title: f.label,
        rows: [{ value: fmt.int(f.value), label: f.value === 1 ? 'token' : 'tokens', color: C.accent, key: 'rect' }],
        notes: [f.sub, ...(f.derived ? ['Derived: custom keys minus the other custom families'] : [])],
      },
    }));
    hbars(el, ctx, { rows, units: true, tipLabel: 'tokens' });
  },

  table(data, ctx) {
    const { fmt } = ctx;
    const fam = families(data.tokens);
    return {
      caption: `Design-system contract tokens by family (total ${data.tokens.contract_total})`,
      columns: [{ key: 'label', label: 'Family' }, { key: 'sub', label: 'Members' }, { key: 'value', label: 'Tokens', numeric: true }],
      rows: [...fam.map((f) => ({ label: f.label + (f.derived ? ' (derived)' : ''), sub: f.sub, value: fmt.int(f.value) })), { label: 'Total', sub: '', value: fmt.int(fam.reduce((s, f) => s + f.value, 0)) }],
    };
  },
};
