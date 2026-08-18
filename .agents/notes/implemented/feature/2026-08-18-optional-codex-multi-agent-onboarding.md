# Agent Note: Optional Codex multi-agent onboarding

Status: implemented

English | [中文](2026-08-18-optional-codex-multi-agent-onboarding.zh.md)

## Problem

The Web profile needs an opt-in way to expose fixed FastAI worker and reviewer routes, native Codex delegation, and cross-session subagent accounting without replacing DSH session ownership, parent wakeup, the shipped `code` preset, or the profile's existing bundle stack. An observability failure must not prevent DSH from starting or settling subagents.

## Decision

[`dsh-codex-enhancements`](../../../../dsh-codex-enhancements/CHECKLIST.md) is a removable patch-layer bundle for the `web` profile. It mounts the existing `@deepseek-ai/dsh-subagent-codex` provider described by the [native backend decision](2026-08-04-claude-code-and-codex-subagent-backends.md); it adds no wake bridge, polling loop, Codex state machine, or second `CODEX_HOME`.

The bundle registers `fastai-worker` and `fastai-reviewer` as wrappers around the native `spawn` provider. Both wrappers replace caller-selected provider and model values with `fastai` and `gpt-5.6-sol` before delegating, while preserving other child options. The separate `code-multi-agent` user preset exposes those wrappers and the native one-shot `codex` provider. Installation copies the shipped `code` composition into an owned user-preset directory and appends the additional tools; it never edits the shipped preset or the default preset setting.

The Subagent Ledger listens to DSH session and subagent lifecycle events and writes a rebuildable JSON projection. It records parent and child identity, role, provider route, model, terminal outcome, usage, cache traffic, retries, and retry waste. Projection load, event folding, service publication, logging, and writes are individually contained; failures update Ledger health and do not reject DSH lifecycle operations. Session disposal retains facts until a paired active subagent end arrives, which preserves usage for continuable children whose Session is released before the terminal subagent event.

The install script adds the bundle and the repository's native Codex provider as profile-managed dependencies, then materializes the owned preset. The uninstall script removes both dependencies and only a preset carrying the bundle's ownership marker. A failed preset installation rolls back the profile dependencies.

## Alternatives considered

- **Move Codex orchestration into DSH**: rejected because DSH already owns durable Sessions, continuation delivery, parent wakeup, retry policy, tools, and permissions. The native provider remains a worker backend.
- **Replace the shipped `code` preset**: rejected because the multi-agent tools are optional deployment policy and must not change ordinary DSH behavior.
- **Persist a second execution truth source**: rejected because the Ledger is derived observability data. DSH session logs and lifecycle events remain authoritative.
- **Make Ledger failures fatal**: rejected because accounting cannot block agent startup, settlement, or profile boot.

## Consequences

The Web profile can opt into fixed Sol worker and reviewer routes and native Codex delegation without changing its default agent preset. Uninstall removes every profile-owned runtime addition and the owned preset while leaving unrelated bundles and user presets intact. The role wrappers intentionally use foreground one-shot tools because continuable provider preparation does not receive role model options; DSH's ordinary continuable `subagent` tool remains the parent-wakeup path. Worktree isolation, Codex continuation, and a risk-based reviewer policy remain outside this bundle.

The local onboarding scripts require the bundle checkout and the matching DSH repository checkout because the unpublished native Codex package is installed with a profile-local link. A published bundle can replace that link with a registry dependency after the provider package is available at the matching DSH version.

## Verification

Node tests pin fixed route replacement, invalid policy rejection, owned-preset installation and refusal behavior, Ledger aggregation across disposal ordering, and isolated write failures. The DSH Codex provider spec pins its app-server protocol and lifecycle behavior. A focused continuation test pins settlement delivery waking an idle parent. Temporary-profile tests pin bundle composition, real Web startup, preset materialization, uninstall cleanup, and ordinary Web startup after removal.
