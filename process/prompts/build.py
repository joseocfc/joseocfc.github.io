#!/usr/bin/env python3
"""Build /process/prompts/index.html from the real lane prompts of this site's build (lane B3).

Reads:  lanes/prompts/*.md (the prompt each worker terminal started from), lanes/run-*.sh (model flag),
        lanes/logs/*.log (first "start" / last "end" line), lanes/build_log.py (lane labels), SPEC.md,
        site/templates/page.html (the canonical shell, used verbatim).
Writes: site/process/prompts/index.html, and two marked regions in site/process/index.html
        (<!--build:workers-->N<!--/build:workers--> and <!--build:page-links-->…<!--/build:page-links-->).

Prompt text is published as written, with three redactions (a staff first name, a street address and a
personal name), each shown in [brackets]. Re-run after adding prompts or finishing lanes:
    python3 -I "site/process/prompts/build.py"
"""
import ast, datetime, html, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
LANES = ROOT / "lanes"
OUT = SITE / "process" / "prompts" / "index.html"
PROCESS = SITE / "process" / "index.html"

REDACT = [  # (pattern, replacement) — applied to every published text
    (r"\bKurt\b", "[the deli lead]"),
    (r"1540 Humboldt( St)?", "[street address]"),
    (r"Nany - Kenzie's Crew", "[nanny-site folder]"),
]
PHASES = [  # prefix → (anchor, heading, one line)
    ("lane", "phase-research", "Phase 0 · Research", "Four read-only research terminals, one per source: Epoch AI, the bakery repo, the theme and Figma file, and my other work."),
    ("SPEC", "phase-spec", "The spec", "Written by the orchestrator from the research, before any build lane opened. Every build lane reads it first."),
    ("A", "phase-build", "Phase A · Build", "Five terminals in parallel, each owning its own files: the design system and shell, the chart system, data and images, the Epoch study, and the copy."),
    ("B", "phase-pages", "Phase B · Pages", "Four page lanes that assemble Phase A’s parts into finished pages."),
    ("C", "phase-qa", "Phase C · QA", "One audit lane across every page, width and theme."),
    ("D", "phase-figma", "Phase D · Figma", "One lane that mirrors the finished site into a Figma file."),
]
PHASE_NAME = {"lane": "Phase 0 · Research", "A": "Phase A · Build", "B": "Phase B · Pages", "C": "Phase C · QA", "D": "Phase D · Figma"}
# Short link labels for the process page (lanes not listed fall back to the build_log.py label).
LINK = {"B1-bakery": "bakery case study", "B2-design-system": "design system", "B3-process": "this page",
        "B4-home-about": "home and about", "C1-qa": "QA audit", "D1-figma": "Figma file"}


def redact(s):
    for pat, rep in REDACT:
        s = re.sub(pat, rep, s)
    return s


def esc(s):
    return html.escape(s, quote=False)


def labels():
    """Lane labels from the orchestrator's lanes/build_log.py META dict (parsed, never executed)."""
    try:
        tree = ast.parse((LANES / "build_log.py").read_text(encoding="utf-8"))
        for node in tree.body:
            if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") == "META":
                return {k: v["label"] for k, v in ast.literal_eval(node.value).items()}
    except Exception:
        pass
    return {}


def stamp(line):
    m = re.search(r"\w{3} (\w{3})\s+(\d+) (\d\d:\d\d:\d\d) \w+ (\d{4})", line)
    return datetime.datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(4)} {m.group(3)}", "%b %d %Y %H:%M:%S") if m else None


def ran(log_id):
    f = LANES / "logs" / f"{log_id}.log"
    if not f.exists():
        return None, None
    rows = [l for l in f.read_text(encoding="utf-8", errors="ignore").splitlines() if l.startswith("[lane")]
    start = next((stamp(l) for l in rows if " start " in l), None)
    end = next((stamp(l) for l in reversed(rows) if " end " in l), None)
    return start, end


def dur(a, b):
    m = round((b - a).total_seconds() / 60)
    return f"{m // 60} h {m % 60:02d} min" if m >= 60 else f"{m} min"


