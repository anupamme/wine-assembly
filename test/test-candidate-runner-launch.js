const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '..');
const filename = path.join(__dirname, 'test-cli-candidate-corpus.js');
const localRequire = createRequire(filename);
const calls = [];
const moduleObject = { exports: {} };
function requireStub(name) {
  if (name === 'child_process') return { spawnSync(command, args, options) {
    calls.push({ command, args, options });
    return { status: 0, stdout: 'bounded smoke', stderr: '' };
  } };
  return localRequire(name);
}
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
  require: requireStub, module: moduleObject, __dirname, process, console, Buffer,
}, { filename });
const { runCandidate } = moduleObject.exports;
const base = path.join(root, 'test/binaries/candidates');
fs.mkdirSync(base, { recursive: true });
const fixture = fs.mkdtempSync(path.join(base, 'runner-contract-'));
const candidate = { id: path.basename(fixture), cli: {
  exeGuestPath: 'C:/SILVER/silver.exe', cwd: 'C:/SILVER', vfsTrees: ['game'],
  zipMounts: [{ file: 'source.zip', root: 'D:/SILVER/' }],
} };
try {
  fs.mkdirSync(path.join(fixture, 'game'));
  fs.writeFileSync(path.join(fixture, 'source.zip'), 'mount contract fixture');
  const result = runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm');
  assert.equal(result.status, 'READY');
  assert.equal(calls.length, 1);
  const args = calls[0].args;
  for (const value of ['--exe=/original/silver.exe', '--wasm=/snapshot.wasm',
    '--exe-guest-path=C:\\SILVER\\silver.exe', '--cwd=C:\\SILVER\\',
    `--vfs-tree=${fixture}/game`, `--zip=${fixture}/source.zip`, '--zip-root=D:\\SILVER\\']) {
    assert(args.includes(value), value);
  }
  assert.equal(args.filter(value => value.startsWith('--wasm=')).length, 1);
  fs.unlinkSync(path.join(fixture, 'source.zip'));
  assert.equal(runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm').status, 'BLOCKED');
  assert.equal(calls.length, 1, 'missing media must not spawn');
  candidate.cli.zipMounts.push({ file: 'other.zip', root: 'E:/OTHER/' });
  assert.equal(runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm').status, 'HARNESS');
  assert.equal(calls.length, 1, 'distinct roots must not spawn');
  candidate.cli = { vfsTrees: ['not-directory'] };
  fs.writeFileSync(path.join(fixture, 'not-directory'), 'x');
  assert.equal(runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm').status, 'BLOCKED');
  assert.equal(calls.length, 1);
  console.log('PASS actual runner launch arguments, missing media, distinct roots, directory validation');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
