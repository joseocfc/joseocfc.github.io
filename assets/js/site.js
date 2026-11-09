/* site.js — shell behaviour for every page (lane A1 "shell"). ES module, no dependencies.
 *
 *  1. Theme      — the inline <head> script stamps data-theme before paint; this module wires
 *                  every [data-theme-toggle], persists to localStorage('theme'), follows the OS
 *                  while the reader has not chosen, and dispatches `themechange` on document
 *                  (detail: { theme }) so charts re-render.
 *  2. Navigation — mobile disclosure (<768px), the "Work" dropdown, aria-current, scrolled header.
 *  3. Reveal     — .reveal elements fade/rise in on first intersection (no stagger). Stat
 *                  tiles are never hidden: their server-rendered numbers show with or without JS.
 *  4. TOC        — .toc links (href="#id") get aria-current="true" for the section in view.
 *  5. Links      — external links get rel="noopener".
 *
 *  Public helpers (import { theme } from '/assets/js/site.js'): theme.get(), theme.set('dark').
 */

const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const mobileMQ = matchMedia('(max-width: 767.98px)');
const reduced = () => reduceMQ.matches;

/* ---------------------------------------------------------------- 1. Theme */
const STORE = 'theme';
const stored = () => { try { const v = localStorage.getItem(STORE); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } };

export const theme = {
  get: () => root.dataset.theme || (darkMQ.matches ? 'dark' : 'light'),
  set(next, persist = true) {
    if (next !== 'light' && next !== 'dark') return;
    const changed = next !== root.dataset.theme;
    root.dataset.theme = next;
    if (persist) { try { localStorage.setItem(STORE, next); } catch { /* private mode */ } }
    syncToggles();
    syncThemeColor();
    if (changed) document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  },
};

function syncToggles() {
  const t = theme.get();
  const label = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  });
}

function syncThemeColor() {
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => paper && m.setAttribute('content', paper));
}

function initTheme() {
  if (!root.dataset.theme) root.dataset.theme = stored() || (darkMQ.matches ? 'dark' : 'light');
  syncToggles();
  syncThemeColor(); // F20: a stored choice that differs from the OS must reach the browser chrome on load, not only on toggle
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-toggle]');
    if (btn) theme.set(theme.get() === 'dark' ? 'light' : 'dark');
  });
  darkMQ.addEventListener('change', (e) => { if (!stored()) theme.set(e.matches ? 'dark' : 'light', false); });
  // Another tab changed the theme.
  addEventListener('storage', (e) => { if (e.key === STORE && (e.newValue === 'light' || e.newValue === 'dark')) theme.set(e.newValue, false); });
}

/* ----------------------------------------------------------- 2. Navigation */
function initNav() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('.site-nav');
  const trigger = header.querySelector('.site-nav__trigger');
  const menu = trigger && document.getElementById(trigger.getAttribute('aria-controls'));

  // aria-current from the URL (pages may also hardcode it).
  const here = normalise(location.pathname);
  header.querySelectorAll('.site-nav a[href]').forEach((a) => {
    const target = normalise(new URL(a.href, location.href).pathname);
    if (target === here) a.setAttribute('aria-current', 'page');
    // C1 QA: a sub-page (/process/prompts/) marks its section link, as /work/* pages mark the Work trigger.
    else if (target !== '/' && here.startsWith(target) && !a.closest('.site-nav__menu')) a.classList.add('is-current');
  });
  if (trigger && here.startsWith('/work/')) trigger.classList.add('is-current');

  // Mobile sheet.
  const setOpen = (open, { focus = false } = {}) => {
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.nav-toggle__label').textContent = open ? 'Close' : 'Menu';
    header.classList.toggle('is-open', open);
    root.classList.toggle('nav-open', open);
    if (nav) nav.inert = mobileMQ.matches && !open;
    if (!open && focus) toggle.focus();
  };
  toggle?.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  const onBreakpoint = () => { setOpen(false); closeMenu(); if (nav) nav.inert = mobileMQ.matches; };
  mobileMQ.addEventListener('change', onBreakpoint);
  if (nav) nav.inert = mobileMQ.matches;

  // Work dropdown (desktop disclosure).
  function closeMenu(focusTrigger = false) {
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'true') return;
    trigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger) trigger.focus();
  }
  trigger?.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!open));
  });
  trigger?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown') return;
    trigger.setAttribute('aria-expanded', 'true');
    menu?.querySelector('a')?.focus();
    e.preventDefault();
  });
  trigger?.parentElement.addEventListener('focusout', (e) => {
    if (!trigger.parentElement.contains(e.relatedTarget)) closeMenu();
  });
  document.addEventListener('click', (e) => { if (trigger && !trigger.parentElement.contains(e.target)) closeMenu(); });
  menu?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = [...menu.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus();
    e.preventDefault();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (header.classList.contains('is-open')) setOpen(false, { focus: true });
    else if (trigger?.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });

  // Hairline under the header once the page scrolls.
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { header.classList.toggle('is-scrolled', scrollY > 4); ticking = false; });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

