# Neon Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Aldi071124/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Aldi071124/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Neon Bay** is a 2D top-down open-world city game. You are Kai Mercer, a
wheelman new in town, taking four jobs for fixer Mama Rosa across a sun-soaked
coastal city: a courier delivery, a pawn-shop getaway, a harbour smuggling run,
and a final dock heist.

## What is in the city

- **On foot and by car** — walk the sidewalks or press **E** to get into any
  parked or traffic car (stealing one in front of the law raises your wanted
  level) and drive it.
- **Living traffic** — cars follow the roads, stop at red lights and queue
  behind each other; pedestrians walk the sidewalks and flee from gunfire and
  crashes.
- **Wanted level 0–5 stars** — crime raises the heat, police cars spawn, chase,
  ram and arrest. Stay hidden and quiet and the heat fades.
- **Four story missions** with objectives, dialogue, timers and cash rewards.
- **Combat** — punch with **F**, shoot with a mouse click (12 rounds, **R** to
  reload). Crashes and shots leave skid marks, smoke and sparks.
- **HUD** — health, cash, wanted stars, objective, timer, a live minimap and a
  speedometer while driving.
- **Save** — cash and job progress are kept in localStorage between visits.
- **Sound** — everything is synthesized with WebAudio: engine hum, sirens,
  gunshots and a bassline loop. **M** mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse + click | Aim and shoot |
| E | Enter / exit a car |
| F | Punch |
| R | Reload / retry a failed job |
| P / Esc | Pause |
| M | Mute |
| Space / Enter | Start, confirm |

## Run it

No build step, no network requests, no binary assets — the game is plain
static files under `game/`, all art is procedural canvas and all audio is
synthesized.

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots live in `screenshots/`; the staged scenes behind them are in
`game/src/shots.js` (`?shot=chase|mission|city|title&seed=1`).

Everything in this game — the city, the characters, the story, the art and the
music — is original work made for this bounty.

Entered on [make.fun](https://make.fun/?ref=fhhh2e3k&utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
