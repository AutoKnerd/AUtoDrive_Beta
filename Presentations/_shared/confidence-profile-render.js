(function () {
  // Renders the DRIVE_OS "Driver Confidence Profile" (slide 32) from live data.
  // Works on BOTH surfaces with the same markup:
  //  - the companion (per-person)  → uses window.AudienceKit (uid + sessionToken)
  //  - the main slide (room view)  → uses window.DeckLive (room sessionToken)
  // The numbers come from the deterministic engine; the insight is Sprocket AI.

  var GAUGE_CIRCUMFERENCE = 2 * Math.PI * 45; // r=45 in the SVG viewBox

  function textNodesMatching(re) {
    var out = [];
    document.querySelectorAll('span, h3, p').forEach(function (el) {
      if (re.test((el.textContent || '').trim())) out.push(el);
    });
    return out;
  }
  function firstMatching(re) { return textNodesMatching(re)[0] || null; }

  function setFocus(labelRe, value) {
    var label = firstMatching(labelRe);
    if (!label || !value) return;
    // label span sits in a header row; the value is the .text-body-lg sibling in the card.
    var card = label.parentElement && label.parentElement.parentElement;
    var valueEl = card && card.querySelector('.text-body-lg');
    if (valueEl) valueEl.textContent = value;
  }

  function setGauge(score) {
    var num = document.querySelector('.gradient-text');
    if (num) num.textContent = String(score);
    var ring = document.querySelector('.animate-gauge');
    if (ring) {
      var offset = GAUGE_CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score)) / 100);
      ring.setAttribute('stroke-dasharray', GAUGE_CIRCUMFERENCE.toFixed(1));
      ring.setAttribute('stroke-dashoffset', offset.toFixed(1));
    }
  }

  function setInsight(text) {
    var label = firstMatching(/AI_INSIGHT_ENGINE/i);
    var p = label && label.parentElement && label.parentElement.querySelector('p');
    if (p && text) p.textContent = text;
  }

  function setLearningFocus(text) {
    var label = firstMatching(/^LEARNING FOCUS$/i);
    var p = label && label.parentElement && label.parentElement.querySelector('p');
    if (p && text) p.textContent = text;
  }

  function setBar(labelRe, pct) {
    var label = firstMatching(labelRe);
    if (!label) return;
    var block = label.parentElement && label.parentElement.parentElement; // header row -> block
    if (!block) return;
    var pctEl = block.querySelector('.text-telemetry-num');
    if (pctEl) pctEl.textContent = pct + '%';
    var row = block.querySelector('.h-3');
    if (row && row.children.length >= 2) {
      row.children[0].style.flex = String(pct);
      row.children[1].style.flex = String(Math.max(0, 100 - pct));
    }
  }

  // Room mode: relabel the three analysis bars as car areas and show the
  // percentage of the room that needs assistance in each.
  function setDimensionBars(dimensions, heading) {
    var pctEls = document.querySelectorAll('.text-telemetry-num');
    dimensions.forEach(function (d, i) {
      var pctEl = pctEls[i];
      if (!pctEl) return;
      var header = pctEl.parentElement;
      var labelSpan = header && header.querySelector('span'); // first span = label
      if (labelSpan) labelSpan.textContent = d.label;
      var pct = Math.round(d.pct);
      pctEl.textContent = pct + '%';
      var block = header && header.parentElement;
      var row = block && block.querySelector('.h-3');
      if (row && row.children.length >= 2) {
        row.children[0].style.flex = String(pct);
        row.children[1].style.flex = String(Math.max(0, 100 - pct));
      }
    });
    // Rename the section heading so the new meaning is clear.
    var headingEl = [].slice.call(document.querySelectorAll('h3')).find(function (h) {
      return /AI LEARNING ANALYSIS|ASSISTANCE NEEDED|PERSONA MATCH/i.test((h.textContent || '').trim());
    });
    if (headingEl) headingEl.textContent = heading || 'Assistance Needed By Area';
  }

  function setFeatures(features) {
    if (!Array.isArray(features) || !features.length) return;
    var grid = document.querySelector('[class*="lg:grid-cols-4"]');
    if (!grid) return;
    var cards = grid.querySelectorAll('button');
    cards.forEach(function (card, i) {
      var f = features[i];
      if (!f) return;
      var label = card.querySelector('.text-label-caps');
      if (label) label.textContent = f.label;
      var icon = card.querySelector('[data-icon], .material-symbols-outlined');
      if (icon && f.icon) { icon.textContent = f.icon; icon.setAttribute('data-icon', f.icon); }
      // Make the card a jump-to-slide button when (a) a deck is present
      // (the main slide, not the companion) and (b) the slide map knows this
      // feature. Use onclick (not addEventListener) so polls don't stack handlers.
      var target = featureSlide(f.label);
      var canJump = target && window.DeckLive && typeof window.DeckLive.goToSlideNumber === 'function';
      if (canJump) {
        card.style.cursor = 'pointer';
        card.title = 'Go to slide ' + target;
        card.classList.add('ak-jump');
        card.onclick = function () { window.DeckLive.goToSlideNumber(target); };
      } else {
        card.onclick = null;
        card.style.cursor = '';
        card.classList.remove('ak-jump');
        card.removeAttribute('title');
      }
    });
  }

  // Resolve a feature label to a deck slide via the per-deck map the slide
  // defines (window.FEATURE_SLIDE_MAP). Tries an exact label match, then keyword
  // containment so map keys can be short ("blind-spot view": 20).
  function featureSlide(label) {
    var map = window.FEATURE_SLIDE_MAP;
    if (!map || !label) return null;
    var L = String(label).toLowerCase();
    if (map[L]) return map[L];
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (L.indexOf(keys[i].toLowerCase()) >= 0) return map[keys[i]];
    }
    return null;
  }

  function setHeader(mode, profile) {
    var h1 = null;
    document.querySelectorAll('h1').forEach(function (el) {
      if (/driver profile|collective adas|confidence|consulting|scorecard|performance/i.test((el.textContent || '').trim())) h1 = h1 || el;
    });
    if (!h1) h1 = document.querySelector('h1');
    if (!h1) return;
    var sub = h1.parentElement && h1.parentElement.querySelector('p');
    // Any report can supply its own labels; otherwise fall back to confidence copy.
    if (profile.title) {
      h1.textContent = profile.title;
      if (sub && profile.subtitle) sub.textContent = profile.subtitle;
      return;
    }
    if (mode === 'room') {
      h1.textContent = 'Collective ADAS Confidence';
      if (sub) {
        var n = profile.participantCount || 0;
        sub.textContent = n > 0 ? ('GENERATED FROM ' + n + ' RESPONSE' + (n === 1 ? '' : 'S')) : 'AWAITING ROOM RESPONSES';
      }
    } else {
      h1.textContent = 'Your Personalized Driver Profile';
      if (sub) sub.textContent = 'GENERATED FROM YOUR RESPONSES';
    }
  }

  function render(profile, mode) {
    if (!profile) return;
    setHeader(mode, profile);
    setGauge(profile.confidenceScore);
    setFocus(/PRIMARY FOCUS AREA/i, profile.primaryFocus);
    setFocus(/SECONDARY FOCUS AREA/i, profile.secondaryFocus);
    setInsight(profile.insight);
    setLearningFocus(profile.learningFocus);
    if (Array.isArray(profile.dimensions) && profile.dimensions.length === 3) {
      setDimensionBars(profile.dimensions, profile.dimensionsHeading);
    } else {
      setBar(/Areas of Confidence/i, profile.areasOfConfidencePct);
      setBar(/Areas for Growth/i, profile.areasForGrowthPct);
      setBar(/Recommended Feature Focus/i, profile.recommendedFocusPct);
    }
    setFeatures(profile.features);
  }

  function resolveContext() {
    var kit = window.AudienceKit;
    if (kit && kit.session && kit.session.sessionToken) {
      return {
        mode: 'individual',
        sessionToken: kit.session.sessionToken,
        deckId: kit.session.deckId || 'adas-ppt-test',
        userId: typeof kit.uid === 'function' ? kit.uid() : '',
      };
    }
    var live = window.DeckLive;
    var token = live && typeof live.getSessionToken === 'function' ? live.getSessionToken() : null;
    if (token) {
      return { mode: 'room', sessionToken: token, deckId: (live && live.deckId) || 'adas-ppt-test', userId: '' };
    }
    return null;
  }

  var lastRendered = '';
  async function poll() {
    var ctx = resolveContext();
    if (!ctx) return; // not in a live session yet — keep the static design as-is
    try {
      var url = new URL('/api/live-session/ai-profile', window.location.origin);
      url.searchParams.set('sessionToken', ctx.sessionToken);
      url.searchParams.set('deckId', ctx.deckId);
      url.searchParams.set('mode', ctx.mode);
      url.searchParams.set('report', window.AI_PROFILE_REPORT || 'confidence');
      if (ctx.userId) url.searchParams.set('userId', ctx.userId);
      var res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) return;
      var data = await res.json();
      if (data && data.profile) {
        // Only touch the DOM when something actually changed — otherwise the
        // insight text and bars would visibly re-render on every poll.
        var signature = JSON.stringify(data.profile);
        if (signature === lastRendered) return;
        render(data.profile, data.mode || ctx.mode);
        lastRendered = signature; // only lock in after a successful render
      }
    } catch (e) {
      // keep the slide usable even if the AI endpoint blips
      console.error('confidence-profile-render poll error', e);
    }
  }

  function start() {
    poll();
    // The room token can arrive a beat after load; poll a few times quickly, then settle.
    window.setInterval(poll, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
