// Neon Bay — the law: a wanted level from 0 to 5 stars that rises on crime
// and fades when the player stays hidden, plus the police cars that spawn,
// chase, ram and — when they catch Kai on foot — arrest him.

import { CAR, PALETTE, WANTED } from './config.js';
import { blockedAt, roadPoint } from './world.js';
import { angleDiff, makeCar } from './vehicles.js';

/** Current wanted stars, from heat 0-100. */
export function wantedStars(state) {
  return Math.min(5, Math.floor(state.heat / 20));
}

/** Add heat for a crime; returns the new star count. */
export function addHeat(state, amount) {
  state.heat = Math.min(100, state.heat + amount);
  state.lastCrime = state.time;
  return wantedStars(state);
}

/** Handle one crime event (stealing, hitting someone, shooting). */
export function handleCrime(state, kind) {
  if (kind === 'steal') addHeat(state, WANTED.stealCar);
  else if (kind === 'hitped') addHeat(state, WANTED.hitPed);
  else if (kind === 'shoot') addHeat(state, WANTED.shoot);
  else if (kind === 'punch') addHeat(state, WANTED.punchPed);
}

/** Spawn a police car on a road some distance from the player. */
function spawnPoliceCar(state) {
  let spot = null;
  for (let tries = 0; tries < 12; tries += 1) {
    const candidate = roadPoint(state.rng);
    const d = Math.hypot(candidate.x - state.player.x, candidate.y - state.player.y);
    if (d > 550 && d < 1100) {
      spot = candidate;
      break;
    }
  }
  if (!spot) spot = roadPoint(state.rng);
  const car = makeCar(spot.x, spot.y, 0, 'police', PALETTE.police);
  car.axis = spot.axis;
  car.dir = state.rng() < 0.5 ? -1 : 1;
  car.road = spot.axis === 'y' ? spot.x : spot.y;
  car.speed = 120;
  car.targetSpeed = CAR.policeMax;
  state.cars.push(car);
  return car;
}

/** Steer a police car toward the player, sliding around buildings. */
function chasePlayer(state, car, dt) {
  const p = state.player;
  const wantedAngle = Math.atan2(p.y - car.y, p.x - car.x);
  const diff = angleDiff(wantedAngle, car.angle);
  const turn = Math.max(-2.8, Math.min(2.8, diff * 3));
  car.angle += turn * dt;
  const target = CAR.policeMax + wantedStars(state) * 18;
  car.speed += Math.max(-420 * dt, Math.min(300 * dt, target - car.speed));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (blockedAt(state.city, nx, ny, 16)) {
    // Blocked: turn hard to one side and try to slide around the building.
    car.angle += (diff > 0 ? 1 : -1) * 2.2 * dt;
    car.speed *= 0.92;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.flash = 0.12; // light bar strobes while chasing
}

/** One step of the wanted system and every police car. */
export function updatePolice(state, dt) {
  const stars = wantedStars(state);
  const player = state.player;

  // Heat fades when the player has been quiet and unseen for a while.
  let policeNear = false;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    if (Math.hypot(car.x - player.x, car.y - player.y) < 420) policeNear = true;
  }
  if (policeNear) state.heat = Math.min(100, state.heat + WANTED.policeSighting * dt);
  if (state.time - state.lastCrime > WANTED.quietTime && !policeNear && state.heat > 0) {
    state.heat = Math.max(0, state.heat - WANTED.decay * dt);
  }

  // Keep the number of police cars matched to the wanted level.
  let policeCount = 0;
  for (const car of state.cars) if (car.kind === 'police') policeCount += 1;
  if (policeCount < stars && state.time - state.lastPoliceSpawn > 1.2) {
    spawnPoliceCar(state);
    state.lastPoliceSpawn = state.time;
  }

  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (stars === 0) {
      // No heat: the police lose interest and drive off.
      car.speed = Math.max(80, car.speed - 60 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (dist > 1200) car.gone = true;
      continue;
    }
    chasePlayer(state, car, dt);
    // Ramming the player's car.
    const playerCar = player.inCar;
    if (playerCar && dist < 40) {
      state.events.push({ type: 'crash', x: (car.x + player.x) / 2, y: (car.y + player.y) / 2, hard: Math.abs(car.speed) > 200 });
      player.health -= 2;
      player.lastHurt = state.time;
      car.speed *= 0.6;
      playerCar.speed *= 0.85;
    }
    // Arrest: a slow player on foot, caught by a police car.
    if (!playerCar && dist < 30 && !player.moving) {
      state.arrestT = (state.arrestT || 0) + dt;
      if (state.arrestT > 1.0) {
        state.events.push({ type: 'busted' });
        state.arrestT = 0;
      }
    } else {
      state.arrestT = 0;
    }
  }
  // Remove police cars that drove away.
  state.cars = state.cars.filter((car) => !car.gone);
}
