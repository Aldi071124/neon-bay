// Neon Bay — cars: traffic that follows the roads and obeys the lights,
// parked cars waiting to be borrowed, and the player's own driving physics
// (acceleration, steering, drift and skid marks).

import { CAR, LANE_OFFSET, PALETTE, ROADS_X, ROADS_Y, WORLD } from './config.js';
import { blockedAt, lightPhase, roadPoint } from './world.js';

let nextCarId = 1;

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function laneFor(axis, road, dir) {
  // Right-hand traffic: heading east (+x) keeps to the south side of the road,
  // heading south (+y) keeps to the west side, and so on.
  if (axis === 'x') return dir > 0 ? road + LANE_OFFSET : road - LANE_OFFSET;
  return dir > 0 ? road - LANE_OFFSET : road + LANE_OFFSET;
}

function axisAngle(axis, dir) {
  if (axis === 'x') return dir > 0 ? 0 : Math.PI;
  return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}

/** A car object. `kind` is 'traffic', 'parked', 'police' or 'player'. */
export function makeCar(x, y, angle, kind, color) {
  return {
    id: nextCarId,
    x,
    y,
    angle,
    speed: 0,
    targetSpeed: 0,
    color,
    kind,
    axis: 'x',
    dir: 1,
    road: 0,
    hp: 100,
    stuck: 0,
    flash: 0,
  };
}

/** Spawn the ambient traffic and the parked cars. */
export function spawnTraffic(state, rng) {
  for (let i = 0; i < 16; i += 1) {
    const spot = roadPoint(rng);
    const dir = rng() < 0.5 ? -1 : 1;
    const car = makeCar(
      spot.axis === 'y' ? laneFor('y', spot.x, dir) : spot.x,
      spot.axis === 'y' ? spot.y : laneFor('x', spot.y, dir),
      axisAngle(spot.axis, dir),
      'traffic',
      pick(rng, PALETTE.carColors),
    );
    car.axis = spot.axis;
    car.dir = dir;
    car.road = spot.axis === 'y' ? spot.x : spot.y;
    car.speed = 60 + rng() * 50;
    car.targetSpeed = CAR.trafficMax;
    state.cars.push(car);
    nextCarId += 1;
  }
  // Parked cars along the parking lots and the beach road.
  for (let i = 0; i < 10; i += 1) {
    const lot = state.city.parkingLots[Math.floor(rng() * state.city.parkingLots.length)];
    const car = makeCar(
      lot.x + 30 + rng() * (lot.w - 60),
      lot.y + 26 + rng() * (lot.h - 52),
      rng() < 0.5 ? 0 : Math.PI / 2,
      'parked',
      pick(rng, PALETTE.carColors),
    );
    state.cars.push(car);
    nextCarId += 1;
  }
}

/** The closest car to a point, within `maxDist` (any kind, or one kind). */
export function nearestCar(state, x, y, maxDist, kind) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (kind && car.kind !== kind) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** One traffic car follows its lane, stops at red lights and at the car ahead. */
function updateTrafficCar(state, car, dt) {
  const ahead = car.axis === 'x' ? car.x + car.dir * 90 : car.y + car.dir * 90;
  // The intersection this car is about to reach (if any): a car driving along
  // x crosses the vertical roads, and a car driving along y crosses the
  // horizontal ones.
  let target = CAR.trafficMax;
  const roads = car.axis === 'x' ? ROADS_X : ROADS_Y;
  for (const cross of roads) {
    const along = car.axis === 'x' ? car.x : car.y;
    const dist = (cross - along) * car.dir;
    if (dist > 8 && dist < 95) {
      const phase = lightPhase(car.axis === 'x' ? cross : car.road, car.axis === 'x' ? car.road : cross, state.time);
      const myGreen = car.axis === 'x' ? phase === 'ew' : phase === 'ns';
      if (!myGreen) target = 0;
      break;
    }
  }
  // Slow down for the car directly ahead in the same lane.
  for (const other of state.cars) {
    if (other === car || other.axis !== car.axis || other.dir !== car.dir || other.road !== car.road) continue;
    const gap = (car.axis === 'x' ? other.x - car.x : other.y - car.y) * car.dir;
    if (gap > 0 && gap < 85) target = Math.min(target, Math.max(0, other.speed * 0.9));
  }
  // At the middle of an intersection, sometimes turn onto the crossing road.
  const along = car.axis === 'x' ? car.x : car.y;
  const crossRoads = car.axis === 'x' ? ROADS_X : ROADS_Y;
  for (const cross of crossRoads) {
    if (Math.abs(along - cross) < 4 && state.rng() < 0.08) {
      const newAxis = car.axis === 'x' ? 'y' : 'x';
      const newDir = state.rng() < 0.5 ? -1 : 1;
      car.axis = newAxis;
      car.dir = newDir;
      car.road = cross;
      car.angle = axisAngle(newAxis, newDir);
      // Snap onto the new lane so the turn reads cleanly.
      const lane = laneFor(newAxis, cross, newDir);
      if (newAxis === 'x') car.y = lane;
      else car.x = lane;
      break;
    }
  }
  car.targetSpeed = target;
  car.speed += Math.max(-260 * dt, Math.min(160 * dt, target - car.speed));
  if (car.speed < 0.5 && target === 0) car.speed = 0;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // A car that left the city turns around at the far end of its road.
  const limit = car.axis === 'x' ? WORLD.width - 60 : WORLD.height - 60;
  const pos = car.axis === 'x' ? car.x : car.y;
  if (pos > limit || pos < 60) {
    car.dir *= -1;
    car.angle = axisAngle(car.axis, car.dir);
    const lane = laneFor(car.axis, car.road, car.dir);
    if (car.axis === 'x') car.y = lane;
    else car.x = lane;
  }
}

