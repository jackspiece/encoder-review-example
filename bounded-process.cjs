"use strict";
const { spawn } = require("node:child_process");

const MAX_OUTPUT_BYTES = 1024 * 1024;
const TERMINATION_WAIT_MS = 1000;

// An asynchronous wait lets the caller cancel on SIGINT/SIGTERM. Only the
// direct worker is managed; this is not process-tree or security isolation.
function runBounded(script, args = [], { timeout = 120000, signal } = {}) {
  return new Promise(resolve => {
    const cancelled = () => Object.assign(new Error("Review worker cancelled"), { code: "ABORT_ERR" });
    if (signal?.aborted) {
      resolve({ status: null, signal: null, error: cancelled(), stdout: "", stderr: "" });
      return;
    }
    const child = spawn(process.execPath, ["--max-old-space-size=128", script, ...args], {
      stdio: ["ignore", "pipe", "pipe"], shell: false,
    });
    const stdout = [], stderr = [];
    let capturedBytes = 0, error, stopping = false, settled = false, terminationTimer;
    const timeoutTimer = setTimeout(() => stop(Object.assign(
      new Error(`Review worker exceeded its ${timeout} ms wall-time budget`), { code: "ETIMEDOUT" }
    )), timeout);

    function finish(status, childSignal) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(terminationTimer);
      signal?.removeEventListener("abort", abort);
      resolve({ status, signal: childSignal, error,
        stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
    }
    function stop(reason) {
      if (stopping || settled) return;
      stopping = true;
      error = reason;
      // Do not depend on the worker cooperating with a catchable signal.
      child.kill("SIGKILL");
      // Inherited pipes must not keep cleanup waiting after worker termination.
      child.stdout.destroy();
      child.stderr.destroy();
      terminationTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          error = Object.assign(new Error("Worker termination could not be confirmed within 1000 ms"),
            { code: "ETERMINATION", cause: error });
        }
        child.unref();
        finish(child.exitCode, child.signalCode);
      }, TERMINATION_WAIT_MS);
    }
    function capture(chunks, chunk) {
      if (stopping) return;
      const remaining = MAX_OUTPUT_BYTES - capturedBytes;
      chunks.push(chunk.subarray(0, remaining));
      capturedBytes += Math.min(chunk.length, remaining);
      if (chunk.length > remaining) {
        stop(Object.assign(new Error("Review worker exceeded its 1 MiB combined output budget"),
          { code: "ENOBUFS" }));
      }
    }
    const abort = () => stop(cancelled());
    child.stdout.on("data", chunk => capture(stdout, chunk));
    child.stderr.on("data", chunk => capture(stderr, chunk));
    child.on("error", childError => { error ||= childError; });
    child.once("close", finish);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
module.exports = { runBounded };
