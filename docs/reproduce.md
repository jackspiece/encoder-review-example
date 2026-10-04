# Repeat the review

[← Back to the project](../README.md)

Use **Node.js 24 or later**. No npm package installation is required.

## 1. Check the checker

From the repository root:

```sh
node --test test/*.test.cjs
```

These tests validate the checker, mutation controls and bounded worker using locally authored fixtures. They do not run the complete third-party encoder review.

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

The runner checks the source fingerprint before loading the file. It then compares 65,976 deterministic cases with Node's `Buffer` and writes a JSON result to a **new** report path. Existing reports are never overwritten.

`verify.cjs` runs `review-worker.cjs` in a subprocess with a 120-second wall-time limit, a 128 MiB V8 old-space limit and a 1 MiB combined stdout/stderr capture limit, counted in bytes. The recorded baseline took about 28 seconds, so this leaves headroom while still bounding a stuck call. These cover loading, the published smoke test and all target calls, not just initial evaluation. A timeout or worker error publishes no partial report. The V8 heap limit is not a total process-memory cap. On unusually slow hardware, a timeout is an incomplete review, not evidence of an encoder defect.

On POSIX systems, SIGINT (including Ctrl-C) or SIGTERM received by the parent while it waits for the worker cancels the review. The parent force-stops its direct worker with SIGKILL, waits up to one additional second for termination, removes the staging directory and exits with code 130 or 143. Timeout and output-limit failures use the same bounded termination path. If the operating system does not confirm termination within that wait, the command reports that failure; it cannot guarantee an unresponsive process is gone. A cancelled review publishes no partial report, and a report already atomically published before interruption remains a complete report.

Cleanup cannot run after uncatchable parent SIGKILL, a crash of the parent or machine shutdown. Windows programmatic process termination does not deliver catchable POSIX signals, so that cancellation behavior is not guaranteed there. These limits manage the direct worker only; they do not terminate arbitrary descendants or contain hostile code. Use an isolated environment when stronger process-tree or crash cleanup is required.

Review and trust the downloaded code before running it. Node's `vm` module and a subprocess are **not security sandboxes**. Use an isolated environment with no secrets for third-party code; the SHA-256 pin proves which bytes were tested, not that those bytes are safe. Run through `verify.cjs` to apply the operational limits; `review-worker.cjs` is an internal entry point.

| Exit code | Meaning |
| ---: | --- |
| `0` | All target cases matched. |
| `1` | At least one target case failed. |
| `2` | The review could not run as requested. |
| `130` | Parent interrupted by SIGINT on POSIX. |
| `143` | Parent terminated by SIGTERM on POSIX. |

The [September 11 result](../results/2026-09-11.json) records the runtime, seed, fingerprints, case groups and limitations. See [the method](method.md) before interpreting the result.
