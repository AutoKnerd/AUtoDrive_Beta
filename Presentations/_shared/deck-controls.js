(function () {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
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
  const currentFile = pathParts[pathParts.length - 1];
  const deckId = pathParts[1];
  let activeSlideFile = currentFile;

  if (!currentFile.endsWith('.html') || currentFile === 'index.html') return;

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
      <button type="button" class="deck-controls__button" data-action="contract-qr">Contract</button>
      <button type="button" class="deck-controls__button" data-action="reset-session">New Session</button>
      <button type="button" class="deck-controls__button" data-action="view-snapshot">View Snapshot</button>
      <button type="button" class="deck-controls__button" data-action="app-demo">App Demo</button>
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
    <div class="deck-response-rail__label">RESPONSES</div>
    <div class="deck-response-rail__meter">
      <div class="deck-response-rail__fill" data-role="response-fill"></div>
    </div>
    <div class="deck-response-rail__count" data-role="response-count">0</div>
    <div class="deck-response-rail__status" data-role="response-status">WAITING</div>
  `;
  document.body.appendChild(responseRail);

  const presentationShell = document.createElement('div');
  presentationShell.className = 'deck-present-shell';
  presentationShell.innerHTML = `
    <iframe class="deck-present-shell__frame" title="Presented slide"></iframe>
  `;
  document.body.appendChild(presentationShell);

  const menuToggle = controls.querySelector('[data-action="toggle-menu"]');
  const backButton = controls.querySelector('[data-action="back"]');
  const audienceQrButton = controls.querySelector('[data-action="audience-qr"]');
  const contractQrButton = controls.querySelector('[data-action="contract-qr"]');
  const resetSessionButton = controls.querySelector('[data-action="reset-session"]');
  const viewSnapshotButton = controls.querySelector('[data-action="view-snapshot"]');
  const appDemoButton = controls.querySelector('[data-action="app-demo"]');
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
  const responseCountEl = responseRail.querySelector('[data-role="response-count"]');
  const responseFillEl = responseRail.querySelector('[data-role="response-fill"]');
  const responseStatusEl = responseRail.querySelector('[data-role="response-status"]');
  const presentationFrame = presentationShell.querySelector('.deck-present-shell__frame');
  let currentSessionToken = null;
  let currentAudienceUrl = null;
  let responseRefreshTimer = null;
  let liveSessionEventSource = null;
  let lastRespondentCount = -1;
  let lastLiveSessionUpdatedAtEpoch = 0;
  let pendingLocalSlideFile = null;
  let ignoreLiveSessionUntil = 0;
  let presentationShellVisible = false;

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
    return baseUrl.toString();
  };

  const resolveQrOverlayUrl = (title, targetUrl) => {
    const nextUrl = new URL('/live-session/qr', window.location.origin);
    nextUrl.searchParams.set('embed', '1');
    nextUrl.searchParams.set('title', title);
    nextUrl.searchParams.set('url', targetUrl);
    return nextUrl.toString();
  };

  const CONTRACT_QR_TARGET = 'https://drive.google.com/file/d/1IdNGovu30VolsmpX4mGHJ7eRhsQDUM4D/view?usp=share_link';

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
      syncAudienceQrFrame();
    }

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

  const setAudienceQrVisible = (visible) => {
    syncAudienceQrFrame({ title: 'Live QR' });
    audienceQrOverlay.classList.toggle('deck-audience-qr--visible', visible);
    if (audienceQrButton instanceof HTMLButtonElement) {
      audienceQrButton.textContent = visible ? 'Hide Audience QR' : 'Audience QR';
    }
  };

  const openContractQr = () => {
    setMenuOpen(false);
    syncAudienceQrFrame({ title: 'Contract', url: CONTRACT_QR_TARGET });
    audienceQrOverlay.classList.add('deck-audience-qr--visible');
    if (audienceQrButton instanceof HTMLButtonElement) {
      audienceQrButton.textContent = 'Audience QR';
    }
  };

  audienceQrButton?.addEventListener('click', () => {
    setMenuOpen(false);
    setAudienceQrVisible(!audienceQrOverlay.classList.contains('deck-audience-qr--visible'));
  });

  contractQrButton?.addEventListener('click', () => {
    openContractQr();
  });

  resetSessionButton?.addEventListener('click', async () => {
    setMenuOpen(false);
    const shouldReset = window.confirm(
      'Start a fresh audience session? This keeps the history, but resets the live snapshot counts.',
    );
    if (!shouldReset) return;

    try {
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
        lastRespondentCount = -1;
        await syncResponseRail();
      }
    } catch (error) {
      console.error('Unable to reset live session.', error);
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

  appDemoButton?.addEventListener('click', () => {
    setMenuOpen(false);
    window.open('/tour/lee', '_blank', 'noopener,noreferrer');
  });

  copyNotesLinkButton?.addEventListener('click', async () => {
    setMenuOpen(false);
    try {
      await copyPresenterNotesLink();
    } catch (error) {
      console.error('Unable to copy presenter notes link.', error);
    }
  });

  audienceQrCloseButton?.addEventListener('click', () => {
    setAudienceQrVisible(false);
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
  };

  const syncScrollCue = () => {
    const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
    const shouldShow = scrollableDistance > 80 && window.scrollY < scrollableDistance - 64;
    scrollCue.classList.toggle('deck-scroll-cue--visible', shouldShow);
  };

  const syncLiveSessionState = async () => {
    try {
      const response = await fetch('/api/live-session', { cache: 'no-store' });
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

  const syncResponseRail = async () => {
    if (!currentSessionToken) return;
    const currentStep = inferStepFromFile(activeSlideFile, currentIndex + 1);
    const currentSlideNumber = inferSlideNumberFromFile(activeSlideFile, currentIndex + 1);
    const summaryUrl = new URL('/api/live-session/responses', window.location.origin);
    summaryUrl.searchParams.set('deckId', deckId);
    summaryUrl.searchParams.set('slideStep', currentStep);
    summaryUrl.searchParams.set('currentSlide', activeSlideFile);
    summaryUrl.searchParams.set('slideNumber', String(currentSlideNumber));
    summaryUrl.searchParams.set('sessionToken', currentSessionToken);

    try {
      const response = await fetch(summaryUrl.toString(), { cache: 'no-store' });
      if (!response.ok) return;

      const payload = await response.json();
      const respondentCount = Number.isFinite(payload?.respondentCount) ? payload.respondentCount : 0;
      const responseCount = Number.isFinite(payload?.responseCount) ? payload.responseCount : respondentCount;
      const fillPercent = Number.isFinite(payload?.fillPercent)
        ? payload.fillPercent
        : Math.min(100, responseCount * 20);

      if (responseCountEl instanceof HTMLElement) {
        responseCountEl.textContent = String(responseCount);
      }

      if (responseFillEl instanceof HTMLElement) {
        responseFillEl.style.height = `${fillPercent}%`;
      }

      if (responseStatusEl instanceof HTMLElement) {
        responseStatusEl.textContent = responseCount > 0 ? 'LIVE' : 'WAITING';
      }

      responseRail.dataset.state = responseCount > 0 ? 'active' : 'idle';

      if (responseCount !== lastRespondentCount) {
        responseRail.classList.remove('deck-response-rail--pulse');
        void responseRail.offsetWidth;
        responseRail.classList.add('deck-response-rail--pulse');
        window.setTimeout(() => {
          responseRail.classList.remove('deck-response-rail--pulse');
        }, 650);
        lastRespondentCount = responseCount;
      }
    } catch (error) {
      console.error('Unable to refresh response summary.', error);
    }
  };

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
      const qrOverlayEnabled = manifest.audience?.qrOverlayEnabled !== false;
      if (audienceQrButton instanceof HTMLButtonElement && !qrOverlayEnabled) {
        audienceQrButton.style.display = 'none';
      }
      if (!qrOverlayEnabled) {
        setAudienceQrVisible(false);
      }
      activeSlideFile = currentFile;
      syncNavigationState();
      syncScrollCue();
      await pushToAudience(inferStepFromFile(currentFile, currentIndex + 1), currentFile);
      await syncLiveSessionState();
      syncAudienceQrFrame();
      syncResponseRail();

      if (!liveSessionEventSource) {
        liveSessionEventSource = new EventSource('/api/live-session/stream');
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
  responseRefreshTimer = window.setInterval(syncResponseRail, 1800);

  window.addEventListener('beforeunload', () => {
    if (responseRefreshTimer !== null) {
      window.clearInterval(responseRefreshTimer);
    }
    if (liveSessionEventSource) {
      liveSessionEventSource.close();
    }
  });
})();
