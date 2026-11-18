// Neon Bay — pedestrians: people walking the sidewalks, crossing at corners,
// fleeing from gunfire and crashes, and occasionally getting in the way of a
// speeding car (which the law notices).

import { PALETTE } from './config.js';
import { blockedAt, sidewalkPoint } from './world.js';

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** One pedestrian: a walker with a shirt colour, a direction and a mood. */
export function makePed(state, rng) {
  const spot = sidewalkPoint(rng);
  return {
    x: spot.x,
    y: spot.y,
    angle: rng() * Math.PI * 2,
    speed: 42 + rng() * 30,
    shirt: pick(rng, PALETTE.pedShirts),
    state: 'walk', // 'walk' | 'flee' | 'down'
    fleeT: 0,
    downT: 0,
    turnT: 1 + rng() * 3,
    fx: 0,
    fy: 0,
  };
}

/** Fill the sidewalks with people. */
export function spawnPeds(state, rng, count) {
  for (let i = 0; i < count; i += 1) state.peds.push(makePed(state, rng));
}

/** A pedestrian is knocked down (by a car, a bullet or a fist). */
export function knockDownPed(state, ped) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downT = 5;
}

/** Make every pedestrian near (x, y) run away from it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.fleeT = 3;
      ped.fx = (ped.x - x) / (d || 1);
      ped.fy = (ped.y - y) / (d || 1);
    }
  }
}

/** One step of the crowd. */
export function updatePeds(state, dt) {
  const player = state.player;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        ped.state = 'walk';
        ped.fleeT = 1.5;
        ped.state = 'flee';
        ped.fx = (ped.x - player.x) / (Math.hypot(ped.x - player.x, ped.y - player.y) || 1);
        ped.fy = (ped.y - player.y) / (Math.hypot(ped.x - player.x, ped.y - player.y) || 1);
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
      const speed = 150;
      const nx = ped.x + ped.fx * speed * dt;
      const ny = ped.y + ped.fy * speed * dt;
      if (!blockedAt(state.city, nx, ped.y, 10)) ped.x = nx;
      if (!blockedAt(state.city, ped.x, ny, 10)) ped.y = ny;
      ped.angle = Math.atan2(ped.fy, ped.fx);
      continue;
    }
    // Walking: amble along, turning at random, staying on the sidewalk.
    ped.turnT -= dt;
    if (ped.turnT <= 0) {
      ped.turnT = 1.5 + state.rng() * 3;
      ped.angle += (state.rng() - 0.5) * 1.6;
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (blockedAt(state.city, nx, ny, 10)) {
      ped.angle += Math.PI / 2 + (state.rng() - 0.5);
    } else {
      ped.x = nx;
      ped.y = ny;
    }
  }
  // Cars ploughing through pedestrians: the driver is liable.
  for (const car of state.cars) {
    if (Math.abs(car.speed) < 60) continue;
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
        knockDownPed(state, ped);
        state.events.push({ type: 'hit', x: ped.x, y: ped.y });
        if (car.kind === 'player') {
          state.events.push({ type: 'crime', kind: 'hitped', x: ped.x, y: ped.y });
        }
        scarePeds(state, ped.x, ped.y, 180);
      }
    }
  }
}
