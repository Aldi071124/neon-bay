// Neon Bay — combat: pistol bullets, muzzle flash, hit sparks and smoke,
// and the particle system every crash, shot and pickup feeds into.

import { CAR, PALETTE } from './config.js';
import { blockedAt } from './world.js';
import { knockDownPed, scarePeds } from './pedestrians.js';

/** A puff of smoke or a burst of sparks at (x, y). */
export function spawnParticles(state, x, y, kind, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng() * Math.PI * 2;
    const speed = 40 + state.rng() * (kind === 'spark' ? 260 : 90);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + state.rng() * 0.45,
      maxLife: 0.8,
      size: kind === 'spark' ? 3 : 5 + state.rng() * 6,
      kind,
    });
  }
  if (state.particles.length > 320) state.particles.splice(0, state.particles.length - 320);
}

/** Fade and drift every particle one step. */
export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.2 * dt;
    pt.vy *= 1 - 2.2 * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const skid of state.skids) skid.life -= dt;
  state.skids = state.skids.filter((skid) => skid.life > 0);
}

/** A bullet hitting a car: damage it, and a traffic driver bails out. */
function hitCar(state, car, bullet) {
  car.hp -= 34;
  car.flash = 0.15;
  spawnParticles(state, bullet.x, bullet.y, 'spark', 6);
  if (car.kind === 'traffic' && car.hp < 60) {
    car.kind = 'parked';
    car.speed = 0;
    const ped = {
      x: car.x,
      y: car.y + 30,
      angle: 0,
      speed: 60,
      shirt: PALETTE.pedShirts[0],
      state: 'flee',
      fleeT: 4,
      downT: 0,
      turnT: 0,
      fx: 0,
      fy: 1,
    };
    state.peds.push(ped);
  }
  if (car.kind === 'police') {
    state.events.push({ type: 'crime', kind: 'shoot', x: car.x, y: car.y });
  }
  if (car.hp <= 0 && car.kind !== 'player') {
    spawnParticles(state, car.x, car.y, 'smoke', 14);
    if (car.kind === 'police') car.gone = true;
    else car.kind = 'parked';
    car.speed = 0;
  }
}

/** Advance all bullets: fly, hit walls, cars and people. */
export function updateBullets(state, dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (blockedAt(state.city, bullet.x, bullet.y, 2)) {
      spawnParticles(state, bullet.x, bullet.y, 'spark', 4);
      bullet.life = 0;
      continue;
    }
    for (const car of state.cars) {
      if (car === state.player.inCar) continue;
      const dx = bullet.x - car.x;
      const dy = bullet.y - car.y;
      // Rough rotated-rectangle test: rotate the offset into the car's frame.
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const across = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
      if (Math.abs(along) < CAR.length / 2 + 2 && Math.abs(across) < CAR.width / 2 + 2) {
        hitCar(state, car, bullet);
        bullet.life = 0;
        break;
      }
    }
    if (bullet.life <= 0) continue;
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 14) {
        knockDownPed(state, ped);
        state.events.push({ type: 'hit', x: ped.x, y: ped.y });
        state.events.push({ type: 'crime', kind: 'hitped', x: ped.x, y: ped.y });
        scarePeds(state, ped.x, ped.y, 200);
        bullet.life = 0;
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}
