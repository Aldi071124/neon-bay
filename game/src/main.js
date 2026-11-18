// Neon Bay — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between four screens:
// title, play, paused and game over, and saves cash and job progress between
// visits.
//
// ?seed=N fixes the city. ?shot=chase|mission|city|title (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { CAR, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { makeCar, spawnTraffic, updateVehicles } from './vehicles.js';
import { spawnPeds, updatePeds, scarePeds } from './pedestrians.js';
import { handleCrime, updatePolice, wantedStars } from './police.js';
import { spawnParticles, updateBullets, updateParticles } from './combat.js';
import { createMissionState, retryMission, startMission, updateMissions } from './missions.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(state) {
  try {
    // After a completed job the save records the next job's index; mid-job it
    // records the current one; after the final job it records 4 (all done).
    const missionIndex = state.mission.finished
      ? 4
      : state.mission.index + (state.mission.nextDelay > 0 ? 1 : 0);
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: state.player.cash,
        missionIndex,
        bestEarned: Math.max(state.save?.bestEarned || 0, state.stats.earned),
        missionsDone: state.stats.missionsDone,
      }),
    );
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

/** A fresh game state for the seed: city, traffic, people, jobs and Kai. */
function createState(seedValue) {
  const rng = createRandom(seedValue);
  const city = createCity(rng);
  const state = {
    seed: seedValue,
    rng,
    time: 0,
    city,
    player: createPlayer(),
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    events: [],
    heat: 0,
    lastCrime: -99,
    lastPoliceSpawn: -99,
    arrestT: 0,
    mission: createMissionState(),
    stats: { earned: 0, missionsDone: 0 },
    save: null,
    saveNeeded: false,
    overReason: null,
    lastInteract: false,
  };
  spawnTraffic(state, rng);
  spawnPeds(state, rng, 36);
  // The vault truck for the final job, parked at the docks.
  state.cars.push(makeCar(2700, 2100, 0, 'parked', '#c25e3e'));
  // A few useful things lying around the city.
  state.pickups.push(
    { x: 1252, y: 948, kind: 'health', amount: 0, taken: false },
    { x: 1652, y: 452, kind: 'ammo', amount: 0, taken: false },
    { x: 852, y: 1652, kind: 'cash', amount: 80, taken: false },
  );
  return state;
}

/** React to one simulation event (sound, particles, crime, screens). */
function handleEvent(state, renderer, event) {
  switch (event.type) {
    case 'crash':
      renderer.shakeCamera();
      audio.crash(event.hard);
      spawnParticles(state, event.x, event.y, event.hard ? 'smoke' : 'spark', event.hard ? 10 : 5);
      scarePeds(state, event.x, event.y, 150);
      break;
    case 'gunshot':
      audio.gunshot();
      scarePeds(state, event.x, event.y, 260);
      break;
    case 'punch':
      audio.punch();
      break;
    case 'pickup':
      audio.pickup();
      spawnParticles(state, event.x, event.y, 'spark', 5);
      break;
    case 'hit':
      spawnParticles(state, event.x, event.y, 'spark', 4);
      break;
    case 'muzzle':
      spawnParticles(state, event.x, event.y, 'spark', 3);
      break;
    case 'crime':
      handleCrime(state, event.kind);
      break;
    case 'missionDone':
      audio.missionDone();
      break;
    case 'busted':
      state.overReason = 'Busted';
      state.busted = true;
      break;
    default:
      break;
  }
}

/** One fixed step of the whole simulation. `input` is a per-frame snapshot. */
function stepGame(state, renderer, input, dt) {
  state.time += dt;
  state.lastInteract = input.interact;
  updatePlayer(state, input, dt);
  const skidding = updateVehicles(state, input, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateMissions(state, dt);
  const playerCar = state.player.inCar;
  audio.engine(playerCar ? Math.abs(playerCar.speed) / CAR.driveMax : 0);
  let policeClose = false;
  for (const car of state.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - state.player.x, car.y - state.player.y) < 520) policeClose = true;
  }
  audio.siren(policeClose && wantedStars(state) > 0);
  for (const event of state.events) handleEvent(state, renderer, event);
  state.events.length = 0;
  // One-shot presses count for a single fixed step only.
  state.lastInteract = false;
  if (state.saveNeeded) {
    state.saveNeeded = false;
    writeSave(state);
  }
  if (state.player.health <= 0 && !state.busted) {
    state.overReason = 'Wasted';
    state.busted = true;
  }
  return skidding;
}

