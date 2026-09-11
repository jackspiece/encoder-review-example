"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { checkEncoding } = require("../validator.cjs");

test("accepts known valid vectors, including an empty array", () => {
  assert.equal(checkEncoding(() => "000FFF".split(""), [0, 15, 255]).valid, true);
  assert.equal(checkEncoding(() => "abcdef".split(""), [171, 205, 239]).valid, true);
  assert.equal(checkEncoding(() => [], []).valid, true);
});

test("rejects an altered result with the correct length", () => {
  assert.equal(checkEncoding(() => "00FE".split(""), [0, 255]).valid, false);
});

test("rejects missing padding and a wrong output type", () => {
  assert.equal(checkEncoding(() => "0FF".split(""), [0, 255]).valid, false);
  assert.equal(checkEncoding(() => "00FF", [0, 255]).valid, false);
  assert.equal(checkEncoding(() => ["0", "0", "F", 15], [0, 255]).valid, false);
});

test("input mutation cannot change the independent reference", () => {
  const original = [0, 255];
  const result = checkEncoding((bytes) => {
    bytes.fill(0);
    return "0000".split("");
  }, original);
  assert.equal(result.valid, false);
  assert.equal(result.expected, "00FF");
  assert.deepEqual(result.input, [0, 255]);
  assert.deepEqual(original, [0, 255]);
});

test("records an encoder exception as a failing case", () => {
  const result = checkEncoding(() => { throw new Error("intentional control"); }, [42]);
  assert.equal(result.valid, false);
  assert.equal(result.error, "intentional control");
  assert.equal(result.expected, "2A");
});

test("rejects values outside the declared input domain", () => {
  for (const value of [[-1], [256], [1.5], [NaN], ["5"], new Array(1), null]) {
    assert.throws(() => checkEncoding(() => [], value), RangeError);
  }
});
