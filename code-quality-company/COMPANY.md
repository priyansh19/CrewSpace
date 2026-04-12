---
name: Code Quality Squad
description: A cross-checking team of AI agents that review code and write tests across any language, ensuring tight quality before code ships
slug: code-quality-company
schema: agentcompanies/v1
version: 1.0.0
license: MIT
authors:
  - name: priyansh19
goals:
  - Catch bugs, security issues, and style problems before they reach production
  - Write comprehensive unit and integration tests for all code
  - Cross-check each other's work to ensure nothing slips through
  - Post clear, actionable GitHub PR comments
---

Code Quality Squad is a tight 4-agent team built around mutual accountability. Two reviewers cross-check each other's findings. Two test writers audit each other's test suites. The result: reviews that are thorough and test coverage that has no blind spots.

## Workflow

1. **Lead Reviewer** takes the first pass — reads the code, identifies bugs, security issues, and style problems, then posts PR comments.
2. **Peer Reviewer** independently reviews the same code AND audits the Lead's comments — catching anything missed and pushing back on false positives.
3. **Test Writer** writes unit and integration tests based on the reviewed code and the reviewers' findings.
4. **Test Auditor** reads the Test Writer's suite, finds untested paths and edge cases, and fills the gaps.

No agent ships their output alone. Every piece of work gets a second set of eyes.
