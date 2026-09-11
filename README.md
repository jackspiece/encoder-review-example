# Encoder validation example

I checked one published byte-to-hex encoder against an independent implementation. This repository contains the test harness, controls and recorded result.

The target is `BytesToTextBase16` from Progsbase's **Bytes 0.1.9** JavaScript bundle. The source record includes the exact download address and SHA-256 fingerprint. The third-party source is downloaded separately.

## Result

**65,976 target cases, zero failures.** The tested outputs matched Node's `Buffer` hex encoding. The dated result is in [results/2026-09-11.json](results/2026-09-11.json).

| Input group | Cases |
| --- | ---: |
| Empty input and negative zero | 2 |
| Every single byte | 256 |
| Every two-byte combination | 65,536 |
| Full byte range, ascending and descending | 2 |
| Seeded longer arrays | 160 |
| Repeated zero or maximum byte | 20 |

The longer arrays cover ten selected lengths, up to 65,536 bytes. The generator seed is recorded so the same cases can be repeated.

## Why the checks mean something

The expected result comes from Node's `Buffer`, separately from the target's lookup-table implementation. It is calculated before the target runs, from a separate input copy.

The checker requires the character-array return type and exactly two hexadecimal characters per byte. It compares hex values without distinguishing upper and lower case.

Six tests check the checker itself. They include a known correct result, an altered value, missing padding, a wrong return type, an exception and invalid input. A control also changes its input and returns the wrong value, to check that it cannot move the reference result.

The library's own smoke test returns zero but does not assert the encoded output. The independent comparisons are the useful evidence here.

## Repeat the review

Use Node.js 24 or later. No package installation is needed.

```sh
node --test test/validator.test.cjs
curl --fail --location --output Bytes.js 'https://repo.progsbase.com/repoviewer/no.inductive.libraries/Bytes/0.1.9/?view=bundle&accept=text/plain;subtype=text/javascript;subtypeversion=5'
node verify.cjs Bytes.js review.local.json
```

The runner checks the source fingerprint before loading it. Exit code `0` means all target cases matched, `1` means at least one failed, and `2` means the review could not run as requested.

This is a bounded result for one exact source file. It does not cover every longer array, invalid target inputs, other library functions or performance guarantees. No reward claim was submitted from this check.

Harness and review by jackspiece. The MIT License covers the original code in this repository.
