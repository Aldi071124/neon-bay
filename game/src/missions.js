// Neon Bay — the story: four jobs for fixer Mama Rosa, each with stages,
// a map marker, dialogue, a timer where the job is urgent, and a cash reward.
// Missions drive the objective line, the minimap marker and the dialogue box.

import { MISSION_REWARDS } from './config.js';
import { addHeat } from './police.js';

export const MISSION_NAMES = [
  'First Delivery',
  'Pawn-Shop Getaway',
  'Harbor Run',
  'Dock Heist',
];

// Where each stage's marker sits: always on a road or a sidewalk, never inside
// a building. (x, y, label) for every stage of every mission.
const STAGES = [
  [
    { x: 1248, y: 852, label: "Pick up Rosa's package at the cafe" },
    { x: 2048, y: 1252, label: 'Deliver the package to the Marlin Hotel', timer: 150 },
  ],
  [
    { x: 2048, y: 452, label: 'Reach the pawn shop on Coral Row' },
    { x: 448, y: 1652, label: 'Lose the heat — reach the safehouse' },
  ],
  [
    { x: 2752, y: 2152, label: 'Pick up the crates at the docks' },
    { x: 452, y: 2152, label: 'Deliver the crates to the beach house', timer: 180 },
  ],
  [
    { x: 2700, y: 2100, label: 'Steal the vault truck at the docks (press E)' },
    { x: 852, y: 452, label: 'Drive the truck to the hideout' },
  ],
];

const DIALOGUE = [
  [
    "Mama Rosa: Kai, welcome to Neon Bay. First job — pick up a package at my cafe, then run it to the Marlin Hotel. Don't keep the client waiting.",
    "Mama Rosa: Package in hand. The hotel is on the east side — drive if you can borrow a car, but don't smash it up.",
  ],
  [
    "Mama Rosa: The pawn shop on Coral Row is holding a lot of cash. Walk in, grab it, and get out. The law will come running — be ready.",
    'Mama Rosa: You have the cash and the whole precinct behind you. Get to the safehouse on the west side and lay low.',
  ],
  [
    "Mama Rosa: Crates at the docks, beach house at the other end of the shore. The harbour patrol is jumpy tonight — keep your head down.",
    'Mama Rosa: Crates loaded. The beach house is waiting, and so is the clock.',
  ],
  [
    "Mama Rosa: Last one, Kai. A vault truck is sitting at the docks, driver on a break. Take it — and take the whole city with it.",
    "Mama Rosa: The truck is yours. Four stars on your tail and one hideout north. Drive like the whole bay is watching — it is.",
  ],
];

/** Fresh mission state: job 0, stage 0, no dialogue showing. */
export function createMissionState() {
  return {
    index: 0,
    stage: 0,
    objective: STAGES[0][0].label,
    marker: { x: STAGES[0][0].x, y: STAGES[0][0].y },
    timer: null,
    dialogue: '',
    dialogueUntil: 0,
    toast: '',
    toastUntil: 0,
    failed: false,
    finished: false,
    nextDelay: 0,
  };
}

function showDialogue(mission, text, state) {
  mission.dialogue = text;
  mission.dialogueUntil = state.time + 6;
}

function showToast(mission, text, state) {
  mission.toast = text;
  mission.toastUntil = state.time + 3.5;
}

function setStage(state, index, stage) {
  const m = state.mission;
  m.index = index;
  m.stage = stage;
  const def = STAGES[index][stage];
  m.objective = def.label;
  m.marker = { x: def.x, y: def.y };
  m.timer = def.timer ?? null;
  m.failed = false;
  showDialogue(m, DIALOGUE[index][stage], state);
}

/** Start the current mission's first stage (used at boot and after a retry). */
export function startMission(state, index) {
  setStage(state, index, 0);
}

/** The job is done: pay out, save, and queue the next one. */
function completeMission(state) {
  const m = state.mission;
  const reward = MISSION_REWARDS[m.index];
  state.player.cash += reward;
  state.stats.earned += reward;
  state.stats.missionsDone += 1;
  showToast(m, `Job done — +$${reward}`, state);
  state.events.push({ type: 'missionDone', index: m.index });
  // The timer stops with the job; the save records the NEXT job, so a
  // returning player resumes where the story left off.
  m.timer = null;
  if (m.index + 1 < MISSION_NAMES.length) {
    m.nextDelay = 3;
    m.objective = 'Job done — Rosa will call with the next one.';
    m.marker = null;
  } else {
    m.finished = true;
    m.objective = 'You own Neon Bay.';
    m.marker = null;
    showDialogue(m, 'Mama Rosa: Four jobs, one city. Neon Bay is yours now, Kai.', state);
  }
  state.saveNeeded = true;
}

/** The job failed: show the reason and offer a retry. */
function failMission(state, reason) {
  const m = state.mission;
  if (m.failed || m.finished) return;
  m.failed = true;
  m.objective = `${reason} — press R to try the job again`;
  showDialogue(m, `Mama Rosa: ${reason}. Dust yourself off and run it back.`, state);
}

/** One step of the story machine. */
export function updateMissions(state, dt) {
  const m = state.mission;
  const p = state.player;
  if (m.finished) return;
  if (m.failed) return;
  if (m.nextDelay > 0) {
    m.nextDelay -= dt;
    if (m.nextDelay <= 0) startMission(state, m.index + 1);
    return;
  }
  if (m.timer !== null) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'Out of time');
      return;
    }
  }
  const marker = m.marker;
  if (!marker) return;
  const d = Math.hypot(p.x - marker.x, p.y - marker.y);
  if (d > 52) return;

  // Mission 4, stage 0 needs the player to press E by the vault truck.
  if (m.index === 3 && m.stage === 0) {
    if (!state.lastInteract) return;
    addHeat(state, 80);
    const truck = state.cars.find((c) => c.kind === 'parked' && Math.hypot(c.x - marker.x, c.y - marker.y) < 90);
    if (truck) {
      truck.kind = 'player';
      state.player.inCar = truck;
      state.player.angle = truck.angle;
    }
    setStage(state, 3, 1);
    return;
  }
  // Mission 2, stage 0: grabbing the cash brings the law down.
  if (m.index === 1 && m.stage === 0) {
    addHeat(state, 45);
    state.pickups.push({ x: marker.x + 20, y: marker.y, kind: 'cash', amount: 120, taken: false });
    setStage(state, 1, 1);
    return;
  }
  // Mission 3, stage 0: loading the crates draws harbour patrol attention.
  if (m.index === 2 && m.stage === 0) {
    addHeat(state, 20);
    setStage(state, 2, 1);
    return;
  }
  // Mission 2, stage 1: reaching the safehouse clears the heat.
  if (m.index === 1 && m.stage === 1) {
    state.heat = 0;
    completeMission(state);
    return;
  }
  if (m.stage + 1 < STAGES[m.index].length) {
    setStage(state, m.index, m.stage + 1);
  } else {
    completeMission(state);
  }
}

/** Retry the current job from its first stage. */
export function retryMission(state) {
  startMission(state, state.mission.index);
}
