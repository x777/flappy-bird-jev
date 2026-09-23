import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(root, '.env'));

const port = Number(process.env.PORT) || 5173;
const timeoutMs = Number(process.env.JEV_TIMEOUT_MS) || 2000;

const QUESTION = {
  instructions: 'What should the bird do right now to pass safely through the gap of the next pipe?',
  criteria: {
    FLAP: 'Flap: the bird is below the gap, or is in the lower half of the gap and not rising.',
    WAIT: 'Wait: the bird is above the gap (even when falling fast), or is in the upper half of the gap, or is rising inside the gap.',
  },
};

const POSITIONS = new Set([
  'above the gap',
  'below the gap',
  'inside the gap, upper half',
  'inside the gap, lower half',
]);
const MOTIONS = new Set(['rising', 'falling fast', 'falling', 'level']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

let apiFetch = globalThis.fetch;
try {
  const undici = await import('undici');
  const dispatcher = new undici.Agent({ allowH2: true, keepAliveTimeout: 60_000 });
  apiFetch = (url, init) => undici.fetch(url, { ...init, dispatcher });
} catch (err) {
  apiFetch = globalThis.fetch;
}

let active = 0;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
  }
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function clampInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(-5000, Math.min(5000, Math.round(n)));
}

function snapshot(body) {
  if (!body || typeof body !== 'object') return null;
  const bird = body.bird || {};
  const pipe = body.next_pipe || {};
  const y = clampInt(bird.y);
  const velocity = clampInt(bird.velocity_y);
  const above = clampInt(bird.clearance_above_bird_to_gap_top);
  const below = clampInt(bird.clearance_below_bird_to_gap_bottom);
  const distance = clampInt(pipe.distance_x);
  const gapTop = clampInt(pipe.gap_top_y);
  const gapBottom = clampInt(pipe.gap_bottom_y);
  if ([y, velocity, above, below, distance, gapTop, gapBottom].some((n) => n == null)) return null;
  const state = {
    bird: {
      y,
      velocity_y: velocity,
      clearance_above_bird_to_gap_top: above,
      clearance_below_bird_to_gap_bottom: below,
    },
    next_pipe: {
      distance_x: Math.max(0, distance),
      gap_top_y: gapTop,
      gap_bottom_y: gapBottom,
    },
    y_axis: 'y grows downward; smaller y is higher',
  };
  if (POSITIONS.has(bird.position)) state.bird.position = bird.position;
  if (MOTIONS.has(bird.motion)) state.bird.motion = bird.motion;
  return state;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 4096) {
        reject(Object.assign(new Error('too_big'), { code: 'too_big' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function route() {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      via: 'openrouter',
      url: 'https://openrouter.ai/api/v1/systemone',
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.JEV_MODEL || 'typesafe/jev-1.13',
    };
  }
  if (process.env.TYPESAFE_API_KEY) {
    return {
      via: 'typesafe',
      url: 'https://api.typesafe.ai/v1/systemone',
      key: process.env.TYPESAFE_API_KEY,
      model: process.env.TYPESAFE_DEFAULT_MODEL || 'jev-latest',
    };
  }
  return null;
}

async function decide(state) {
  const target = route();
  if (!target) return { status: 503, body: { error: 'no_key' } };
  if (active >= 24) return { status: 429, body: { error: 'busy' } };
  active += 1;
  const started = Date.now();
  try {
    const headers = {
      Authorization: 'Bearer ' + target.key,
      'Content-Type': 'application/json',
    };
    if (target.via === 'openrouter') headers['X-Title'] = 'Flappy Birch';
    const response = await apiFetch(target.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: target.model,
        state,
        questions: {
          move: { type: 'choice', instructions: QUESTION.instructions, criteria: QUESTION.criteria },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.answers || !payload.answers.move) {
      return { status: 502, body: { error: 'upstream', latencyMs: Date.now() - started } };
    }
    const answer = payload.answers.move;
    if (answer.choice !== 'FLAP' && answer.choice !== 'WAIT') {
      return { status: 502, body: { error: 'upstream', latencyMs: Date.now() - started } };
    }
    return {
      status: 200,
      body: {
        choice: answer.choice,
        probabilities: answer.probabilities || {},
        confidence: answer.confidence,
        model: payload.model,
        usage: payload.usage || null,
        latencyMs: Date.now() - started,
      },
    };
  } catch (err) {
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return { status: timedOut ? 504 : 502, body: { error: timedOut ? 'timeout' : 'upstream', latencyMs: Date.now() - started } };
  } finally {
    active -= 1;
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  if (rel.includes('\0') || path.basename(rel).startsWith('.')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const file = path.resolve(root, '.' + rel);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const target = route();
    send(res, 200, { configured: Boolean(target), via: target ? target.via : null });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/decide') {
    try {
      const raw = await readBody(req);
      const state = snapshot(JSON.parse(raw || '{}'));
      if (!state) {
        send(res, 400, { error: 'bad_state' });
        return;
      }
      const result = await decide(state);
      send(res, result.status, result.body);
    } catch (err) {
      send(res, err && err.code === 'too_big' ? 413 : 400, { error: 'bad_request' });
    }
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(port, '127.0.0.1', () => {
  const target = route();
  const key = target ? 'ключ ' + target.via : 'ключа нет — впиши OPENROUTER_API_KEY в .env';
  console.log('Flappy Bird: http://127.0.0.1:' + port + ' (' + key + ')');
});
