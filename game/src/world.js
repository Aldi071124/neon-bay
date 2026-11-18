// Neon Bay — the city itself: roads, blocks, buildings, beach, docks and
// traffic lights, plus the collision and road queries the rest of the game uses.
// The city is generated once from a seeded random, so the same seed always
// builds the same streets.

import { BEACH_TOP, DOCKS, PALETTE, ROADS_X, ROADS_Y, ROAD_HALF, WATER_TOP, WORLD } from './config.js';

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** A building: a rectangle with a roof colour and a height used for its shadow. */
function makeBuilding(rng, x0, y0, x1, y1) {
  return {
    x: x0,
    y: y0,
    w: x1 - x0,
    h: y1 - y0,
    roof: pick(rng, PALETTE.buildingRoof),
    tall: rng() < 0.3,
  };
}

/** Build the whole city from the seeded random. */
export function createCity(rng) {
  const buildings = [];
  const parks = [];
  const parkingLots = [];

  // Blocks are the rectangles between neighbouring roads. Each block holds
  // one to three buildings, or becomes a park or a parking lot.
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const bx0 = ROADS_X[ix] + ROAD_HALF + 14;
      const bx1 = ROADS_X[ix + 1] - ROAD_HALF - 14;
      const by0 = ROADS_Y[iy] + ROAD_HALF + 14;
      const by1 = ROADS_Y[iy + 1] - ROAD_HALF - 14;
      // The south row of blocks borders the beach: keep it low and open.
      if (by1 > BEACH_TOP - 60) continue;
      const roll = rng();
      if (roll < 0.14) {
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        continue;
      }
      if (roll < 0.26) {
        parkingLots.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        continue;
      }
      const count = 1 + Math.floor(rng() * 3);
      if (count === 1) {
        buildings.push(makeBuilding(rng, bx0 + 20, by0 + 20, bx1 - 20, by1 - 20));
      } else if (count === 2) {
        const horizontal = rng() < 0.5;
        if (horizontal) {
          const mid = (by0 + by1) / 2;
          buildings.push(makeBuilding(rng, bx0 + 16, by0 + 16, bx1 - 16, mid - 10));
          buildings.push(makeBuilding(rng, bx0 + 16, mid + 10, bx1 - 16, by1 - 16));
        } else {
          const mid = (bx0 + bx1) / 2;
          buildings.push(makeBuilding(rng, bx0 + 16, by0 + 16, mid - 10, by1 - 16));
          buildings.push(makeBuilding(rng, mid + 10, by0 + 16, bx1 - 16, by1 - 16));
        }
      } else {
        const mx = (bx0 + bx1) / 2;
        const my = (by0 + by1) / 2;
        buildings.push(makeBuilding(rng, bx0 + 14, by0 + 14, mx - 10, my - 10));
        buildings.push(makeBuilding(rng, mx + 10, by0 + 14, bx1 - 14, my - 10));
        buildings.push(makeBuilding(rng, bx0 + 14, my + 10, bx1 - 14, by1 - 14));
      }
    }
  }

  // The dock yard: container stacks (solid blocks) and two wooden piers.
  const containers = [];
  for (let i = 0; i < 10; i += 1) {
    const cx = DOCKS.x0 + 30 + (i % 5) * 96;
    const cy = DOCKS.y0 + 24 + Math.floor(i / 5) * 64;
    containers.push({
      x: cx,
      y: cy,
      w: 78,
      h: 44,
      roof: pick(rng, PALETTE.container),
      tall: false,
    });
  }
  const piers = [
    { x: DOCKS.x0 + 40, y: DOCKS.y0 + 130, w: 60, h: 90 },
    { x: DOCKS.x0 + 420, y: DOCKS.y0 + 130, w: 60, h: 90 },
  ];

  // One traffic light per intersection; its phase is derived from the clock,
  // so lights never need their own stored state.
  const lights = [];
  for (const lx of ROADS_X) {
    for (const ly of ROADS_Y) {
      lights.push({ x: lx, y: ly, parity: ((lx + ly) / 400) % 2 });
    }
  }

  // A few palm trees along the beach, for the skyline.
  const palms = [];
  for (let x = 120; x < WORLD.width - 120; x += 130) {
    palms.push({ x: x + rng() * 60, y: BEACH_TOP + 34 + rng() * 40 });
  }

  return { buildings, parks, parkingLots, containers, piers, lights, palms, roadsX: ROADS_X, roadsY: ROADS_Y };
}

/** True when the point is on asphalt (a road, either axis). */
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

/** True when the point is in the water (not walkable, not drivable). */
export function isWater(x, y) {
  return y >= WATER_TOP;
}

/** True when a circle of radius r at (x, y) overlaps a building, a container or water. */
export function blockedAt(city, x, y, r) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  if (isWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  for (const c of city.containers) {
    if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return true;
  }
  return false;
}

/** The nearest road centre to a point, and which axis it belongs to. */
export function nearestRoad(x, y) {
  let bestX = ROADS_X[0];
  let bestDx = Math.abs(x - bestX);
  for (const rx of ROADS_X) {
    if (Math.abs(x - rx) < bestDx) {
      bestDx = Math.abs(x - rx);
      bestX = rx;
    }
  }
  let bestY = ROADS_Y[0];
  let bestDy = Math.abs(y - bestY);
  for (const ry of ROADS_Y) {
    if (Math.abs(y - ry) < bestDy) {
      bestDy = Math.abs(y - ry);
      bestY = ry;
    }
  }
  return bestDx <= bestDy ? { axis: 'y', road: bestX } : { axis: 'x', road: bestY };
}

/**
 * Which way the light at (lx, ly) is green at time t: 'ns' lets the vertical
 * roads run, 'ew' lets the horizontal roads run. The phase flips every 6 s.
 */
export function lightPhase(lx, ly, t) {
  const cycle = Math.floor(t / 6) % 2;
  return ((lx + ly) / 400) % 2 === cycle ? 'ns' : 'ew';
}

/** A random point on a sidewalk (used to spawn pedestrians). */
export function sidewalkPoint(rng) {
  if (rng() < 0.5) {
    const rx = ROADS_X[Math.floor(rng() * ROADS_X.length)];
    const side = rng() < 0.5 ? -1 : 1;
    return { x: rx + side * (ROAD_HALF + 12), y: 120 + rng() * (BEACH_TOP - 240) };
  }
  const ry = ROADS_Y[Math.floor(rng() * ROADS_Y.length)];
  const side = rng() < 0.5 ? -1 : 1;
  return { x: 120 + rng() * (WORLD.width - 240), y: ry + side * (ROAD_HALF + 12) };
}

/** A random point in the middle of a road lane (used to spawn traffic). */
export function roadPoint(rng) {
  if (rng() < 0.5) {
    const rx = ROADS_X[Math.floor(rng() * ROADS_X.length)];
    return { x: rx, y: 120 + rng() * (BEACH_TOP - 240), axis: 'y' };
  }
  const ry = ROADS_Y[Math.floor(rng() * ROADS_Y.length)];
  return { x: 120 + rng() * (WORLD.width - 240), y: ry, axis: 'x' };
}
