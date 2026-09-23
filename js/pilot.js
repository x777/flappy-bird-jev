(function () {
  'use strict';

  var hooks = window.FlappyHooks;
  var Engine = window.FlappyEngine;
  if (!hooks || !Engine) return;

  var button = document.getElementById('jev');
  var panel = document.getElementById('jev-panel');
  var statusEl = document.getElementById('jev-status');
  var choiceEl = document.getElementById('jev-choice');
  var metaEl = document.getElementById('jev-meta');

  var jevOn = false;
  var arming = false;
  var askTimer = null;
  var restartTimer = null;
  var seenPhase = hooks.getState().phase;
  var inFlight = 0;
  var emaRtt = 320;
  var quietUntil = 0;

  function updateButton() {
    button.setAttribute('aria-pressed', jevOn ? 'true' : 'false');
    button.textContent = jevOn ? 'Я сам' : 'Летит Jev';
  }

  function showProblem(text, detail) {
    panel.hidden = false;
    panel.classList.add('is-bad');
    statusEl.textContent = text;
    choiceEl.textContent = '—';
    metaEl.textContent = detail || '';
  }

  function showChoice(choice, probs, rtt, applied) {
    panel.hidden = false;
    panel.classList.remove('is-bad');
    var flap = typeof probs.FLAP === 'number' ? probs.FLAP : 0;
    var wait = typeof probs.WAIT === 'number' ? probs.WAIT : 0;
    var picked = choice === 'FLAP' ? flap : wait;
    statusEl.textContent = applied ? 'Jev ведёт' : 'Ответ опоздал';
    choiceEl.textContent = (choice === 'FLAP' ? 'Взмах' : 'Ждать') + ' · ' + Math.round(picked * 100) + '%';
    metaEl.textContent = Math.round(rtt) + ' мс · в пути ' + inFlight;
  }

  function messageFor(body, status) {
    if (location.protocol === 'file:') return 'Открой через npm start';
    if (body && body.error === 'no_key') return 'Нет ключа в .env';
    if (status === 429) return 'Слишком часто, жду';
    if (body && body.error === 'timeout') return 'Jev не успел';
    return 'Jev не отвечает';
  }

  function scheduleRestart() {
    if (restartTimer) return;
    restartTimer = setTimeout(function () {
      restartTimer = null;
      if (!jevOn) return;
      if (hooks.getState().phase !== 'over') return;
      hooks.restart();
      hooks.queueFlap();
      seenPhase = hooks.getState().phase;
    }, 1100);
  }

  function ask() {
    var phase = hooks.getState().phase;
    if (jevOn && phase === 'over' && seenPhase !== 'over') scheduleRestart();
    seenPhase = phase;
    if (!jevOn || phase !== 'play') return;
    if (performance.now() < quietUntil || inFlight >= 6) return;
    var lead = Math.max(80, Math.min(450, emaRtt));
    var obs = Engine.observe(hooks.getState(), lead / 1000);
    if (!obs) return;
    var epoch = hooks.epoch();
    var due = performance.now() + lead;
    var sent = performance.now();
    inFlight += 1;
    fetch('/api/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obs)
    }).then(function (res) {
      return res.json().then(function (body) {
        return { ok: res.ok, status: res.status, body: body };
      }).catch(function () {
        return { ok: res.ok, status: res.status, body: {} };
      });
    }).then(function (res) {
      inFlight = Math.max(0, inFlight - 1);
      if (!jevOn) return;
      var rtt = performance.now() - sent;
      emaRtt = emaRtt * 0.75 + rtt * 0.25;
      if (!res.ok) {
        quietUntil = performance.now() + (res.status === 429 ? 900 : 500);
        showProblem(messageFor(res.body, res.status));
        return;
      }
      var choice = res.body.choice;
      var probs = res.body.probabilities || {};
      var apply = function () {
        var live = epoch === hooks.epoch() && jevOn && hooks.getState().phase === 'play';
        showChoice(choice, probs, rtt, live);
        if (live && choice === 'FLAP') hooks.queueFlap();
      };
      var wait = due - performance.now();
      if (epoch === hooks.epoch() && wait > 15) setTimeout(apply, wait);
      else apply();
    }).catch(function () {
      inFlight = Math.max(0, inFlight - 1);
      if (!jevOn) return;
      quietUntil = performance.now() + 500;
      showProblem(messageFor(null, 0));
    });
  }

  function startAsking() {
    if (askTimer) return;
    askTimer = setInterval(ask, 70);
  }

  function stopAsking() {
    if (askTimer) clearInterval(askTimer);
    askTimer = null;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = null;
  }

  function enable() {
    if (arming || jevOn) return;
    arming = true;
    panel.hidden = false;
    panel.classList.remove('is-bad');
    statusEl.textContent = 'Проверяю…';
    choiceEl.textContent = '—';
    metaEl.textContent = '';
    fetch('/api/health').then(function (res) { return res.json(); }).then(function (health) {
      if (!health || !health.configured) {
        arming = false;
        showProblem('Нет ключа в .env', 'openrouter.ai/keys');
        updateButton();
        return;
      }
      arming = false;
      jevOn = true;
      updateButton();
      if (hooks.getState().phase === 'over') hooks.restart();
      if (hooks.getState().phase === 'ready') hooks.queueFlap();
      seenPhase = hooks.getState().phase;
      startAsking();
      statusEl.textContent = 'Спрашиваю…';
    }).catch(function () {
      arming = false;
      showProblem(location.protocol === 'file:' ? 'Открой через npm start' : 'Сервер Jev недоступен');
      updateButton();
    });
  }

  function disable() {
    jevOn = false;
    stopAsking();
    panel.hidden = true;
    updateButton();
  }

  button.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  button.addEventListener('click', function (e) {
    e.stopPropagation();
    hooks.audio();
    if (jevOn) disable();
    else if (!panel.hidden && panel.classList.contains('is-bad')) panel.hidden = true;
    else enable();
  });

  window.FlappyJev = {
    isOn: function () { return jevOn; },
    handRestart: function () {
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      if (!jevOn) return;
      if (hooks.getState().phase === 'ready') hooks.queueFlap();
      seenPhase = hooks.getState().phase;
    }
  };

  updateButton();
})();
