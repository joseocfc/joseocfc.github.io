#!/usr/bin/env python3
"""List every served file that nothing on the site references.

Walks the site tree, collects every path-like token from the HTML, CSS, JS,
JSON and XML files, resolves each one (root-relative, page-relative or
https://joseocfc.github.io/...) and reports the files nobody points at.
A file only counts as referenced if the file pointing at it is itself live,
so a chain of orphans (an orphan JSON listing orphan images) is caught too.

Usage:  python3 tools/check_refs.py [site_root]
Exit 0 when every served file is referenced, 1 otherwise. Stdlib only.
"""
import os
import posixpath
import re
import sys

SITE_HOST = "https://joseocfc.github.io"

# Never scanned as candidates: repo plumbing, not part of the site.
SKIP_DIRS = {".git", ".github", "tools", "node_modules"}

# Served, but reached without a link from a page (crawlers, GitHub Pages itself).
# They still count as referrers, so whatever they point at is live.
ROOT_FILES = {
    "index.html",    # the home page, the entry point
    "README.md",     # repo documentation
    "robots.txt",    # fetched by crawlers at a fixed URL
    "sitemap.xml",   # named in robots.txt, fetched by crawlers
    ".nojekyll",     # GitHub Pages switch
    "404.html",      # GitHub Pages serves it for every missing URL
    "CNAME",         # GitHub Pages custom domain (none today)
}

# Files that are live on purpose although no page links to them.
# One line each, with the reason. Keep this list short.
ALLOWLIST = {
    # Internal reference page (every component on one page); kept out of the
    # navigation and the sitemap, and disallowed in robots.txt.
    "styleguide/index.html",
    # Internal reference page (every chart renderer with real data); same.
    "charts-demo.html",
    # Licence for the self-hosted fonts; ships beside the woff2 files the CSS
    # loads, as the OFL requires, and is not meant to be linked.
    "assets/fonts/LICENSE.txt",
}

# File types that can point at other files.
REFERRER_EXTS = {".html", ".css", ".js", ".json", ".xml", ".webmanifest"}

TOKEN = re.compile(r"[A-Za-z0-9_\-./%~:]+")

# Site convention (SPEC §6): <figure data-chart="name"> makes the chart runtime
# import assets/js/charts/<name>.js, a path no file spells out.
DATA_CHART = re.compile(r"""data-chart=["']([a-z0-9-]+)["']""")
CHART_MODULE = "assets/js/charts/{}.js"


def served_files(root):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        rel_dir = "" if rel_dir == "." else rel_dir.replace(os.sep, "/")
        top = rel_dir.split("/", 1)[0]
        if top in SKIP_DIRS:
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.startswith(".") and name not in ROOT_FILES:
                continue  # dotfiles: tool config (.gitignore, .htmlvalidate.json …)
            out.append(posixpath.join(rel_dir, name) if rel_dir else name)
    return sorted(out)


def resolve(token, referrer):
    """Turn a path-like token into a repo-relative path, or None."""
    if token.startswith(("http://", "https://")):
        if not token.startswith(SITE_HOST):
            return None
        token = token[len(SITE_HOST):] or "/"
    if ":" in token:
        return None  # mailto:, data:, other schemes, CSS pseudo-classes
    if token.startswith("/"):
        path = token
    else:
        path = posixpath.join("/", posixpath.dirname(referrer), token)
    if path.endswith("/"):
        path += "index.html"
    path = posixpath.normpath(path).lstrip("/")
    return path or None


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else
                           os.path.join(os.path.dirname(__file__), ".."))
    files = served_files(root)
    present = set(files)

    by_name = {}
    for f in files:
        by_name.setdefault(posixpath.basename(f), []).append(f)

    # For each referrer, the set of files it points at.
    edges = {}
    for f in files:
        if posixpath.splitext(f)[1] not in REFERRER_EXTS:
            continue
        with open(os.path.join(root, f), encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        targets = set()
        for tok in set(TOKEN.findall(text)):
            tok = tok.rstrip(".,:")
            if not tok:
                continue
            path = resolve(tok, f)
            if path in present:
                targets.add(path)
                continue
            if path and path + "/index.html" in present:
                targets.add(path + "/index.html")  # /about without the slash
                continue
            # Filename fallback, only when the name is unique in the tree.
            hits = by_name.get(posixpath.basename(tok), [])
            if len(hits) == 1 and "." in posixpath.basename(tok):
                targets.add(hits[0])
        for name in DATA_CHART.findall(text):
            if CHART_MODULE.format(name) in present:
                targets.add(CHART_MODULE.format(name))
        targets.discard(f)
        edges[f] = targets

    # Reachability from the files that are live without a link.
    live = {f for f in files if f in ROOT_FILES or f in ALLOWLIST}
    stack = list(live)
    while stack:
        for t in edges.get(stack.pop(), ()):
            if t not in live:
                live.add(t)
                stack.append(t)

    stale = sorted(a for a in ALLOWLIST if a not in present)
    orphans = [f for f in files if f not in live]

    for a in stale:
        print(f"allowlisted but missing: {a}")
    for o in orphans:
        print(f"unreferenced: {o}")
    if orphans or stale:
        print(f"\n{len(orphans)} unreferenced, {len(stale)} stale allowlist "
              f"entries, out of {len(files)} served files.")
        return 1
    print(f"OK: all {len(files)} served files are referenced.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
