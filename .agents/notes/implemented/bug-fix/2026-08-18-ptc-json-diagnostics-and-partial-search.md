# Agent Note: Make PTC JSON failures actionable and preserve partial search results

Status: implemented

English | [中文](2026-08-18-ptc-json-diagnostics-and-partial-search.zh.md)

## Problem

Code-mode programs can return JavaScript values that JSON cannot preserve, such as an object property whose value is `undefined`. The worker correctly rejects those values, but the generic `program completion must be lossless JSON` message does not identify what the model must change. This makes a model-neutral PTC execution path unnecessarily dependent on a model guessing the harness rule.

Filesystem discovery has a separate all-or-nothing failure. Ripgrep can emit valid matches and then exit nonzero because one nested directory is inaccessible. Treating that run as a total failure discards useful paths from readable parts of the workspace and encourages the model to bypass the search tools. The same exit code also represents invalid patterns, missing roots, and other I/O failures, so accepting every nonzero run would hide real faults.

## Decision

The worker-thread JSON snapshot records the first invalid value as a linked JSON path plus a correction-oriented reason while it performs the existing single-read, iterative validation. PTC completion remains fail-closed: invalid values still produce `invalid-output`, but the message identifies the bounded path, the violated lossless-JSON rule, and the repair. Host-side validation of forged worker traffic stays generic because an untrusted peer must not supply diagnostic claims.

`dsh-tool-fs-search` accepts a nonzero ripgrep run only when it already has usable complete stdout, stderr is complete, and every nonempty stderr line matches a recognized Windows or POSIX access-denied diagnostic. The canonical result carries `warnings: [{ code: "SEARCH_ACCESS_DENIED", paths }]`, and model-facing rendering states that the result is partial. Empty-output denial, mixed diagnostics, truncated stderr, invalid patterns, missing roots, and other failures retain their existing `SEARCH_*` errors.

Both changes stay in the packages that own the behavior. They add no dependency, model-specific prompt, permissive JSON conversion, or provider branch.

## Alternatives considered

**Switch affected sessions to Standard mode.** Rejected because it bypasses PTC rather than improving its model-neutral execution and diagnostic contract.

**Silently stringify completion values.** Rejected because JSON serialization drops `undefined` object properties, changes sparse arrays, and normalizes non-finite numbers; accepting that output would conceal data loss.

**Teach individual model prompts to omit `undefined`.** Rejected because the rule belongs to the runtime operation that enforces it and must work for every model adapter.

**Ignore every ripgrep access error or every nonzero exit.** Rejected because an inaccessible explicit root and a mixed diagnostic do not establish a usable partial result, while syntax and I/O failures require correction.

**Add permanent default excludes for runtime-specific secret directories.** Rejected because deployments can create inaccessible subtrees under arbitrary names; traversal recovery belongs to result classification rather than a growing name list.

## Consequences

PTC retries receive enough information to repair the first invalid return field without weakening lossless JSON. Diagnostic path rendering is bounded, so an adversarially deep or long key cannot create unbounded error text; a diagnostic that does not fit the remaining output ledger still becomes `output-limit` under the existing rule.

Glob and grep retain readable results across recognized nested access denial and expose incompleteness to both structured consumers and the model. The conservative classifier can still reject a localized or previously unseen access-denied message; adding a signature requires evidence and tests. Real worker tests pin PTC diagnostics, search unit tests pin partial success and structured warnings, and existing real-ripgrep integration tests pin unchanged normal and hard-failure behavior.
