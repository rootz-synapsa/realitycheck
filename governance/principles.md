# RealityCheck Governance Principles — Authoritative Baseline v0.2

Status: AUTHORITATIVE FOR RC-WC-001 IMPLEMENTATION
Policy version: rc-gov-0.2
Product: RealityCheck (LINE MINI App)

## Language standard

Write for ordinary people first. Keep technical terms only where they are necessary for implementation accuracy.
Internal state names, field names, Claim IDs, and code identifiers may remain in English.

## Product posture

RealityCheck is a decision-support and digital-evidence tool.
It is not a forensic authority.

RealityCheck must:
- say only what the available evidence supports;
- keep uncertainty visible;
- preserve user authority in consequential decisions;
- avoid unsupported claims about identity, intent, guilt, authenticity, or legal truth.

## Result model

RealityCheck uses two independent axes.

### Evidence State
- VERIFIED_PROVENANCE
- SIGNAL_DETECTED
- NO_SIGNAL_IN_SCOPE
- INCONCLUSIVE
- OUT_OF_SCOPE
- ANALYSIS_FAILED

### Risk Context
- NONE
- ELEVATED
- HIGH

These axes must not be collapsed into a single “safe/unsafe” or “real/fake” result.

## Core implementation rules for RC-WC-001

### GP-001 — No Claim Beyond Evidence
A user-facing analytical claim MUST be supported by resolvable evidence.

### GP-002 — Absence of Evidence ≠ Authenticity
NO_SIGNAL_IN_SCOPE MUST NOT be rendered as proof that content is authentic, unmodified, or safe.

### GP-006 — Uncertainty Must Be Visible
When evidence is insufficient, conflicting, or outside measured scope, uncertainty MUST be visible in the primary result.

### GP-007 — Unknown Over Guessing
Insufficient or conflicting evidence MUST result in an inconclusive/unsupported outcome rather than a guessed conclusion.

### GP-012 — Evidence Must Be Traceable
Governed results MUST be traceable to the evidence and policy version used.

### GP-014 — Limitations Must Follow the Result
Material limitations MUST appear with the result, not only in Terms or a separate legal page.

### GP-015 — Fail Safely
Failure, timeout, unsupported input, or tool error MUST NOT become a positive, “no signal,” authentic, or safe result.

### GP-016 — Human Authority Preserved
RealityCheck provides evidence and safer next actions; it does not replace the user’s authority in consequential decisions.

### GP-023 — Result Is Context-Bound & Perishable
A result is bound to the specific file, time, tool/model version, and policy version used.

### GP-026 — Uncertainty Must Not Be Color-Only
Every status requires a textual label. Color alone must never carry the meaning.

### GP-027 — Language Parity
Thai and English analytical outputs pass through the same Claim Authority rules.

### GP-028 — Default Deny
A claim that is not explicitly registered or does not satisfy its rule MUST be BLOCKED.

### GP-029 — No Person Scoring
Do not create persistent reputation or risk scores tied to a person, account, phone number, or identity.

## Authority boundary

Governed analytical conclusions, risk assessments, material limitations, and decision-relevant recommendations require Claim IDs.

Ordinary UI text such as button labels, navigation labels, upload instructions, and neutral interface copy does not require a Claim ID.

## Copilot boundary

Copilot may implement these rules.
Copilot may not invent, weaken, rename, or expand governance policy without explicit human authorization.
