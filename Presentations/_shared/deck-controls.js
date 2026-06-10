(function () {
  const pathParts = window.location.pathname.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  if (pathParts.length < 3 || pathParts[0] !== 'Presentations') return;
  if (new URLSearchParams(window.location.search).get('embedded') === '1') {
    const embeddedStyle = document.createElement('style');
    embeddedStyle.textContent = `
      aside.fixed.left-0.top-0.h-full {
        display: none !important;
      }

      main.ml-20,
      main[class*="ml-20"] {
        margin-left: 0 !important;
        width: 100% !important;
      }

      footer.fixed.bottom-0.w-full {
        left: 0 !important;
        width: 100% !important;
      }
    `;
    document.head.appendChild(embeddedStyle);
    return;
  }

  const deckBasePath = `/${pathParts.slice(0, 2).join('/')}`;
  const currentFile = pathParts.slice(2).join('/');
  const deckId = pathParts[1];
  let activeSlideFile = currentFile;

  if (!currentFile.endsWith('.html') || currentFile === 'index.html') return;

  // --- Room isolation ------------------------------------------------------
  // Each presentation run is its own "room" so simultaneous presenters never
  // share slide state. The room comes from ?room=, else a per-deck code kept in
  // sessionStorage (survives slide-to-slide page reloads), else a fresh code.
  const DEFAULT_ROOM = 'autoknerd-main';
  const roomStorageKey = `deck-room:${deckBasePath}`;
  const generateRoomCode = () => {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  };
  const resolveRoom = () => {
    try {
      const param = new URLSearchParams(window.location.search).get('room');
      if (param) { window.sessionStorage.setItem(roomStorageKey, param); return param; }
      let stored = window.sessionStorage.getItem(roomStorageKey);
      if (!stored) { stored = generateRoomCode(); window.sessionStorage.setItem(roomStorageKey, stored); }
      return stored;
    } catch {
      return generateRoomCode();
    }
  };
  const liveRoom = resolveRoom();
  const withRoom = (path) => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('room', liveRoom);
    return url.toString();
  };

  const controls = document.createElement('div');
  controls.className = 'deck-controls';
  controls.innerHTML = `
    <button type="button" class="deck-controls__toggle" data-action="toggle-menu" aria-label="Open presentation menu" aria-expanded="false">
      <span class="deck-controls__hamburger" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </button>
    <div class="deck-controls__menu">
      <button type="button" class="deck-controls__button" data-action="back">Back to Deck</button>
      <button type="button" class="deck-controls__button" data-action="audience-qr">Audience QR</button>
      <button type="button" class="deck-controls__button deck-controls__button--primary" data-action="remote-qr">Presenter Remote QR</button>
      <button type="button" class="deck-controls__button deck-controls__button--danger" data-action="reset-session">Reset Live Data</button>
      <button type="button" class="deck-controls__button" data-action="view-snapshot">View Snapshot</button>
      <button type="button" class="deck-controls__button" data-action="notes-screen">Open Notes Screen</button>
      <button type="button" class="deck-controls__button" data-action="copy-notes-link">Copy Notes Link</button>
      <button type="button" class="deck-controls__button" data-action="notes">Hide Notes</button>
      <button type="button" class="deck-controls__button deck-controls__button--primary" data-action="present">Present</button>
    </div>
  `;

  document.body.appendChild(controls);

  const nav = document.createElement('div');
  nav.className = 'deck-nav';
  nav.innerHTML = `
    <button type="button" class="deck-nav__button" data-action="prev">Prev</button>
    <button type="button" class="deck-nav__button" data-action="next">Next</button>
  `;

  const prevZone = document.createElement('button');
  prevZone.type = 'button';
  prevZone.className = 'deck-clickzone deck-clickzone--prev';
  prevZone.setAttribute('aria-label', 'Previous slide');

  const nextZone = document.createElement('button');
  nextZone.type = 'button';
  nextZone.className = 'deck-clickzone deck-clickzone--next';
  nextZone.setAttribute('aria-label', 'Next slide');

  document.body.appendChild(prevZone);
  document.body.appendChild(nextZone);
  document.body.appendChild(nav);

  const scrollCue = document.createElement('div');
  scrollCue.className = 'deck-scroll-cue';
  scrollCue.setAttribute('aria-hidden', 'true');
  scrollCue.innerHTML = `
    <div class="deck-scroll-cue__line"></div>
    <div class="deck-scroll-cue__arrow"></div>
    <div class="deck-scroll-cue__label">Scroll</div>
  `;
  document.body.appendChild(scrollCue);

  const audienceQrOverlay = document.createElement('div');
  audienceQrOverlay.className = 'deck-audience-qr';
  audienceQrOverlay.innerHTML = `
    <button type="button" class="deck-audience-qr__close" aria-label="Hide audience QR">&times;</button>
    <iframe class="deck-audience-qr__frame" src="/live-session/qr?embed=1&title=Live%20QR" title="Audience QR code"></iframe>
  `;
  document.body.appendChild(audienceQrOverlay);

  const responseRail = document.createElement('aside');
  responseRail.className = 'deck-response-rail';
  responseRail.setAttribute('aria-hidden', 'true');
  responseRail.innerHTML = `
    <div class="deck-response-rail__label">AUDIENCE</div>
    <div class="deck-response-rail__meter">
      <div class="deck-response-rail__fill" data-role="response-fill"></div>
    </div>
    <div class="deck-response-rail__count" data-role="audience-count">0</div>
    <div class="deck-response-rail__replies" data-role="response-count" hidden>0</div>
    <div class="deck-response-rail__status" data-role="response-status">WAITING</div>
  `;
  document.body.appendChild(responseRail);

  // Live roster overlay (bottom-left of the slide) — names appear as audience
  // members enroll via the companion "Initialize Session" form.
  const rosterOverlay = document.createElement('div');
  rosterOverlay.className = 'deck-roster';
  rosterOverlay.setAttribute('aria-hidden', 'true');
  rosterOverlay.innerHTML = `
    <div class="deck-roster__label">On the roster</div>
    <ul class="deck-roster__list" data-role="roster-list"></ul>
  `;
  document.body.appendChild(rosterOverlay);
  const rosterListEl = rosterOverlay.querySelector('[data-role="roster-list"]');
  let lastRosterSignature = '';
  let rosterNames = [];

  // Live poll leaderboard overlay (lower-left of the slide). Shows on the slide
  // whose companion binding is marked mainSlideEffect:'leaderboard'; each card's
  // count + bar reflect live votes coming in from the companion.
  const leaderboardOverlay = document.createElement('div');
  leaderboardOverlay.className = 'deck-leaderboard';
  leaderboardOverlay.setAttribute('aria-hidden', 'true');
  document.body.appendChild(leaderboardOverlay);
  let lastLeaderboardSignature = '';

  const presentationShell = document.createElement('div');
  presentationShell.className = 'deck-present-shell';
  presentationShell.innerHTML = `
    <iframe class="deck-present-shell__frame" title="Presented slide"></iframe>
  `;
  document.body.appendChild(presentationShell);

  const menuToggle = controls.querySelector('[data-action="toggle-menu"]');
  const backButton = controls.querySelector('[data-action="back"]');
  const audienceQrButton = controls.querySelector('[data-action="audience-qr"]');
  const remoteQrButton = controls.querySelector('[data-action="remote-qr"]');
  const resetSessionButton = controls.querySelector('[data-action="reset-session"]');
  const viewSnapshotButton = controls.querySelector('[data-action="view-snapshot"]');
  const notesScreenButton = controls.querySelector('[data-action="notes-screen"]');
  const copyNotesLinkButton = controls.querySelector('[data-action="copy-notes-link"]');
  const notesButton = controls.querySelector('[data-action="notes"]');
  const presentButton = controls.querySelector('[data-action="present"]');
  const prevButton = nav.querySelector('[data-action="prev"]');
  const nextButton = nav.querySelector('[data-action="next"]');
  const notesPanels = Array.from(document.querySelectorAll('.hideable-speaker-notes'));
  const notesStorageKey = `deck-notes-hidden:${deckBasePath}`;
  const fullscreenIntentStorageKey = `deck-fullscreen-intent:${deckBasePath}`;
  const pendingSlideStorageKey = `deck-pending-slide:${deckBasePath}`;
  const pendingSlideUntilStorageKey = `deck-pending-slide-until:${deckBasePath}`;
  const audienceQrCloseButton = audienceQrOverlay.querySelector('.deck-audience-qr__close');
  const audienceQrFrame = audienceQrOverlay.querySelector('.deck-audience-qr__frame');
  const audienceCountEl = responseRail.querySelector('[data-role="audience-count"]');
  const responseCountEl = responseRail.querySelector('[data-role="response-count"]');
  const responseFillEl = responseRail.querySelector('[data-role="response-fill"]');
  const responseStatusEl = responseRail.querySelector('[data-role="response-status"]');
  let lastAudienceViewers = 0;
  let lastResponseCount = 0;
  const presentationFrame = presentationShell.querySelector('.deck-present-shell__frame');
  let currentSessionToken = null;
  let currentAudienceUrl = null;

  // Expose live-session identity so injected slide scripts (e.g. the slide 32
  // AI confidence profile) can query room-scoped data without re-deriving it.
  window.DeckLive = window.DeckLive || {};
  window.DeckLive.room = liveRoom;
  window.DeckLive.deckId = deckId;
  window.DeckLive.getSessionToken = () => currentSessionToken;
  let responseRefreshTimer = null;
  let liveSessionEventSource = null;
  let lastRespondentCount = -1;
  let lastLiveSessionUpdatedAtEpoch = 0;
  let pendingLocalSlideFile = null;
  let ignoreLiveSessionUntil = 0;
  let presentationShellVisible = false;
  let companionBindingsByStep = {};

  try {
    const storedPendingSlide = window.sessionStorage.getItem(pendingSlideStorageKey);
    const storedPendingUntil = Number.parseInt(window.sessionStorage.getItem(pendingSlideUntilStorageKey) || '', 10);
    if (storedPendingSlide && Number.isFinite(storedPendingUntil) && storedPendingUntil > Date.now()) {
      pendingLocalSlideFile = storedPendingSlide;
      ignoreLiveSessionUntil = storedPendingUntil;
    } else {
      window.sessionStorage.removeItem(pendingSlideStorageKey);
      window.sessionStorage.removeItem(pendingSlideUntilStorageKey);
    }
  } catch {
    // Ignore storage failures. The in-memory guard still helps.
  }

  const setFullscreenIntent = (nextEnabled) => {
    try {
      if (nextEnabled) {
        window.sessionStorage.setItem(fullscreenIntentStorageKey, 'true');
      } else {
        window.sessionStorage.removeItem(fullscreenIntentStorageKey);
      }
    } catch {
      // Ignore storage failures. Fullscreen still works for the current page.
    }
  };

  const resolveAudienceUrl = () => {
    if (typeof currentAudienceUrl === 'string' && currentAudienceUrl.length > 0) {
      return currentAudienceUrl;
    }

    const audienceUrl = new URL('/live-session', window.location.origin);
    const isPrivateHost = (host) => {
      return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        /^169\.254\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      );
    };

    if (isPrivateHost(audienceUrl.hostname) && audienceUrl.port && audienceUrl.port !== '3000') {
      audienceUrl.port = '3000';
    }

    audienceUrl.searchParams.set('audience', '1');
    if (liveRoom && liveRoom !== DEFAULT_ROOM) audienceUrl.searchParams.set('room', liveRoom);
    return audienceUrl.toString();
  };
  const resolveEmbeddedSlideUrl = (fileName) => {
    const nextUrl = new URL(`${deckBasePath}/${fileName}`, window.location.origin);
    nextUrl.searchParams.set('embedded', '1');
    return nextUrl.toString();
  };

  const resolvePresenterNotesUrl = () => {
    const baseUrl = typeof currentAudienceUrl === 'string' && currentAudienceUrl.length > 0
      ? new URL(currentAudienceUrl)
      : new URL('/live-session', window.location.origin);

    baseUrl.pathname = '/live-session/notes';
    baseUrl.search = '';
    baseUrl.searchParams.set('deckId', deckId);
    if (currentSessionToken) {
      baseUrl.searchParams.set('sessionToken', currentSessionToken);
    }
    if (liveRoom && liveRoom !== DEFAULT_ROOM) baseUrl.searchParams.set('room', liveRoom);
    return baseUrl.toString();
  };

  const resolveQrOverlayUrl = (title, targetUrl) => {
    const nextUrl = new URL('/live-session/qr', window.location.origin);
    nextUrl.searchParams.set('embed', '1');
    nextUrl.searchParams.set('title', title);
    nextUrl.searchParams.set('url', targetUrl);
    return nextUrl.toString();
  };

  const syncAudienceQrFrame = (options = {}) => {
    if (!(audienceQrFrame instanceof HTMLIFrameElement)) return;
    const nextSrc = resolveQrOverlayUrl(options.title || 'Live QR', options.url || resolveAudienceUrl());
    if (audienceQrFrame.src !== nextSrc) {
      audienceQrFrame.src = nextSrc;
    }
  };

  const openPresenterNotesScreen = async () => {
    await syncLiveSessionState();
    window.open(resolvePresenterNotesUrl(), '_blank', 'noopener,noreferrer');
  };

  const openPresenterSnapshotScreen = async () => {
    await syncLiveSessionState();
    const snapshotUrl = new URL(resolvePresenterNotesUrl());
    snapshotUrl.searchParams.set('view', 'snapshot');
    window.open(snapshotUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  const copyPresenterNotesLink = async () => {
    await syncLiveSessionState();
    const notesUrl = resolvePresenterNotesUrl();

    try {
      await navigator.clipboard.writeText(notesUrl);
      if (copyNotesLinkButton instanceof HTMLButtonElement) {
        const originalText = copyNotesLinkButton.textContent || 'Copy Notes Link';
        copyNotesLinkButton.textContent = 'Copied';
        window.setTimeout(() => {
          copyNotesLinkButton.textContent = originalText;
        }, 1200);
      }
    } catch {
      window.prompt('Copy presenter notes link', notesUrl);
    }
  };

  const inferStepFromFile = (fileName, fallbackIndex) => {
    const numberedMatch = String(fileName || '').match(/^(\d+)/);
    const parsedIndex = numberedMatch ? Number.parseInt(numberedMatch[1], 10) : NaN;
    const resolvedIndex = Number.isFinite(parsedIndex) && parsedIndex > 0
      ? parsedIndex
      : (typeof fallbackIndex === 'number' && fallbackIndex > 0 ? fallbackIndex : 1);
    return `slide${resolvedIndex}`;
  };

  const inferSlideNumberFromFile = (fileName, fallbackIndex) => {
    const numberedMatch = String(fileName || '').match(/^(\d+)/);
    const parsedIndex = numberedMatch ? Number.parseInt(numberedMatch[1], 10) : NaN;
    return Number.isFinite(parsedIndex) && parsedIndex > 0
      ? parsedIndex
      : (typeof fallbackIndex === 'number' && fallbackIndex > 0 ? fallbackIndex : 1);
  };

  const getCompanionBindingForStep = (step) => {
    if (!step || !companionBindingsByStep || typeof companionBindingsByStep !== 'object') {
      return null;
    }

    const binding = companionBindingsByStep[step];
    if (!binding || typeof binding !== 'object') {
      return null;
    }

    return binding;
  };

  const getCompanionRoots = () => {
    const roots = [document];

    if (
      presentationShellVisible
      && presentationFrame instanceof HTMLIFrameElement
      && presentationFrame.contentDocument
      && presentationFrame.contentDocument !== document
    ) {
      roots.push(presentationFrame.contentDocument);
    }

    return roots;
  };

  const queryCompanionTargets = (root, attributeName, binding) => {
    if (!root || typeof root.querySelectorAll !== 'function') return [];

    return Array.from(root.querySelectorAll(`[${attributeName}]`)).filter((element) => {
      const rawValue = element.getAttribute(attributeName);
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!value) return true;
      return value === binding?.slideStep || value === binding?.responseKey;
    });
  };

  const setCompanionRootState = (root, binding, currentStep, responseCount, respondentCount, fillPercent, latestAt) => {
    const state = responseCount > 0 ? 'active' : 'idle';

    if (root.documentElement instanceof HTMLElement) {
      root.documentElement.dataset.companionStep = currentStep;
      root.documentElement.dataset.companionState = state;
      root.documentElement.dataset.companionResponseCount = String(responseCount);
      root.documentElement.dataset.companionRespondentCount = String(respondentCount);
      root.documentElement.dataset.companionFillPercent = String(fillPercent);
      root.documentElement.dataset.companionLatestAt = latestAt || '';
      root.documentElement.dataset.companionResponseKey = binding?.responseKey || '';
      root.documentElement.dataset.companionInteractionMode = binding?.interactionMode || '';
      root.documentElement.dataset.companionMainEffect = binding?.mainSlideEffect || '';
    }

    const counterTargets = queryCompanionTargets(root, 'data-companion-counter', binding);
    counterTargets.forEach((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = String(responseCount);
      } else {
        element.textContent = String(responseCount);
      }
      element.dataset.companionState = state;
      element.dataset.companionResponseCount = String(responseCount);
      element.dataset.companionRespondentCount = String(respondentCount);
    });

    const stageTargets = [
      ...queryCompanionTargets(root, 'data-companion-stage', binding),
      ...queryCompanionTargets(root, 'data-companion-toggle', binding),
      ...queryCompanionTargets(root, 'data-companion-visual', binding),
    ];

    stageTargets.forEach((element) => {
      element.dataset.companionState = state;
      element.dataset.companionResponseCount = String(responseCount);
      element.dataset.companionRespondentCount = String(respondentCount);
      element.dataset.companionFillPercent = String(fillPercent);
      element.dataset.companionLatestAt = latestAt || '';
      element.classList.toggle('is-visible', responseCount > 0);
      element.classList.toggle('is-active', responseCount > 0);
      element.classList.toggle('is-hidden', responseCount === 0);
      element.setAttribute('aria-hidden', String(responseCount === 0));
    });

    const eventDetail = {
      step: currentStep,
      binding,
      responseCount,
      respondentCount,
      fillPercent,
      latestAt: latestAt || null,
    };

    root.dispatchEvent(new CustomEvent('presentation:companion-update', { detail: eventDetail }));
  };

  const applyCompanionBindingState = (currentStep, summaryPayload) => {
    const binding = getCompanionBindingForStep(currentStep);
    const responseCount = Number.isFinite(summaryPayload?.responseCount) ? summaryPayload.responseCount : 0;
    const respondentCount = Number.isFinite(summaryPayload?.respondentCount) ? summaryPayload.respondentCount : 0;
    const fillPercent = Number.isFinite(summaryPayload?.fillPercent)
      ? summaryPayload.fillPercent
      : Math.min(100, responseCount * 20);
    const latestAt = typeof summaryPayload?.latestAt === 'string' ? summaryPayload.latestAt : '';

    getCompanionRoots().forEach((root) => {
      setCompanionRootState(root, binding, currentStep, responseCount, respondentCount, fillPercent, latestAt);
    });
  };

  const getLiveSessionStateUpdatedAtEpoch = (state) => {
    const raw = state && typeof state.updatedAt === 'string' ? state.updatedAt : '';
    if (!raw.trim()) return 0;

    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const commitLiveSessionPayload = (payload) => {
    if (payload?.state?.sessionToken && payload.state.sessionToken !== currentSessionToken) {
      currentSessionToken = payload.state.sessionToken;
      pendingLocalSlideFile = null;
      ignoreLiveSessionUntil = 0;
      try {
        window.sessionStorage.removeItem(pendingSlideStorageKey);
        window.sessionStorage.removeItem(pendingSlideUntilStorageKey);
      } catch {
        // Ignore storage failures.
      }
    }

    const nextUpdatedAt = getLiveSessionStateUpdatedAtEpoch(payload && payload.state);
    if (nextUpdatedAt === 0) {
      if (lastLiveSessionUpdatedAtEpoch > 0) {
        return false;
      }
    } else if (nextUpdatedAt < lastLiveSessionUpdatedAtEpoch) {
      return false;
    }

    if (nextUpdatedAt > 0) {
      lastLiveSessionUpdatedAtEpoch = nextUpdatedAt;
    }

    if (typeof payload?.audienceUrl === 'string' && payload.audienceUrl.length > 0) {
      currentAudienceUrl = payload.audienceUrl;
      if (qrMode !== 'remote') syncAudienceQrFrame();
    }

    applyAudienceQrFromState(payload?.state?.audienceQrVisible === true);

    return true;
  };

  const pushToAudience = async (step, slideFile = activeSlideFile) => {
    const currentStep = typeof step === 'string' && step ? step : inferStepFromFile(slideFile, currentIndex + 1);

    try {
      const response = await fetch('/api/live-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deckId,
          currentStep,
          currentSlide: slideFile,
          room: liveRoom,
        }),
        keepalive: true,
      });
      if (response.ok) {
        const payload = await response.json();
        if (commitLiveSessionPayload(payload)) {
          if (payload?.state?.currentSlide && payload.state.currentSlide !== activeSlideFile) {
            syncDeckToLiveSession(payload);
          }
          void syncResponseRail();
        }
      }
    } catch (error) {
      console.error('Unable to update audience session state.', error);
    }
  };

  window.pushToAudience = pushToAudience;

  const setMenuOpen = (open) => {
    controls.classList.toggle('deck-controls--open', open);
    if (menuToggle instanceof HTMLButtonElement) {
      menuToggle.setAttribute('aria-expanded', String(open));
    }
  };

  menuToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    setMenuOpen(!controls.classList.contains('deck-controls--open'));
  });

  controls.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  document.addEventListener('click', () => setMenuOpen(false));

  backButton?.addEventListener('click', () => {
    setMenuOpen(false);
    setFullscreenIntent(false);
    setPresentationShellVisible(false);
    window.location.href = `${deckBasePath}`;
  });

  const setAudienceQrVisible = async (visible) => {
    if (visible) {
      await pushToAudience(inferStepFromFile(activeSlideFile, currentIndex + 1), activeSlideFile);
    }
    syncAudienceQrFrame({ title: 'Live QR' });
    audienceQrOverlay.classList.toggle('deck-audience-qr--visible', visible);
    if (audienceQrButton instanceof HTMLButtonElement) {
      audienceQrButton.textContent = visible ? 'Hide Audience QR' : 'Audience QR';
    }
  };

  // Audience-join QR shown on the presentation screen, driven by live-session
  // state so the presenter remote can raise it for new participants. qrMode keeps
  // the separate "Presenter Remote QR" display from being dismissed by updates.
  let qrMode = null; // 'audience' | 'remote' | null
  let lastAudienceQrState = false;

  const showAudienceJoinQr = (visible) => {
    if (visible) {
      qrMode = 'audience';
      syncAudienceQrFrame({ title: 'Live QR' });
      audienceQrOverlay.classList.add('deck-audience-qr--visible');
    } else if (qrMode === 'audience') {
      qrMode = null;
      audienceQrOverlay.classList.remove('deck-audience-qr--visible');
    }
    if (audienceQrButton instanceof HTMLButtonElement) {
      audienceQrButton.textContent = qrMode === 'audience' ? 'Hide Audience QR' : 'Audience QR';
    }
  };

  const applyAudienceQrFromState = (visible) => {
    if (visible === lastAudienceQrState) return;
    lastAudienceQrState = visible;
    showAudienceJoinQr(visible);
  };

  const postAudienceQrState = async (visible) => {
    try {
      await fetch('/api/live-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckId,
          currentStep: inferStepFromFile(activeSlideFile, currentIndex + 1),
          currentSlide: activeSlideFile,
          audienceQrVisible: visible,
          room: liveRoom,
        }),
        keepalive: true,
      });
    } catch (error) {
      console.error('Unable to update audience QR state.', error);
    }
  };

  // Presenter remote — reuses the LAN-aware host so the QR resolves on a phone.
  const resolveRemoteUrl = () => {
    const base = new URL(resolveAudienceUrl());
    base.pathname = '/presenter-remote.html';
    base.search = '';
    if (liveRoom && liveRoom !== DEFAULT_ROOM) base.searchParams.set('room', liveRoom);
    return base.toString();
  };

  const openRemoteQr = () => {
    setMenuOpen(false);
    qrMode = 'remote';
    syncAudienceQrFrame({ title: 'Presenter Remote', url: resolveRemoteUrl() });
    audienceQrOverlay.classList.add('deck-audience-qr--visible');
    if (audienceQrButton instanceof HTMLButtonElement) {
      audienceQrButton.textContent = 'Audience QR';
    }
  };

  audienceQrButton?.addEventListener('click', async () => {
    setMenuOpen(false);
    const desired = qrMode !== 'audience';
    showAudienceJoinQr(desired);
    lastAudienceQrState = desired;
    await postAudienceQrState(desired);
  });

  remoteQrButton?.addEventListener('click', () => {
    openRemoteQr();
  });

  resetSessionButton?.addEventListener('click', async () => {
    setMenuOpen(false);
    const shouldReset = window.confirm(
      'Reset this presentation run? Existing live questions, feedback, and response counts will clear from the room view and a fresh audience session will start on this slide.',
    );
    if (!shouldReset) return;

    try {
      if (resetSessionButton instanceof HTMLButtonElement) {
        resetSessionButton.disabled = true;
        resetSessionButton.textContent = 'Resetting...';
      }

      const response = await fetch('/api/live-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deckId,
          currentStep: inferStepFromFile(activeSlideFile, currentIndex + 1),
          currentSlide: activeSlideFile,
          resetSession: true,
          room: liveRoom,
        }),
        keepalive: true,
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload?.state?.sessionToken) {
          currentSessionToken = payload.state.sessionToken;
        }
        if (typeof payload?.audienceUrl === 'string' && payload.audienceUrl.length > 0) {
          currentAudienceUrl = payload.audienceUrl;
          syncAudienceQrFrame();
        }
        resetVisibleLiveState();
        await syncResponseRail();
      }
    } catch (error) {
      console.error('Unable to reset live session.', error);
    } finally {
      if (resetSessionButton instanceof HTMLButtonElement) {
        resetSessionButton.disabled = false;
        resetSessionButton.textContent = 'Reset Live Data';
      }
    }
  });

  notesScreenButton?.addEventListener('click', async () => {
    setMenuOpen(false);
    try {
      await openPresenterNotesScreen();
    } catch (error) {
      console.error('Unable to open presenter notes screen.', error);
    }
  });

  viewSnapshotButton?.addEventListener('click', async () => {
    setMenuOpen(false);
    try {
      await openPresenterSnapshotScreen();
    } catch (error) {
      console.error('Unable to open presenter snapshot screen.', error);
    }
  });

  copyNotesLinkButton?.addEventListener('click', async () => {
    setMenuOpen(false);
    try {
      await copyPresenterNotesLink();
    } catch (error) {
      console.error('Unable to copy presenter notes link.', error);
    }
  });

  audienceQrCloseButton?.addEventListener('click', async () => {
    const wasAudience = qrMode === 'audience';
    qrMode = null;
    audienceQrOverlay.classList.remove('deck-audience-qr--visible');
    if (audienceQrButton instanceof HTMLButtonElement) audienceQrButton.textContent = 'Audience QR';
    if (wasAudience) {
      lastAudienceQrState = false;
      await postAudienceQrState(false);
    }
  });

  const syncNotesState = () => {
    if (!notesButton) return;
    const notesHidden = document.body.classList.contains('speaker-notes-hidden');
    notesButton.textContent = notesHidden ? 'Show Notes' : 'Hide Notes';
  };

  if (notesPanels.length === 0 && notesButton instanceof HTMLButtonElement) {
    notesButton.style.display = 'none';
  } else {
    const savedNotesHidden = window.localStorage.getItem(notesStorageKey) === 'true';
    document.body.classList.toggle('speaker-notes-hidden', savedNotesHidden);
    syncNotesState();

    notesButton?.addEventListener('click', () => {
      const nextHidden = !document.body.classList.contains('speaker-notes-hidden');
      document.body.classList.toggle('speaker-notes-hidden', nextHidden);
      window.localStorage.setItem(notesStorageKey, String(nextHidden));
      syncNotesState();
      setMenuOpen(false);
    });
  }

  const updatePresentLabel = () => {
    if (!presentButton) return;
    presentButton.textContent = presentationShellVisible || document.fullscreenElement ? 'Exit Fullscreen' : 'Present';
  };

  const setPresentationShellVisible = (visible) => {
    presentationShellVisible = visible;
    presentationShell.classList.toggle('deck-present-shell--visible', visible);
    document.body.classList.toggle('deck-presenting', visible);
    updatePresentLabel();
  };

  const setPresentationSlide = (slideFile) => {
    activeSlideFile = slideFile;
    if (presentationFrame instanceof HTMLIFrameElement) {
      presentationFrame.src = resolveEmbeddedSlideUrl(slideFile);
    }
    syncNavigationState();
    syncScrollCue();
    if (currentSessionToken) {
      void syncResponseRail();
    }
  };

  presentButton?.addEventListener('click', async () => {
    try {
      if (presentationShellVisible || document.fullscreenElement) {
        setPresentationShellVisible(false);
        await document.exitFullscreen();
        setFullscreenIntent(false);
        if (presentationFrame instanceof HTMLIFrameElement) {
          presentationFrame.src = 'about:blank';
        }
      } else {
        setFullscreenIntent(true);
        await document.documentElement.requestFullscreen();
        setPresentationShellVisible(true);
        setPresentationSlide(activeSlideFile);
        syncAudienceQrFrame();
      }
    } catch (error) {
      console.error('Unable to toggle fullscreen presentation mode.', error);
      if (!document.fullscreenElement) {
        setFullscreenIntent(false);
      }
    } finally {
      updatePresentLabel();
      setMenuOpen(false);
    }
  });

  document.addEventListener('fullscreenchange', () => {
    updatePresentLabel();
  });
  updatePresentLabel();

  let slideOrder = [];
  let currentIndex = -1;

  const navigateByOffset = (offset) => {
    if (!slideOrder.length || currentIndex === -1) return;

    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= slideOrder.length) return;

    const nextSlideFile = slideOrder[nextIndex];
    const nextStep = inferStepFromFile(nextSlideFile, nextIndex + 1);
    pendingLocalSlideFile = nextSlideFile;
    ignoreLiveSessionUntil = Date.now() + 2200;
    try {
      window.sessionStorage.setItem(pendingSlideStorageKey, nextSlideFile);
      window.sessionStorage.setItem(pendingSlideUntilStorageKey, String(ignoreLiveSessionUntil));
    } catch {
      // Ignore storage failures.
    }

    if (presentationShellVisible) {
      setPresentationSlide(nextSlideFile);
      void pushToAudience(nextStep, nextSlideFile);
      return;
    }

    if (document.fullscreenElement) {
      setFullscreenIntent(true);
    }

    window.location.href = `${deckBasePath}/${nextSlideFile}`;
  };

  const syncNavigationState = () => {
    currentIndex = slideOrder.indexOf(activeSlideFile);

    if (prevButton instanceof HTMLButtonElement) {
      prevButton.disabled = currentIndex <= 0;
    }

    if (nextButton instanceof HTMLButtonElement) {
      nextButton.disabled = currentIndex === -1 || currentIndex >= slideOrder.length - 1;
    }

    prevZone.disabled = currentIndex <= 0;
    nextZone.disabled = currentIndex === -1 || currentIndex >= slideOrder.length - 1;

    updateFilmstripActive();
    applyRosterVisibility();
    applyLeaderboardVisibility(leaderboardStepBinding());
    void syncLeaderboard();
  };

  // --- Slide thumbnail filmstrip (multi-file decks) ---
  let filmstripEl = null;
  let filmstripToggleEl = null;
  const filmstripHiddenKey = `deck-filmstrip-hidden:${deckBasePath}`;

  const navigateToIndex = (index) => {
    if (currentIndex === -1) return;
    navigateByOffset(index - currentIndex);
  };

  // Let injected slide content (e.g. the slide 32 AI feature cards) jump the deck
  // to a specific slide — behaves exactly like clicking that filmstrip thumbnail,
  // so the audience follows in a live session.
  window.DeckLive.goToSlideNumber = (n) => {
    const idx = Math.floor(Number(n)) - 1;
    if (Number.isFinite(idx) && idx >= 0 && idx < slideOrder.length) navigateToIndex(idx);
  };
  window.DeckLive.slideCount = () => slideOrder.length;

  const loadThumbFrame = (thumb) => {
    const frame = thumb && thumb.querySelector ? thumb.querySelector('iframe') : null;
    if (frame instanceof HTMLIFrameElement && frame.dataset.src && !frame.src) {
      frame.src = frame.dataset.src;
    }
  };

  const updateFilmstripActive = () => {
    if (!filmstripEl) return;
    filmstripEl.querySelectorAll('.deck-filmstrip__thumb').forEach((thumb) => {
      const idx = Number.parseInt(thumb.getAttribute('data-index') || '-1', 10);
      const active = idx === currentIndex;
      thumb.classList.toggle('is-active', active);
      if (Math.abs(idx - currentIndex) <= 4) loadThumbFrame(thumb);
      if (active) {
        thumb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    });
  };

  const buildFilmstrip = () => {
    if (filmstripEl || slideOrder.length < 2) return;

    filmstripEl = document.createElement('div');
    filmstripEl.className = 'deck-filmstrip';
    const track = document.createElement('div');
    track.className = 'deck-filmstrip__track';

    slideOrder.forEach((file, idx) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'deck-filmstrip__thumb';
      thumb.setAttribute('data-index', String(idx));
      thumb.setAttribute('aria-label', `Go to slide ${idx + 1}`);

      const frame = document.createElement('iframe');
      frame.className = 'deck-filmstrip__frame';
      frame.setAttribute('tabindex', '-1');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('scrolling', 'no');
      // ?embedded=1 keeps deck-controls from re-running inside the thumbnail.
      frame.dataset.src = resolveEmbeddedSlideUrl(file);
      thumb.appendChild(frame);

      const num = document.createElement('span');
      num.className = 'deck-filmstrip__num';
      num.textContent = String(idx + 1);
      thumb.appendChild(num);

      thumb.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        navigateToIndex(idx);
      });
      track.appendChild(thumb);
    });

    filmstripEl.appendChild(track);
    document.body.appendChild(filmstripEl);
    document.body.classList.add('has-deck-filmstrip');

    filmstripToggleEl = document.createElement('button');
    filmstripToggleEl.type = 'button';
    filmstripToggleEl.className = 'deck-filmstrip__toggle';
    document.body.appendChild(filmstripToggleEl);

    const setHidden = (hidden) => {
      document.body.classList.toggle('deck-filmstrip-hidden', hidden);
      filmstripToggleEl.textContent = hidden ? '▲' : '▼';
      filmstripToggleEl.title = hidden ? 'Show slide strip' : 'Hide slide strip';
      filmstripToggleEl.setAttribute('aria-label', filmstripToggleEl.title);
      try { window.localStorage.setItem(filmstripHiddenKey, String(hidden)); } catch {}
    };
    filmstripToggleEl.addEventListener('click', (event) => {
      event.stopPropagation();
      setHidden(!document.body.classList.contains('deck-filmstrip-hidden'));
    });
    setHidden(window.localStorage.getItem(filmstripHiddenKey) === 'true');

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadThumbFrame(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { root: track, rootMargin: '300px' });
      track.querySelectorAll('.deck-filmstrip__thumb').forEach((thumb) => io.observe(thumb));
    } else {
      track.querySelectorAll('.deck-filmstrip__thumb').forEach(loadThumbFrame);
    }

    updateFilmstripActive();
  };

  const syncScrollCue = () => {
    const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
    const shouldShow = scrollableDistance > 80 && window.scrollY < scrollableDistance - 64;
    scrollCue.classList.toggle('deck-scroll-cue--visible', shouldShow);
  };

  const syncLiveSessionState = async () => {
    try {
      const response = await fetch(withRoom('/api/live-session'), { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      commitLiveSessionPayload(payload);
    } catch (error) {
      console.error('Unable to read live session state.', error);
    }
  };

  const syncDeckToLiveSession = (payload) => {
    const nextSlideFile = typeof payload?.state?.currentSlide === 'string' ? payload.state.currentSlide.trim() : '';
    if (!nextSlideFile || nextSlideFile === activeSlideFile) return;

    const now = Date.now();
    if (now < ignoreLiveSessionUntil && nextSlideFile !== pendingLocalSlideFile) {
      return;
    }

    if (nextSlideFile === pendingLocalSlideFile) {
      pendingLocalSlideFile = null;
      ignoreLiveSessionUntil = 0;
      try {
        window.sessionStorage.removeItem(pendingSlideStorageKey);
        window.sessionStorage.removeItem(pendingSlideUntilStorageKey);
      } catch {
        // Ignore storage failures.
      }
    }

    if (slideOrder.length && !slideOrder.includes(nextSlideFile)) {
      return;
    }

    if (presentationShellVisible) {
      setPresentationSlide(nextSlideFile);
      return;
    }

    if (document.fullscreenElement) {
      setFullscreenIntent(true);
    }

    window.location.href = `${deckBasePath}/${nextSlideFile}`;
  };

  const updateRailStatus = () => {
    const live = lastAudienceViewers > 0 || lastResponseCount > 0;
    if (responseStatusEl instanceof HTMLElement) {
      responseStatusEl.textContent = live ? 'LIVE' : 'WAITING';
    }
    responseRail.dataset.state = live ? 'active' : 'idle';
  };

  // Live audience presence (connected viewers) — climbs as people scan the join QR.
  const syncPresenceRail = async () => {
    if (!currentSessionToken) return;
    try {
      const url = new URL('/api/live-session/presence', window.location.origin);
      url.searchParams.set('deckId', deckId);
      url.searchParams.set('sessionToken', currentSessionToken);
      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const viewers = Number.isFinite(payload?.activeAudienceCount) ? payload.activeAudienceCount : 0;
      const changed = viewers !== lastAudienceViewers;
      lastAudienceViewers = viewers;
      if (audienceCountEl instanceof HTMLElement) {
        audienceCountEl.textContent = String(viewers);
      }
      updateRailStatus();
      if (changed) {
        responseRail.classList.remove('deck-response-rail--pulse');
        void responseRail.offsetWidth;
        responseRail.classList.add('deck-response-rail--pulse');
        window.setTimeout(() => responseRail.classList.remove('deck-response-rail--pulse'), 650);
      }
    } catch (error) {
      // Keep the rail usable even if presence polling blips.
    }
  };

  // The roster overlay only shows on the slide whose companion binding is marked
  // as a roster (so names don't follow you onto every slide). Per-slide the
  // binding can set the label ("On the roster" / "Locked In") and side.
  const rosterStepBinding = () => {
    const step = inferStepFromFile(activeSlideFile, currentIndex + 1);
    const binding = getCompanionBindingForStep(step);
    return (binding && (binding.mainSlideEffect === 'roster' || binding.interactionMode === 'roster')) ? binding : null;
  };
  const applyRosterVisibility = () => {
    const binding = rosterStepBinding();
    const show = rosterNames.length > 0 && Boolean(binding);
    rosterOverlay.classList.toggle('deck-roster--visible', show);
    if (binding) {
      const labelEl = rosterOverlay.querySelector('.deck-roster__label');
      if (labelEl) labelEl.textContent = binding.rosterLabel || 'On the roster';
      rosterOverlay.classList.toggle('deck-roster--left', binding.rosterSide === 'left');
    }
  };

  // Live roster — names enrolled via the companion form, shown bottom-left.
  const syncRoster = async () => {
    if (!currentSessionToken) return;
    try {
      const url = new URL('/api/live-session/roster', window.location.origin);
      url.searchParams.set('sessionToken', currentSessionToken);
      url.searchParams.set('room', liveRoom);
      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const entries = Array.isArray(payload?.entries) ? payload.entries : [];
      const names = entries.map((entry) => String(entry?.name || '').trim()).filter(Boolean);
      const signature = names.join('|');
      if (signature === lastRosterSignature) return;
      lastRosterSignature = signature;

      rosterNames = names;
      if (rosterListEl instanceof HTMLElement) {
        rosterListEl.innerHTML = '';
        names.forEach((name) => {
          const li = document.createElement('li');
          li.className = 'deck-roster__name';
          li.textContent = name;
          rosterListEl.appendChild(li);
        });
        // Keep the newest lock-ins in view when the list overflows.
        rosterListEl.scrollTop = rosterListEl.scrollHeight;
      }
      applyRosterVisibility();
    } catch (error) {
      // Keep the deck usable even if roster polling blips.
    }
  };

  // --- Live poll leaderboard ----------------------------------------------
  // The binding turns this on per slide (mainSlideEffect:'leaderboard') and
  // supplies the category list it should always show, e.g.
  //   leaderboardCategories: [{ value:'driving', label:'Driving' }, ...]
  const DEFAULT_LEADERBOARD_CATEGORIES = [
    { value: 'driving', label: 'Driving' },
    { value: 'parking', label: 'Parking' },
    { value: 'visibility', label: 'Visibility' },
  ];
  const leaderboardStepBinding = () => {
    const step = inferStepFromFile(activeSlideFile, currentIndex + 1);
    const binding = getCompanionBindingForStep(step);
    return (binding && binding.mainSlideEffect === 'leaderboard') ? binding : null;
  };
  const renderLeaderboard = (binding, tally, total) => {
    const categories = (Array.isArray(binding.leaderboardCategories) && binding.leaderboardCategories.length)
      ? binding.leaderboardCategories
      : DEFAULT_LEADERBOARD_CATEGORIES;
    const counts = categories.map((cat) => {
      const hit = tally ? tally[String(cat.value).toLowerCase()] : null;
      return { label: cat.label || cat.value, count: hit && Number.isFinite(hit.count) ? hit.count : 0 };
    });
    const maxCount = Math.max(1, ...counts.map((c) => c.count));
    const leadCount = Math.max(...counts.map((c) => c.count));
    const signature = counts.map((c) => `${c.label}:${c.count}`).join('|');
    if (signature === lastLeaderboardSignature) return;
    lastLeaderboardSignature = signature;
    leaderboardOverlay.innerHTML = counts.map((c) => {
      const leading = c.count > 0 && c.count === leadCount ? ' deck-leaderboard__card--leading' : '';
      const pct = total > 0 ? Math.round((c.count / maxCount) * 100) : 0;
      return `
        <div class="deck-leaderboard__card${leading}">
          <div class="deck-leaderboard__head">
            <span class="deck-leaderboard__dot"></span>
            <span class="deck-leaderboard__name">${c.label}</span>
          </div>
          <div class="deck-leaderboard__count">${c.count}<small>${c.count === 1 ? 'vote' : 'votes'}</small></div>
          <div class="deck-leaderboard__bar"><div class="deck-leaderboard__fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
  };
  const applyLeaderboardVisibility = (binding) => {
    leaderboardOverlay.classList.toggle('deck-leaderboard--visible', Boolean(binding));
  };
  const syncLeaderboard = async () => {
    const binding = leaderboardStepBinding();
    applyLeaderboardVisibility(binding);
    if (!binding || !currentSessionToken) {
      lastLeaderboardSignature = '';
      return;
    }
    try {
      const url = new URL('/api/live-session/responses', window.location.origin);
      url.searchParams.set('deckId', deckId);
      url.searchParams.set('slideStep', inferStepFromFile(activeSlideFile, currentIndex + 1));
      url.searchParams.set('sessionToken', currentSessionToken);
      if (binding.responseKey) url.searchParams.set('responseKey', binding.responseKey);
      url.searchParams.set('groupByAnswer', '1');
      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      renderLeaderboard(binding, payload?.tally || {}, Number(payload?.tallyTotal) || 0);
    } catch (error) {
      // Keep the deck usable even if leaderboard polling blips.
    }
  };

  const syncResponseRail = async () => {
    if (!currentSessionToken) return;
    const currentStep = inferStepFromFile(activeSlideFile, currentIndex + 1);
    const currentSlideNumber = inferSlideNumberFromFile(activeSlideFile, currentIndex + 1);
    const companionBinding = getCompanionBindingForStep(currentStep);
    const summaryUrl = new URL('/api/live-session/responses', window.location.origin);
    summaryUrl.searchParams.set('deckId', deckId);
    summaryUrl.searchParams.set('slideStep', currentStep);
    summaryUrl.searchParams.set('currentSlide', activeSlideFile);
    summaryUrl.searchParams.set('slideNumber', String(currentSlideNumber));
    summaryUrl.searchParams.set('sessionToken', currentSessionToken);
    if (companionBinding?.responseKey) {
      summaryUrl.searchParams.set('responseKey', companionBinding.responseKey);
    }

    try {
      const response = await fetch(summaryUrl.toString(), { cache: 'no-store' });
      if (!response.ok) return;

      const payload = await response.json();
      const respondentCount = Number.isFinite(payload?.respondentCount) ? payload.respondentCount : 0;
      const responseCount = Number.isFinite(payload?.responseCount) ? payload.responseCount : respondentCount;
      const fillPercent = Number.isFinite(payload?.fillPercent)
        ? payload.fillPercent
        : Math.min(100, responseCount * 20);

      lastResponseCount = responseCount;
      if (responseCountEl instanceof HTMLElement) {
        responseCountEl.textContent = `${responseCount} ${responseCount === 1 ? 'reply' : 'replies'}`;
        responseCountEl.hidden = responseCount === 0;
      }

      if (responseFillEl instanceof HTMLElement) {
        responseFillEl.style.height = `${fillPercent}%`;
      }

      updateRailStatus();

      if (responseCount !== lastRespondentCount) {
        responseRail.classList.remove('deck-response-rail--pulse');
        void responseRail.offsetWidth;
        responseRail.classList.add('deck-response-rail--pulse');
        window.setTimeout(() => {
          responseRail.classList.remove('deck-response-rail--pulse');
        }, 650);
        lastRespondentCount = responseCount;
      }

      applyCompanionBindingState(currentStep, payload);
    } catch (error) {
      console.error('Unable to refresh response summary.', error);
    }
  };

  const resetVisibleLiveState = () => {
    if (responseCountEl instanceof HTMLElement) {
      responseCountEl.textContent = '0';
    }

    if (responseFillEl instanceof HTMLElement) {
      responseFillEl.style.height = '0%';
    }

    if (responseStatusEl instanceof HTMLElement) {
      responseStatusEl.textContent = 'WAITING';
    }

    responseRail.dataset.state = 'idle';
    lastRespondentCount = -1;

    const currentStep = inferStepFromFile(activeSlideFile, currentIndex + 1);
    applyCompanionBindingState(currentStep, {
      responseCount: 0,
      respondentCount: 0,
      fillPercent: 0,
      latestAt: null,
    });
  };

  presentationFrame?.addEventListener('load', () => {
    if (presentationShellVisible) {
      void syncResponseRail();
    }
  });

  const canHandleKeyEvent = (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return true;
    const tagName = target.tagName;
    return tagName !== 'INPUT' && tagName !== 'TEXTAREA' && target.contentEditable !== 'true';
  };

  document.addEventListener('keydown', (event) => {
    if (!canHandleKeyEvent(event)) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigateByOffset(1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateByOffset(-1);
    }
  });

  prevButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    navigateByOffset(-1);
  });
  nextButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    navigateByOffset(1);
  });
  prevZone.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    navigateByOffset(-1);
  });
  nextZone.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    navigateByOffset(1);
  });
  window.addEventListener('scroll', syncScrollCue, { passive: true });
  window.addEventListener('resize', syncScrollCue);

  fetch(`${deckBasePath}/manifest.json`, { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then(async (manifest) => {
      if (!manifest || !Array.isArray(manifest.slides)) return;
      slideOrder = manifest.slides.filter((slide) => typeof slide === 'string');
      companionBindingsByStep = manifest?.companion?.bindingsByStep && typeof manifest.companion.bindingsByStep === 'object'
        ? manifest.companion.bindingsByStep
        : {};
      const qrOverlayEnabled = manifest.audience?.qrOverlayEnabled !== false;
      if (audienceQrButton instanceof HTMLButtonElement && !qrOverlayEnabled) {
        audienceQrButton.style.display = 'none';
      }
      if (!qrOverlayEnabled) {
        setAudienceQrVisible(false);
      }
      activeSlideFile = currentFile;
      buildFilmstrip();
      syncNavigationState();
      syncScrollCue();
      await pushToAudience(inferStepFromFile(currentFile, currentIndex + 1), currentFile);
      await syncLiveSessionState();
      syncAudienceQrFrame();
      syncResponseRail();
      syncPresenceRail();
      syncRoster();
      syncLeaderboard();

      if (!liveSessionEventSource) {
        liveSessionEventSource = new EventSource(withRoom('/api/live-session/stream'));
        liveSessionEventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (commitLiveSessionPayload(payload)) {
              syncDeckToLiveSession(payload);
              syncResponseRail();
            }
          } catch (error) {
            console.error('Unable to process live session stream update.', error);
          }
        };
        liveSessionEventSource.onerror = () => {
          // Keep the deck usable even if the live stream blips.
        };
      }
    })
    .catch((error) => {
      console.error('Unable to load deck manifest.', error);
    });

  syncScrollCue();
  responseRefreshTimer = window.setInterval(() => { void syncResponseRail(); void syncPresenceRail(); void syncRoster(); void syncLeaderboard(); }, 1800);

  window.addEventListener('beforeunload', () => {
    if (responseRefreshTimer !== null) {
      window.clearInterval(responseRefreshTimer);
    }
    if (liveSessionEventSource) {
      liveSessionEventSource.close();
    }
  });
})();
