/*
 * Live consulting tally for the persona slides (22 Jamie / 23 Ryan).
 * Each slide sets window.CONSULTING_TALLY = { key, persona } before loading this.
 * Polls /api/live-session/tally and renders an icon scoreboard of the room's
 * picks in the slide's open bottom area. Icons mirror the companion exactly.
 */
(function () {
  var cfg = window.CONSULTING_TALLY || {};
  var key = cfg.key;
  var persona = cfg.persona || 'this driver';
  if (!key) return;

  var params = new URLSearchParams(window.location.search);
  // The projected slide may not carry ?room= when navigated through the deck —
  // deck-controls resolves the live room (URL / sessionStorage / generated) and
  // exposes it as window.DeckLive.room. Prefer that, fall back to the URL param.
  function getRoom() {
    var p = params.get('room');
    if (p && p.trim()) return p.trim();
    if (window.DeckLive && typeof window.DeckLive.room === 'string' && window.DeckLive.room.trim()) {
      return window.DeckLive.room.trim();
    }
    return '';
  }

  // slug -> { icon (Material Symbol), label } — same set/order as the companion.
  var ORDER = ['scc-stopgo', 'hda', 'lfa', 'fca', 'bvm', 'bca', 'rcca', 'svm', 'pdw', 'rspa', 'hba', 'faw'];
  var META = {
    'scc-stopgo': { icon: 'speed', label: 'Smart Cruise' },
    'hda': { icon: 'directions_car', label: 'Highway Assist' },
    'lfa': { icon: 'road', label: 'Lane Following' },
    'fca': { icon: 'warning', label: 'Fwd Collision' },
    'bvm': { icon: 'visibility', label: 'Blind-Spot View' },
    'bca': { icon: 'sensors', label: 'Blind-Spot Avoid' },
    'rcca': { icon: 'minor_crash', label: 'Rear Cross-Traffic' },
    'svm': { icon: 'panorama', label: 'Surround View' },
    'pdw': { icon: 'local_parking', label: 'Parking Warning' },
    'rspa': { icon: 'open_with', label: 'Remote Parking' },
    'hba': { icon: 'nights_stay', label: 'High Beam' },
    'faw': { icon: 'face', label: 'Attention Warn' }
  };

  function injectOnce(id, build) {
    if (document.getElementById(id)) return;
    build();
  }
  injectOnce('ctally-font', function () {
    var l = document.createElement('link'); l.id = 'ctally-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&family=Sora:wght@400;600;700;800&display=swap';
    document.head.appendChild(l);
  });
  injectOnce('ctally-style', function () {
    var s = document.createElement('style'); s.id = 'ctally-style';
    s.textContent =
      '.ctally{position:absolute;left:37%;right:3.4%;bottom:7%;height:14%;display:flex;flex-direction:column;gap:.35vw;pointer-events:none;font-family:Sora,system-ui,sans-serif;z-index:5}' +
      '.ctally-head{display:flex;align-items:center;justify-content:flex-end;gap:.55vw}' +
      '.ctally-dot{width:.5vw;height:.5vw;border-radius:50%;background:#38bdf8;box-shadow:0 0 0 .16vw rgba(56,189,248,.25)}' +
      '.ctally-title{font-size:.82vw;font-weight:800;color:#0b1320;letter-spacing:.04em;text-transform:uppercase}' +
      '.ctally-sub{font-size:.78vw;font-weight:600;color:#5b6b7d}' +
      '.ctally-grid{flex:1;display:flex;gap:.45vw;align-items:stretch;min-height:0}' +
      '.ctally-cell{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:.1vw;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:.5vw;padding:.35vw .12vw .3vw;position:relative;overflow:hidden;transition:border-color .3s,background .3s,box-shadow .3s,opacity .3s}' +
      '.ctally-cell .fill{position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(56,189,248,.18);transition:height .45s ease}' +
      '.ctally-cell .ic{position:relative;font-size:1.35vw;color:#1a2330;line-height:1}' +
      '.ctally-cell .n{position:relative;font-size:1.15vw;font-weight:800;color:#0b1320;line-height:1}' +
      '.ctally-cell .lb{position:relative;font-size:.55vw;font-weight:600;color:#64748b;text-align:center;line-height:1.05;height:1.3vw;display:flex;align-items:center}' +
      '.ctally-cell.lead{border-color:#38bdf8;background:#eaf7ff;box-shadow:0 .2vw .7vw rgba(56,189,248,.28)}' +
      '.ctally-cell.lead .ic,.ctally-cell.lead .n{color:#0284c7}' +
      '.ctally-cell.zero{opacity:.4}';
    document.head.appendChild(s);
  });

  var slide = document.querySelector('.slide') || document.body;
  var panel = document.createElement('div');
  panel.className = 'ctally';
  panel.innerHTML =
    '<div class="ctally-head"><span class="ctally-dot"></span>' +
    '<span class="ctally-title">Room picks for ' + persona + '</span>' +
    '<span class="ctally-sub" data-sub>Waiting for responses…</span></div>' +
    '<div class="ctally-grid" data-grid></div>';
  slide.appendChild(panel);

  var grid = panel.querySelector('[data-grid]');
  var sub = panel.querySelector('[data-sub]');
  var cells = {};
  ORDER.forEach(function (slug) {
    var m = META[slug];
    var cell = document.createElement('div');
    cell.className = 'ctally-cell zero';
    cell.innerHTML =
      '<div class="fill"></div>' +
      '<span class="material-symbols-outlined ic">' + m.icon + '</span>' +
      '<span class="n">0</span>' +
      '<span class="lb">' + m.label + '</span>';
    grid.appendChild(cell);
    cells[slug] = { el: cell, fill: cell.querySelector('.fill'), n: cell.querySelector('.n') };
  });

  function render(data) {
    var counts = (data && data.counts) || {};
    var max = 0;
    ORDER.forEach(function (slug) { if ((counts[slug] || 0) > max) max = counts[slug] || 0; });
    ORDER.forEach(function (slug) {
      var c = cells[slug];
      var n = counts[slug] || 0;
      c.n.textContent = n;
      c.fill.style.height = max > 0 ? Math.round((n / max) * 100) + '%' : '0%';
      c.el.classList.toggle('zero', n === 0);
      c.el.classList.toggle('lead', max > 0 && n === max);
    });
    var respondents = (data && data.respondents) || 0;
    sub.textContent = respondents > 0
      ? respondents + (respondents === 1 ? ' person responding' : ' people responding')
      : 'Waiting for responses…';
  }

  function poll() {
    var room = getRoom();
    if (!room) return; // room not resolved yet — keep the panel, try again next tick
    fetch('/api/live-session/tally?room=' + encodeURIComponent(room) + '&key=' + encodeURIComponent(key), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) render(d); })
      .catch(function () {});
  }
  poll();
  setInterval(poll, 3000);
})();
