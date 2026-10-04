"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { runBounded } = require("../bounded-process.cjs");
function fixture(t, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "encoder-control-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const script = path.join(dir, "control.cjs");
  fs.writeFileSync(script, source);
  return { dir, script };
}
test("a nonterminating synthetic target is killed within its wall-time budget", async t => {
  const { script } = fixture(t, "while (true) {}");
  const result = await runBounded(script, [], { timeout: 150 });
  assert.equal(result.error?.code, "ETIMEDOUT");
  assert.equal(result.signal, "SIGKILL");
});
test("excessive target output is bounded", async t => {
  const { script } = fixture(t, "process.stdout.write('x'.repeat(2 * 1024 * 1024));");
  assert.equal((await runBounded(script)).error?.code, "ENOBUFS");
});
test("ordinary worker exit codes and output are preserved", async t => {
  const { script } = fixture(t, "console.log('synthetic result'); process.exitCode = 1;");
  const result = await runBounded(script);
  assert.equal(result.status, 1);
  assert.equal(result.stdout.trim(), "synthetic result");
});
test("exactly 1 MiB of worker output is accepted without truncation", async t => {
  const { script } = fixture(t, "process.stdout.write('x'.repeat(1024 * 1024));");
  const result = await runBounded(script);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(Buffer.byteLength(result.stdout), 1024 * 1024);
});
test("the output budget counts stdout and stderr together", async t => {
  const { script } = fixture(t, "process.stdout.write('x'.repeat(600000)); process.stderr.write('x'.repeat(600000));");
  const result = await runBounded(script);
  assert.equal(result.error?.code, "ENOBUFS");
  assert.equal(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr), 1024 * 1024);
});
test("the output budget counts multibyte output as bytes, not characters", async t => {
  const { script } = fixture(t, "process.stdout.write('é'.repeat(600000));");
  const result = await runBounded(script);
  assert.equal(result.error?.code, "ENOBUFS");
  assert.equal(Buffer.byteLength(result.stdout), 1024 * 1024);
});
test("an already-cancelled worker request does not execute", async t => {
  const { dir, script } = fixture(t, "require('node:fs').writeFileSync(process.argv[2], 'ran');");
  const marker = path.join(dir, "executed");
  const controller = new AbortController();
  controller.abort();
  const result = await runBounded(script, [marker], { signal: controller.signal });
  assert.equal(result.error?.code, "ABORT_ERR");
  assert.equal(fs.existsSync(marker), false);
});
test("CLI refuses an unpinned source without executing it or publishing a report", t => {
  const { dir, script } = fixture(t, "throw new Error('must not execute');");
  const report = path.join(dir, "report.json");
  const result = spawnSync(process.execPath, [path.join(__dirname, "../verify.cjs"), script, report],
    { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Source hash does not match/);
  assert(!result.stderr.includes("must not execute"));
  assert.equal(fs.existsSync(report), false);
  assert.deepEqual(fs.readdirSync(dir), ["control.cjs"]);
});
test("CLI will not overwrite an existing report", t => {
  const { dir, script } = fixture(t, "");
  const report = path.join(dir, "report.json");
  fs.writeFileSync(report, "existing report");
  const result = spawnSync(process.execPath, [path.join(__dirname, "../verify.cjs"), script, report],
    { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Report already exists/);
  assert.equal(fs.readFileSync(report, "utf8"), "existing report");
});
