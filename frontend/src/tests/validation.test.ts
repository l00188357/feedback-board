import { describe, it, expect } from "vitest";
import { validateFeedback } from "../lib/validation";

describe("Feedback validation", () => {

  it("accepts valid feedback", () => {
    expect(validateFeedback({
      name: "Anna",
      category: "Suggestion",
      message: "Great website!"
    })).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(validateFeedback({
      name: "",
      category: "Bug",
      message: "Something is broken"
    })).toBe(false);
  });

  it("rejects an empty message", () => {
    expect(validateFeedback({
      name: "James",
      category: "Bug",
      message: ""
    })).toBe(false);
  });

  it("rejects invalid categories", () => {
    expect(validateFeedback({
      name: "Sofia",
      category: "Other",
      message: "Nice work!"
    })).toBe(false);
  });

  it("rejects names longer than 60 characters", () => {
    expect(validateFeedback({
      name: "A".repeat(61),
      category: "Suggestion",
      message: "Great website!"
    })).toBe(false);
  });

  it("rejects messages longer than 500 characters", () => {
    expect(validateFeedback({
      name: "Anna",
      category: "Compliment",
      message: "A".repeat(501)
    })).toBe(false);
  });

  it("rejects whitespace-only messages", () => {
    expect(validateFeedback({
      name: "Anna",
      category: "Bug",
      message: "   "
    })).toBe(false);
  });

  it("rejects whitespace-only names", () => {
    expect(validateFeedback({
      name: "   ",
      category: "Suggestion",
      message: "Great website!"
    })).toBe(false);
  });

});