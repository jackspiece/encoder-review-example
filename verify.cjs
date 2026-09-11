"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { checkEncoding } = require("./validator.cjs");

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

  let cases = 0;
  let failureCount = 0;
  const failures = [];
  const groups = {};
  const started = performance.now();
  function check(bytes, group) {
    const result = checkEncoding(context.BytesToTextBase16, bytes);
    cases += 1;
    groups[group] = (groups[group] || 0) + 1;
    if (!result.valid) {
      failureCount += 1;
      if (failures.length < 10) failures.push({ case: cases, group, ...result });
    }
  }

  check([], "empty and negative zero");
  check([-0], "empty and negative zero");
  for (let a = 0; a < 256; a++) check([a], "all single bytes");
  for (let a = 0; a < 256; a++) {
    for (let b = 0; b < 256; b++) check([a, b], "all two-byte combinations");
  }
  check(Array.from({ length: 256 }, (_, i) => i), "ascending and descending byte ranges");
  check(Array.from({ length: 256 }, (_, i) => 255 - i), "ascending and descending byte ranges");
  let seed = 0x5e91b1a7;
  function random() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  }
  for (const length of [3, 15, 16, 17, 255, 256, 257, 1024, 4096, 65536]) {
    for (let repeat = 0; repeat < 16; repeat++) {
      check(Array.from({ length }, () => random() & 255), "seeded longer arrays");
    }
    check(Array(length).fill(0), "repeated zero or maximum byte");
    check(Array(length).fill(255), "repeated zero or maximum byte");
  }
  assert.equal(cases, 65976, "Declared case coverage must be complete");

  const result = {
    checkedAt: new Date().toISOString(),
    library: "Bytes", version: "0.1.9", function: "BytesToTextBase16",
    sourceSha256, runtime: process.version,
    harnessSha256: {
      validator: crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "validator.cjs"))).digest("hex"),
      runner: crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex"),
    },
    publishedSmokeTest: smokeTest,
    smokeTestLimit: "The published test returns zero without output assertions; the independent comparisons provide the evidence.",
    oracle: "Node Buffer hex encoding, compared case-insensitively with exact character count and output type",
    referenceHandling: "Reference is computed from a separate input copy before the target is called",
    inputDomain: "Arrays of integer bytes from 0 to 255, with lengths up to 65,536",
    seed: "0x5e91b1a7", cases, groups, failureCount, failures,
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
