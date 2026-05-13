import { describe, expect, it } from "vitest";
import { hexToRgb, pickTextColorForSolidBg, pickTextColorForPillBg } from "./color-contrast.js";

describe("hexToRgb", () => {
  it("parses a 6-digit hex color without #", () => {
    expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses a 6-digit hex color with #", () => {
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("expands a 3-digit hex color", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("is case-insensitive", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("handles whitespace around the value", () => {
    expect(hexToRgb("  #3366aa  ")).toEqual({ r: 51, g: 102, b: 170 });
  });

  it("returns null for invalid hex", () => {
    expect(hexToRgb("not-a-color")).toBeNull();
    expect(hexToRgb("#gg0000")).toBeNull();
    expect(hexToRgb("")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
  });

  it("returns null for 2-digit hex", () => {
    expect(hexToRgb("#ab")).toBeNull();
  });
});

describe("pickTextColorForSolidBg", () => {
  it("returns light text for a very dark background", () => {
    expect(pickTextColorForSolidBg("#000000")).toBe("#f8fafc");
  });

  it("returns dark text for a very light background", () => {
    expect(pickTextColorForSolidBg("#ffffff")).toBe("#111827");
  });

  it("returns light text for a mid-dark blue background", () => {
    expect(pickTextColorForSolidBg("#1e40af")).toBe("#f8fafc");
  });

  it("returns light text for invalid hex (fallback)", () => {
    expect(pickTextColorForSolidBg("invalid")).toBe("#f8fafc");
  });

  it("returns dark text for a yellow background", () => {
    expect(pickTextColorForSolidBg("#facc15")).toBe("#111827");
  });
});

describe("pickTextColorForPillBg", () => {
  it("returns a text color string", () => {
    const result = pickTextColorForPillBg("#3b82f6");
    expect(["#f8fafc", "#111827"]).toContain(result.trim());
  });

  it("uses custom alpha", () => {
    const full = pickTextColorForPillBg("#000000", 1.0);
    expect(full).toBe("#f8fafc");
  });

  it("returns fallback for invalid hex", () => {
    expect(pickTextColorForPillBg("not-a-color")).toBe("#f8fafc");
  });
});
