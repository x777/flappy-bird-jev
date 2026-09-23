(function () {
  'use strict';

  var E = window.FlappyEngine;
  var C = E.C;

  var MEDALS = [
    { id: 'none', min: 0, name: 'Без медали', next: 'Жёлудь ждёт на 8 очках' },
    { id: 'bronze', min: 8, name: 'Жёлудь', next: 'Дальше — шишка, это 15' },
    { id: 'silver', min: 15, name: 'Шишка', next: 'Дальше — золотая ветвь, это 25' },
    { id: 'gold', min: 25, name: 'Золотая ветвь', next: 'Дальше — звезда рощи, это 40' },
    { id: 'star', min: 40, name: 'Звезда рощи', next: 'Выше этой медали только небо' }
  ];

  var GLYPH = {
    bronze: '<svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true"><ellipse cx="32" cy="40" rx="13" ry="15" fill="#3b2412"/><path d="M18 36c2-12 28-12 28 0" fill="#234626"/><rect x="30" y="16" width="4" height="12" rx="2" fill="#234626"/></svg>',
    silver: '<svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true"><ellipse cx="32" cy="34" rx="12" ry="16" fill="#2c3338"/><ellipse cx="32" cy="28" rx="8" ry="6" fill="none" stroke="#2c3338" stroke-width="3"/><ellipse cx="32" cy="38" rx="9" ry="6" fill="none" stroke="#2c3338" stroke-width="3"/><ellipse cx="32" cy="48" rx="7" ry="5" fill="none" stroke="#2c3338" stroke-width="3"/></svg>',
    gold: '<svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true"><path d="M10 40c10-2 14-12 18-22 4 10 8 20 18 22-8 2-12 8-18 16-6-8-10-14-18-16z" fill="#5c3d10"/><path d="M32 18c2 6-2 10-6 12" fill="none" stroke="#5c3d10" stroke-width="3" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true"><path d="M32 8l6.5 16.5L56 27l-13 11 4 17L32 46 17 55l4-17L8 27l17.5-2.5z" fill="#1c2438"/></svg>'
  };

  var MORNING = {
    top: '#7EC8EA', mid: '#C7E7F7', horizon: '#FFE4BC',
    hillFar: '#B7D3A4', hillNear: '#8FB573',
    grass: '#67A84A', grassDeep: '#3E7A34',
    dirt: '#C9A56E', dirtDeep: '#A78452',
    sun: '#FFE56A', sunGlow: '#FFD27A', cloud: '#FFFDF8', fog: '#FFE7C8',
    bark0: '#D9D0C2', bark1: '#F8F4EC', bark2: '#E7E0D4', bark3: '#B7AA98',
    moss: '#3E6B42', mossHi: '#8FBF78', mark: '#2A241F', crown: '#6E9A58'
  };

  var SUNSET = {
    top: '#35517E', mid: '#E47862', horizon: '#FFB067',
    hillFar: '#6C5E86', hillNear: '#4F6A4E',
    grass: '#3E6A38', grassDeep: '#274826',
    dirt: '#8C6244', dirtDeep: '#6A4632',
    sun: '#FF8A3D', sunGlow: '#FFB15A', cloud: '#FFD0B8', fog: '#F7A07A',
    bark0: '#C9C2B6', bark1: '#E6E0D6', bark2: '#D2CBC0', bark3: '#9A8E80',
    moss: '#2C4E34', mossHi: '#6E9A58', mark: '#241E1A', crown: '#3E5A40'
  };

  var NIGHT = {
    top: '#0C122B', mid: '#1A2A52', horizon: '#2A4468',
    hillFar: '#182033', hillNear: '#142418',
    grass: '#1A3A26', grassDeep: '#102616',
    dirt: '#3A3228', dirtDeep: '#2A241E',
    sun: '#F4E7C4', sunGlow: '#C9D7F2', cloud: '#8FA4C8', fog: '#1A3050',
    bark0: '#C5CED6', bark1: '#E6EEF4', bark2: '#D0D8E0', bark3: '#8E9AAA',
    moss: '#1E3A2A', mossHi: '#4E7A58', mark: '#1A1E24', crown: '#1A3322'
  };

  var playfield = document.getElementById('playfield');
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });
  var liveScore = document.getElementById('live-score');
  var liveNum = document.getElementById('live-score-num');
  var readyBest = document.getElementById('ready-best');
  var railBest = document.getElementById('rail-best');
  var railNow = document.getElementById('rail-now');
  var overUi = document.getElementById('over-ui');
  var againBtn = document.getElementById('again');
  var muteBtn = document.getElementById('mute');
  var muteIcon = document.getElementById('mute-icon');
  var medalEl = document.getElementById('medal');
  var medalGlyph = document.getElementById('medal-glyph');
  var medalName = document.getElementById('medal-name');
  var medalNext = document.getElementById('medal-next');
  var finalScore = document.getElementById('final-score');
  var finalBest = document.getElementById('final-best');
  var ribbon = document.getElementById('ribbon');
  var theme = document.querySelector('meta[name="theme-color"]');
  var medalNodes = document.querySelectorAll('.medals li');

  var BEST_KEY = 'flappy-birch-best';
  var MUTE_KEY = 'flappy-birch-mute';
  var STEP = 1 / 60;

  var state = E.create((Date.now() >>> 0) || 1);
  state.best = loadNum(BEST_KEY);
  var queued = false;
  var flapEpoch = 0;
  var acc = 0;
  var shownDay = 0;
  var shake = 0;
  var flash = 0;
  var particles = [];
  var celebrateRecord = false;
  var muted = loadNum(MUTE_KEY) === 1;
  var actx = null;
  var master = null;
  var scorePop = 0;

  var ICON_ON = '<path fill="currentColor" d="M4 9h3.5L12 5.2v13.6L7.5 15H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15.2 9.2a3.6 3.6 0 010 5.6M17.6 7a6.4 6.4 0 010 10"/>';
  var ICON_OFF = '<path fill="currentColor" d="M4 9h3.5L12 5.2v13.6L7.5 15H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 9.5l5 5M21 9.5l-5 5"/>';

  function loadNum(key) {
    try { return Math.max(0, Number(localStorage.getItem(key)) || 0); }
    catch (err) { return 0; }
  }

  function saveNum(key, value) {
    try { localStorage.setItem(key, String(value)); }
    catch (err) { /* private mode */ }
  }

  function medalFor(score) {
    var found = MEDALS[0];
    for (var i = 0; i < MEDALS.length; i++) {
      if (score >= MEDALS[i].min) found = MEDALS[i];
    }
    return found;
  }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixHex(a, b, t) {
    var A = hexToRgb(a);
    var B = hexToRgb(b);
    var c = [0, 1, 2].map(function (i) {
      return Math.round(A[i] + (B[i] - A[i]) * t);
    });
    return '#' + c.map(function (v) {
      return v.toString(16).padStart(2, '0');
    }).join('');
  }

  function mixPal(a, b, t) {
    var out = {};
    Object.keys(a).forEach(function (key) {
      out[key] = mixHex(a[key], b[key], t);
    });
    return out;
  }

  function palette(day) {
    if (day < 0.55) return mixPal(MORNING, SUNSET, day / 0.55);
    return mixPal(SUNSET, NIGHT, (day - 0.55) / 0.45);
  }

  function wrap(v, m) {
    return ((v % m) + m) % m;
  }

  function mulberry(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(x, y, w, h, r) {
    var rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function ensureAudio() {
    if (muted) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) {
        actx = new AC();
        master = actx.createGain();
        master.gain.value = 0.8;
        master.connect(actx.destination);
      }
      if (actx.state === 'suspended') actx.resume();
    } catch (err) { /* autoplay */ }
  }

  function tone(freq, dur, type, vol, endFreq) {
    if (muted || !actx || !master) return;
    var t0 = actx.currentTime;
    var osc = actx.createOscillator();
    var gain = actx.createGain();
    var filter = actx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
    filter.type = 'lowpass';
    filter.frequency.value = 2800;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (muted || !actx || !master) return;
    var n = Math.max(1, Math.floor(actx.sampleRate * dur));
    var buf = actx.createBuffer(1, n, actx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = actx.createBufferSource();
    src.buffer = buf;
    var filter = actx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    var gain = actx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  var sfx = {
    flap: function () { tone(620, 0.09, 'triangle', 0.06, 280); },
    score: function () {
      tone(880, 0.08, 'sine', 0.06);
      setTimeout(function () { tone(1175, 0.12, 'sine', 0.05); }, 70);
    },
    chime: function () {
      tone(784, 0.1, 'sine', 0.06);
      setTimeout(function () { tone(1046, 0.14, 'sine', 0.05); }, 90);
    },
    hit: function () { noise(0.18, 0.18, 520); tone(196, 0.22, 'sine', 0.07, 70); },
    over: function () { tone(320, 0.28, 'sine', 0.05, 90); },
    record: function () {
      tone(523, 0.1, 'sine', 0.06);
      setTimeout(function () { tone(659, 0.1, 'sine', 0.05); }, 90);
      setTimeout(function () { tone(784, 0.18, 'sine', 0.05); }, 180);
    }
  };

  function setMuted(next) {
    muted = next;
    muteBtn.classList.toggle('is-muted', muted);
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    muteIcon.innerHTML = muted ? ICON_OFF : ICON_ON;
    saveNum(MUTE_KEY, muted ? 1 : 0);
  }

  function spawnFeathers(x, y, count, power) {
    for (var i = 0; i < count; i++) {
      if (particles.length > 90) particles.shift();
      particles.push({
        kind: 'feather',
        x: x + (Math.random() - 0.3) * 10,
        y: y + (Math.random() - 0.5) * 12,
        vx: -40 - Math.random() * power,
        vy: (Math.random() - 0.6) * power,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 8,
        w: 3 + Math.random() * 4,
        h: 1.4 + Math.random() * 1.4,
        color: ['#E24A34', '#C56A3E', '#FFE6D0', '#F2B433'][i % 4],
        life: 0.55 + Math.random() * 0.35,
        age: 0
      });
    }
  }

  function spawnSparks(x, y) {
    for (var i = 0; i < 10; i++) {
      var a = (Math.PI * 2 * i) / 10;
      particles.push({
        kind: 'spark',
        x: x,
        y: y,
        vx: Math.cos(a) * 70,
        vy: Math.sin(a) * 70,
        life: 0.4,
        age: 0,
        color: i % 2 ? '#FFE7A8' : '#FFF'
      });
    }
    particles.push({
      kind: 'label',
      text: '+1',
      x: x + 26,
      y: y - 18,
      vy: -36,
      life: 0.55,
      age: 0
    });
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      if (p.kind === 'label') {
        p.y += p.vy * dt;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'feather') {
        p.vy += 280 * dt;
        p.rot += p.spin * dt;
      }
    }
  }

  function handle(events) {
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'start') noise(0.12, 0.05, 1400);
      if (e.type === 'flap') {
        sfx.flap();
        spawnFeathers(C.BIRD_X - 8, state.bird.y, 4, 80);
      }
      if (e.type === 'score') {
        sfx.score();
        scorePop = 1;
        spawnSparks(C.BIRD_X, state.bird.y);
        var prev = medalFor(e.score - 1);
        var now = medalFor(e.score);
        if (now.id !== prev.id) {
          sfx.chime();
          particles.push({
            kind: 'label',
            text: now.name,
            x: C.BIRD_X - 10,
            y: state.bird.y - 42,
            vy: -28,
            life: 1.15,
            age: 0
          });
        }
      }
      if (e.type === 'hit') {
        sfx.hit();
        shake = 8;
        flash = 1;
        spawnFeathers(C.BIRD_X, state.bird.y, 14, 220);
        if (navigator.vibrate) navigator.vibrate(36);
      }
      if (e.type === 'record') {
        celebrateRecord = true;
        sfx.record();
        saveNum(BEST_KEY, e.best);
      }
      if (e.type === 'over' && !celebrateRecord) sfx.over();
    }
  }

  function doRestart() {
    queued = false;
    celebrateRecord = false;
    flash = 0;
    shake = 0;
    particles.length = 0;
    shownDay = 0;
    state = E.restart(state);
  }

  function queueFlap() {
    ensureAudio();
    if (state.phase === 'over') return false;
    if (queued) return false;
    queued = true;
    flapEpoch += 1;
    return true;
  }

  function onFlapIntent() {
    queueFlap();
  }

  function restartRound() {
    doRestart();
    if (window.FlappyJev) window.FlappyJev.handRestart();
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(canvas.width / C.W, 0, 0, canvas.height / C.H, 0, 0);
  }

  function drawSky(pal, day) {
    var g = ctx.createLinearGradient(0, 0, 0, C.H);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.48, pal.mid);
    g.addColorStop(1, pal.horizon);
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, C.W + 80, C.H + 80);

    var starA = Math.max(0, Math.min(1, (day - 0.48) / 0.35));
    if (starA > 0.02) {
      for (var i = 0; i < 32; i++) {
        var rnd = mulberry(1000 + i * 17);
        var sx = rnd() * C.W;
        var sy = rnd() * C.H * 0.48;
        var tw = 0.45 + 0.55 * Math.sin(state.t * 2.2 + i);
        ctx.fillStyle = 'rgba(255,255,255,' + (starA * tw).toFixed(3) + ')';
        ctx.fillRect(sx, sy, i % 5 === 0 ? 2.2 : 1.3, i % 5 === 0 ? 2.2 : 1.3);
      }
    }

    var sunA = day < 0.62 ? 1 : Math.max(0, 1 - (day - 0.62) / 0.2);
    var moonA = day < 0.52 ? 0 : Math.min(1, (day - 0.52) / 0.28);
    if (sunA > 0.02) {
      var sunX = C.W * 0.74;
      var sunY = 108 + day * 80;
      var glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
      var sg = hexToRgb(pal.sunGlow);
      glow.addColorStop(0, 'rgba(' + sg[0] + ',' + sg[1] + ',' + sg[2] + ',' + (0.9 * sunA) + ')');
      glow.addColorStop(1, 'rgba(' + sg[0] + ',' + sg[1] + ',' + sg[2] + ',0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = sunA;
      ctx.fillStyle = pal.sun;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (moonA > 0.02) {
      var moonX = C.W * 0.24;
      var moonY = 96;
      ctx.globalAlpha = moonA;
      ctx.fillStyle = pal.sun;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 110, 90, 0.28)';
      ctx.beginPath();
      ctx.arc(moonX - 6, moonY - 3, 5, 0, Math.PI * 2);
      ctx.arc(moonX + 5, moonY + 4, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function hillLayer(worldX, parallax, step, amp, color, base) {
    var shift = wrap(worldX * parallax, step);
    var start = -step * 2 - shift;
    ctx.beginPath();
    ctx.moveTo(start, C.H);
    ctx.lineTo(start, base);
    for (var x = start; x <= C.W + step * 2; x += step) {
      ctx.quadraticCurveTo(x + step * 0.5, base - amp, x + step, base);
    }
    ctx.lineTo(C.W + step, C.H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawGrove(worldX, pal) {
    var spacing = 72;
    var span = spacing * 9;
    var shift = wrap(worldX * 0.32, span);
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (var i = -1; i < 12; i++) {
      var x = i * spacing - shift;
      var h = 48 + Math.abs((i * 29) % 28);
      var y = C.H - C.GROUND - 40;
      ctx.fillStyle = pal.bark1;
      ctx.fillRect(x, y - h, 5, h);
      ctx.fillStyle = pal.crown;
      ctx.beginPath();
      ctx.arc(x + 2, y - h, 13, 0, Math.PI * 2);
      ctx.arc(x - 8, y - h + 8, 9, 0, Math.PI * 2);
      ctx.arc(x + 12, y - h + 7, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawClouds(worldX, pal, day) {
    var clouds = [
      [40, 108, 1.05, 0.18],
      [230, 72, 0.72, 0.28],
      [390, 140, 1.2, 0.14],
      [560, 90, 0.84, 0.22]
    ];
    ctx.save();
    ctx.fillStyle = pal.cloud;
    ctx.globalAlpha = 0.82 * (1 - day * 0.45);
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var x = wrap(c[0] - worldX * c[3] + state.t * 4, C.W + 220) - 80;
      var y = c[1];
      var s = c[2];
      ctx.beginPath();
      ctx.ellipse(x, y, 28 * s, 16 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 22 * s, y + 4 * s, 20 * s, 13 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 20 * s, y + 6 * s, 16 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMotes(worldX, pal, day) {
    var night = day > 0.62;
    for (var i = 0; i < 16; i++) {
      var x = wrap(i * 97 - worldX * (0.15 + (i % 4) * 0.04) + state.t * (night ? 14 : 8), C.W + 30) - 15;
      var y = 160 + ((i * 53) % 340) + Math.sin(state.t * 1.4 + i) * 16;
      if (y > C.H - C.GROUND - 24) continue;
      if (night) {
        ctx.fillStyle = 'rgba(214, 228, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = pal.sun;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawTrunk(x, y, w, h, seed, lipSide, pal) {
    if (h < 2) return;
    var lip = C.LIP;
    var extra = C.LIP_EXTRA;
    var grd = ctx.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, pal.bark3);
    grd.addColorStop(0.16, pal.bark1);
    grd.addColorStop(0.48, pal.bark2);
    grd.addColorStop(1, pal.bark0);
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, w, h);

    var rnd = mulberry(seed * 97 + 13);
    var count = Math.max(2, Math.floor(h / 26));
    var mark = hexToRgb(pal.mark);
    for (var i = 0; i < count; i++) {
      var my = y + 10 + rnd() * Math.max(8, h - 20);
      if (lipSide === 'bottom' && my > y + h - lip - 2) continue;
      if (lipSide === 'top' && my < y + lip + 2) continue;
      var mw = 6 + rnd() * (w * 0.4);
      var mx = x + 6 + rnd() * Math.max(1, w - mw - 12);
      ctx.fillStyle = 'rgba(' + mark[0] + ',' + mark[1] + ',' + mark[2] + ',' + (0.62 + rnd() * 0.35) + ')';
      roundRect(mx, my, mw, 2 + rnd() * 1.5, 1);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(40, 30, 20, 0.38)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y, w - 2, h);

    var ly = lipSide === 'bottom' ? y + h - lip : y;
    roundRect(x - extra, ly, w + extra * 2, lip, 9);
    ctx.fillStyle = pal.moss;
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 28, 16, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    var hiY = lipSide === 'top' ? ly + 4 : ly + 4;
    roundRect(x - extra + 4, hiY, w + extra * 2 - 8, 6, 4);
    ctx.fillStyle = pal.mossHi;
    ctx.fill();

    ctx.fillStyle = 'rgba(12, 10, 8, 0.28)';
    if (lipSide === 'bottom') ctx.fillRect(x - extra, ly + lip - 5, w + extra * 2, 5);
    else ctx.fillRect(x - extra, ly, w + extra * 2, 5);

    var leafY = lipSide === 'bottom' ? ly + 8 : ly + lip - 10;
    ctx.fillStyle = pal.mossHi;
    for (var L = 0; L < 3; L++) {
      var lx = x + rnd() * w;
      ctx.beginPath();
      ctx.ellipse(lx, leafY, 5, 2.6, rnd() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPipes(pal) {
    for (var i = 0; i < state.pipes.length; i++) {
      var pipe = state.pipes[i];
      var topH = pipe.gapY - pipe.gapH / 2;
      var botY = pipe.gapY + pipe.gapH / 2;
      drawTrunk(pipe.x, 0, pipe.w, topH, pipe.id, 'bottom', pal);
      drawTrunk(pipe.x, botY, pipe.w, C.H - botY, pipe.id + 101, 'top', pal);
    }
  }

  function drawGround(worldX, pal) {
    var y = C.H - C.GROUND;
    for (var i = 0; i < state.pipes.length; i++) {
      var pipe = state.pipes[i];
      ctx.fillStyle = 'rgba(20, 30, 10, 0.16)';
      ctx.beginPath();
      ctx.ellipse(pipe.x + pipe.w / 2, y + 3, pipe.w * 0.42, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = pal.dirt;
    ctx.fillRect(0, y + 30, C.W, C.GROUND);
    ctx.fillStyle = pal.dirtDeep;
    ctx.fillRect(0, y + 30, C.W, 6);

    var pebbleStep = 44;
    var pebbleShift = wrap(worldX, pebbleStep);
    for (var p = -1; p < C.W / pebbleStep + 2; p++) {
      var pebbleX = p * pebbleStep - pebbleShift + 8;
      ctx.fillStyle = 'rgba(70, 46, 24, 0.28)';
      ctx.beginPath();
      ctx.ellipse(pebbleX, y + 52 + Math.abs(p % 3) * 8, 2.4, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = pal.grassDeep;
    ctx.fillRect(0, y + 18, C.W, 16);
    ctx.fillStyle = pal.grass;
    var step = 16;
    var shift = wrap(worldX, step);
    ctx.beginPath();
    ctx.moveTo(-40, y + 34);
    ctx.lineTo(-40, y + 12);
    for (var x = -step * 2; x <= C.W + step * 2; x += step) {
      var px = x - shift;
      ctx.quadraticCurveTo(px + step * 0.5, y - 4, px + step, y + 12);
    }
    ctx.lineTo(C.W + 40, y + 34);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y + 11);
    for (var hx = 0; hx <= C.W; hx += step) {
      var qx = hx - shift;
      ctx.quadraticCurveTo(qx + step * 0.5, y - 5, qx + step, y + 11);
    }
    ctx.stroke();

    var fstep = 58;
    for (var f = -1; f < C.W / fstep + 2; f++) {
      var fx = f * fstep - wrap(worldX, fstep) + 18;
      var bucket = Math.floor((worldX + fx) / fstep);
      var kind = Math.abs(bucket) % 3;
      var fy = y + 16;
      ctx.fillStyle = kind === 0 ? '#F2D15A' : kind === 1 ? '#F7F4EE' : '#E07A9A';
      ctx.beginPath();
      ctx.arc(fx, fy, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5C3A2A';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawShadow() {
    var groundY = C.H - C.GROUND + 1;
    var alt = Math.max(0, groundY - state.bird.y);
    var norm = Math.min(1, alt / 440);
    ctx.fillStyle = 'rgba(40, 30, 10, ' + (0.22 * (1 - norm * 0.7)) + ')';
    ctx.beginPath();
    ctx.ellipse(C.BIRD_X, groundY, 16 * (1 - norm * 0.45), 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function wingAngle() {
    if (state.phase === 'fall' || state.phase === 'over') return 0.9;
    if (state.bird.flap > 0) {
      var u = 1 - state.bird.flap / 0.18;
      return -1.15 + u * 1.35;
    }
    if (state.phase === 'ready') return Math.sin(state.t * 8) * 0.4;
    return 0.22 + Math.sin(state.t * 5.5) * 0.16;
  }

  function drawBird(day) {
    var dead = state.phase === 'fall' || state.phase === 'over';
    var wing = wingAngle();
    var squash = state.bird.flap > 0.08 ? 0.1 : 0;
    ctx.save();
    ctx.translate(C.BIRD_X, state.bird.y);
    ctx.rotate(state.bird.rot);
    ctx.scale(1 + squash, 1 - squash);

    if (day > 0.6) {
      ctx.fillStyle = 'rgba(255, 196, 120, ' + ((day - 0.6) * 0.45) + ')';
      ctx.beginPath();
      ctx.ellipse(2, 2, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#5C3A2E';
    ctx.beginPath();
    ctx.moveTo(-12, -1);
    ctx.lineTo(-28, -8);
    ctx.lineTo(-22, 1);
    ctx.lineTo(-27, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#C56B42';
    ctx.beginPath();
    ctx.ellipse(-1, 2, 16, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(-2, 1);
    ctx.rotate(wing);
    ctx.fillStyle = '#7A4030';
    ctx.beginPath();
    ctx.ellipse(1, 9, 8, 12, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F4E4D0';
    ctx.beginPath();
    ctx.ellipse(3.2, 10, 2.6, 8, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#E24A34';
    ctx.beginPath();
    ctx.ellipse(6, 3, 11, 10, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFE6D0';
    ctx.beginPath();
    ctx.ellipse(4, 7, 7.5, 5.5, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E24A34';
    ctx.beginPath();
    ctx.arc(10, -5, 8.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8C4E34';
    ctx.beginPath();
    ctx.ellipse(8, -9, 8, 4.4, -0.4, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(6, -8, 4, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    if (!dead) {
      ctx.fillStyle = 'rgba(255, 170, 150, 0.9)';
      ctx.beginPath();
      ctx.ellipse(12, -1, 3, 2, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    var blink = !dead && (state.t % 3.6) > 3.42;
    var look = Math.max(-1, Math.min(1, state.bird.vy / 800));
    ctx.fillStyle = '#FFF8F0';
    ctx.beginPath();
    if (blink) {
      ctx.ellipse(13, -5.5, 3.6, 0.8, 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (dead) {
      ctx.strokeStyle = '#1C140F';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(11, -7.2);
      ctx.lineTo(15.2, -4);
      ctx.moveTo(15.2, -7.2);
      ctx.lineTo(11, -4);
      ctx.stroke();
    } else {
      ctx.arc(13, -5.6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1C140F';
      ctx.beginPath();
      ctx.arc(14.1, -5.5 + look * 0.7, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(14.6, -6.1, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    var open = state.bird.flap > 0.08 ? 2.4 : 0.6;
    ctx.fillStyle = '#F2B433';
    ctx.beginPath();
    ctx.moveTo(16.5, -6);
    ctx.lineTo(26, -3.2);
    ctx.lineTo(16.5, -2.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#D8922A';
    ctx.beginPath();
    ctx.moveTo(16.5, -2.2);
    ctx.lineTo(25, -1.6 + open * 0.15);
    ctx.lineTo(16.5, -2.2 + open);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = Math.max(0, 1 - p.age / p.life);
      ctx.save();
      ctx.globalAlpha = a;
      if (p.kind === 'feather') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w, p.h, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'label') {
        ctx.font = p.text === '+1'
          ? '800 18px Unbounded, Bahnschrift, sans-serif'
          : '700 16px Unbounded, Bahnschrift, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fffaf3';
        ctx.strokeStyle = 'rgba(40, 24, 16, 0.45)';
        ctx.lineWidth = 3;
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.restore();
    }
  }

  function drawVignette(day) {
    var g = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.28, C.W / 2, C.H / 2, C.H * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20, 12, 18, ' + (0.14 + day * 0.28) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.W, C.H);
  }

  function draw(dt) {
    var day = Math.max(0, Math.min(1, shownDay));
    var pal = palette(day);
    resize();
    ctx.fillStyle = pal.top;
    ctx.fillRect(-40, -40, C.W + 80, C.H + 80);
    ctx.save();
    if (shake > 0.15) {
      ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    }
    drawSky(pal, day);
    hillLayer(state.worldX, 0.12, 160, 28, pal.hillFar, C.H - C.GROUND - 78);
    hillLayer(state.worldX, 0.22, 120, 18, pal.hillNear, C.H - C.GROUND - 34);
    drawGrove(state.worldX, pal);
    var fog = ctx.createLinearGradient(0, C.H * 0.46, 0, C.H * 0.7);
    var fr = hexToRgb(pal.fog);
    fog.addColorStop(0, 'rgba(' + fr[0] + ',' + fr[1] + ',' + fr[2] + ',0)');
    fog.addColorStop(0.55, 'rgba(' + fr[0] + ',' + fr[1] + ',' + fr[2] + ',' + (0.28 + day * 0.15) + ')');
    fog.addColorStop(1, 'rgba(' + fr[0] + ',' + fr[1] + ',' + fr[2] + ',0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, C.H * 0.46, C.W, C.H * 0.28);
    drawClouds(state.worldX, pal, day);
    drawPipes(pal);
    drawMotes(state.worldX, pal, day);
    drawGround(state.worldX, pal);
    drawShadow();
    drawParticles();
    drawBird(day);
    drawVignette(day);
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.72) + ')';
      ctx.fillRect(0, 0, C.W, C.H);
    }
    document.body.style.background = 'linear-gradient(180deg, ' + pal.top + ' 0%, ' + pal.horizon + ' 100%)';
    if (theme) theme.setAttribute('content', pal.top);
    playfield.classList.toggle('is-night', day > 0.62);
  }

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function highlightMedals() {
    var earned = medalFor(state.best).id;
    var order = ['bronze', 'silver', 'gold', 'star'];
    var idx = order.indexOf(earned);
    for (var i = 0; i < medalNodes.length; i++) {
      var node = medalNodes[i];
      node.classList.toggle('is-on', order.indexOf(node.dataset.medal) <= idx && idx >= 0);
    }
  }

  function fillOver() {
    var medal = medalFor(state.score);
    medalEl.className = 'medal ' + medal.id;
    medalGlyph.innerHTML = GLYPH[medal.id] || '';
    medalName.textContent = medal.name;
    medalNext.textContent = medal.next;
    finalScore.textContent = String(state.score);
    finalBest.textContent = String(state.best);
    ribbon.hidden = !celebrateRecord;
    saveNum(BEST_KEY, state.best);
    highlightMedals();
  }

  function syncDom() {
    var phaseChanged = playfield.dataset.phase !== state.phase;
    if (phaseChanged) {
      playfield.dataset.phase = state.phase;
      overUi.setAttribute('aria-hidden', state.phase === 'over' ? 'false' : 'true');
      if (state.phase === 'over') {
        fillOver();
        againBtn.focus({ preventScroll: true });
      }
    }
    setText(liveNum, String(state.score));
    if (scorePop) {
      liveNum.classList.remove('pop');
      void liveNum.offsetWidth;
      liveNum.classList.add('pop');
      scorePop = 0;
    }
    setText(readyBest, String(state.best));
    setText(railBest, String(state.best));
    setText(railNow, state.phase === 'ready' ? '—' : String(state.score));
    liveScore.setAttribute('aria-hidden', state.phase === 'play' || state.phase === 'fall' ? 'false' : 'true');
  }

  function step(dt) {
    if (!document.hidden) {
      acc += dt;
      var n = 0;
      while (acc >= STEP && n < 5) {
        acc -= STEP;
        var flap = queued ? 1 : 0;
        queued = false;
        handle(E.tick(state, STEP, flap));
        n++;
      }
    }
    updateParticles(dt);
    var targetDay = Math.max(0, Math.min(1, state.score / 36));
    shownDay += (targetDay - shownDay) * (1 - Math.exp(-dt * 0.85));
    if (shake > 0) shake *= Math.exp(-dt * 9);
    if (flash > 0) flash = Math.max(0, flash - dt * 2.4);
  }

  playfield.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button')) return;
    e.preventDefault();
    onFlapIntent();
  }, { passive: false });

  playfield.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });

  playfield.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  overUi.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

  againBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    ensureAudio();
    restartRound();
  });

  muteBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  muteBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!muted) ensureAudio();
    setMuted(!muted);
  });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM') {
      e.preventDefault();
      if (!muted) ensureAudio();
      setMuted(!muted);
      return;
    }
    var flapKey = e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
    var restartKey = flapKey || e.code === 'Enter' || e.code === 'KeyR';
    if (!flapKey && !restartKey) return;
    e.preventDefault();
    if (e.repeat) return;
    if (state.phase === 'over') {
      if (restartKey) restartRound();
      return;
    }
    if (flapKey) onFlapIntent();
  });

  if (typeof ResizeObserver === 'function') {
    var observer = new ResizeObserver(function () { resize(); });
    observer.observe(playfield);
  } else {
    window.addEventListener('resize', resize);
  }

  setMuted(muted);
  highlightMedals();
  syncDom();
  resize();
  draw(0);

  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    draw(dt);
    syncDom();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.FlappyHooks = {
    getState: function () { return state; },
    queueFlap: queueFlap,
    restart: doRestart,
    audio: ensureAudio,
    epoch: function () { return flapEpoch; }
  };
})();
