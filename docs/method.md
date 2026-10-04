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

## Checker and execution regression coverage

The 12 mutation controls are intentionally faulty encoder implementations, not an automated mutation-testing score for every line in this repository. They cover ordering, nibbles, padding, wrong values, lengths, character types, sparse arrays, invalid hex, missing output and non-Error exceptions. The generated positive controls check both hex cases for all 256 byte values.

The current harness also tests a bounded child process with synthetic nonterminating and excessive-output fixtures, rejects unpinned source files before evaluation and protects existing reports. POSIX tests send actual SIGINT and SIGTERM signals to isolated copies of the runner with idle and busy synthetic workers, then check worker termination, exit status and removal of incomplete staging files. These signal-delivery tests are skipped on Windows. A null thrown value exposed a checker error-handling gap; it now records a failing case just like an ordinary exception.

The preserved September 11 report describes the earlier harness and remains unchanged. New harness tests do not establish a fresh 65,976-case run against the external target. Follow the [reproduction guide](reproduce.md) to create a new dated result after reviewing that source.
