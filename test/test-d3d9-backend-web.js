#!/usr/bin/env node
'use strict';
const assert = require('assert');
const path = require('path');
// Pure JS validation arm: exercise the production draw validator with a GPU
// boundary double. No browser, WASM, or pixels are needed for rejection detail.
const { Device } = require('../lib/d3d9-backend');
const vertexShader = new Uint32Array([0xfffe0101, 1, 0xc00f0000, 0x90e40000, 0xffff]);
const pixelShader = new Uint32Array([0xffff0101, 1, 0x800f0000, 0xa0e40000, 0xffff]);
for (const [type, offset] of [[5, 0], [3, 2], [3, -4], [3, 0.5]]) {
  const draw = { vertexShader, pixelShader, primitive: 4, primitiveCount: 1,
    stride: 16, vertices: new Uint8Array(48),
    attributes: [{ register: 0, usage: 0, usageIndex: 2, type, offset }] };
  const before = JSON.stringify(draw.attributes);
  const gpu = { canvas: {width: 16, height: 16}, gl: {}, createProgram: () => ({}),
    draw() { throw Error('invalid declaration reached GPU draw'); } };
  assert.throws(() => Device.prototype.draw.call({gpu, programs: new Map(), bindDepth() {}}, draw), error => {
    const prefix = 'D3D9 draw: unsupported vertex declaration element: ';
    assert(error.message.startsWith(prefix));
    assert.deepStrictEqual(JSON.parse(error.message.slice(prefix.length)),
      {register: 0, type, offset, usage: 0, usageIndex: 2, stride: 16});
    return true;
  });
  assert.strictEqual(JSON.stringify(draw.attributes), before, 'diagnostic must not mutate declaration');
}
if (process.argv.includes('--validation-only')) {
  console.log('PASS D3D9 unsupported type and invalid offsets still reject with exact element detail');
  process.exit(0);
}
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-first-run', '--no-default-browser-check'] });
  try {
    const page = await browser.newPage();
    for (const file of ['gpu-backend.js', 'd3d9-shader.js', 'd3d9-fixed.js', 'd3d9-backend.js'])
      await page.addScriptTag({ path: path.join(__dirname, '../lib', file) });
    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
      const device = new D3D9Backend.Device(canvas), gl = device.gpu.gl;
      const vertexShader = new Uint32Array([0xfffe0101,
        1, 0xc00f0000, 0x90e40000, // oPos = v0
        1, 0xd00f0000, 0xa0e40000, // oD0 = VS c0
        0xffff]);
      const pixelShader = new Uint32Array([0xffff0101,
        5, 0x800f0000, 0x90e40000, 0xa0e40000, // r0 = v0 * PS c0
        0xffff]);
      const floats = new Float32Array([-1,-1,0.25,1, 3,-1,0.25,1, -1,3,0.25,1]);
      const draw = { vertexShader, pixelShader, primitive: 4, primitiveCount: 1,
        vertices: new Uint8Array(floats.buffer), stride: 16,
        indices: new Uint16Array([0,1,2]), attributes: [{ register: 0, type: 3, offset: 0 }],
        vertexConstants: new Float32Array([0.8, 0.4, 0.2, 1]),
        pixelConstants: new Float32Array([0.5, 0.5, 0.5, 1]), state: { cull: 1 } };
      const read = () => Array.from(device.gpu.readPixels(8,8,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      device.clear([0,0,0,1], 3); device.draw(draw); const initial = read();
      const farther = floats.slice(); for (let i=2;i<farther.length;i+=4) farther[i] = 0.75;
      device.draw({ ...draw, vertices: new Uint8Array(farther.buffer),
        vertexConstants: new Float32Array([1,0,0,1]) });
      const depthRejected = read();
      device.draw({ ...draw, vertices: new Uint8Array(farther.buffer),
        vertexConstants: new Float32Array([1,0,0,1]),
        pixelConstants: new Float32Array([1,1,1,0.5]),
        state: { cull: 1, zenable: false, blend: true, srcblend: 5, dstblend: 6 } });
      const blended = read();
      let bounded = false;
      try { device.draw({ ...draw, indices: new Uint16Array([0,1,20]) }); }
      catch (e) { bounded = /outside buffer/.test(e.message); }
      const relativeVS=new Uint32Array([0xfffe0101,1,0xb0010000,0xa0000000,
        1,0xc00f0000,0x90e40000,1,0xd00f0000,0xa0e42002,0xffff]);
      const constants=new Float32Array(384);constants[0]=1.75;
      constants.set([0.2,0.4,0.6,1],12);
      const relativeDraw={...draw,vertexShader:relativeVS,vertexConstants:constants,
        pixelConstants:new Float32Array([1,1,1,1]),state:{cull:1,zenable:false}};
      device.draw(relativeDraw);const relativePixel=read();
      constants[0]=-2.25;device.draw(relativeDraw);const relativeOutside=read();
      const error = device.gpu.getError(); device.destroy();
      return { initial, depthRejected, blended, relativePixel, relativeOutside, bounded, error,
        probe:D3D9Backend.probe(document.createElement('canvas')) };
    });
    assert.strictEqual(result.error, 0); assert.ok(result.bounded);
    assert.ok(result.probe,'programmable profile requires a real textured/indexed pixel probe');
    const near = (actual, expected) => expected.forEach((v,i) =>
      assert.ok(Math.abs(actual[i] - v) <= 1, `pixel ${actual} expected ${expected}`));
    near(result.initial, [102,51,26,255]);
    assert.deepStrictEqual(result.depthRejected, result.initial);
    near(result.blended.slice(0,3), [179,26,13]);
    near(result.relativePixel,[51,102,153,255]);
    near(result.relativeOutside.slice(0,3),[0,0,0]); // opaque default back buffer
    console.log('PASS D3D9 indexed draw, independent VS/PS constants, depth rejection, alpha blending, vertex bounds');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
