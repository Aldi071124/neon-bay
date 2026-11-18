// Neon Bay — drawing only: the camera follows Kai, the city is painted in
// layers (ground, roads, buildings with long day shadows, docks, skid marks,
// people, cars, particles), then a warm daylight grade and the screen panels.
// The world's state and the current screen go in; pixels come out.

import { BEACH_TOP, DOCKS, FONT, PALETTE, ROADS_X, ROADS_Y, ROAD_HALF, VIEW, WATER_TOP, WORLD } from './config.js';
import { lightPhase } from './world.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const SHADOW_DX = 10;
const SHADOW_DY = 14;

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 1200, y: 900, shake: 0, shakeT: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  /** Convert a screen pixel (canvas CSS pixels) to world coordinates. */
  function screenToWorld(sx, sy) {
    const scale = view.scale;
    const tx = view.x + (VIEW.width / 2 - camera.x) * scale;
    const ty = view.y + (VIEW.height / 2 - camera.y) * scale;
    return { x: (sx * (window.devicePixelRatio || 1) - tx) / scale, y: (sy * (window.devicePixelRatio || 1) - ty) / scale };
  }

  function drawGround(state) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Parks.
    for (const park of state.city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Parking lots.
    ctx.fillStyle = '#6d7278';
    for (const lot of state.city.parkingLots) ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    // Beach and water.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, BEACH_TOP, WORLD.width, WATER_TOP - BEACH_TOP);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, WATER_TOP, WORLD.width, WORLD.height - WATER_TOP);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD.width; x += 90) {
      ctx.fillRect(x + ((state.time * 12) % 90), WATER_TOP + 30 + ((x / 90) % 3) * 40, 46, 3);
    }
    // Docks: wooden piers over the water's edge.
    ctx.fillStyle = PALETTE.dockWood;
    for (const pier of state.city.piers) ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    // Roads: asphalt with sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF - 10, 0, (ROAD_HALF + 10) * 2, BEACH_TOP);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_HALF - 10, WORLD.width, (ROAD_HALF + 10) * 2);
    ctx.fillStyle = PALETTE.asphalt;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, BEACH_TOP);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_HALF, WORLD.width, ROAD_HALF * 2);
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of ROADS_X) {
      for (let y = 40; y < BEACH_TOP; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROADS_Y) {
      for (let x = 40; x < WORLD.width; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
    }
    // Crosswalk stripes at every intersection.
    ctx.fillStyle = '#e8e8e8cc';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(rx + i * 12 - 3, ry - ROAD_HALF - 8, 6, 8);
          ctx.fillRect(rx + i * 12 - 3, ry + ROAD_HALF, 6, 8);
        }
      }
    }
    // Traffic lights: green for the running axis, red for the other.
    for (const light of state.city.lights) {
      const phase = lightPhase(light.x, light.y, state.time);
      ctx.fillStyle = '#22242a';
      ctx.fillRect(light.x - 26, light.y - ROAD_HALF - 22, 10, 20);
      ctx.fillRect(light.x + 16, light.y + ROAD_HALF + 2, 10, 20);
      ctx.fillStyle = phase === 'ns' ? '#3ddc5a' : '#ff4d4d';
      ctx.beginPath();
      ctx.arc(light.x - 21, light.y - ROAD_HALF - 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase === 'ew' ? '#3ddc5a' : '#ff4d4d';
      ctx.beginPath();
      ctx.arc(light.x + 21, light.y + ROAD_HALF + 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Palm trees on the beach.
    for (const palm of state.city.palms) {
      ctx.fillStyle = '#7a5a38';
      ctx.fillRect(palm.x - 2, palm.y - 14, 4, 16);
      ctx.fillStyle = '#4caf6d';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(palm.x + Math.cos(a) * 10, palm.y - 16 + Math.sin(a) * 6, 12, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBuildings(state) {
    for (const b of [...state.city.buildings, ...state.city.containers]) {
      // Long soft shadow to the south-east: high noon sun, low in the west.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + SHADOW_DX, b.y + SHADOW_DY, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x, b.y, b.w, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      // Roof clutter: vents and AC boxes.
      const vents = Math.max(1, Math.floor((b.w * b.h) / 9000));
      for (let i = 0; i < vents; i += 1) {
        const vx = b.x + 12 + ((i * 37) % Math.max(10, b.w - 24));
        const vy = b.y + 12 + ((i * 53) % Math.max(10, b.h - 24));
        ctx.fillRect(vx, vy, 10, 8);
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h / 2 - 14, 28, 28);
      }
    }
  }

  function drawCar(car, strobe) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow under the car.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 5, 25, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.flash > 0 ? '#ffffff' : car.color;
    roundRectPath(ctx, -23, -12, 46, 24, 7);
    ctx.fill();
    // Windows and roof.
    ctx.fillStyle = '#1d2733cc';
    ctx.fillRect(-6, -10, 14, 20);
    ctx.fillStyle = car.kind === 'police' ? PALETTE.policeStripe : 'rgba(255,255,255,0.25)';
    ctx.fillRect(-23, -12, 46, 5);
    if (car.kind === 'police') {
      // Light bar, strobing while chasing (driven by game time, so a staged
      // frame is the same every run).
      ctx.fillStyle = strobe ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-4, -13, 8, 4);
      ctx.fillStyle = strobe ? '#3b82ff' : '#ff3b30';
      ctx.fillRect(4, -13, 8, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 4);
    }
    // Wheels.
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-16, -14, 10, 4);
    ctx.fillRect(-16, 10, 10, 4);
    ctx.fillRect(8, -14, 10, 4);
    ctx.fillRect(8, 10, 10, 4);
    ctx.restore();
  }

  function drawWorld(state) {
    drawGround(state);
    drawBuildings(state);
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,24,0.5)';
    ctx.lineWidth = 4;
    for (const skid of state.skids) {
      ctx.globalAlpha = Math.min(1, skid.life / 2);
      ctx.beginPath();
      ctx.moveTo(skid.x1, skid.y1);
      ctx.lineTo(skid.x2, skid.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Pickups.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(state.time * 4 + pickup.x) * 2;
      ctx.fillStyle = pickup.kind === 'cash' ? PALETTE.cash : pickup.kind === 'health' ? PALETTE.health : PALETTE.ammo;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10141b';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pickup.kind === 'cash' ? '$' : pickup.kind === 'health' ? '+' : 'A', pickup.x, pickup.y + bob + 4);
    }
    // Mission marker: a pulsing ring and beacon.
    const m = state.mission;
    if (m.marker && !m.finished && !m.failed) {
      const pulse = 26 + Math.sin(state.time * 4) * 6;
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.marker.x, m.marker.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(m.marker.x, m.marker.y, 6, 0, Math.PI * 2);
      ctx.fill();
      // A light beam so the marker is visible from a distance.
      ctx.fillStyle = 'rgba(255,217,77,0.10)';
      ctx.fillRect(m.marker.x - 4, m.marker.y - 320, 8, 320);
    }
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 7, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ped.x + 2, ped.y + 3, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cars (the light-bar strobe is driven by game time, not wall time).
    const strobe = Math.floor(state.time * 5) % 2 === 0;
    for (const car of state.cars) drawCar(car, strobe);
    // The player on foot.
    const p = state.player;
    if (!p.inCar) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x + 2, p.y + 4, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.playerShirt;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#20242c';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 6, 0, Math.PI * 2);
      ctx.fill();
      // Pistol in hand when aiming.
      ctx.strokeStyle = '#20242c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
      ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
      ctx.stroke();
    }
    // Bullets.
    ctx.strokeStyle = PALETTE.muzzle;
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.kind === 'spark' ? PALETTE.spark : PALETTE.smoke;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Warm daylight grade over the whole frame. */
  function drawLighting() {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, 'rgba(255,214,140,0.05)');
    grad.addColorStop(1, 'rgba(255,170,90,0.10)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawPanel(title, lines, prompt, best, topY) {
    const extra = best ? 32 : 0;
    const width = 640;
    const height = 150 + lines.length * 32 + extra;
    const x = (VIEW.width - width) / 2;
    const y = topY !== undefined ? topY : (VIEW.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRectPath(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 52, PALETTE.title, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 128 + i * 32, 20, PALETTE.hudMuted, 'center');
    }
    if (best) text(best, VIEW.width / 2, y + 128 + lines.length * 32, 20, PALETTE.hudText, 'center');
    text(prompt, VIEW.width / 2, y + height - 30, 22, PALETTE.cash, 'center', 'bold');
  }

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen) {
    // Ease the camera toward the player; add shake while it lasts.
    const targetX = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, state.player.x));
    const targetY = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, state.player.y));
    camera.x += (targetX - camera.x) * 0.12;
    camera.y += (targetY - camera.y) * 0.12;
    if (camera.shakeT > 0) {
      camera.shakeT -= 1 / 60;
      camera.shake = 7;
    } else {
      camera.shake = 0;
    }
    // Shake from a deterministic wobble of game time, so a staged frame is
    // the same every run.
    const shakeX = camera.shake ? (Math.sin(state.time * 91.7) * 0.6 + Math.sin(state.time * 47.3) * 0.4) * camera.shake : 0;
    const shakeY = camera.shake ? (Math.cos(state.time * 83.1) * 0.6 + Math.cos(state.time * 53.9) * 0.4) * camera.shake : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = view.scale;
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      view.x + (VIEW.width / 2 - camera.x - shakeX) * scale,
      view.y + (VIEW.height / 2 - camera.y - shakeY) * scale,
    );
    drawWorld(state);
    ctx.setTransform(scale, 0, 0, scale, view.x, view.y);
    drawLighting();
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(10,14,22,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.textBaseline = 'alphabetic';
      text('NEON BAY', VIEW.width / 2, 116, 96, PALETTE.title, 'center', 'bold');
      text('A sun-soaked open city. One wheelman. Four jobs.', VIEW.width / 2, 158, 22, PALETTE.hudText, 'center');
      const best = state.save ? `Best haul $${state.save.bestEarned} · Jobs done ${state.save.missionsDone}` : 'No jobs run yet — the city is waiting.';
      drawPanel('READY WHEN YOU ARE', ['WASD move and drive · E enter a car · Click shoot · F punch', 'Steal cars, dodge the law, finish all four jobs for Mama Rosa.', best], 'Press Space or click to start', null, 196);
      return;
    }
    drawHud(ctx, state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except now.'], 'Press P to keep driving', null);
    } else if (screen === SCREEN_OVER) {
      const reason = state.overReason || 'Wasted';
      const lines = reason === 'Busted'
        ? ['The law caught up with Kai.', 'Bail cost $100. Rosa is not impressed.']
        : ['Kai is down. The bay keeps moving.'];
      drawPanel(reason, lines, 'Press Space to get back on your feet', null);
    }
  }

  /** Kick the camera (a crash, a ram). */
  function shakeCamera() {
    camera.shakeT = 0.35;
  }

  /** Point the camera at a spot instantly (used by staged screenshots). */
  function snapCamera(x, y) {
    camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, x));
    camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, y));
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, shakeCamera, snapCamera, screenToWorld, camera };
}
