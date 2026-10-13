"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { runCases } = require("../review-cases.cjs");
const recorded = require("../results/2026-09-11.json");
const correct = bytes => Buffer.from(bytes).toString("hex").toUpperCase().split("");

// SHA-256 over JSON.stringify(input) + "\n" for every encoder call, in order.
// Computed by running the case-generation lines (30-67) of verify.cjs at commit
// faacbef, the harness that produced results/2026-09-11.json, with the correct
// encoder above. A change to any generated input or to the case order fails here.
const RECORDED_INPUTS_SHA256 = "9e31a8cf14297afddef95a25abcdfeee14a4f82107f5cc2c941b7d7396aa89d9";

test("a correct encoder passes every declared case, with the recorded inputs and groups", () => {
  const inputs = crypto.createHash("sha256");
  const result = runCases(bytes => {
    inputs.update(`${JSON.stringify(bytes)}\n`);
    return correct(bytes);
  });
  assert.equal(result.cases, 65976);
  assert.equal(result.failureCount, 0);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.groups, recorded.groups);
  assert.deepEqual(Object.keys(result.groups), Object.keys(recorded.groups));
  assert.equal(inputs.digest("hex"), RECORDED_INPUTS_SHA256);
});

test("a defect that appears only in long inputs is reported compactly", () => {
  const result = runCases(bytes => {
    const out = correct(bytes);
    if (bytes.length >= 4096) out[0] = out[0] === "0" ? "1" : "0";
    return out;
  });
  assert.equal(result.failureCount, 36);
  assert.equal(result.failures.length, 10);
  const [first] = result.failures;
  // Case 65,941 is the first seeded 4,096-byte array.
  assert.equal(first.case, 65941);
  assert.equal(first.group, "seeded longer arrays");
  assert.equal(first.inputLength, 4096);
  assert.equal(first.inputHead.length, 32);
  assert.equal(first.expectedHead, Buffer.from(first.inputHead).toString("hex").toUpperCase());
  assert.equal(first.actualHead.length, 64);
  assert.notEqual(first.actualHead.join(""), first.expectedHead);
  assert(Buffer.byteLength(JSON.stringify(result)) < 64 * 1024);
});

test("failures on the largest inputs stay small when the encoder throws long messages or returns strings", () => {
  const longMessage = "x".repeat(1024 * 1024);
  let largeCalls = 0;
  const result = runCases(bytes => {
    if (bytes.length < 65536) return correct(bytes);
    largeCalls += 1;
    if (largeCalls % 2) throw new Error(longMessage);
    return correct(bytes).join("");
  });
  assert.equal(result.failureCount, 18);
  assert.equal(result.failures.length, 10);
  result.failures.forEach((failure, index) => {
    assert.equal(failure.inputLength, 65536);
    if (index % 2 === 0) {
      assert.equal(failure.error, "x".repeat(200));
      assert.equal(failure.actualHead, undefined);
    } else {
      assert.equal(failure.actualHead, failure.expectedHead);
      assert.equal(failure.error, undefined);
    }
  });
  assert(Buffer.byteLength(JSON.stringify(result)) < 64 * 1024);
});
