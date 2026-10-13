"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { runCases, SEED } = require("./review-cases.cjs");

function main() {
  const [sourceFile, reportFile] = process.argv.slice(2);
  if (!sourceFile || !reportFile || process.argv.length !== 4) {
    throw new Error("Usage: node verify.cjs PATH_TO_BYTES_JS REPORT_JSON");
  }
  if (path.resolve(sourceFile) === path.resolve(reportFile)) {
    throw new Error("The report path must differ from the source path");
  }
  const source = fs.readFileSync(sourceFile);
  const sourceSha256 = crypto.createHash("sha256").update(source).digest("hex");
  const reviewedSha256 = "9e950b5346ee33393b79130abcd8622b91f3c25408cf74e2ee461cd41b5dacfa";
  if (sourceSha256 !== reviewedSha256) {
    throw new Error("Source hash does not match the reviewed Bytes 0.1.9 bundle");
  }
  const context = vm.createContext({ Math });
  vm.runInContext(source.toString("utf8"), context, { timeout: 5000 });
  const smokeTest = context.test();
  assert.equal(smokeTest, 0, "The published smoke test must complete first");
  assert.equal(typeof context.BytesToTextBase16, "function");

  const started = performance.now();
  const { cases, groups, failureCount, failures } = runCases(context.BytesToTextBase16);

  const result = {
    checkedAt: new Date().toISOString(),
    library: "Bytes", version: "0.1.9", function: "BytesToTextBase16",
    sourceSha256, runtime: process.version,
    harnessSha256: {
      validator: crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "validator.cjs"))).digest("hex"),
      runner: crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "verify.cjs"))).digest("hex"),
      worker: crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex"),
      boundedProcess: crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "bounded-process.cjs"))).digest("hex"),
      reviewCases: crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "review-cases.cjs"))).digest("hex"),
    },
    publishedSmokeTest: smokeTest,
    smokeTestLimit: "The published test returns zero without output assertions; the independent comparisons provide the evidence.",
    oracle: "Node Buffer hex encoding, compared case-insensitively with exact character count and output type",
    referenceHandling: "Reference is computed from a separate input copy before the target is called",
    inputDomain: "Arrays of integer bytes from 0 to 255, with lengths up to 65,536",
    seed: `0x${SEED.toString(16)}`, cases, groups, failureCount, failures,
    elapsedSeconds: (performance.now() - started) / 1000,
    conclusion: failureCount ? "Incorrect or exceptional results found; investigate the recorded cases" : "No incorrect result found in the tested cases",
    limits: "Not exhaustive over longer arrays, not a proof for all inputs, and not a test of other library functions",
  };
  fs.writeFileSync(reportFile, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ ...result, report: path.basename(reportFile) }));
  process.exitCode = failureCount ? 1 : 0;
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 2; }
