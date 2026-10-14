#!/usr/bin/env node
'use strict';

// Requires the serialized runtime/build slot. No game assets are needed.
// This compiles the real WAT source closure, then executes its API, descriptor,
// decoder and page-watch exports in Chrome against the production GPU backend.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const { compileSrcWasm } = require('./compile-src');
const extraWat = require('./helpers/palette-gpu-wat');
const root = path.resolve(__dirname, '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

(async () => {
  const wasm = compileSrcWasm((file,source) => file === '13-exports.wat' ? `${source}\n${extraWat}` : source);
  const scripts = ['gpu-backend','d3d9-shader','d3d9-fixed','d3d9-backend','d3dim-gpu']
    .map(name=>`lib/${name}.js`).concat('test/helpers/palette-gpu-browser.js');
  const assets = new Map(scripts.map(name=>['/'+name,fs.readFileSync(path.join(root,name))]));
  assets.set('/fixture.wasm',wasm);
  const server = http.createServer((req,res) => {
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if (req.url === '/') {
      res.setHeader('Content-Type','text/html');
      res.end(scripts.map(name=>`<script src="/${name}"></script>`).join('\n')); return;
    }
    const body=assets.get(req.url);
    if (!body) { res.statusCode=404; res.end(); return; }
    res.setHeader('Content-Type',req.url.endsWith('.wasm')?'application/wasm':'text/javascript'); res.end(body);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const evidence = {
    source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    diff:execFileSync('git',['diff','--stat'],{cwd:root,encoding:'utf8'}).trim(),
    wasmSha256:sha256(wasm), extraWatSha256:sha256(extraWat),
    scripts:Object.fromEntries(scripts.map(name=>[name,sha256(assets.get('/'+name))])),
    route:'cooperative full-VM WebGL; production guest/render Worker queue is not covered', results:[],
  };
  try {
    browser=await puppeteer.launch({headless:true,
      executablePath:process.env.CHROME || '/usr/bin/chromium',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    evidence.browser=await browser.version();
    for (const version of [1,2]) {
      const page=await browser.newPage();
      page.setDefaultTimeout(120000);
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const result=await page.evaluate(version=>runPaletteGpu(version),version);
      evidence.results.push({version,...result});
      console.log(`PASS WebGL${version}: ${result.observations.length} real palette draw/clear/alpha framebuffer checks`);
      await page.close();
    }
  } catch (error) { evidence.error=error.stack || String(error); throw error; }
  finally {
    if (process.env.PALETTE_GPU_EVIDENCE)
      fs.writeFileSync(process.env.PALETTE_GPU_EVIDENCE,JSON.stringify(evidence,null,2)+'\n');
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error.stack || error);process.exitCode=1;});