/** The title screen's backdrop: traffic and people move, nobody plays. */
function stepAmbient(state, renderer, dt) {
  state.time += dt;
  const empty = { up: false, down: false, left: false, right: false, interact: false, punch: false, shoot: false, mouseX: 0, mouseY: 0, mouseSeen: false };
  updateVehicles(state, empty, dt);
  updatePeds(state, dt);
  updateParticles(state, dt);
}

function runShot(name, state, renderer) {
  const scene = stageShot(name, state, (s, input, dt) => stepGame(s, renderer, input, dt));
  renderer.snapCamera(state.player.x, state.player.y);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  const state = createState(seed);
  state.save = readSave();
  if (state.save) {
    state.player.cash = state.save.cash || 0;
    state.stats.earned = state.save.bestEarned || 0;
    state.stats.missionsDone = state.save.missionsDone || 0;
    if (state.save.missionIndex > 0 && state.save.missionIndex < 4) {
      startMission(state, state.save.missionIndex);
    } else if (state.save.missionIndex >= 4) {
      state.mission.finished = true;
      state.mission.objective = 'You own Neon Bay.';
      state.mission.marker = null;
    }
  }
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // For automated checks: the live state is reachable from the page.
  window.__game = { state, get screen() { return screen; } };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    // A fresh run keeps the saved cash and job progress; a new job starts
    // from the first stage of the saved job.
    const fresh = createState(seed);
    fresh.save = state.save;
    fresh.player.cash = state.player.cash;
    fresh.stats = state.stats;
    Object.assign(state, fresh);
    state.save = readSave();
    state.busted = false;
    state.overReason = null;
    screen = SCREEN_PLAY;
    announce(`Playing. Job: ${state.mission.objective}`);
  }

  function endGame(reason) {
    screen = SCREEN_OVER;
    state.overReason = reason;
    if (reason === 'Busted') {
      state.player.cash = Math.max(0, state.player.cash - 100);
      audio.fail();
    } else {
      state.player.cash = Math.max(0, state.player.cash - 50);
      audio.fail();
    }
    writeSave(state);
    announce(`${reason}. Press Space to get back on your feet.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (input.takeMute()) audio.setMuted(!audio.muted);
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (input.takeReload()) {
      if (state.mission.failed) {
        retryMission(state);
        announce('Job restarted.');
      } else if (!state.player.inCar && state.player.reloadT <= 0) {
        state.player.reloadT = 1.1;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // Snapshot the one-shot presses once per frame, then convert the mouse
    // position from screen pixels to world coordinates for aiming.
    const snap = {
      up: input.up,
      down: input.down,
      left: input.left,
      right: input.right,
      interact: input.takeInteract(),
      punch: input.takePunch(),
      shoot: input.takeShoot(),
      mouseX: 0,
      mouseY: 0,
      mouseSeen: input.mouseSeen,
    };
    if (input.mouseSeen) {
      const world = renderer.screenToWorld(input.mouseX, input.mouseY);
      snap.mouseX = world.x;
      snap.mouseY = world.y;
    }
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        stepAmbient(state, renderer, STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepGame(state, renderer, snap, STEP);
        accumulator -= STEP;
        if (state.busted) {
          endGame(state.overReason);
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen);
  }

  // Leaving the tab pauses a running game rather than letting the city run on.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) {
  const renderer = createRenderer(canvas);
  const state = createState(seed);
  state.save = readSave();
  runShot(shot, state, renderer);
} else {
  runGame();
}
