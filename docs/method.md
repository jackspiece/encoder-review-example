# Method and limits

[← Back to the project](../README.md)

## Independent expected values

The target is a lookup-table byte-to-hex implementation. The reference uses Node's `Buffer`.

The expected result is computed before the target runs, from a separate copy of the input. A target that mutates its input cannot move the reference result.

The checker requires a character-array result and exactly two hexadecimal characters per input byte. It compares hex values without distinguishing upper and lower case.

## Controls

The [checker tests](../test/validator.test.cjs) include known correct output, an altered value, missing padding, a wrong return type, a thrown exception and invalid input.

An additional assertion changes the target's input and returns the wrong value. The expected value and original input must remain intact.

The published library's own smoke test returns zero without asserting the encoded output. The independent output comparisons provide the evidence used in this review.

## Case coverage

The suite checks empty input and negative zero, every single byte, every two-byte combination, both directions of the full byte range, repeated extreme values and seeded longer arrays.

The longer arrays cover ten selected lengths up to 65,536 bytes. The seed is stored with the result so the same cases can be repeated.

## Interpreting the result

The recorded run found no incorrect result among 65,976 cases for the exact downloaded source.

Longer arrays are sampled, so the result does not establish correctness for every possible input. Invalid target inputs, other library functions and performance guarantees are outside this review.

No reward claim was submitted from the check.
