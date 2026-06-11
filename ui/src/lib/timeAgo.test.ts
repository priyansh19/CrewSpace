import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { timeAgo } from "./timeAgo.js";

const NOW = new Date("2026-04-19T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function secondsAgo(s: number) {
  return new Date(NOW - s * 1000);
}

describe("timeAgo", () => {
  it("returns 'just now' for 0 seconds ago", () => {
    expect(timeAgo(secondsAgo(0))).toBe("just now");
  });

  it("returns 'just now' for 30 seconds ago", () => {
    expect(timeAgo(secondsAgo(30))).toBe("just now");
  });

  it("returns 'just now' for 59 seconds ago", () => {
    expect(timeAgo(secondsAgo(59))).toBe("just now");
  });

  it("returns minutes for 1 minute ago", () => {
    expect(timeAgo(secondsAgo(60))).toBe("1m ago");
  });

  it("returns minutes for 45 minutes ago", () => {
    expect(timeAgo(secondsAgo(45 * 60))).toBe("45m ago");
  });

  it("returns hours for 1 hour ago", () => {
    expect(timeAgo(secondsAgo(60 * 60))).toBe("1h ago");
  });

  it("returns hours for 23 hours ago", () => {
    expect(timeAgo(secondsAgo(23 * 60 * 60))).toBe("23h ago");
  });

  it("returns days for 1 day ago", () => {
    expect(timeAgo(secondsAgo(24 * 60 * 60))).toBe("1d ago");
  });

  it("returns days for 6 days ago", () => {
    expect(timeAgo(secondsAgo(6 * 24 * 60 * 60))).toBe("6d ago");
  });

  it("returns weeks for 1 week ago", () => {
    expect(timeAgo(secondsAgo(7 * 24 * 60 * 60))).toBe("1w ago");
  });

  it("returns weeks for 3 weeks ago", () => {
    expect(timeAgo(secondsAgo(21 * 24 * 60 * 60))).toBe("3w ago");
  });

  it("returns months for 30 days ago", () => {
    expect(timeAgo(secondsAgo(30 * 24 * 60 * 60))).toBe("1mo ago");
  });

  it("returns months for 90 days ago", () => {
    expect(timeAgo(secondsAgo(90 * 24 * 60 * 60))).toBe("3mo ago");
  });

  it("accepts string ISO date", () => {
    const isoStr = new Date(NOW - 3600_000).toISOString();
    expect(timeAgo(isoStr)).toBe("1h ago");
  });
});
