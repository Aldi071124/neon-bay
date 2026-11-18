// Neon Bay — keyboard and mouse input. Held keys give movement and steering;
// one-shot presses (interact, punch, shoot, pause, confirm, mute, retry) are
// queued as flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const RELOAD = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let interact = false;
  let punch = false;
  let shoot = false;
  let reload = false;
  let mute = false;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;

  function press(event, set) {
    if (UP.has(event.code)) keys.up = set;
    else if (DOWN.has(event.code)) keys.down = set;
    else if (LEFT.has(event.code)) keys.left = set;
    else if (RIGHT.has(event.code)) keys.right = set;
    else if (CONFIRM.has(event.code)) {
      if (set && !event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (set && !event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (set && !event.repeat) interact = true;
    } else if (PUNCH.has(event.code)) {
      if (set && !event.repeat) punch = true;
    } else if (RELOAD.has(event.code)) {
      if (set && !event.repeat) reload = true;
    } else if (MUTE.has(event.code)) {
      if (set && !event.repeat) mute = true;
    } else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (press(event, true)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    press(event, false);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
    if (event.button === 0) shoot = true;
  });

  return {
    get up() {
      return keys.up;
    },
    get down() {
      return keys.down;
    },
    get left() {
      return keys.left;
    },
    get right() {
      return keys.right;
    },
    get mouseX() {
      return mouseX;
    },
    get mouseY() {
      return mouseY;
    },
    get mouseSeen() {
      return mouseSeen;
    },
    /** One-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Was E pressed since the last call? Clears on read. */
    takeInteract() {
      const taken = interact;
      interact = false;
      return taken;
    },
    takePunch() {
      const taken = punch;
      punch = false;
      return taken;
    },
    takeShoot() {
      const taken = shoot;
      shoot = false;
      return taken;
    },
    takeReload() {
      const taken = reload;
      reload = false;
      return taken;
    },
    takeMute() {
      const taken = mute;
      mute = false;
      return taken;
    },
  };
}