/**
 * Drive the player's car: throttle, brake/reverse and steering, with a little
 * drift at speed. Returns true when the car is skidding (for sound + marks).
 */
function drivePlayerCar(state, car, input, dt) {
  const forward = input.up ? 1 : 0;
  const back = input.down ? 1 : 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (forward) car.speed += CAR.accel * dt;
  if (back) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
  if (!forward && !back) car.speed -= car.speed * CAR.drag * dt;
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.driveMax, car.speed));
  const steerScale = Math.min(1, Math.abs(car.speed) / 120);
  const turning = steer * CAR.steerRate * steerScale * (car.speed < 0 ? -1 : 1);
  car.angle += turning * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const skidding = Math.abs(turning) > 1.4 && Math.abs(car.speed) > 240;
  if (skidding) {
    const backX = car.x - Math.cos(car.angle) * 20;
    const backY = car.y - Math.sin(car.angle) * 20;
    state.skids.push({ x1: backX, y1: backY, x2: nx - Math.cos(car.angle) * 20, y2: ny - Math.sin(car.angle) * 20, life: 5 });
    if (state.skids.length > 220) state.skids.shift();
  }
  // Building hit: stop hard, take damage, bounce back a little.
  if (blockedAt(state.city, nx, ny, CAR.radius)) {
    if (Math.abs(car.speed) > CAR.crashDamageSpeed) {
      state.events.push({ type: 'crash', x: car.x, y: car.y, hard: true });
      car.hp -= 18;
      state.player.health -= 6;
      state.player.lastHurt = state.time;
    } else if (Math.abs(car.speed) > 40) {
      state.events.push({ type: 'crash', x: car.x, y: car.y, hard: false });
    }
    car.speed *= -0.25;
    return false;
  }
  car.x = nx;
  car.y = ny;
  return skidding;
}

/** Push two overlapping cars apart and trade a little speed between them. */
function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= CAR.radius * 2) return false;
  const push = (CAR.radius * 2 - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg;
  b.speed = avg;
  return true;
}

/** Advance all cars one step. Returns whether the player's car is skidding. */
export function updateVehicles(state, input, dt) {
  let skidding = false;
  for (const car of state.cars) {
    if (car.flash > 0) car.flash -= dt;
    if (car.kind === 'traffic') updateTrafficCar(state, car, dt);
    else if (car.kind === 'player') skidding = drivePlayerCar(state, car, input, dt);
    // Parked cars sit still; police cars are driven by police.js.
  }
  // Car-on-car bumps, including the player ramming traffic.
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i];
      const b = state.cars[j];
      if (separateCars(a, b)) {
        const fast = Math.max(Math.abs(a.speed), Math.abs(b.speed));
        if (fast > 180) {
          state.events.push({ type: 'crash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, hard: fast > 300 });
          if (a.kind === 'player' || b.kind === 'player') {
            state.player.health -= 3;
            state.player.lastHurt = state.time;
          }
        }
        // A hard ram knocks a traffic driver out of their car.
        if (fast > 260 && a.kind === 'traffic' && b.kind === 'player') a.kind = 'parked';
        if (fast > 260 && b.kind === 'traffic' && a.kind === 'player') b.kind = 'parked';
      }
    }
  }
  // Keep the player's car inside the world and out of the water.
  const playerCar = state.cars.find((c) => c.kind === 'player');
  if (playerCar && (playerCar.x < 30 || playerCar.y < 30 || playerCar.x > WORLD.width - 30 || playerCar.y > WORLD.height - 30)) {
    playerCar.x = Math.max(30, Math.min(WORLD.width - 30, playerCar.x));
    playerCar.y = Math.max(30, Math.min(WORLD.height - 30, playerCar.y));
    playerCar.speed *= 0.5;
  }
  return skidding;
}

/** Put the player into a car (stealing a traffic car is a crime). */
export function enterCar(state, car) {
  if (car.kind === 'traffic') {
    state.events.push({ type: 'crime', kind: 'steal', x: car.x, y: car.y });
    car.kind = 'player';
  } else if (car.kind === 'parked') {
    car.kind = 'player';
  } else {
    return false;
  }
  state.player.inCar = car;
  state.player.angle = car.angle;
  return true;
}

/** Step out of the car onto the road beside it. */
export function exitCar(state) {
  const car = state.player.inCar;
  if (!car) return;
  const sideX = car.x - Math.sin(car.angle) * 34;
  const sideY = car.y + Math.cos(car.angle) * 34;
  state.player.x = blockedAt(state.city, sideX, sideY, 14) ? car.x + Math.sin(car.angle) * 34 : sideX;
  state.player.y = blockedAt(state.city, sideX, sideY, 14) ? car.y - Math.cos(car.angle) * 34 : sideY;
  state.player.angle = car.angle;
  car.kind = 'parked';
  car.speed = 0;
  state.player.inCar = null;
}

export { angleDiff, laneFor, axisAngle };
