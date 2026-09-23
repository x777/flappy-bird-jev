# Flappy Bird, flown by Jev

A one-button Flappy Bird set in a birch grove. Fly the robin yourself, or hand it to [Jev](https://openrouter.ai/typesafe/jev-1.13), TypeSafe's decision model. The game owns gravity, pipes, and collisions. Jev only chooses **flap** or **wait**.

## Demo

[Watch Jev play](https://x777.github.io/flappy-bird-jev/demo.html).

The recording is `Flappy Bird — JEV.mp4` in this repository. GitHub's file page will not open a video of this size, so use the link above.

## Run it

Node.js 20 or newer.

```bash
npm start
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

Opening `index.html` from disk is enough to play by hand. Jev needs this server: the API key stays there and is never sent to the browser.

## Fly it yourself

| Input | Action |
| --- | --- |
| Space, Up, W, click, or tap | One flap. Holding the key does not repeat. |
| M | Mute |
| Space or **Again** after a crash | New run |

The first gaps are wider. Later gaps tighten, and the sky goes from morning to night as the score climbs. Medals are an acorn at 8, a pinecone at 15, a golden branch at 25, and a grove star at 40. The best score is stored in the browser.

## Let Jev fly

TypeSafe's own signup is closed. The same model is on OpenRouter as `typesafe/jev-1.13`.

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. Copy `.env.example` to `.env`.
3. Set `OPENROUTER_API_KEY`.
4. Run `npm start`, then press **Летит Jev** (Let Jev fly).

The panel under the button shows the latest choice and how sure Jev was. **Я сам** (I'll fly) gives the bird back. A click or the space bar still flaps while Jev is flying.

The round does not wait on the network. Several questions are in flight at once, each one describing where the bird will be when the answer is likely to land. An answer that arrives after another flap, or after a crash, is dropped. If Jev stops answering, the bird falls. There is no backup autopilot in the code.

Jev is asked about fourteen times a second. Input is about $0.042 per million tokens and output is free, so a long session is on the order of a dollar or two an hour, billed to your OpenRouter account.

If you already have a TypeSafe key, set `TYPESAFE_API_KEY` and leave `OPENROUTER_API_KEY` empty. The OpenRouter key wins when both are set.

## What Jev is shown

One Choice question: what should the bird do right now to pass the next gap?

The state is numbers the game has already computed, not a screenshot and not advice: height, vertical speed, distance to the pipe, and clearance above and below the bird. The same facts are repeated in short labels such as `inside the gap, lower half` and `rising`. Jev returns `FLAP` or `WAIT`, plus a probability for each.

## Layout

| Path | Role |
| --- | --- |
| `js/engine.js` | Physics, pipes, scoring, and the observation Jev reads |
| `js/game.js` | Drawing, input, and sound |
| `js/pilot.js` | Asks Jev and applies a flap |
| `server.mjs` | Static files and `POST /api/decide` |
| `index.html`, `css/style.css` | The page |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | | OpenRouter key. Used when set. |
| `JEV_MODEL` | `typesafe/jev-1.13` | Model id for OpenRouter. |
| `TYPESAFE_API_KEY` | | Direct TypeSafe key. Used only when the OpenRouter key is unset. |
| `TYPESAFE_DEFAULT_MODEL` | `jev-latest` | Model id for the direct API. |
| `JEV_TIMEOUT_MS` | `2000` | Give up on a slower answer. |
| `PORT` | `5173` | Local server port. |

Do not commit `.env`.
