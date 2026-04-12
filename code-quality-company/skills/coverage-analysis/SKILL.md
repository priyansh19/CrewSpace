---
name: coverage-analysis
description: >
  Analyze code to find untested paths, functions, and edge cases. Run coverage tools
  and interpret the results to identify where tests are missing. Use before writing tests
  (to plan what to write) or after (to audit what was missed).
---

# Coverage Analysis Skill

Find what's not tested — then explain why it matters.

## When to use

- Before writing tests: to identify where to focus
- After a test suite is written: to find what was missed
- When asked to audit test coverage on a PR or module

## Step 1 — Run coverage tooling

### JS / TS (Vitest)
```bash
npx vitest run --coverage
# or
pnpm test:coverage
```

### JS / TS (Jest)
```bash
npx jest --coverage
```

### Python (pytest-cov)
```bash
pytest --cov=src --cov-report=term-missing
```

### Go
```bash
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out
```

If no coverage tool is configured, do a manual analysis (see Step 2).

## Step 2 — Manual path analysis (no tooling needed)

For each function or method in scope:

1. List all branches:
   - Every `if` / `else` arm
   - Every `switch` / `case`
   - Every `try` / `catch` / `finally`
   - Every early return
   - Every loop (does it handle empty? single item? many items?)

2. Check the test suite for each branch:
   - Is there a test that reaches this branch?
   - Does the test actually assert the outcome of this branch?

3. Flag any branch with no covering test.

## Step 3 — Prioritize gaps

Not all gaps are equal. Rank uncovered paths by risk:

| Priority | What to cover first |
|----------|-------------------|
| P1 | Error paths — uncaught exceptions that could crash the app |
| P1 | Auth/permission checks — missing test = untested security boundary |
| P2 | Business logic branches — different outcomes for different inputs |
| P2 | Edge cases flagged by code reviewers |
| P3 | Happy path variants |
| P4 | Logging, tracing, non-functional branches |

## Step 4 — Report

Produce a coverage gap report:

```
## Coverage Gap Report

### Uncovered paths (by priority)

**P1 — Error paths**
- `src/auth/login.ts:45` — catch block when DB times out (never tested)
- `src/payment/charge.ts:78` — branch when Stripe returns card_declined

**P2 — Business logic**
- `src/user/invite.ts:23` — branch when user is already a member
- `src/report/generate.ts:67` — branch when data set is empty

**P3 — Happy path variants**
- `src/search/query.ts:12` — pagination beyond page 1

### Summary
- X functions/methods analyzed
- Y branches total
- Z branches uncovered
- Estimated coverage: ~N%
```

## What "covered" means

A path is covered when:
1. A test reaches it (execution coverage)
2. The test asserts the correct outcome (assertion coverage)

A test that reaches a branch but doesn't assert anything about it does NOT count as covered.
