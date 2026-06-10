/* Shared ADAS knowledge quiz — the full official ADAS Workshop post-test (the 10
 * knowledge questions; the test's name/dealer/ID items are skipped since we have
 * that from check-in). Single source of truth for questions + answer key. Renders,
 * scores client-side, and reports the score % AND which TOPICS were missed (so the
 * Session Impact finale can show managers what staff needs to work on). */
(function () {
  var QUESTIONS = [
    { id: 'q1', type: 'single', topic: 'ADAS categories', q: 'Which of the following is NOT an ADAS category?',
      options: [['driving', 'Driving'], ['parking', 'Parking'], ['speed', 'Speed'], ['visibility', 'Visibility']],
      correct: ['speed'] },
    { id: 'q2', type: 'single', topic: 'Purpose of ADAS', q: "What's the purpose of ADAS?",
      options: [['a', 'Designed to help protect vehicle occupants during or after a crash'],
                ['b', 'Designed to aid the driver in certain situations'],
                ['c', 'Designed to help the driver maintain vehicle control, drive safely & avoid accidents'],
                ['d', 'None of the above']],
      correct: ['b'] },
    { id: 'q3', type: 'single', topic: 'FCA lane-change technologies', q: 'Which Forward Collision-Avoidance Assist technology helps steer to prevent a collision when an oncoming vehicle is detected while changing lanes?',
      options: [['a', 'Junction Turning'], ['b', 'Lane Change Oncoming'], ['c', 'Lane Change Side'], ['d', 'Evasive Steering Assist']],
      correct: ['b'] },
    { id: 'q4', type: 'single', topic: 'Kia Resource Center resources', q: 'Which resource(s) can you find on the Kia Resource Center to help you on your ADAS journey?',
      options: [['a', 'ADAS Resource page'], ['b', 'PRGs'], ['c', 'Quick Tips'], ['d', 'All of the above']],
      correct: ['d'] },
    { id: 'q5', type: 'single', topic: 'Feature → category', q: 'Which ADAS category do Smart Cruise Control features fall under?',
      options: [['driving', 'Driving'], ['parking', 'Parking'], ['visibility', 'Visibility'], ['none', 'None of the above']],
      correct: ['driving'] },
    { id: 'q6', type: 'single', topic: 'Helping customers remotely', q: 'How can you best help a customer understand an ADAS feature without being with them in person?',
      options: [['a', 'Check the ADAS Resource Page on KiaResourceCenter.com'],
                ['b', 'Email them a relevant Kia Features & Functions YouTube video'],
                ['c', 'Look for helpful articles on KDealer+'],
                ['d', 'All of the above']],
      correct: ['b'] },
    { id: 'q7', type: 'single', topic: 'Communicating ADAS value', q: 'To best help customers see the value of ADAS features, you should ___.',
      options: [['a', "Connect the benefits of the features to the customer's needs"],
                ['b', 'Suggest they look up more on the technologies later'],
                ['c', 'Explain how to subscribe to Kia Connect'],
                ['d', 'Show customers where the vehicle manual is located']],
      correct: ['a'] },
    { id: 'q8', type: 'single', topic: 'Customer expectations', q: 'TRUE or FALSE: Customers expect you to explain ADAS features and their benefits.',
      options: [['true', 'True'], ['false', 'False']],
      correct: ['true'] },
    { id: 'q9', type: 'multi', topic: 'Why ADAS knowledge matters', q: 'Why is it important for you to be knowledgeable of ADAS features? (Select all that apply.)',
      options: [['a', 'To help customers understand the function and value of these systems'],
                ['b', 'Clear, confident explanations improve the customer experience'],
                ['c', 'Eliminates the need for post-Delivery follow-up calls']],
      correct: ['a', 'b'] },
    { id: 'q10', type: 'multi', topic: '2027 Telluride interior sensors', q: 'Which of the following are interior sensors in the 2027 Telluride? (Select all that apply.)',
      options: [['grip', 'Steering Wheel Grip Sensor'], ['heat', 'Heated Steering Wheel Temperature Sensor'],
                ['iccd', 'In-Cabin Camera-Driver (ICC-D)'], ['bvc', 'Blind-Spot View Camera']],
      correct: ['grip', 'iccd'] },
  ];

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var s = new Set(a);
    return b.every(function (x) { return s.has(x); });
  }

  function injectStyle() {
    if (document.getElementById('adas-quiz-style')) return;
    var css = document.createElement('style');
    css.id = 'adas-quiz-style';
    css.textContent =
      '.aq-q{margin-bottom:18px}.aq-q .aq-prompt{font-weight:600;font-size:15px;margin:0 0 10px}' +
      '.aq-opt{display:flex;align-items:center;gap:10px;background:#161b22;border:1px solid #2a313c;border-radius:12px;' +
      'padding:11px 12px;margin-bottom:8px;color:#e6e9ee;font:inherit;font-size:13px;cursor:pointer;width:100%;text-align:left;transition:all .12s}' +
      '.aq-opt .aq-box{width:18px;height:18px;border:2px solid #3a4452;border-radius:5px;flex:none;display:flex;align-items:center;justify-content:center;font-size:13px;color:#04222f}' +
      '.aq-opt.aq-on{border-color:#38bdf8;background:rgba(56,189,248,.08)}.aq-opt.aq-on .aq-box{background:#38bdf8;border-color:#38bdf8}' +
      '.aq-submit{width:100%;background:#38bdf8;color:#04222f;border:none;border-radius:12px;padding:14px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;margin-top:6px}' +
      '.aq-submit:disabled{opacity:.5}.aq-status{text-align:center;font-size:13px;min-height:20px;margin-top:10px;color:#38bdf8}';
    document.head.appendChild(css);
  }

  // render(container, { onScore: fn(scorePct, correctCount, total, missedTopics[]) })
  function render(container, opts) {
    opts = opts || {};
    injectStyle();
    var picks = {};
    QUESTIONS.forEach(function (q) {
      picks[q.id] = [];
      var wrap = document.createElement('div');
      wrap.className = 'aq-q';
      var p = document.createElement('p');
      p.className = 'aq-prompt';
      p.textContent = q.q;
      wrap.appendChild(p);
      q.options.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aq-opt';
        btn.innerHTML = '<span class="aq-box"></span><span>' + opt[1] + '</span>';
        btn.onclick = function () {
          if (q.type === 'single') {
            picks[q.id] = [opt[0]];
            wrap.querySelectorAll('.aq-opt').forEach(function (b) { b.classList.remove('aq-on'); b.querySelector('.aq-box').textContent = ''; });
            btn.classList.add('aq-on'); btn.querySelector('.aq-box').textContent = '●';
          } else {
            var i = picks[q.id].indexOf(opt[0]);
            if (i >= 0) { picks[q.id].splice(i, 1); btn.classList.remove('aq-on'); btn.querySelector('.aq-box').textContent = ''; }
            else { picks[q.id].push(opt[0]); btn.classList.add('aq-on'); btn.querySelector('.aq-box').textContent = '✓'; }
          }
        };
        wrap.appendChild(btn);
      });
      container.appendChild(wrap);
    });

    var submit = document.createElement('button');
    submit.className = 'aq-submit';
    submit.textContent = 'Submit answers';
    var status = document.createElement('p');
    status.className = 'aq-status';
    submit.onclick = function () {
      var answered = QUESTIONS.every(function (q) { return picks[q.id].length > 0; });
      if (!answered) { status.textContent = 'Answer every question first.'; status.style.color = '#ffb4ab'; return; }
      var correct = 0;
      var missedTopics = [];
      QUESTIONS.forEach(function (q) {
        if (sameSet(picks[q.id], q.correct)) correct += 1; else missedTopics.push(q.topic);
      });
      var pct = Math.round((correct / QUESTIONS.length) * 100);
      submit.disabled = true;
      status.style.color = '#38bdf8';
      status.textContent = 'Submitted! You got ' + correct + ' of ' + QUESTIONS.length + '.';
      if (typeof opts.onScore === 'function') opts.onScore(pct, correct, QUESTIONS.length, missedTopics);
    };
    container.appendChild(submit);
    container.appendChild(status);
  }

  window.AdasQuiz = { questions: QUESTIONS, render: render };
})();
