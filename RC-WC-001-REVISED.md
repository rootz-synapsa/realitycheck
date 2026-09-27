# RC-WC-001 — Governance Foundation (REVISED)

Status: AUTHORIZED FOR IMPLEMENTATION
Policy source: RealityCheck Governance Program Plan v0.2 Revised + authoritative files in `/governance`

## Role boundary

Copilot is the implementation agent.

Copilot MUST NOT:
- author new governance policy;
- rename or replace approved Claim IDs;
- invent new user-facing analytical claims;
- weaken default deny;
- substitute free-form fallback prose for the governed safe-fallback Claim IDs;
- create a second hand-maintained policy registry that can drift from `claims.yaml`.

## Objective

Implement the smallest executable Claim Gate and Safe Fallback foundation using the authoritative files provided in `/governance`.

## Source of truth

The files supplied in `/governance` are policy inputs, not drafts for Copilot to rewrite.

Copilot may make only mechanical corrections required for valid YAML/JSON syntax.
Any substantive policy change must be reported as a blocker for human review.

## Required behaviors

1. Unknown Claim ID -> BLOCK.
2. `PERMANENTLY_BLOCKED` Claim ID -> BLOCK.
3. Registered claim with unresolved required evidence/state -> BLOCK.
4. Registered claim with satisfied preconditions -> ALLOW.
5. Missing mandatory companion -> HOLD the result set and invoke safe fallback.
6. If every candidate analytical claim is blocked/unresolvable -> SAFE_FALLBACK.
7. SAFE_FALLBACK MUST use the Claim IDs declared in `composition.yaml`; do not invent fallback prose.
8. Analysis failure MUST NOT become `NO_SIGNAL_IN_SCOPE`, authentic, or safe.
9. Every gate decision must expose enough structured data for later audit: `claim_id`, `decision`, `reason`, `policy_version`.

## Implementation constraints

- Do not redesign the current UI.
- Do not add detectors or external APIs.
- Do not add third-party egress.
- Do not implement statistical threshold policy in this contract.
- Do not add identity, attribution, intent, reputation, or person scoring.
- Prefer one policy source of truth. Do not maintain `claims.yaml` and a separate manually-authored JS registry with different policy content.
- If a YAML loader or build step is needed, keep it minimal and document it.

## Deterministic tests

At minimum:
- unknown claim -> BLOCK
- permanently blocked claim -> BLOCK
- missing required evidence -> BLOCK
- valid registered claim -> ALLOW
- missing mandatory companion -> HOLD -> SAFE_FALLBACK
- all candidates blocked -> SAFE_FALLBACK
- analysis failure cannot become NO_SIGNAL or safe/authentic
- audit fields include policy_version

## Completion evidence

PR description must include:
1. requirements implemented
2. files changed
3. exact tests run
4. exact test results
5. known limitations
6. reproduction commands
7. any policy ambiguity encountered

Implementation completion is not governance PASS.
Human review is required before merge.
