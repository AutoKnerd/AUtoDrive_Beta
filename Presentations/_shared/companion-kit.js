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

  function init() { wireRoster(); wireAnswers(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
