"use strict";

const assert = require("node:assert/strict");
const { checkEncoding } = require("./validator.cjs");

const SEED = 0x5e91b1a7;

// Run every declared case through the independent checker and count the cases
// by group. Generation is deterministic, so a case number always names the
// same input.
function runCases(encode) {
  let cases = 0;
  let failureCount = 0;
  const failures = [];
  const groups = {};
  function check(bytes, group) {
    const result = checkEncoding(encode, bytes);
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
  let seed = SEED;
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
  return { cases, groups, failureCount, failures };
}

module.exports = { runCases, SEED };
