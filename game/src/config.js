// Neon Bay — every tuning number and colour in one place.
// The world is a 3200x2400 coastal city; the camera shows a 1280x720 window of it.
// All speeds are world units per second, all angles are radians.

export const STEP = 1 / 60;

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };

// Roads: a grid of avenues (vertical) and streets (horizontal).
export const ROADS_X = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const ROADS_Y = [400, 800, 1200, 1600, 2000];
export const ROAD_HALF = 48; // asphalt half-width
export const LANE_OFFSET = 26; // right-hand lane centre offset from the road centre

// The shore: sand then open water along the whole south edge.
export const BEACH_TOP = 2080;
export const WATER_TOP = 2240;

// Docks: wooden piers and container yard on the south-east shore.
export const DOCKS = { x0: 2520, x1: 3080, y0: 2060, y1: 2240 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 235,
  health: 100,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.45,
  ammoMax: 12,
  reloadTime: 1.1,
  shootCooldown: 0.16,
  bulletSpeed: 950,
  regenDelay: 6, // seconds without damage before health starts coming back
  regenRate: 4,
};

export const CAR = {
  length: 46,
  width: 24,
  radius: 17, // collision circle radius
  accel: 320,
  brake: 520,
  reverseMax: 130,
  driveMax: 430,
  drag: 0.55, // per second when coasting
  gripDrag: 1.6, // lateral slide damping
  steerRate: 2.6, // radians per second at full lock, scaled by speed
  crashDamageSpeed: 210, // above this, a building hit hurts
  trafficMax: 135,
  policeMax: 300,
};

export const WANTED = {
  stealCar: 25,
  hitPed: 15,
  shoot: 12,
  punchPed: 10,
  policeSighting: 0.6, // heat per second while a police car is close
  decay: 3.5, // heat lost per second while hidden and quiet
  quietTime: 6, // seconds after a crime before decay starts
};

// Cash rewards for the four story missions.
export const MISSION_REWARDS = [150, 300, 450, 800];

export const SAVE_KEY = 'neon-bay.save.v1';

export const PALETTE = {
  grass: '#7fb069',
  grassDark: '#6da25c',
  park: '#8fc97e',
  asphalt: '#3d4148',
  asphaltEdge: '#2e3138',
  lane: '#e8d44d',
  sidewalk: '#9aa0a8',
  sand: '#e8d29a',
  water: '#2e7fa8',
  waterDeep: '#256b90',
  buildingRoof: ['#c96f4a', '#d9a441', '#5b7d9c', '#8a6fae', '#b5566e', '#6f9e7a'],
  buildingEdge: '#00000033',
  dockWood: '#8a6b48',
  container: ['#c25e3e', '#3e7ec2', '#4caf6d', '#d9a441'],
  carColors: ['#d94f3d', '#3d7dd9', '#e8c33d', '#e8e8e8', '#2f2f38', '#4caf6d', '#c26fd9', '#e07b39'],
  police: '#1c2430',
  policeStripe: '#e8e8e8',
  player: '#ffcf3f',
  playerShirt: '#ffcf3f',
  pedShirts: ['#e86a6a', '#6aa8e8', '#7ed67e', '#e8a86a', '#b06ad9', '#e8e86a'],
  muzzle: '#ffd94d',
  blood: '#c22e2e',
  smoke: '#9a9a9a',
  spark: '#ffd94d',
  cash: '#4ade80',
  health: '#ff5d5d',
  ammo: '#ffd94d',
  marker: '#ffd94d',
  hudBg: '#10141bcc',
  hudText: '#f2f4f7',
  hudMuted: '#aab2bd',
  star: '#ffd94d',
  starEmpty: '#5a6270',
  title: '#ffd94d',
  panel: '#141a24e6',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
