// main.js
/* eslint-disable */
(() => {
  'use strict';

  // Tiny utils
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const on = (el, evt, fn, opts) => el && el.addEventListener(evt, fn, opts);

  const nav = $('#mainNav');
  const progressBar = $('.navbar-progress-bar');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Viewport + navbar metrics (mobile 100vh fix + sticky offsets)
  function setMetrics() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    if (nav) document.documentElement.style.setProperty('--nav-h', `${nav.offsetHeight}px`);
  }
  setMetrics();
  on(window, 'resize', setMetrics);
  on(window, 'orientationchange', setMetrics);

  // Scroll handling (rAF = jank-free)
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(updateOnScroll);
      ticking = true;
    }
  }
  function updateOnScroll() {
    ticking = false;
    const y = window.pageYOffset || 0;

    if (nav) {
      if (y > 100) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    }

    if (progressBar) {
      const winH = window.innerHeight;
      const docH = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      const track = Math.max(1, docH - winH);
      const pct = Math.min(100, Math.max(0, (y / track) * 100));
      progressBar.style.width = pct + '%';
    }
  }
  on(window, 'scroll', onScroll, { passive: true });
  on(window, 'load', updateOnScroll);

  // Smooth scroll with fixed-header offset (delegated)
  function smoothScrollTo(target) {
    const offset = nav ? nav.offsetHeight : 0;
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#' || href.length < 2) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    smoothScrollTo(target);
    history.pushState(null, '', href);

    // Close mobile menu if open
    const collapse = $('#navbarNav');
    if (collapse && collapse.classList.contains('show') && window.bootstrap) {
      new bootstrap.Collapse(collapse).hide();
    }
  });

  // Close mobile menu on link click (Bootstrap API)
  const collapseEl = $('#navbarNav');
  let bsCollapse;
  if (collapseEl && window.bootstrap) {
    bsCollapse = new bootstrap.Collapse(collapseEl, { toggle: false });
    $$('#mainNav .nav-link').forEach((link) =>
      on(link, 'click', () => {
        if (collapseEl.classList.contains('show')) bsCollapse.hide();
      })
    );
  }

  // Path-based active nav (multi-page)
  function highlightPath() {
    const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    $$('#mainNav .nav-link').forEach((link) => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      const match = href && href.endsWith(current);
      link.classList.toggle('active', match);
      link.setAttribute('aria-current', match ? 'page' : 'false');
    });
  }
  highlightPath();

  // Section-based ScrollSpy (only where nav links target page sections)
  const sections = $$('section[id]');
  if (sections.length) {
    const map = new Map();
    $$('#mainNav .nav-link[href^="#"]').forEach((l) => {
      const id = l.getAttribute('href').slice(1);
      if (id) map.set(id, l);
    });
    if (map.size && 'IntersectionObserver' in window) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const id = entry.target.id;
            const link = map.get(id);
            if (!link) return;
            if (entry.isIntersecting) {
              map.forEach((lnk) => lnk.classList.remove('active'));
              link.classList.add('active');
            }
          });
        },
        { rootMargin: '-50% 0px -50% 0px', threshold: 0.01 }
      );
      sections.forEach((s) => spy.observe(s));
    }
  }

  // Lazy loading polyfill for [data-src] / [data-srcset]
  if ('IntersectionObserver' in window) {
    const lazyNodes = $$('img[data-src], source[data-srcset]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.tagName === 'IMG' && el.dataset.src) el.src = el.dataset.src;
          if (el.dataset.srcset) el.srcset = el.dataset.srcset;
          el.removeAttribute('data-src');
          el.removeAttribute('data-srcset');
          el.classList.add('is-loaded');
          io.unobserve(el);
        });
      },
      { rootMargin: '200px 0px' }
    );
    lazyNodes.forEach((n) => io.observe(n));
  }

  // AOS init if present (respect reduced motion)
  if (window.AOS) {
    AOS.init({
      duration: 800,
      once: true,
      disable: () => reduceMotion
    });
  }

  // Notification system (ARIA live) — call window.showNotification(msg, 'success'|'error'|'info')
  const notifyContainer = document.createElement('div');
  notifyContainer.className = 'notify-container';
  notifyContainer.setAttribute('aria-live', 'polite');
  notifyContainer.setAttribute('aria-atomic', 'true');
  document.body.appendChild(notifyContainer);

  function notify(message, { type = 'info', duration = 4000 } = {}) {
    const n = document.createElement('div');
    n.className = `notify notify-${type}`;
    n.innerHTML = `
      <span class="notify-icon">${
        type === 'success' ? '✔' : type === 'error' ? '⚠' : 'ℹ'
      }</span>
      <span class="notify-text">${message}</span>
      <button class="notify-close" aria-label="Close">×</button>
    `;
    notifyContainer.appendChild(n);
    requestAnimationFrame(() => n.classList.add('show'));
    const close = () => {
      n.classList.remove('show');
      setTimeout(() => n.remove(), 250);
    };
    n.querySelector('.notify-close').addEventListener('click', close);
    if (duration > 0) setTimeout(close, duration);
  }
  window.showNotification = (msg, type = 'info') => notify(msg, { type });

  // Reservation form (homepage) — quick inline validation
  const reservationForm = document.querySelector('.reservation-section form');
  if (reservationForm) {
    reservationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = reservationForm.querySelector('input[type="text"]')?.value.trim();
      const email = reservationForm.querySelector('input[type="email"]')?.value.trim();
      const date = reservationForm.querySelector('input[type="date"]')?.value;
      const time = reservationForm.querySelector('input[type="time"]')?.value;
      if (!name || !email || !date || !time) {
        notify('Please fill in all required fields.', { type: 'error' });
        return;
      }
      notify('Reservation request sent. We’ll confirm by email.', { type: 'success' });
      reservationForm.reset();
    });
  }

  // Counters — any element with data-count="1234" (optional data-duration, data-decimals)
  const counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const fmt = (n, d = 0) =>
      d ? n.toFixed(d) : Math.round(n).toLocaleString();

    const co = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseFloat(el.dataset.count || '0');
          const dur = parseInt(el.dataset.duration || '1500', 10);
          const dec = parseInt(el.dataset.decimals || '0', 10);
          const start = performance.now();

          function tick(now) {
            const p = Math.min(1, (now - start) / dur);
            const val = target * easeOutCubic(p);
            el.textContent = fmt(val, dec);
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          obs.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => co.observe(el));
  }

  // Gallery filters — works with .filter-chip and .gallery-card[data-category]
  const chips = $$('.filter-chip');
  const cards = $$('.gallery-card');
  const resultsCount = $('#resultsCount');
  function setFilter(key) {
    let shown = 0;
    cards.forEach((card) => {
      const cats = (card.dataset.category || '').toLowerCase().split(/\s+/);
      const show = key === 'all' || cats.includes(key);
      card.classList.toggle('is-hidden', !show);
      if (show) shown++;
    });
    if (resultsCount) resultsCount.textContent = shown;
    const active = document.querySelector('.filter-chip.active');
    active?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    const url = new URL(window.location);
    url.searchParams.set('filter', key);
    history.replaceState(null, '', url);
  }
  if (chips.length && cards.length) {
    chips.forEach((btn) =>
      btn.addEventListener('click', () => {
        document.querySelector('.filter-chip.active')?.classList.remove('active');
        chips.forEach((c) => c.setAttribute('aria-selected', 'false'));
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        setFilter(btn.dataset.filter || 'all');
      })
    );
    const initial = new URL(window.location).searchParams.get('filter') || 'all';
    const initChip =
      document.querySelector(`.filter-chip[data-filter="${initial}"]`) ||
      document.querySelector('.filter-chip.active');
    if (initChip) {
      initChip.classList.add('active');
      initChip.setAttribute('aria-selected', 'true');
      setFilter(initChip.dataset.filter || 'all');
    } else {
      setFilter('all');
    }
  }

  // Lightbox — prefer GLightbox, else provide a simple fallback
  if (window.GLightbox) {
    GLightbox({ selector: '.glightbox', touchNavigation: true, loop: true });
  } else {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.gallery-card a, .gallery-item');
      if (!link) return;
      e.preventDefault();
      const img = link.querySelector('img');
      const src = img?.getAttribute('src') || img?.getAttribute('data-src');
      if (!src) return;
      openSimpleLightbox(src, img.alt || 'Image');
    });

    function openSimpleLightbox(src, alt = '') {
      const overlay = document.createElement('div');
      overlay.className = 'simple-lightbox';
      overlay.innerHTML = `
        <div class="slb-content" role="dialog" aria-modal="true" aria-label="${alt}">
          <img src="${src}" alt="${alt}">
          <button class="slb-close" aria-label="Close">×</button>
        </div>`;
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      const close = () => {
        overlay.classList.add('hide');
        setTimeout(() => { overlay.remove(); document.body.style.overflow = ''; }, 200);
        document.removeEventListener('keydown', onKey);
      };
      const onKey = (ev) => { if (ev.key === 'Escape') close(); };
      on(overlay, 'click', (ev) => { if (ev.target === overlay || ev.target.classList.contains('slb-close')) close(); });
      on(document, 'keydown', onKey);
      requestAnimationFrame(() => overlay.classList.add('show'));
    }
  }

  // Subtle page-fade transition for internal navigation (surprise & delight)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    const sameOrigin = url.origin === window.location.origin;
    const samePageHash = url.pathname === window.location.pathname && url.hash && url.hash.startsWith('#');
    const external = link.hasAttribute('target') || !sameOrigin;
    if (external || samePageHash) return;
    document.body.classList.add('page-leave');
  });
})();