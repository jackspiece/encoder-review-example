"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { checkEncoding } = require("../validator.cjs");
const correct = bytes => Buffer.from(bytes).toString("hex").split("");
const controls = [
  ["dropped padding", () => "123ab".split("")],
  ["reversed byte order", bytes => correct(bytes.reverse())],
  ["swapped nibbles", bytes => correct(bytes).join("").replace(/(.)(.)/g, "$2$1").split("")],
  ["wrong valid hex digit", bytes => { const out = correct(bytes); out[0] = "f"; return out; }],
  ["appended character", bytes => [...correct(bytes), "0"]],
  ["string instead of character array", bytes => correct(bytes).join("")],
  ["numeric array entry", bytes => { const out = correct(bytes); out[0] = 0; return out; }],
  ["sparse array entry", bytes => { const out = correct(bytes); delete out[0]; return out; }],
  ["non-hex character", bytes => { const out = correct(bytes); out[0] = "g"; return out; }],
  ["undefined output", () => undefined],
  ["null exception", () => { throw null; }],
  ["string exception", () => { throw "synthetic failure"; }],
];
for (const [name, mutate] of controls) {
  test(`checker rejects mutation control: ${name}`, () => {
    const input = [1, 35, 171];
    const result = checkEncoding(mutate, input);
    assert.equal(result.valid, false);
    assert.equal(result.expected, "0123AB");
    assert.deepEqual(input, [1, 35, 171]);
  });
}
test("generated valid controls pass for every byte and both hex cases", () => {
  for (let byte = 0; byte < 256; byte++) {
    const bytes = [byte, 255 - byte, 0, 255];
    assert.equal(checkEncoding(correct, bytes).valid, true);
    assert.equal(checkEncoding(input => correct(input).map(char => char.toUpperCase()), bytes).valid, true);
  }
});
