"use strict";

// Compare a returned character array with a separate, trusted implementation.
// The reference is computed before calling the encoder, from a separate copy.
function checkEncoding(encode, bytes) {
  if (!Array.isArray(bytes)) {
    throw new RangeError("Input must be an array of integer bytes from 0 to 255");
  }
  for (let index = 0; index < bytes.length; index++) {
    const value = bytes[index];
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new RangeError("Input must be an array of integer bytes from 0 to 255");
    }
  }
  const input = bytes.slice();
  const expected = Buffer.from(input).toString("hex").toUpperCase();
  try {
    const actual = encode(input.slice());
    const valid = Array.isArray(actual) && actual.length === input.length * 2 &&
      actual.every((char) => typeof char === "string" && /^[0-9a-f]$/i.test(char)) &&
      actual.join("").toUpperCase() === expected;
    return { valid, input, expected, actual };
  } catch (error) {
    return { valid: false, input, expected, error: String(error.message || error) };
  }
}

module.exports = { checkEncoding };
