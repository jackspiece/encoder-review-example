"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}
async function waitFor(predicate, message, milliseconds = 5000) {
  const deadline = Date.now() + milliseconds;
  while (!predicate()) {
    assert(Date.now() < deadline, message);
    await delay(10);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  for (const behavior of ["idle", "busy"]) {
    test(`parent ${signal} kills the ${behavior} synthetic worker and removes partial staging`, {
      // Windows process.kill forcibly terminates the parent rather than delivering
      // a catchable POSIX signal. Do not pretend it validates this contract.
      skip: process.platform === "win32" ? "Requires POSIX signal delivery" : false,
      timeout: 15000,
    }, async t => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "encoder-signal-test-"));
      let parent, parentExit, workerPid;
      t.after(async () => {
        // Kill only processes launched by this test, including on assertion failure.
        if (parent && parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL");
        if (workerPid && alive(workerPid)) process.kill(workerPid, "SIGKILL");
        if (parent) await waitFor(() => parentExit, "test parent did not exit during cleanup");
        fs.rmSync(dir, { recursive: true, force: true });
      });
      for (const filename of ["verify.cjs", "bounded-process.cjs"]) {
        fs.copyFileSync(path.join(__dirname, "..", filename), path.join(dir, filename));
      }
      // Keep the production runner unchanged. Replace only its worker in this
      // isolated copy: no external encoder or bypass of the real source pin.
      fs.writeFileSync(path.join(dir, "review-worker.cjs"), `
        const fs = require("node:fs"), path = require("node:path");
        process.on("SIGINT", () => {});
        process.on("SIGTERM", () => {});
        fs.writeFileSync(process.argv[3], '{"incomplete":');
        fs.writeFileSync(path.join(__dirname, "worker.pid"), String(process.pid));
        ${behavior === "busy" ? "while (true) {}" : "setInterval(() => {}, 1000);"}
      `);
      const source = path.join(dir, "unused-source.js"), report = path.join(dir, "report.json");
      fs.writeFileSync(source, "throw new Error('synthetic placeholder must not run');\n");
      parent = spawn(process.execPath, [path.join(dir, "verify.cjs"), source, report],
        { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      parent.stdout.on("data", data => { stdout += data; });
      parent.stderr.on("data", data => { stderr += data; });
      parent.once("error", error => { parentExit = { error }; });
      parent.once("close", (code, childSignal) => { parentExit = { code, signal: childSignal }; });
      const pidFile = path.join(dir, "worker.pid");
      await waitFor(() => fs.existsSync(pidFile) || parentExit, "synthetic worker did not start");
      assert.equal(parentExit, undefined, `runner exited before worker startup: ${stderr}`);
      workerPid = Number(fs.readFileSync(pidFile, "utf8"));
      assert(Number.isSafeInteger(workerPid) && workerPid > 0);
      assert(alive(workerPid), "synthetic worker must be running before the signal");
      const stages = fs.readdirSync(dir).filter(name => name.startsWith(".encoder-review-"));
      assert.equal(stages.length, 1);
      assert.equal(fs.readFileSync(path.join(dir, stages[0], "report.json"), "utf8"), '{"incomplete":');

      const started = performance.now();
      assert(parent.kill(signal));
      await waitFor(() => parentExit, "signalled runner did not finish cleanup");
      assert(performance.now() - started < 5000, "cancellation must not wait for the 120-second budget");
      assert.deepEqual(parentExit, { code: signal === "SIGINT" ? 130 : 143, signal: null });
      assert.equal(alive(workerPid), false, "worker must be gone when its parent exits");
      assert.equal(fs.existsSync(report), false);
      assert.deepEqual(fs.readdirSync(dir).filter(name => name.startsWith(".encoder-review-")), []);
      assert.equal(stdout, "");
      assert.match(stderr, new RegExp(`Review interrupted by ${signal}; no report published`));
    });
  }
}
