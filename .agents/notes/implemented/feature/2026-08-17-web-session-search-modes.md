# Agent Note: Web session search modes

Status: implemented

English | [中文](2026-08-17-web-session-search-modes.zh.md)

## Problem

Literal phrase search did not find an unfinished final token such as `spatiotempora` inside `spatiotemporal`, and the sidebar exposed no controls for case-sensitive, whole-word, or regular-expression queries. Sending every keystroke to the global index also made one- and two-character inputs unnecessarily expensive.

## Decision

The default SQLite query remains an inert literal phrase but adds an FTS5 prefix marker after the phrase, which expands only its final token. `matchWholeWord` removes that expansion. `matchCase` keeps the indexed candidate lookup and verifies matches against original indexed document text. `useRegularExpression` preserves internal query whitespace and scans original indexed document text with a Unicode JavaScript regular expression; `matchCase` controls case folding and `matchWholeWord` adds Unicode word boundaries. Invalid expressions fail before query execution.

The Web `session.search` request carries the three optional controls through the runtime and Host gateway. The sidebar presents them as `Aa`, `ab`, and `.*` toggles inside the expanded search field and applies the same controls to immediate title and Workspace matches. Queries shorter than three Unicode characters remain local. Longer valid queries start 350 ms after the latest input or option change, and a replacement aborts the prior request. Invalid regular expressions show a local error and never reach the Host.

## Alternatives considered

- **Filter only the first Host page in the browser** — rejected because a matching Session outside the first 20 provider hits would disappear, making the controls incomplete.
- **Use FTS5 query syntax as the regular-expression mode** — rejected because FTS5 operators are not regular expressions and would expose provider syntax instead of the advertised behavior.
- **Search on every character** — rejected because title matching already gives immediate feedback while global content scans for one- and two-character inputs have low selectivity.

## Consequences

Partial final-token queries and the three explicit matching modes work across visible live and persisted Sessions while preserving Host authorization and exact-result navigation. Default literal and case-sensitive searches retain an FTS5 candidate path. Regular expressions are more flexible but synchronously scan original indexed documents and can block longer than indexed searches; the three-character UI threshold and 350 ms debounce reduce accidental scans without changing direct service callers.

## Verification

SQLite tests pin prefix, case-sensitive, whole-word, regular-expression, and invalid-pattern behavior. Runtime and Host tests pin wire forwarding. Workspace tests pin the delay, short-query suppression, option controls, local matching, invalid-pattern handling, cancellation, and result navigation.
