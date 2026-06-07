(function () {
  // Shared behavior for single-file "carousel" decks whose slides live in an
  // in-page array (a thumbnail filmstrip + a slide counter). Loaded AFTER
  // deck-controls.js. No-op for normal page-per-slide decks (no thumbnails).
  function thumbList() {
    return Array.prototype.slice
      .call(document.querySelectorAll('[data-i]'))
      .filter(function (el) { return el.dataset && el.dataset.i != null; })
      .sort(function (a, b) {
        return (parseInt(a.dataset.i, 10) || 0) - (parseInt(b.dataset.i, 10) || 0);
      });
  }

  var list = thumbList();
  if (list.length < 2) return; // Not an in-page carousel — nothing to enhance.

  document.body.classList.add('has-inpage-deck');

  var embedded = new URLSearchParams(window.location.search).get('embedded') === '1';

  function currentIndex() {
    var active = document.querySelector('.thumb.active, [data-i].active');
    if (active && active.dataset && active.dataset.i != null) {
      return parseInt(active.dataset.i, 10) || 0;
    }
    var cur = document.getElementById('cur');
    if (cur) {
      var n = parseInt(cur.textContent, 10);
      if (isFinite(n) && n > 0) return n - 1;
    }
    return 0;
  }

  function currentStep() { return 'slide' + (currentIndex() + 1); }

  function goTo(index) {
    var bounded = Math.max(0, Math.min(list.length - 1, index));
    var thumb = list[bounded];
    if (thumb) thumb.click(); // Triggers the deck's own show() handler.
  }

  function pushStep() {
    if (typeof window.pushToAudience === 'function') {
      try { window.pushToAudience(currentStep()); } catch (e) { /* ignore */ }
    }
  }

  // --- Hide/show slide-strip toggle (lower-left, above the carousel) ---
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'strip-toggle';
  toggle.textContent = '▼';
  toggle.title = 'Hide slide strip';
  toggle.setAttribute('aria-label', 'Hide slide strip');
  function syncToggle() {
    var hidden = document.body.classList.contains('strip-hidden');
    toggle.textContent = hidden ? '▲' : '▼';
    toggle.title = hidden ? 'Show slide strip' : 'Hide slide strip';
    toggle.setAttribute('aria-label', toggle.title);
  }
  toggle.addEventListener('click', function () {
    document.body.classList.toggle('strip-hidden');
    syncToggle();
  });
  document.body.appendChild(toggle);
  syncToggle();

  // --- ?slide=N deep-link (used by the builder preview & launch) ---
  var slideParam = parseInt(new URLSearchParams(window.location.search).get('slide') || '', 10);
  if (isFinite(slideParam) && slideParam > 0) {
    // Defer so the deck's own init (e.g. show(0)) runs first.
    setTimeout(function () { goTo(slideParam - 1); }, 30);
  }

  // --- Wire shared deck-controls PREV/NEXT (pills + edge zones) to in-page nav ---
  function wireDeckControls() {
    var dn = document.querySelector('.deck-nav');
    var prevBtn = dn && dn.querySelector('[data-action="prev"]');
    var nextBtn = dn && dn.querySelector('[data-action="next"]');
    var prevZone = document.querySelector('.deck-clickzone--prev');
    var nextZone = document.querySelector('.deck-clickzone--next');
    if (!prevBtn || !nextBtn) return false;

    function bind(el, delta) {
      if (!el) return;
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation(); // Block deck-controls' file-based handler.
        goTo(currentIndex() + delta);
      }, true);
    }
    bind(prevBtn, -1);
    bind(nextBtn, 1);
    bind(prevZone, -1);
    bind(nextZone, 1);

    // deck-controls disables these for single-file decks; keep them live.
    function keepEnabled() {
      [prevBtn, nextBtn, prevZone, nextZone].forEach(function (el) {
        if (el) el.disabled = false;
      });
    }
    keepEnabled();
    new MutationObserver(keepEnabled).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    });
    return true;
  }

  // --- Sync the live-session step to the in-page slide so the audience companion follows ---
  function watchStep() {
    var cur = document.getElementById('cur');
    if (cur) {
      new MutationObserver(pushStep).observe(cur, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
    var strip = document.getElementById('strip') || document.querySelector('.filmstrip');
    if (strip) {
      new MutationObserver(pushStep).observe(strip, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class'],
      });
    }
  }

  function init() {
    if (embedded) return; // Builder preview: only the ?slide deep-link matters.
    if (!wireDeckControls()) {
      var tries = 0;
      var iv = setInterval(function () {
        if (wireDeckControls() || ++tries > 30) clearInterval(iv);
      }, 100);
    }
    watchStep();
    // Best-effort initial sync once deck-controls has injected pushToAudience.
    setTimeout(pushStep, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
