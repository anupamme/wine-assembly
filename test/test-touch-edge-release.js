#!/usr/bin/env node
'use strict';

// Edge scrolling follows the cursor, and on a touchscreen the cursor stays
// wherever the finger left it. A drag-select ending at the screen edge (or a
// tap near it) left StarCraft- and Age-of-Empires-style maps scrolling until
// the next touch elsewhere. `touchControls.edgeInset: N` moves the guest
// cursor N pixels inside the game screen when a direct touch ends within N of
// its edge. Asserted against the real lib/browser-input.js bridge:
//   * a tap at the left edge of an exclusive 640x480 screen ends with a
//     teleported move to x = inset, after the click itself;
//   * a tap in the middle sends no extra move;
//   * without edgeInset the edge tap is left alone (opt-in per game).

const assert = require('assert');

const listeners = new Map();
const canvasListeners = new Map();
const canvas = {
  width: 640, height: 480, style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
  focus() {}, setAttribute() {}, requestPointerLock() {},
  addEventListener(type, fn) { canvasListeners.set(type, fn); },
};
global.window = {
  addEventListener(type, fn) {
    listeners.set(type, (listeners.get(type) || []).concat(fn));
  },
  removeEventListener(type, fn) {
    listeners.set(type, (listeners.get(type) || []).filter(entry => entry !== fn));
  },
};
global.document = {
  pointerLockElement: null, activeElement: canvas,
  getElementById: () => null, querySelectorAll: () => [], elementFromPoint: () => null,
  visibilityState: 'visible', addEventListener() {},
};
global.setInterval = () => 1;
global.clearInterval = () => {};

const events = [];
const renderer = {
  windows: {}, _mouseX: 0, _mouseY: 0,
  // Identity presentation: canvas pixels are guest pixels.
  _exclusivePresentationViewport: { nativeX: 0, nativeY: 0, nativeW: 640, nativeH: 480 },
  _unmapExclusiveInputPoint: (x, y) => ({ x, y }),
  wantsRelativeMouse: () => false,
  handleMouseMove(x, y, opts) {
    this._mouseX = x; this._mouseY = y;
    events.push(['move', x, y, !!(opts && opts.teleport)]);
  },
  handleMouseDown: (x, y, b) => events.push(['down', x, y, b]),
  handleMouseUp: (x, y, b) => events.push(['up', x, y, b]),
  handleMenuHover() {},
};
const runningApps = [{ name: 'starcraft_shareware', mobileTouch: 'direct',
  touchControls: { edgeInset: 8 }, wine: { running: true } }];
const browserInput = require('../lib/browser-input');
browserInput.wireCanvasInput(canvas, renderer, {
  runningApps, setTimeout: () => 77, clearTimeout() {},
});

const touchStart = canvasListeners.get('touchstart');
const tev = (touches, changed) => ({ touches, changedTouches: changed || touches,
  preventDefault() {}, stopPropagation() {} });
const finger = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
const tap = (id, x, y) => {
  const f = finger(id, x, y);
  touchStart(tev([f], [f]));
  (listeners.get('touchend') || []).at(-1)(tev([], [f]));
};

// Left edge: the click lands where the finger was, then the cursor steps in.
events.length = 0;
tap(1, 1, 200);
const up = events.findIndex(e => e[0] === 'up');
assert(up >= 0, 'the edge tap should still click');
assert.deepStrictEqual(events[up], ['up', 1, 200, 0], 'the click belongs to the touched point');
assert.deepStrictEqual(events.slice(up + 1), [['move', 8, 200, true]],
  'after the click the cursor should move edgeInset pixels inside, as a teleport');

// Bottom-right corner clamps on both axes.
events.length = 0;
tap(2, 639, 479);
assert.deepStrictEqual(events.at(-1), ['move', 631, 471, true],
  'a corner release should clamp both axes inside the inset');

// Away from the edges nothing extra happens.
events.length = 0;
tap(3, 320, 240);
assert.deepStrictEqual(events.at(-1), ['up', 320, 240, 0],
  'a tap away from the edge should end with its own release');

// Opt-in: without edgeInset an edge tap leaves the cursor where it was.
delete runningApps[0].touchControls;
events.length = 0;
tap(4, 1, 200);
assert.deepStrictEqual(events.at(-1), ['up', 1, 200, 0],
  'without touchControls.edgeInset the bridge must not move the cursor');

console.log('PASS  touch release near the screen edge parks the cursor inside edgeInset');
