---
name: code-review
description: >
  Review code changes for bugs, security vulnerabilities, performance issues, and style problems.
  Post findings as GitHub PR comments with file/line references and concrete fix suggestions.
  Use when assigned a PR URL, diff, or file to review.
---

# Code Review Skill

Review code and post structured feedback to GitHub pull requests.

## When to use

- You are assigned a PR URL, a diff, a branch, or a file to review
- You need to audit another agent's code review comments
- You need to post a review summary on a PR

## How to review

### 1. Gather the code

If you have a PR URL:
```bash
gh pr diff <PR-URL>
gh pr view <PR-URL>
```

If you have a branch:
```bash
git diff main...<branch-name>
```

### 2. Analyze the diff

Read the full diff. For each changed file, check:

**Bugs and logic errors**
- Off-by-one errors, incorrect conditionals, wrong variable used
- Unhandled null/undefined, missing await on async calls
- Race conditions in async code
- Incorrect state mutations

**Security**
- SQL injection, command injection, path traversal
- XSS vulnerabilities in rendered output
- Hardcoded secrets or credentials
- Missing auth checks on endpoints
- Unsafe deserialization

**Performance**
- N+1 query patterns
- Unnecessary re-renders or recomputations
- Missing indexes implied by query patterns
- Blocking calls in async contexts

**Code quality**
- Overly complex functions (try to split if > ~50 lines of logic)
- Unclear naming
- Dead code, commented-out code left in
- Missing error handling on operations that can fail

### 3. Post inline comments

For each finding:
```bash
gh pr review <PR-URL> --comment --body "..."
```

Or post inline with the GitHub API. Each comment must include:
- The file path and line number
- A clear explanation of the issue
- A concrete suggestion for how to fix it

Use severity labels in comments:
- `[CRITICAL]` — must fix before merge (bug, security issue)
- `[WARNING]` — should fix (performance, missing error handling)
- `[SUGGESTION]` — nice to have (style, naming, simplification)
- `[QUESTION]` — needs clarification before you can assess

### 4. Post a summary review

```bash
gh pr review <PR-URL> --comment --body "## Code Review Summary

**Verdict:** [Approve / Request Changes / Needs Discussion]

### Critical Issues
- ...

### Warnings
- ...

### Suggestions
- ...

Overall this PR [brief assessment]."
```

## Multi-language guidance

- **TypeScript/JavaScript**: Check for missing type annotations on public APIs, unsafe `any` casts, promise handling
- **Python**: Check for mutable default arguments, bare `except:` clauses, missing type hints on public functions
- **Go**: Check for unchecked errors, goroutine leaks, improper use of defer
- **General**: Always check for missing tests for new code paths
