# RealityCheck Governance Principles (RC-WC-001)

This foundation enforces the following executable rules:

1. Default deny for analytical claims.
2. Unknown Claim ID MUST be blocked.
3. Known claims MUST declare required evidence keys.
4. A claim is allowed only when all required evidence keys are present with non-empty values.
5. If all candidate claims are blocked, return a SAFE FALLBACK.

## Evidence validity rule

A required evidence key is valid when:

- the key exists on the evidence object, and
- the value is not `null`/`undefined`, and
- if string: `trim().length > 0`, and
- if array: `length > 0`, and
- if object: `Object.keys(value).length > 0`.

Numbers and booleans are treated as defined values.

## Safe fallback meaning

SAFE FALLBACK means there is not enough supported evidence to produce an analytical conclusion.
It must not imply authenticity or safety.
