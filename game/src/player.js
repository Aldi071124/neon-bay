// Neon Bay — Kai Mercer on foot: walking, punching, shooting, picking things
// up, and getting in and out of cars. Driving itself lives in vehicles.js.

import { PLAYER } from './config.js';
import { blockedAt } from './world.js';
import { enterCar, exitCar, nearestCar } from './vehicles.js';

/** The player's starting state: on foot by Rosa's cafe, unarmed but for fists. */
export function createPlayer() {
  return {
    x: 1150,
    y: 950,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    cash: 0,
    ammo: PLAYER.ammoMax,
    inCar: null,
    punchCd: 0,
    shootCd: 0,
    reloadT: 0,
    lastHurt: -99,
    moving: false,
  };
}

/** Move on foot with axis-separated collision (slides along walls). */
function walk(state, input, dt) {
  const p = state.player;
  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  p.moving = mx !== 0 || my !== 0;
  if (!p.moving) return;
  const len = Math.hypot(mx, my);
  const vx = (mx / len) * PLAYER.walkSpeed * dt;
  const vy = (my / len) * PLAYER.walkSpeed * dt;
  if (!blockedAt(state.city, p.x + vx, p.y, PLAYER.radius)) p.x += vx;
  if (!blockedAt(state.city, p.x, p.y + vy, PLAYER.radius)) p.y += vy;
  p.angle = Math.atan2(my, mx);
}

/** A punch in the direction the player faces; knocks a pedestrian down. */
function punch(state) {
  const p = state.player;
  p.punchCd = PLAYER.punchCooldown;
  const px = p.x + Math.cos(p.angle) * 30;
  const py = p.y + Math.sin(p.angle) * 30;
  state.events.push({ type: 'punch', x: px, y: py });
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < PLAYER.punchRange) {
      ped.state = 'down';
      ped.downT = 4;
      state.events.push({ type: 'crime', kind: 'punch', x: ped.x, y: ped.y });
      state.events.push({ type: 'hit', x: ped.x, y: ped.y });
    }
  }
}

/** Fire the pistol toward the mouse. Returns false when there is no ammo. */
function shoot(state, tx, ty) {
  const p = state.player;
  if (p.ammo <= 0) {
    p.reloadT = PLAYER.reloadTime;
    return false;
  }
  p.ammo -= 1;
  p.shootCd = PLAYER.shootCooldown;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  const mx = p.x + Math.cos(angle) * 22;
  const my = p.y + Math.sin(angle) * 22;
  state.bullets.push({
    x: mx,
    y: my,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: 0.9,
  });
  state.events.push({ type: 'muzzle', x: mx, y: my, angle });
  state.events.push({ type: 'gunshot', x: p.x, y: p.y });
  state.events.push({ type: 'crime', kind: 'shoot', x: p.x, y: p.y });
  return true;
}

/** One step of the player: on foot or riding along in their car. */
export function updatePlayer(state, input, dt) {
  const p = state.player;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) p.ammo = PLAYER.ammoMax;
  }
  // Slow health recovery after a quiet spell.
  if (state.time - p.lastHurt > PLAYER.regenDelay && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + PLAYER.regenRate * dt);
  }

  if (p.inCar) {
    // In the car the player is the car: position and angle follow it.
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    p.angle = p.inCar.angle;
    p.moving = Math.abs(p.inCar.speed) > 10;
    if (state.lastInteract) exitCar(state);
    return;
  }

  walk(state, input, dt);
  // Aim at the mouse; on foot the player turns to face it.
  if (input.mouseSeen) p.angle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
  if (input.punch && p.punchCd <= 0) punch(state);
  if (input.shoot && p.shootCd <= 0 && p.reloadT <= 0) shoot(state, input.mouseX, input.mouseY);
  if (state.lastInteract) {
    const car = nearestCar(state, p.x, p.y, 56);
    if (car && car.kind !== 'police') enterCar(state, car);
  }
  // Pick up anything lying at the player's feet.
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 30) {
      pickup.taken = true;
      if (pickup.kind === 'cash') {
        p.cash += pickup.amount;
        state.stats.earned += pickup.amount;
      } else if (pickup.kind === 'health') {
        p.health = Math.min(PLAYER.health, p.health + 40);
      } else if (pickup.kind === 'ammo') {
        p.ammo = PLAYER.ammoMax;
      }
      state.events.push({ type: 'pickup', x: pickup.x, y: pickup.y, kind: pickup.kind });
    }
  }
}
