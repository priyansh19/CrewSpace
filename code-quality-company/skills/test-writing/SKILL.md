---
name: test-writing
description: >
  Write unit and integration tests for code across any language. Detects the existing test
  framework and matches its style. Covers happy paths, edge cases, and error paths.
  Use when asked to write tests for a file, function, module, or PR.
---

# Test Writing Skill

Write tests that actually catch bugs — not tests that just hit lines.

## When to use

- You need to write tests for new or changed code
- You are auditing another agent's test suite
- You need to add tests for a specific bug or edge case

## Step 1 — Detect the test framework

```bash
# JS/TS — check package.json
cat package.json | grep -E '"jest"|"vitest"|"mocha"|"jasmine"'

# Python — check for pytest, unittest
find . -name "pytest.ini" -o -name "setup.cfg" -o -name "pyproject.toml" | head -5
grep -r "import unittest" . --include="*.py" -l | head -3

# Go
ls *_test.go 2>/dev/null

# Ruby
ls spec/ test/ 2>/dev/null
```

Use whatever framework is already in the project. If there is none, use:
- **JS/TS**: Vitest (preferred) or Jest
- **Python**: pytest
- **Go**: standard `testing` package

## Step 2 — Understand the code

Read the function/module you're testing. Identify:
- What inputs does it accept?
- What does it return or what side effects does it have?
- What can go wrong?
- What are the boundary conditions?

## Step 3 — Write the tests

### Test naming convention

Name your tests so they read like a specification:
```
describe("functionName") {
  it("returns X when given Y")
  it("throws an error when input is null")
  it("handles empty array without crashing")
}
```

### Coverage checklist for each function

- [ ] Happy path — typical valid input, expected output
- [ ] Boundary values — empty string, 0, negative numbers, max int, empty array, single element
- [ ] Null / undefined / None inputs (if the function can receive them)
- [ ] Error path — what happens when dependencies fail (mock them)
- [ ] Async behavior — if async, test that it resolves and rejects correctly
- [ ] Side effects — if it writes to DB or calls an API, verify the call was made with correct args

### Test structure (AAA pattern)

```
// Arrange — set up inputs and mocks
// Act — call the function
// Assert — verify the result
```

## Language-specific patterns

### TypeScript / Jest or Vitest

```ts
import { describe, it, expect, vi } from "vitest";
import { myFunction } from "../src/my-module";

describe("myFunction", () => {
  it("returns the processed result for valid input", () => {
    const result = myFunction({ id: 1, name: "test" });
    expect(result).toEqual({ id: 1, name: "TEST" });
  });

  it("throws when input is null", () => {
    expect(() => myFunction(null)).toThrow("Input cannot be null");
  });

  it("calls the dependency with the correct args", () => {
    const mockDep = vi.fn().mockResolvedValue("ok");
    const result = await myFunction({ id: 1 }, mockDep);
    expect(mockDep).toHaveBeenCalledWith(1);
  });
});
```

### Python / pytest

```python
import pytest
from mymodule import my_function

def test_returns_processed_result_for_valid_input():
    result = my_function({"id": 1, "name": "test"})
    assert result == {"id": 1, "name": "TEST"}

def test_raises_when_input_is_none():
    with pytest.raises(ValueError, match="Input cannot be None"):
        my_function(None)

@pytest.mark.parametrize("value,expected", [
    (0, "zero"),
    (1, "positive"),
    (-1, "negative"),
])
def test_handles_boundary_values(value, expected):
    assert my_function(value) == expected
```

## What NOT to write

- Tests that only assert the function was called (without checking behavior)
- Tests that mock so much there's nothing real being tested
- Tests that duplicate what another test already covers
- Tests that break when internal implementation changes (test behavior, not internals)
