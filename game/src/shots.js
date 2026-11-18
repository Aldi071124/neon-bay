// Neon Bay — the staged screenshot scenes behind ?shot=chase|mission|city|title.
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createMissionState } from './missions.js';
import { createPlayer } from './player.js';
import { makeCar } from './vehicles.js';
import { spawnPeds } from './pedestrians.js';
import { spawnTraffic } from './vehicles.js';

const CHASE_SECONDS = 4.5;
const MISSION_SECONDS = 1.5;
const CITY_SECONDS = 7;
const TITLE_SECONDS = 5;

function blankInput() {
  return { up: false, down: false, left: false, right: false, interact: false, punch: false, shoot: false, mouseX: 0, mouseY: 0, mouseSeen: false };
}

/** Wipe the moving parts of the state back to a fresh world. */
function resetState(state) {
  state.time = 0;
  state.cars = [];
  state.peds = [];
  state.bullets = [];
  state.particles = [];
  state.skids = [];
  state.pickups = [];
  state.events = [];
  state.heat = 0;
  state.lastCrime = -99;
  state.lastPoliceSpawn = -99;
  state.arrestT = 0;
  state.mission = createMissionState();
  state.player = createPlayer();
  state.overReason = null;
  spawnTraffic(state, state.rng);
  spawnPeds(state, state.rng, 36);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Chase scene: Kai in a stolen sedan tearing east down Palm Avenue with two
 * police cars on his tail and three stars over his head.
 */
function stageChase(state, step) {
  resetState(state);
  state.mission.index = 1;
  state.mission.stage = 1;
  state.mission.objective = 'Lose the heat — reach the safehouse';
  state.mission.marker = { x: 448, y: 1652 };
  state.mission.dialogue = '';
  state.mission.dialogueUntil = 0;
  state.heat = 60;
  const car = makeCar(1100, 1200, 0, 'player', '#d94f3d');
  car.speed = 200;
  state.cars.push(car);
  state.player.inCar = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = 0;
  const cop1 = makeCar(940, 1200, 0, 'police', '#1c2430');
  cop1.speed = 230;
  const cop2 = makeCar(880, 1226, 0, 'police', '#1c2430');
  cop2.speed = 220;
  state.cars.push(cop1, cop2);
  state.lastPoliceSpawn = state.time;
  for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
    const input = blankInput();
    input.up = true;
    // Stay on the avenue: steer back toward the road centre.
    const desired = Math.max(-0.45, Math.min(0.45, (1200 - car.y) * 0.004));
    const diff = angleDiff(desired, car.angle);
    if (diff > 0.06) input.right = true;
    else if (diff < -0.06) input.left = true;
    step(state, input, STEP);
  }
  return { screen: SCREEN_PLAY };
}

/**
 * Mission scene: Kai on foot, package in hand, closing in on the Marlin
 * Hotel drop-off while a pedestrian crosses the street.
 */
function stageMission(state, step) {
  resetState(state);
  state.mission.index = 0;
  state.mission.stage = 1;
  state.mission.objective = 'Deliver the package to the Marlin Hotel';
  state.mission.marker = { x: 2048, y: 1252 };
  state.mission.timer = 132;
  state.mission.dialogue = "Mama Rosa: Package in hand. The hotel is on the east side — don't keep the client waiting.";
  state.mission.dialogueUntil = 999;
  state.player.x = 1500;
  state.player.y = 1020;
  state.player.ammo = 9;
  // Capture the drop-off before stepping: the mission can complete mid-stage,
  // which clears the marker.
  const target = { x: state.mission.marker.x, y: state.mission.marker.y };
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    if (!state.mission.marker) break;
    const input = blankInput();
    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    if (Math.abs(dx) > 12) {
      if (dx > 0) input.right = true;
      else input.left = true;
    }
    if (Math.abs(dy) > 12) {
      if (dy > 0) input.down = true;
      else input.up = true;
    }
    step(state, input, STEP);
  }
  return { screen: SCREEN_PLAY };
}

/**
 * City scene: a busy beachfront intersection — traffic on the avenue, people
 * on the sidewalks, the docks and the water at the edge of the frame.
 */
function stageCity(state, step) {
  resetState(state);
  state.mission.objective = 'Free roam — explore Neon Bay';
  state.mission.marker = { x: 2800, y: 2100 };
  state.player.x = 2400;
  state.player.y = 1900;
  for (let i = 0; i < CITY_SECONDS / STEP; i += 1) step(state, blankInput(), STEP);
  return { screen: SCREEN_PLAY };
}

/** Title scene: the city alive behind the menu. */
function stageTitle(state, step) {
  resetState(state);
  state.player.x = 1200;
  state.player.y = 860;
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) step(state, blankInput(), STEP);
  return { screen: SCREEN_TITLE };
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * `step` is the game's own fixed-step function, passed in by the boot code.
 */
export function stageShot(name, state, step) {
  if (name === 'chase') return stageChase(state, step);
  if (name === 'mission') return stageMission(state, step);
  if (name === 'city') return stageCity(state, step);
  return stageTitle(state, step);
}
