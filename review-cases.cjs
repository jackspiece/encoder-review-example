"use strict";

const assert = require("node:assert/strict");
const { checkEncoding } = require("./validator.cjs");

const SEED = 0x5e91b1a7;
const MAX_FAILURE_RECORDS = 10;
// Failure records keep short previews. A full record for one failing
// 65,536-byte case holds about 0.9 MB of input, expected and actual values.
const INPUT_HEAD_BYTES = 32;
const TEXT_HEAD_CHARS = 64;
const ERROR_HEAD_CHARS = 200;

// Shorten strings and arrays; other values are kept as returned. The host
// Array.prototype.slice avoids calling a slice method on the returned value.
function head(value, length) {
  if (typeof value === "string") return value.slice(0, length);
  if (Array.isArray(value)) return Array.prototype.slice.call(value, 0, length);
  return value;
}

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
      if (failures.length < MAX_FAILURE_RECORDS) {
        failures.push({
          case: cases, group, inputLength: bytes.length,
          inputHead: result.input.slice(0, INPUT_HEAD_BYTES),
          expectedHead: result.expected.slice(0, TEXT_HEAD_CHARS),
          actualHead: head(result.actual, TEXT_HEAD_CHARS),
          error: head(result.error, ERROR_HEAD_CHARS),
        });
      }
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
