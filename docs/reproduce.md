# Repeat the review

[← Back to the project](../README.md)

Use **Node.js 24 or later**. No npm package installation is required.

## 1. Check the checker

From the repository root:

```sh
node --test test/validator.test.cjs
```

These six tests validate the checker. They do not run the complete third-party encoder review.

## 2. Download the pinned source

```sh
curl --fail --location --output Bytes.js \
  'https://repo.progsbase.com/repoviewer/no.inductive.libraries/Bytes/0.1.9/?view=bundle&accept=text/plain;subtype=text/javascript;subtypeversion=5'
```

The expected address and SHA-256 fingerprint are recorded in [source-record.json](../source-record.json). The bundle is downloaded separately from this repository.

## 3. Run the target cases

```sh
node verify.cjs Bytes.js review.local.json
```

The runner checks the source fingerprint before loading the file. It then compares 65,976 deterministic cases with Node's `Buffer` and writes a JSON result.

| Exit code | Meaning |
| ---: | --- |
| `0` | All target cases matched. |
| `1` | At least one target case failed. |
| `2` | The review could not run as requested. |

The [September 11 result](../results/2026-09-11.json) records the runtime, seed, fingerprints, case groups and limitations. See [the method](method.md) before interpreting the result.
