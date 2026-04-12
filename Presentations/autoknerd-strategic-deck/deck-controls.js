(function () {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length < 3 || pathParts[0] !== 'Presentations') return;

  const deckBasePath = `/${pathParts.slice(0, 2).join('/')}`;
  const currentFile = pathParts[pathParts.length - 1];

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
      <button type="button" class="deck-controls__button" data-action="notes">Hide Notes</button>
      <button type="button" class="deck-controls__button deck-controls__button--primary" data-action="present">Present</button>
    </div>
  `;

  document.body.appendChild(controls);

  const nav = document.createElement('div');
  nav.className = 'deck-nav';
  nav.innerHTML = `
    <button type="button" class="deck-nav__button" data-action="prev">Prev</button>
    <div class="deck-nav__meta" data-role="meta">Slide</div>
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

  const menuToggle = controls.querySelector('[data-action="toggle-menu"]');
  const backButton = controls.querySelector('[data-action="back"]');
  const audienceQrButton = controls.querySelector('[data-action="audience-qr"]');
  const notesButton = controls.querySelector('[data-action="notes"]');
  const presentButton = controls.querySelector('[data-action="present"]');
  const prevButton = nav.querySelector('[data-action="prev"]');
  const nextButton = nav.querySelector('[data-action="next"]');
  const metaLabel = nav.querySelector('[data-role="meta"]');
  const notesPanels = Array.from(document.querySelectorAll('.hideable-speaker-notes'));
  const notesStorageKey = `deck-notes-hidden:${deckBasePath}`;

  const slideStepMap = {
    '01-the-hook.html': 'slide1',
    '02-the-problem.html': 'slide2',
    '03-root-cause.html': 'slide3',
    '04-the-shift.html': 'slide4',
    '05-the-system.html': 'slide5',
    '06-autodrivecx.html': 'slide6',
    '07-precision-insight.html': 'slide7',
    '08-weekly-cadence.html': 'slide8',
    '09-autoforge.html': 'slide9',
    '10-the-transformation.html': 'slide10',
    '11-business-impact.html': 'slide11',
    '12-the-philosophy.html': 'slide12',
    '13-the-vision.html': 'slide13',
    '14-call-to-action.html': 'slide14',
  };

  const pushToAudience = async (step) => {
    const currentStep = typeof step === 'string' && step ? step : (slideStepMap[currentFile] || 'slide1');

    try {
      await fetch('/api/live-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentStep,
          currentSlide: currentFile,
        }),
        keepalive: true,
      });
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
    window.location.href = `${deckBasePath}`;
  });

  audienceQrButton?.addEventListener('click', () => {
    setMenuOpen(false);
    window.open('/live-session/qr', '_blank', 'noopener,noreferrer');
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
    presentButton.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Present';
  };

  presentButton?.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error('Unable to toggle fullscreen presentation mode.', error);
    } finally {
      updatePresentLabel();
      setMenuOpen(false);
    }
  });

  document.addEventListener('fullscreenchange', updatePresentLabel);
  updatePresentLabel();

  let slideOrder = [];
  let currentIndex = -1;

  const navigateByOffset = (offset) => {
    if (!slideOrder.length || currentIndex === -1) return;

    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= slideOrder.length) return;

    window.location.href = `${deckBasePath}/${slideOrder[nextIndex]}`;
  };

  const syncNavigationState = () => {
    currentIndex = slideOrder.indexOf(currentFile);

    if (metaLabel && currentIndex >= 0) {
      metaLabel.textContent = `Slide ${currentIndex + 1} / ${slideOrder.length}`;
    }

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

  prevButton?.addEventListener('click', () => navigateByOffset(-1));
  nextButton?.addEventListener('click', () => navigateByOffset(1));
  prevZone.addEventListener('click', () => navigateByOffset(-1));
  nextZone.addEventListener('click', () => navigateByOffset(1));
  window.addEventListener('scroll', syncScrollCue, { passive: true });
  window.addEventListener('resize', syncScrollCue);

  fetch(`${deckBasePath}/manifest.json`, { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((manifest) => {
      if (!manifest || !Array.isArray(manifest.slides)) return;
      slideOrder = manifest.slides.filter((slide) => typeof slide === 'string');
      syncNavigationState();
      syncScrollCue();
    })
    .catch((error) => {
      console.error('Unable to load deck manifest.', error);
    });

  pushToAudience(slideStepMap[currentFile] || 'slide1');
  syncScrollCue();
})();
