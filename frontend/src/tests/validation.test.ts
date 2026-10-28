import { describe, it, expect } from "vitest";
import { validateFeedback } from "../lib/validation";

describe("Feedback Validation", () => {
  it("accepts valid feedback", () => {
    const result = validateFeedback({
      name: "Anna",
      category: "Suggestion",
      message: "Great website!",
    });

    expect(result).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = validateFeedback({
      name: "",
      category: "Bug",
      message: "Something is broken",
    });

    expect(result).toBe(false);
  });

  it("rejects an empty message", () => {
    const result = validateFeedback({
      name: "James",
      category: "Bug",
      message: "",
    });

    expect(result).toBe(false);
  });

  it("rejects an invalid category", () => {
    const result = validateFeedback({
      name: "Sofia",
      category: "Other",
      message: "Nice work!",
    });

    expect(result).toBe(false);
  });

  it("rejects messages longer than 500 characters", () => {
    const result = validateFeedback({
      name: "Anna",
      category: "Compliment",
      message: "A".repeat(501),
    });

    expect(result).toBe(false);
  });
});