def lane_info(p, label_map):
    stem = p.stem
    text = redact(p.read_text(encoding="utf-8"))
    prefix = "lane" if stem.startswith("lane") else stem[0]
    log_id = stem.split("-")[0] if prefix == "lane" else stem
    run = LANES / f"run-{log_id}.sh"
    run_txt = run.read_text(encoding="utf-8") if run.exists() else ""
    m = re.search(r"\(model: ([^)]+)\)", text.splitlines()[0] if text else "")
    if m:
        model, model_note = m.group(1), "named in the prompt" + (" · run with --model opus" if "--model opus" in run_txt else "")
    elif run_txt and "--model" not in run_txt:
        model, model_note = "Fable 5.1", "CLI default · the run script passes no --model"
    else:
        model, model_note = "Opus 5.5", "run with --model opus"
    start, end = ran(log_id)
    short = stem.split("-")[0] if prefix == "lane" else stem.split("-")[0]
    return {
        "stem": stem, "id": short, "prefix": prefix, "text": text, "model": model, "model_note": model_note,
        "label": label_map.get(log_id, stem), "phase": PHASE_NAME.get(prefix, "Build"),
        "run": f"lanes/run-{log_id}.sh" if run.exists() else None, "start": start, "end": end,
        "words": len(re.findall(r"\S+", text)), "lines": len(text.splitlines()),
    }


def ran_text(l):
    if l["start"] and l["end"]:
        return f"{l['start']:%H:%M:%S} → {l['end']:%H:%M:%S} PT · {dur(l['start'], l['end'])}"
    if l["start"]:
        return f"started {l['start']:%H:%M:%S} PT · still running when this page was generated"
    return "not started when this page was generated"


def details(l, open_=False):
    meta = [f"<span><b>File</b> lanes/prompts/{esc(l['stem'])}.md · {l['lines']} lines · {l['words']:,} words</span>",
            f"<span><b>Model</b> {esc(l['model'])} ({esc(l['model_note'])})</span>"]
    if l["run"]:
        meta.append(f"<span><b>Run</b> {esc(l['run'])} · {esc(ran_text(l))}</span>")
    return (f'<details class="disclosure prompt" id="{esc(l["stem"])}"{" open" if open_ else ""}>\n'
            f'  <summary><span class="prompt__id">{esc(l["id"])}</span><span class="prompt__label">{esc(l["label"])}</span>'
            f'<span class="prompt__tags"><span class="tag tag--mono">{esc(l["model"])}</span><span class="tag tag--mono">{esc(l["phase"])}</span></span></summary>\n'
            f'  <p class="prompt__meta">{"".join(meta)}</p>\n'
            f'  <pre class="prompt__text">{esc(l["text"].rstrip())}</pre>\n</details>')


STYLE = """<style>
/* /process/prompts/ — page-scoped styles (lane B3). A1 tokens only. */
.pp-hero { padding-bottom: clamp(var(--space-6), 4vw, var(--space-8)); }
.pp-hero .meta-grid { margin-top: var(--space-7); max-width: 52rem; }
.pp-actions { margin-top: var(--space-6); }
.pp-body { padding-bottom: var(--section-pad); }
.pp-index { margin-bottom: var(--space-9); }
.pp-index td a { font-family: var(--font-mono); font-size: .8125rem; }
.pp-index td.pp-ran { font-family: var(--font-mono); font-size: .75rem; color: var(--ink-meta); white-space: nowrap; }
.pp-phase + .pp-phase { margin-top: var(--space-9); }
.pp-phase > header { margin-bottom: var(--space-5); max-width: 44rem; }
.pp-phase > header p { margin-top: var(--space-3); color: var(--ink-2); }
.pp-list { display: grid; gap: var(--space-3); }
.prompt { scroll-margin-top: calc(var(--header-h) + var(--space-5)); }
.prompt > summary { flex-wrap: wrap; justify-content: flex-start; row-gap: var(--space-2); padding-block: var(--space-4); }
.prompt > summary::after { margin-left: auto; }
.prompt__id { min-width: 4.25rem; font-family: var(--font-mono); font-size: .8125rem; color: var(--accent-ink); }
.prompt__label { font-weight: var(--fw-semi); margin-right: var(--space-3); }
.prompt__tags { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.prompt__meta { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-5); padding: var(--space-3) var(--space-4) !important; border-bottom: 1px solid var(--line);
  font-family: var(--font-mono); font-size: var(--fs-micro); line-height: 1.5; color: var(--ink-meta); }
.prompt__meta b { font-weight: var(--fw-medium); color: var(--ink-2); margin-right: .35em; text-transform: uppercase; letter-spacing: .06em; }
.prompt__text { max-height: 70vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .8rem; line-height: 1.6; background: var(--paper-2);
  padding-inline: var(--space-5) max(var(--space-5), calc(100% - 112ch)); }
.prompt--spec .prompt__text { max-height: 80vh; }
.prompt[open] { border-color: var(--line-strong); }
.prompt:target, .prompt.is-target { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.pp-note { margin-top: var(--space-4); font-size: var(--fs-small); color: var(--ink-meta); max-width: 44rem; }
@media (max-width: 599.98px) {
  .prompt__id { min-width: 0; margin-right: var(--space-2); }
  .prompt__label { flex: 1 1 60%; margin-right: 0; }
  .prompt__tags { order: 3; flex-basis: 100%; }
  .prompt__text { font-size: .75rem; padding-inline: var(--space-4); }
  .pp-index .pp-sm-hide { display: none; }
  .pp-index td.pp-ran { white-space: normal; min-width: 7.5rem; }
}
</style>"""

