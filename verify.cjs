"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { runBounded } = require("./bounded-process.cjs");

const cancellation = new AbortController();
let interruptedBy;
function interrupt(signal) {
  interruptedBy ||= signal;
  cancellation.abort();
}
const onInterrupt = () => interrupt("SIGINT");
const onTerminate = () => interrupt("SIGTERM");
// Install before creating staging files or starting the worker.
process.on("SIGINT", onInterrupt);
process.on("SIGTERM", onTerminate);

async function main() {
  const [sourceFile, reportFile] = process.argv.slice(2);
  if (!sourceFile || !reportFile || process.argv.length !== 4) {
    throw new Error("Usage: node verify.cjs PATH_TO_BYTES_JS NEW_REPORT_JSON");
  }
  if (path.resolve(sourceFile) === path.resolve(reportFile)) {
    throw new Error("The report path must differ from the source path");
  }
  if (fs.existsSync(reportFile)) throw new Error("Report already exists; choose a new report path");
  // Stage beside the requested report for exclusive publication on the same filesystem.
  const stage = fs.mkdtempSync(path.join(path.dirname(path.resolve(reportFile)), ".encoder-review-"));
  try {
    const stagedReport = path.join(stage, "report.json");
    const result = await runBounded(path.join(__dirname, "review-worker.cjs"),
      [path.resolve(sourceFile), stagedReport], { signal: cancellation.signal });
    if (result.error) throw result.error;
    if (result.signal) throw new Error(`Review worker stopped by ${result.signal}; no report published`);
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(result.stderr.trim() || `Review worker exited with status ${result.status}`);
    }
    const report = JSON.parse(fs.readFileSync(stagedReport, "utf8"));
    report.executionBounds = { wallTimeSeconds: 120, v8OldSpaceMiB: 128, outputBufferBytes: 1048576,
      terminationWaitSeconds: 1,
      note: "Operational limits only; a subprocess and node:vm are not a security sandbox" };
    fs.writeFileSync(stagedReport, JSON.stringify(report, null, 2) + "\n");
    fs.linkSync(stagedReport, path.resolve(reportFile));
    console.log(JSON.stringify({ ...report, report: path.basename(reportFile) }));
    process.exitCode = result.status;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error(interruptedBy ? `Review interrupted by ${interruptedBy}; no report published (${error.message})` : error.message);
  process.exitCode = interruptedBy ? (interruptedBy === "SIGINT" ? 130 : 143) : 2;
}).finally(() => {
  process.removeListener("SIGINT", onInterrupt);
  process.removeListener("SIGTERM", onTerminate);
});
