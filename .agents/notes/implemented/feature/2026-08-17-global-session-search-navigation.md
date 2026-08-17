# Agent Note: Global session search navigates to the matching message

Status: implemented

English | [中文](2026-08-17-global-session-search-navigation.zh.md)

## Problem

Web session search could find message content across visible live and persisted Sessions, but selecting a result opened only the Session's initial history window. The result did not identify the matching message, so a user still had to scan the transcript and manually load older pages. Exact navigation also crosses package ownership: the workspace sidebar owns search results, while the conversation package owns history paging, DOM rows, scrolling, and highlight state.

## Decision

`session.search` returns the strongest visible matching message's non-negative `eventSeq` beside the Session id and snippet. The host derives that sequence from the already authorized search hit and the wire schema validates it, so the client receives a stable event address without receiving raw event payloads or widening Session visibility.

The workspace result keeps `eventSeq` only for content matches. Selecting such a result opens the Session and publishes a transient `ctx.conversation` focus request containing a monotonically increasing request id, Session id, and event sequence; title- and Workspace-only matches have no event address and retain ordinary Session navigation. Ordinary navigation clears a pending focus request so stale search intent cannot affect a later selection.

The matching Session's chat view consumes the request. If the addressed node is outside the loaded window, it requests one older page per settled snapshot until the node appears or history is exhausted. Once rendered, the view scrolls the row to the center, honors reduced-motion preference, applies a 2.4-second highlight, and consumes the request. Unmounting the addressed Session also consumes it, and request-id comparison prevents a stale cleanup from erasing a newer request.

## Alternatives considered

- **Search the rendered DOM after opening a Session** — rejected because only the current history window exists in the DOM, snippets need not equal rendered text byte-for-byte, and repeated text cannot identify one stable row.
- **Load the complete transcript before navigating** — rejected because it makes one search click pay unbounded history and rendering cost. Existing page loading already provides a bounded route to the addressed sequence.
- **Put paging and scrolling in the workspace package** — rejected because that package does not own the conversation projection or DOM. A transient conversation service request preserves the package boundary.
- **Persist the requested event in Session state or the URL** — rejected because this interaction is one-shot UI intent, not durable conversation state or a shareable route contract.

## Consequences

- A content-search result now opens the matching Session and reveals the exact message even when it lies outside the initial history window; the row is centered and briefly highlighted.
- Search remains bounded to the same visible Sessions and message surfaces. The new address is metadata from an already authorized hit, not a new read path.
- Navigation may require several sequential history requests for old matches. Leaving the Session cancels the intent, while exhausting history without finding the sequence clears it without trapping the view in a retry loop.
- Metadata-only matches still open at the normal Session position because they do not correspond to a message event.

## Verification

Host schema and gateway tests pin `eventSeq` propagation and validation. Workspace tests pin merge behavior and forwarding only content-result addresses. Conversation tests pin older-page loading, centered scrolling, highlight lifetime, request consumption, and stale-request isolation.
