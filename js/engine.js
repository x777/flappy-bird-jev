(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FlappyEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const W = 432;
  const H = 768;
  const GROUND = 112;
  const BIRD_X = 128;
  const HIT_R = 13;
  const READY_Y = 392;
  const GRAVITY = 2100;
  const FLAP_VY = -520;
  const MAX_VY = 980;
  const PIPE_W = 78;
  const LIP = 26;
  const LIP_EXTRA = 8;
  const SPAWN_X = W + 22;
  const MARGIN = 86;

  const C = {
    W, H, GROUND, BIRD_X, HIT_R, READY_Y,
    GRAVITY, FLAP_VY, MAX_VY, PIPE_W, LIP, LIP_EXTRA, SPAWN_X, MARGIN,
  };

  function create(seed) {
    seed = (Number(seed) >>> 0) || 1;
    return {
      phase: 'ready',
      t: 0,
      worldX: 0,
      seed: seed,
      nextId: 1,
      score: 0,
      best: 0,
      bird: { y: READY_Y, vy: 0, rot: 0, flap: 0 },
      pipes: [],
      groundTimer: 0,
      fallTime: 0,
    };
  }

  function restart(state) {
    const next = create((state.seed + 1013904223) >>> 0);
    next.best = state.best;
    return next;
  }

  function rand(state) {
    state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
    return state.seed / 4294967296;
  }

  function ramp(score, maxScore, from, to) {
    const t = Math.max(0, Math.min(1, score / maxScore));
    return from + (to - from) * t;
  }

  function speedFor(score) {
    return ramp(score, 28, 198, 286);
  }

  function gapHeight(score) {
    if (score <= 0) return 188;
    return ramp(score, 18, 172, 140);
  }

  function spawnDistance(score) {
    return ramp(score, 24, 308, 262);
  }

  function doFlap(state, events) {
    state.bird.vy = FLAP_VY;
    state.bird.flap = 0.18;
    events.push({ type: 'flap' });
  }

  function spawnPipe(state) {
    const gapH = gapHeight(state.score);
    const minC = MARGIN + gapH / 2;
    const maxC = H - GROUND - MARGIN - gapH / 2;
    const last = state.pipes[state.pipes.length - 1];
    let center;
    if (!last && state.score === 0) {
      center = READY_Y;
    } else {
      center = minC + rand(state) * (maxC - minC);
      if (last) {
        const maxDelta = 104;
        center = Math.max(last.gapY - maxDelta, Math.min(last.gapY + maxDelta, center));
      }
    }
    center = Math.max(minC, Math.min(maxC, center));
    state.pipes.push({
      id: state.nextId++,
      x: SPAWN_X,
      gapY: center,
      gapH: gapH,
      w: PIPE_W,
      scored: false,
    });
  }

  function maybeSpawn(state) {
    const last = state.pipes[state.pipes.length - 1];
    const gap = spawnDistance(state.score);
    if (!last || last.x <= SPAWN_X - gap) spawnPipe(state);
  }

  function circleRect(cx, cy, r, x, y, w, h) {
    if (w <= 0 || h <= 0) return false;
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function hitsPipe(bird, pipe) {
    const gapTop = pipe.gapY - pipe.gapH / 2;
    const gapBot = pipe.gapY + pipe.gapH / 2;
    const x = pipe.x;
    const w = pipe.w;
    if (circleRect(BIRD_X, bird.y, HIT_R, x, 0, w, gapTop - LIP)) return true;
    if (circleRect(BIRD_X, bird.y, HIT_R, x - LIP_EXTRA, gapTop - LIP, w + LIP_EXTRA * 2, LIP)) return true;
    if (circleRect(BIRD_X, bird.y, HIT_R, x - LIP_EXTRA, gapBot, w + LIP_EXTRA * 2, LIP)) return true;
    if (circleRect(BIRD_X, bird.y, HIT_R, x, gapBot + LIP, w, H - (gapBot + LIP))) return true;
    return false;
  }

  function kill(state, events) {
    if (state.phase !== 'play') return;
    state.phase = 'fall';
    state.groundTimer = 0;
    state.fallTime = 0;
    if (state.bird.vy < 280) state.bird.vy = 280;
    events.push({ type: 'hit' });
  }

  function finish(state, events) {
    state.phase = 'over';
    if (state.score > state.best) {
      state.best = state.score;
      events.push({ type: 'record', best: state.best });
    }
    events.push({ type: 'over', score: state.score, best: state.best });
  }

  // Where the bird will be if it is left alone for leadSeconds. Jev is shown this,
  // not advice: the numbers are the scene at the moment an answer can land.
  function observe(state, leadSeconds) {
    if (state.phase !== 'play') return null;
    var y = state.bird.y;
    var vy = state.bird.vy;
    var left = Math.max(0, Number(leadSeconds) || 0);
    var speed = speedFor(state.score);
    var shift = 0;
    var step = 1 / 60;
    while (left > 0) {
      var dt = Math.min(step, left);
      vy = Math.min(MAX_VY, vy + GRAVITY * dt);
      y += vy * dt;
      if (y < HIT_R + 1) {
        y = HIT_R + 1;
        if (vy < 0) vy = 0;
      }
      var floorY = H - GROUND - HIT_R;
      if (y > floorY) {
        y = floorY;
        vy = 0;
      }
      shift += speed * dt;
      left -= dt;
    }
    var pipe = null;
    for (var i = 0; i < state.pipes.length; i++) {
      var candidate = state.pipes[i];
      if (candidate.x - shift + candidate.w > BIRD_X - HIT_R) {
        pipe = candidate;
        break;
      }
    }
    if (!pipe) return null;
    var gapTop = pipe.gapY - pipe.gapH / 2;
    var gapBottom = pipe.gapY + pipe.gapH / 2;
    var birdY = Math.round(y);
    var above = birdY - HIT_R - Math.round(gapTop);
    var below = Math.round(gapBottom) - (birdY + HIT_R);
    var position = above < 0
      ? 'above the gap'
      : below < 0
        ? 'below the gap'
        : above < below
          ? 'inside the gap, upper half'
          : 'inside the gap, lower half';
    var motion = vy < -60 ? 'rising' : vy > 250 ? 'falling fast' : vy > 60 ? 'falling' : 'level';
    return {
      bird: {
        y: birdY,
        velocity_y: Math.round(vy),
        clearance_above_bird_to_gap_top: above,
        clearance_below_bird_to_gap_bottom: below,
        position: position,
        motion: motion
      },
      next_pipe: {
        distance_x: Math.max(0, Math.round(pipe.x - shift - (BIRD_X + HIT_R))),
        gap_top_y: Math.round(gapTop),
        gap_bottom_y: Math.round(gapBottom)
      },
      y_axis: 'y grows downward; smaller y is higher'
    };
  }

  function tick(state, dt, flap) {
    const events = [];
    state.t += dt;
    state.bird.flap = Math.max(0, state.bird.flap - dt);

    if (state.phase === 'ready') {
      state.bird.y = READY_Y + Math.sin(state.t * 2.5) * 8;
      state.bird.vy = 0;
      state.bird.rot = Math.sin(state.t * 2.5) * -0.06;
      state.worldX += 72 * dt;
      if (!flap) return events;
      state.phase = 'play';
      events.push({ type: 'start' });
    } else if (state.phase === 'over') {
      return events;
    }

    if (flap && state.phase === 'play') doFlap(state, events);

    const speed = speedFor(state.score);
    state.worldX += speed * dt;
    state.bird.vy = Math.min(MAX_VY, state.bird.vy + GRAVITY * dt);
    state.bird.y += state.bird.vy * dt;

    if (state.phase === 'play' && state.bird.y < HIT_R + 1) {
      state.bird.y = HIT_R + 1;
      if (state.bird.vy < 0) state.bird.vy = 0;
    }

    for (let i = 0; i < state.pipes.length; i++) state.pipes[i].x -= speed * dt;
    state.pipes = state.pipes.filter(function (pipe) { return pipe.x + pipe.w > -80; });

    if (state.phase === 'play') {
      maybeSpawn(state);
      const groundY = H - GROUND;
      if (state.bird.y + HIT_R >= groundY) {
        kill(state, events);
      } else {
        for (let i = 0; i < state.pipes.length; i++) {
          if (hitsPipe(state.bird, state.pipes[i])) {
            kill(state, events);
            break;
          }
        }
      }
      if (state.phase === 'play') {
        for (let i = 0; i < state.pipes.length; i++) {
          const pipe = state.pipes[i];
          if (!pipe.scored && BIRD_X - HIT_R > pipe.x + pipe.w) {
            pipe.scored = true;
            state.score += 1;
            events.push({ type: 'score', score: state.score });
          }
        }
      }
    } else if (state.phase === 'fall') {
      state.fallTime += dt;
      const rest = H - GROUND - HIT_R;
      if (state.bird.y >= rest) {
        state.bird.y = rest;
        state.bird.vy = 0;
        state.groundTimer += dt;
      }
      if (state.groundTimer >= 0.4 || state.fallTime > 2.2) finish(state, events);
    }

    const diving = state.phase === 'fall' || state.phase === 'over';
    const target = diving
      ? Math.PI / 2
      : Math.max(-0.5, Math.min(1.35, state.bird.vy / 640));
    const k = 1 - Math.exp(-dt * (diving ? 10 : 7.5));
    state.bird.rot += (target - state.bird.rot) * k;
    return events;
  }

  return { create: create, tick: tick, restart: restart, observe: observe, C: C };
});
