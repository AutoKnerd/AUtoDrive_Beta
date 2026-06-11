(function () {
  // Shared audience companion kit. Gives every audience member a stable identity
  // (same-origin localStorage, shared across all companion pages + the audience
  // view) and links every submission — roster enrollment and question answers —
  // to that identity, so the presenter can recall an individual's session later.
  const params = new URLSearchParams(window.location.search);
  const UID_KEY = 'autodrive-audience-uid';

  function uid() {
    try {
      let value = window.localStorage.getItem(UID_KEY);
      if (!value) {
        value = 'aud-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        window.localStorage.setItem(UID_KEY, value);
      }
      return value;
    } catch {
      return 'aud-' + Math.random().toString(36).slice(2, 10);
    }
  }

  const session = {
    sessionToken: params.get('sessionToken') || '',
    deckId: params.get('deckId') || '',
    room: params.get('room') || '',
    currentStep: params.get('currentStep') || '',
    currentSlide: params.get('currentSlide') || '',
  };

  async function submitRoster(data) {
    return fetch('/api/live-session/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: uid(),
        name: (data && data.name) || '',
        dealerCode: (data && data.dealerCode) || '',
        kuid: (data && data.kuid) || '',
        agreed: !!(data && data.agreed),
        sessionToken: session.sessionToken,
        deckId: session.deckId,
        room: session.room,
        slideStep: session.currentStep,
      }),
    });
  }

  async function submitAnswer(responseKey, answer, answerLabel) {
    return fetch('/api/live-session/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: uid(),
        slideId: session.currentStep || responseKey || 'response',
        responseKey: responseKey || session.currentStep || 'response',
        answer: String(answer),
        answerLabel: answerLabel || String(answer),
        selectedValue: answer,
        sessionToken: session.sessionToken,
        deckId: session.deckId,
        slideStep: session.currentStep,
        currentSlide: session.currentSlide,
      }),
    });
  }

  window.AudienceKit = { uid, session, submitRoster, submitAnswer };

  // --- Auto-wire a roster/enrollment form (name + dealer + kuid + a button) ---
  // Works even if the button has no explicit id, so re-imported Stitch forms
  // keep working: prefer #initSessionBtn, else find the form's submit button.
  function findEnrollButton(nameEl) {
    const byId = document.getElementById('initSessionBtn');
    if (byId) return byId;
    const form = nameEl.closest('form');
    const scope = form || document;
    const buttons = Array.prototype.slice.call(scope.querySelectorAll('button'));
    if (buttons.length === 0) return null;
    const labelled = buttons.find((b) => /initiali[sz]e|lock\s*in|enroll|join|sign\s*in|get\s*started|start|submit|confirm|begin/i.test(b.textContent || ''));
    return labelled || buttons[buttons.length - 1];
  }

  function wireRoster() {
    const nameEl = document.getElementById('full_name');
    if (!nameEl) return;
    const btn = findEnrollButton(nameEl);
    if (!btn || btn.dataset.akWired) return;
    btn.dataset.akWired = '1';
    if (btn.type !== 'submit') btn.type = 'button';
    let statusEl = document.getElementById('rosterStatus');
    if (!statusEl) {
      statusEl = document.createElement('p');
      statusEl.id = 'rosterStatus';
      statusEl.style.cssText = 'text-align:center;font-size:12px;min-height:18px;margin-top:8px;';
      (btn.parentElement || nameEl.parentElement || document.body).appendChild(statusEl);
    }
    const setStatus = (msg, ok) => { if (statusEl) { statusEl.textContent = msg; statusEl.style.color = ok ? '#8eff71' : '#ffb4ab'; } };
    btn.addEventListener('click', async () => {
      const name = (nameEl.value || '').trim();
      if (!name) { setStatus('Enter your full name first.', false); return; }
      btn.disabled = true; setStatus('Joining…', true);
      try {
        const res = await submitRoster({
          name,
          dealerCode: (document.getElementById('dealer_code') || {}).value || '',
          kuid: (document.getElementById('kuid') || {}).value || '',
          agreed: !!(document.getElementById('terms') || {}).checked,
        });
        if (!res.ok) throw new Error('failed');
        setStatus("You're on the roster. Welcome, " + name.split(' ')[0] + '!', true);
        btn.textContent = 'SESSION INITIALIZED';
      } catch (e) {
        btn.disabled = false; setStatus('Could not join. Try again.', false);
      }
    });
  }

  // --- Auto-wire answer choices: any element with [data-ak-answer] submits it. ---
  // Optional [data-ak-key] (on the element or an ancestor) sets the responseKey;
  // [data-ak-label] overrides the stored label; siblings in the same
  // [data-ak-group] get an "ak-selected" class toggled for single-choice UX.
  function wireAnswers() {
    document.querySelectorAll('[data-ak-answer]').forEach((el) => {
      if (el.dataset.akWired) return;
      el.dataset.akWired = '1';
      el.addEventListener('click', async () => {
        const keyHost = el.closest('[data-ak-key]');
        const responseKey = el.getAttribute('data-ak-key') || (keyHost && keyHost.getAttribute('data-ak-key')) || session.currentStep;
        const answer = el.getAttribute('data-ak-answer');
        const label = el.getAttribute('data-ak-label') || (el.textContent || '').trim();
        const group = el.closest('[data-ak-group]');
        if (group) group.querySelectorAll('[data-ak-answer]').forEach((s) => s.classList.toggle('ak-selected', s === el));
        else el.classList.add('ak-selected');
        try { await submitAnswer(responseKey, answer, label); } catch (e) { /* keep UI responsive */ }
      });
    });
  }

  // --- Deploy-on-demand 3D model overlay -----------------------------------
  // Every companion subscribes to the live session. When the presenter taps
  // "Deploy Model" on the remote (state.modelDeployed), a full-screen 3D model
  // pops over whatever the companion is showing; "Hide Model" removes it and the
  // slide content returns. The presenter's sensor taps (state.spotlight) rotate
  // the model + highlight the sensor. model-viewer + the model load lazily on
  // the first deploy, so companions that never use it pay nothing.
  function injectOverlayStyle() {
    if (document.getElementById('ak-model-style')) return;
    var s = document.createElement('style');
    s.id = 'ak-model-style';
    s.textContent =
      '.ak-model-overlay{position:fixed;inset:0;z-index:99999;background:radial-gradient(circle at 50% 35%,#11161f,#070a0e);' +
      'display:none;flex-direction:column;padding:16px;font-family:Sora,system-ui,sans-serif;color:#e6e9ee}' +
      '.ak-model-overlay.show{display:flex}' +
      // When deployed inside the auto-resizing audience shell, collapse the slide
      // content behind the overlay so the iframe shrinks to the car (no long page).
      'html.ak-model-on{overflow:hidden}' +
      'html.ak-model-on body{margin:0!important;min-height:0!important;height:auto!important;overflow:hidden;background:#070a0e}' +
      'html.ak-model-on body>*:not(.ak-model-overlay){display:none!important}' +
      'html.ak-model-on .ak-model-overlay{position:relative;inset:auto;min-height:500px;height:auto;z-index:1}' +
      '.ak-mo-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
      '.ak-mo-eyebrow{color:#38bdf8;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}' +
      '.ak-mo-follow{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;cursor:pointer;user-select:none}' +
      '.ak-mo-toggle{width:40px;height:22px;border-radius:999px;background:#38bdf8;position:relative;flex:none}' +
      '.ak-mo-toggle.off{background:#3a4452}' +
      '.ak-mo-toggle::after{content:"";position:absolute;top:3px;left:21px;width:16px;height:16px;border-radius:50%;background:#04222f;transition:left .2s}' +
      '.ak-mo-toggle.off::after{left:3px;background:#aeb6c2}' +
      '.ak-mo-mv{flex:none;width:100%;aspect-ratio:3/4;max-height:min(78vh,620px);min-height:340px;background:transparent;--poster-color:transparent}' +
      // Sensor markers stay laid out (so model-viewer positions all of them) but
      // are invisible until the presenter spotlights a sensor; only the active one
      // fades in, with a small label + description chip beside its dot.
      // Gate with visibility (not opacity): model-viewer sets inline opacity on
      // front-facing hotspots, which would override an opacity-based hide.
      '.ak-hs{position:relative;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:#38bdf8;box-shadow:0 0 16px rgba(56,189,248,.9);cursor:pointer;visibility:hidden;pointer-events:none}' +
      '.ak-hs.active{visibility:visible;pointer-events:auto;animation:ak-hs-pulse 1.6s ease-out infinite}' +
      '@keyframes ak-hs-pulse{0%{box-shadow:0 0 0 0 rgba(56,189,248,.5),0 0 16px rgba(56,189,248,.9)}70%{box-shadow:0 0 0 13px rgba(56,189,248,0),0 0 16px rgba(56,189,248,.9)}100%{box-shadow:0 0 0 0 rgba(56,189,248,0),0 0 16px rgba(56,189,248,.9)}}' +
      '.ak-hs .ak-hs-tag{position:absolute;left:24px;top:50%;transform:translateY(-50%);display:none;flex-direction:column;gap:1px;padding:6px 9px;border-radius:10px;background:rgba(8,12,18,.92);border:1px solid rgba(56,189,248,.4);box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:none}' +
      '.ak-hs.active .ak-hs-tag{display:flex}' +
      '.ak-hs-tag-label{font-size:11px;font-weight:700;color:#38bdf8;letter-spacing:.02em;white-space:nowrap}' +
      '.ak-hs-tag-desc{font-size:10px;line-height:1.25;color:#aab6c6;max-width:150px}' +
      // Flip the label chip to the left of the dot when the sensor is near the
      // right edge, so it never gets clipped off the canvas.
      '.ak-hs.ak-tag-left .ak-hs-tag{left:auto;right:24px;align-items:flex-end;text-align:right}' +
      '.ak-mo-banner{background:rgba(10,13,18,.82);border:1px solid rgba(56,189,248,.35);border-radius:14px;padding:12px 14px;opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}' +
      '.ak-mo-banner.show{opacity:1;transform:translateY(0)}' +
      '.ak-mo-label{font-size:16px;font-weight:700;color:#38bdf8}.ak-mo-feature{font-size:12px;color:#93a1b3;margin-top:2px}' +
      '.ak-mo-wait{flex:1;display:flex;align-items:center;justify-content:center;color:#93a1b3;font-size:14px}';
    document.head.appendChild(s);
  }

  function roomFromAncestors() {
    // When this companion is iframed inside the audience shell, its own URL may
    // lack ?room= (older tab / pre-fix link). The shell's URL always has it, and
    // we're same-origin, so read it from the parent/top frame as a fallback.
    var frames = [];
    try { if (window.parent && window.parent !== window) frames.push(window.parent); } catch (e) {}
    try { if (window.top && window.top !== window) frames.push(window.top); } catch (e) {}
    for (var i = 0; i < frames.length; i++) {
      try {
        var r = new URLSearchParams(frames[i].location.search).get('room');
        if (r && r.trim()) return r.trim();
      } catch (e) {}
    }
    try {
      if (document.referrer) {
        var rr = new URL(document.referrer).searchParams.get('room');
        if (rr && rr.trim()) return rr.trim();
      }
    } catch (e) {}
    return '';
  }

  function wireModelOverlay() {
    var room = session.room || params.get('room') || roomFromAncestors() || '';
    var deckId = session.deckId || params.get('deckId') || '';
    if (!room) return;
    var overlay = null, mv = null, banner = null, hotspots = {}, defaultOrbit = '0deg 75deg auto';
    var built = false, follow = true, deployed = false, currentSpotlight = null;

    // Inside the audience shell the iframe auto-sizes to the companion's content
    // height. While the model is deployed the slide content is hidden, so we tell
    // the shell the overlay's height directly (the html element can't shrink below
    // the iframe viewport on its own — classic auto-resize feedback loop).
    function postModelHeight(h) {
      try { if (window.parent && window.parent !== window) window.parent.postMessage({ source: 'autodrive-companion', type: 'model-height', height: h }, '*'); } catch (e) {}
    }
    function reportHeight() {
      if (!deployed) return;
      var h = overlay ? Math.ceil(overlay.scrollHeight) : 500;
      postModelHeight(Math.max(h, 480));
    }

    function ensureScript() {
      if (document.querySelector('script[data-ak-mv]')) return;
      var sc = document.createElement('script');
      sc.type = 'module'; sc.setAttribute('data-ak-mv', '1');
      sc.src = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
      document.head.appendChild(sc);
    }
    function setFollow(on) { follow = on; var t = overlay && overlay.querySelector('.ak-mo-toggle'); if (t) t.classList.toggle('off', !on); }
    // Keep the active sensor's label chip from being clipped: if the dot is in the
    // right portion of the canvas, flip the chip to the dot's left.
    function positionActiveTag() {
      if (!overlay || !mv) return;
      var a = overlay.querySelector('.ak-hs.active'); if (!a) return;
      var dr = a.getBoundingClientRect(), mr = mv.getBoundingClientRect();
      if (!mr.width || !dr.width) return;
      var ratio = (dr.left + dr.width / 2 - mr.left) / mr.width;
      a.classList.toggle('ak-tag-left', ratio > 0.52);
    }
    // force=true => presenter-driven spotlight: snap the camera to the sensor even
    // if this viewer turned "Follow presenter" off (re-engages a distracted user).
    function applySpotlight(id, force) {
      currentSpotlight = id;
      if (!overlay) return;
      Object.keys(hotspots).forEach(function (hid) { var el = overlay.querySelector('[slot="hotspot-' + hid + '"]'); if (el) el.classList.toggle('active', hid === id); });
      var h = hotspots[id];
      if (!h) { if (banner) banner.classList.remove('show'); reportHeight(); return; }
      if ((follow || force) && mv) mv.setAttribute('camera-orbit', h.cameraOrbit || defaultOrbit);
      overlay.querySelector('.ak-mo-label').textContent = h.label || '';
      overlay.querySelector('.ak-mo-feature').textContent = h.feature || '';
      if (banner) banner.classList.add('show');
      reportHeight();
      positionActiveTag();
      setTimeout(positionActiveTag, 350);
      setTimeout(positionActiveTag, 750);
    }
    function build() {
      if (built) return; built = true;
      injectOverlayStyle(); ensureScript();
      overlay = document.createElement('div');
      overlay.className = 'ak-model-overlay';
      overlay.innerHTML =
        '<div class="ak-mo-head"><span class="ak-mo-eyebrow">3D Model · Live</span>' +
        '<span class="ak-mo-follow"><span class="ak-mo-toggle"></span> Follow presenter</span></div>' +
        '<model-viewer class="ak-mo-mv" camera-controls touch-action="pan-y" interaction-prompt="none" loading="eager" reveal="auto" shadow-intensity="1" exposure="1.1"></model-viewer>' +
        '<div class="ak-mo-banner"><div class="ak-mo-label"></div><div class="ak-mo-feature"></div></div>';
      document.body.appendChild(overlay);
      mv = overlay.querySelector('model-viewer');
      banner = overlay.querySelector('.ak-mo-banner');
      mv.addEventListener('camera-change', positionActiveTag);
      overlay.querySelector('.ak-mo-follow').addEventListener('click', function () { setFollow(!follow); if (follow && currentSpotlight) applySpotlight(currentSpotlight); });
      fetch('/Presentations/' + deckId + '/model-hotspots.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); }).then(function (cfg) {
          defaultOrbit = cfg.defaultOrbit || defaultOrbit;
          mv.setAttribute('src', cfg.model);
          mv.setAttribute('camera-orbit', defaultOrbit);
          (cfg.hotspots || []).forEach(function (h) {
            hotspots[h.id] = h;
            var b = document.createElement('button'); b.className = 'ak-hs'; b.setAttribute('slot', 'hotspot-' + h.id);
            b.setAttribute('data-position', h.position || '0 0 0'); b.setAttribute('data-normal', '0 1 0'); b.title = h.label;
            var tag = document.createElement('span'); tag.className = 'ak-hs-tag';
            var tl = document.createElement('span'); tl.className = 'ak-hs-tag-label'; tl.textContent = h.label || '';
            tag.appendChild(tl);
            var descText = h.desc || h.feature;
            if (descText) { var td = document.createElement('span'); td.className = 'ak-hs-tag-desc'; td.textContent = descText; tag.appendChild(td); }
            b.appendChild(tag);
            b.addEventListener('click', function () { setFollow(false); applySpotlight(h.id, true); });
            mv.appendChild(b);
          });
          if (currentSpotlight) applySpotlight(currentSpotlight, true);
        }).catch(function () {});
    }
    function setDeployed(on) {
      deployed = on;
      var de = document.documentElement;
      if (on) { build(); if (overlay) overlay.classList.add('show'); de.classList.add('ak-model-on'); reportHeight(); setTimeout(reportHeight, 350); setTimeout(reportHeight, 1200); }
      else { de.classList.remove('ak-model-on'); if (overlay) overlay.classList.remove('show'); }
    }
    function apply(st) {
      if (!st) return;
      if (!!st.modelDeployed !== deployed) setDeployed(!!st.modelDeployed);
      var sp = st.spotlight || null;
      if (sp !== currentSpotlight) {
        currentSpotlight = sp;
        if (deployed) {
          if (sp) applySpotlight(sp, true);
          else if (overlay) { banner && banner.classList.remove('show'); overlay.querySelectorAll('.ak-hs.active').forEach(function (e) { e.classList.remove('active'); }); }
        }
      }
    }
    // prime current state (for someone who opens after it's already deployed), then live updates
    fetch('/api/live-session?room=' + encodeURIComponent(room), { cache: 'no-store' })
      .then(function (r) { return r.json(); }).then(function (d) { apply(d && d.state); }).catch(function () {});
    try {
      var es = new EventSource('/api/live-session/stream?room=' + encodeURIComponent(room));
      es.onmessage = function (ev) { try { var d = JSON.parse(ev.data); apply(d && d.state); } catch (e) {} };
      es.onerror = function () {};
    } catch (e) {}
  }

  function init() { wireRoster(); wireAnswers(); wireModelOverlay(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
