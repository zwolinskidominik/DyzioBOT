import { describe, expect, it } from "vitest";
import { computeInsertion } from "@/lib/textInsert";

describe("computeInsertion", () => {
  it("inserts text at a collapsed caret position", () => {
    const result = computeInsertion("Hello world", 5, 5, " there");
    expect(result.value).toBe("Hello there world");
    expect(result.caret).toBe(11);
  });

  it("replaces a selected range with the inserted text", () => {
    const result = computeInsertion("Hello world", 6, 11, "there");
    expect(result.value).toBe("Hello there");
    expect(result.caret).toBe(11);
  });

  it("appends at the end when caret is at the end", () => {
    const result = computeInsertion("Hi", 2, 2, "!");
    expect(result.value).toBe("Hi!");
    expect(result.caret).toBe(3);
  });

  it("inserts at the beginning when caret is at zero", () => {
    const result = computeInsertion("world", 0, 0, "hello ");
    expect(result.value).toBe("hello world");
    expect(result.caret).toBe(6);
  });

  it("handles inserting into an empty string", () => {
    const result = computeInsertion("", 0, 0, "{user}");
    expect(result.value).toBe("{user}");
    expect(result.caret).toBe(6);
  });
});