SCRIPT = """<script>
/* Open the prompt a link points at (#A1-shell etc.), and the expand/collapse buttons. */
(function () {
  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS') { el.open = true; document.querySelectorAll('.prompt.is-target').forEach(function (d) { d.classList.remove('is-target'); }); el.classList.add('is-target'); el.scrollIntoView(); }
  }
  addEventListener('hashchange', openHash); openHash();
  document.querySelectorAll('[data-pp]').forEach(function (b) {
    b.addEventListener('click', function () { var o = b.getAttribute('data-pp') === 'open'; document.querySelectorAll('details.prompt').forEach(function (d) { d.open = o; }); });
  });
})();
</script>"""


def main():
    label_map = labels()
    prompts = sorted((LANES / "prompts").glob("*.md"))
    lanes = [lane_info(p, label_map) for p in prompts]
    order = {"lane": 0, "A": 1, "B": 2, "C": 3, "D": 4}
    lanes.sort(key=lambda l: (order.get(l["prefix"], 9), l["stem"]))
    spec_txt = redact((ROOT / "SPEC.md").read_text(encoding="utf-8"))
    now = datetime.datetime.now()
    words = sum(l["words"] for l in lanes)
    ran_n = sum(1 for l in lanes if l["start"])

    # Index table
    rows = []
    for l in lanes:
        rows.append(f'<tr><td><a href="#{esc(l["stem"])}">{esc(l["id"])}</a></td><td>{esc(l["label"])}</td>'
                    f'<td>{esc(l["model"])}</td><td class="pp-sm-hide">{esc(l["phase"])}</td><td class="pp-ran">{esc(ran_text(l).replace(" · still running when this page was generated", " · running") if l["start"] else "not started yet")}</td>'
                    f'<td class="pp-sm-hide" data-num>{l["words"]:,}</td></tr>')
    spec_lines = len(spec_txt.splitlines())
    spec_words = len(re.findall(r"\S+", spec_txt))
    rows.insert(4, f'<tr><td><a href="#spec">SPEC</a></td><td>The contract every build lane follows</td><td>Fable 5.1</td>'
                   f'<td class="pp-sm-hide">Orchestrator</td><td class="pp-ran">written before Phase A</td><td class="pp-sm-hide" data-num>{spec_words:,}</td></tr>')
    index = ('<div class="table-wrap pp-index"><table class="table table--compact">\n'
             f'<caption>{len(lanes)} lane prompts and the spec. Times are from the first and last line of each lane’s log, Pacific time.</caption>\n'
             '<thead><tr><th scope="col">Lane</th><th scope="col">Job</th><th scope="col">Model</th><th scope="col" class="pp-sm-hide">Phase</th><th scope="col">Ran</th><th scope="col" class="num pp-sm-hide">Words</th></tr></thead>\n'
             '<tbody>\n' + "\n".join(rows) + '\n</tbody></table></div>')

    # Phase sections (the spec sits where it was written: after research, before build)
    sections = []
    for prefix, anchor, title, line in PHASES:
        if prefix == "SPEC":
            body = (f'<details class="disclosure prompt prompt--spec" id="spec">\n'
                    f'  <summary><span class="prompt__id">SPEC</span><span class="prompt__label">SPEC.md — the contract every build lane follows</span>'
                    f'<span class="prompt__tags"><span class="tag tag--mono">Fable 5.1</span><span class="tag tag--mono">Orchestrator</span></span></summary>\n'
                    f'  <p class="prompt__meta"><span><b>File</b> SPEC.md · {spec_lines} lines · {spec_words:,} words</span>'
                    f'<span><b>Written</b> 2026-11-07, between the research lanes and Phase A</span></p>\n'
                    f'  <pre class="prompt__text">{esc(spec_txt.rstrip())}</pre>\n</details>')
        else:
            group = [l for l in lanes if l["prefix"] == prefix]
            if not group:
                continue
            body = "\n".join(details(l) for l in group)
        sections.append(f'<section class="pp-phase" id="{anchor}" aria-labelledby="{anchor}-t">\n<header><h2 id="{anchor}-t">{esc(title)}</h2><p>{esc(line)}</p></header>\n'
                        f'<div class="pp-list">\n{body}\n</div>\n</section>')

    content = f"""<div class="container">
<header class="hero pp-hero">
  <p class="eyebrow hero__eyebrow"><a href="/process/">Process</a> · The build of this site</p>
  <h1 class="hero__title hero__title--h1">The prompts that built this site</h1>
  <p class="lead hero__dek">Every worker terminal in this build started from one prompt file, written by the orchestrator session. They are published here as written, in the order they ran, with the spec every build lane read first.</p>
  <dl class="meta-grid">
    <div><dt>Prompts</dt><dd>{len(lanes)} lanes · {words:,} words</dd></div>
    <div><dt>Spec</dt><dd>{spec_lines} lines, one owner per file</dd></div>
    <div><dt>Models</dt><dd>Orchestrator Fable 5.1 · workers from Phase A on Opus 5.5</dd></div>
    <div><dt>Generated</dt><dd>{now:%Y-%m-%d %H:%M} PT · {ran_n} of {len(lanes)} lanes started</dd></div>
  </dl>
  <p class="pp-note">Three redactions, shown in [brackets]: a staff member’s first name, a street address and a personal name. Everything else is as written, including the paths on my laptop.</p>
  <div class="pp-actions no-js-hide"><div class="btn-row"><button class="btn btn--ghost btn--sm" type="button" data-pp="open">Expand all</button> <button class="btn btn--ghost btn--sm" type="button" data-pp="close">Collapse all</button></div></div>
</header>
<div class="pp-body">
{index}
{chr(10).join(sections)}
</div>
</div>"""

    tpl = (SITE / "templates" / "page.html").read_text(encoding="utf-8")
    page = (tpl.replace("«Page title»", "The prompts that built this site")
               .replace("«Meta description»", "Every lane prompt from this site’s one-night build, published as written, plus the spec every lane followed.")
               .replace("«/path/»", "/process/prompts/"))
    page = re.sub(r"<!-- PAGE CONTENT -->.*?<!-- /PAGE CONTENT -->",
                  lambda m: "<!-- PAGE CONTENT -->\n" + content + "\n<!-- /PAGE CONTENT -->", page, flags=re.S)
    page = page.replace("<!-- PAGE HEAD: page-specific <link>/<style> go here (keep it empty if not needed). -->",
                        "<!-- PAGE HEAD: page-specific <link>/<style> go here (keep it empty if not needed). -->\n" + STYLE)
    page = page.replace("</body>", SCRIPT + "\n</body>")
    page = page.replace("<!doctype html>", "<!doctype html>\n<!-- Generated by site/process/prompts/build.py (lane B3) from lanes/prompts/*.md. Do not edit by hand. -->", 1)
    OUT.write_text(page, encoding="utf-8")

    # The process page: worker count and the page/QA/Figma prompt links.
    if PROCESS.exists():
        p = PROCESS.read_text(encoding="utf-8")
        p = re.sub(r"<!--build:workers-->.*?<!--/build:workers-->", f"<!--build:workers-->{len(lanes)}<!--/build:workers-->", p, flags=re.S)
        def links(prefixes):
            items = [l for l in lanes if l["prefix"] in prefixes]
            return '<span class="sep" aria-hidden="true">·</span> '.join(
                f'<a href="/process/prompts/#{esc(l["stem"])}">{esc(LINK.get(l["stem"], l["label"].lower()))}</a>' for l in items)
        rows = []
        if any(l["prefix"] == "B" for l in lanes):
            rows.append(f'  <li><span class="pr-lanes__k">Pages</span><span class="pr-lanes__v">{links({"B"})}</span></li>')
        if any(l["prefix"] in "CD" for l in lanes):
            rows.append(f'  <li><span class="pr-lanes__k">QA and Figma</span><span class="pr-lanes__v">{links({"C", "D"})}</span></li>')
        p = re.sub(r"<!--build:page-links-->.*?<!--/build:page-links-->",
                   lambda m: "<!--build:page-links-->\n" + "\n".join(rows) + "\n<!--/build:page-links-->", p, flags=re.S)
        PROCESS.write_text(p, encoding="utf-8")
    print(f"{len(lanes)} prompts · {words} words · {ran_n} started → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
