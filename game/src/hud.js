// Neon Bay — the HUD: health, cash, wanted stars, the current objective, a
// live minimap, the speedometer while driving, and the dialogue box Mama Rosa
// talks through. Drawing only; it never touches the simulation.

import { PALETTE, VIEW, WORLD } from './config.js';
import { wantedStars } from './police.js';

const MINIMAP = { w: 210, h: 158, margin: 16 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = '#00000088';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = frac > 0.3 ? color : '#ff5d5d';
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawStars(ctx, state, x, y) {
  const stars = wantedStars(state);
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? PALETTE.star : PALETTE.starEmpty;
    ctx.fillText('★', x + i * 30, y);
  }
}

function drawMinimap(ctx, state) {
  const x0 = VIEW.width - MINIMAP.w - MINIMAP.margin;
  const y0 = VIEW.height - MINIMAP.h - MINIMAP.margin;
  const sx = MINIMAP.w / WORLD.width;
  const sy = MINIMAP.h / WORLD.height;
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, x0 - 6, y0 - 6, MINIMAP.w + 12, MINIMAP.h + 12, 8);
  ctx.fill();
  // Water and sand along the south edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0 + 2240 * sy, MINIMAP.w, MINIMAP.h - 2240 * sy);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, y0 + 2080 * sy, MINIMAP.w, 160 * sy);
  // Roads.
  ctx.fillStyle = '#5a6068';
  for (const rx of state.city.roadsX) ctx.fillRect(x0 + rx * sx - 2, y0, 4, MINIMAP.h);
  for (const ry of state.city.roadsY) ctx.fillRect(x0, y0 + ry * sy - 2, MINIMAP.w, 4);
  // Buildings.
  ctx.fillStyle = '#8b93a3';
  for (const b of state.city.buildings) {
    ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  // Mission marker, pulsing.
  const m = state.mission;
  if (m.marker && !m.finished) {
    const pulse = 4 + Math.sin(state.time * 5) * 2;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x0 + m.marker.x * sx, y0 + m.marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police in blue, the player in white.
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillStyle = '#4d9fff';
    ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 6, y0 - 6, MINIMAP.w + 12, MINIMAP.h + 12);
}

/** Paint the HUD over a playing frame. */
export function drawHud(ctx, state) {
  const p = state.player;
  ctx.textBaseline = 'top';
  // Top-left: health bar and cash.
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 12, 12, 250, 66, 8);
  ctx.fill();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'left';
  ctx.fillText('KAI MERCER', 24, 22);
  drawBar(ctx, 24, 44, 150, 12, p.health / 100, '#4ade80');
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.cash;
  ctx.fillText(`$${p.cash}`, 184, 38);
  // Top-right: wanted stars.
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, VIEW.width - 190, 12, 178, 44, 8);
  ctx.fill();
  drawStars(ctx, state, VIEW.width - 178, 20);
  // Top-centre: the current objective.
  const m = state.mission;
  if (m.objective) {
    ctx.font = '16px system-ui, sans-serif';
    const w = ctx.measureText(m.objective).width + 28;
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, (VIEW.width - w) / 2, 12, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = m.failed ? '#ff8a80' : PALETTE.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(m.objective, VIEW.width / 2, 20);
    if (m.timer !== null && !m.failed) {
      ctx.fillStyle = m.timer < 30 ? '#ff8a80' : PALETTE.hudMuted;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`${Math.ceil(m.timer)}s`, VIEW.width / 2, 46);
    }
  }
  // Bottom-left: ammo and speed.
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudBg;
  const speedText = p.inCar ? `${Math.round(Math.abs(p.inCar.speed) * 0.45)} km/h` : '';
  const ammoText = p.reloadT > 0 ? 'RELOADING…' : `AMMO ${p.ammo}/${12}`;
  const leftW = Math.max(ctx.measureText(speedText).width, ctx.measureText(ammoText).width) + 28;
  roundRect(ctx, 12, VIEW.height - 66, leftW, 54, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(ammoText, 24, VIEW.height - 58);
  if (p.inCar) {
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.fillText(speedText, 24, VIEW.height - 34);
  }
  // Mission-complete toast.
  if (m.toast && state.time < m.toastUntil) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    const w = ctx.measureText(m.toast).width + 36;
    ctx.fillStyle = '#1d7a3acc';
    roundRect(ctx, (VIEW.width - w) / 2, 96, w, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(m.toast, VIEW.width / 2, 105);
  }
  // Dialogue box from Mama Rosa.
  if (m.dialogue && state.time < m.dialogueUntil) {
    ctx.font = '16px system-ui, sans-serif';
    const maxW = 760;
    const words = m.dialogue.split(' ');
    const lines = [''];
    for (const word of words) {
      const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (ctx.measureText(test).width > maxW - 40 && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = test;
    }
    const h = 24 + lines.length * 22;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, (VIEW.width - maxW) / 2, VIEW.height - h - 84, maxW, h, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MAMA ROSA', (VIEW.width - maxW) / 2 + 20, VIEW.height - h - 84 + 14);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '16px system-ui, sans-serif';
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], (VIEW.width - maxW) / 2 + 20, VIEW.height - h - 84 + 38 + i * 22);
    }
  }
  drawMinimap(ctx, state);
  // Controls reminder, faint, bottom centre.
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff66';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move / drive · E enter car · Click shoot · F punch · P pause · M mute', VIEW.width / 2, VIEW.height - 20);
}