const normalise = (p) => (p.replace(/index\.html$/, '').replace(/\/?$/, '/') || '/');

/* --------------------------------------------------------------- 3. Reveal */
function initReveal() {
  const all = [...document.querySelectorAll('.reveal')];
  if (!all.length) return;
  // Stat numbers render statically: never fade a tile that holds one.
  const isStat = (el) => el.matches('.stat-card, .stat-value') || el.querySelector('.stat-value');
  const els = all.filter((el) => !isStat(el));
  all.filter(isStat).forEach((el) => el.classList.add('is-visible'));
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-visible');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ 4. TOC */
function initToc() {
  const toc = document.querySelector('.toc');
  if (!toc || !('IntersectionObserver' in window)) return;
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const pairs = links
    .map((a) => ({ a, el: document.getElementById(decodeURIComponent(a.hash.slice(1))) }))
    .filter((p) => p.el);
  if (!pairs.length) return;
  const list = toc.querySelector('.toc__list') || toc;
  const visible = new Set();
  let current = null;

  const setCurrent = (pair) => {
    if (!pair || pair === current) return;
    current?.a.removeAttribute('aria-current');
    current?.a.classList.remove('is-current');
    pair.a.setAttribute('aria-current', 'true');
    pair.a.classList.add('is-current');
    current = pair;
    // Keep the active chip in view on the horizontal strip without moving the page.
    if (list.scrollWidth > list.clientWidth + 1) {
      const li = pair.a.closest('li') || pair.a;
      const pad = parseFloat(getComputedStyle(list).paddingLeft) || 0;
      const left = list.scrollLeft + li.getBoundingClientRect().left - list.getBoundingClientRect().left - pad;
      list.scrollTo({ left: Math.max(0, left), behavior: reduced() ? 'auto' : 'smooth' });
    }
  };

  const headerH = document.querySelector('.site-header')?.offsetHeight || 64;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    const first = pairs.find((p) => visible.has(p.el));
    if (first) setCurrent(first);
    else if (pairs[0].el.getBoundingClientRect().top > innerHeight * 0.5) {
      current?.a.removeAttribute('aria-current');
      current?.a.classList.remove('is-current');
      current = null;
      // C1 QA: back above the first section, return the chip strip to its start (it stayed on the last chip).
      if (list.scrollLeft > 0 && list.scrollWidth > list.clientWidth + 1) list.scrollTo({ left: 0, behavior: reduced() ? 'auto' : 'smooth' });
    }
  }, { rootMargin: `-${headerH + 56}px 0px -55% 0px`, threshold: 0 });
  pairs.forEach((p) => io.observe(p.el));
}

/* ---------------------------------------------------------------- 5. Links */
function initLinks() {
  document.querySelectorAll('a[href]').forEach((a) => {
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if (!/^https?:$/.test(url.protocol) || url.host === location.host) return;
    const rel = new Set((a.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    a.setAttribute('rel', [...rel].join(' '));
  });
}

/* ----------------------------------------------------------------- Boot */
function boot() {
  initTheme();
  initNav();
  initLinks();
  initReveal();
  initToc();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
