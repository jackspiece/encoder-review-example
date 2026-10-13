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
