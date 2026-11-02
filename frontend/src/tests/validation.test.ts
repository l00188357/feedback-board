import { describe, expect, it } from "vitest";
import { validateFeedback } from "../lib/validation";

const validFeedback = {
  name: "Anna",
  category: "Suggestion",
  message: "Great website!",
};

describe("Feedback validation", () => {
  it("accepts valid feedback", () => {
    expect(validateFeedback(validFeedback)).toBe(true);
  });

  it.each(["Suggestion", "Bug", "Compliment"])(
    "accepts the category %s",
    (category) => {
      expect(validateFeedback({ ...validFeedback, category })).toBe(true);
    }
  );

  it("rejects an empty name", () => {
    expect(validateFeedback({ ...validFeedback, name: "" })).toBe(false);
  });

  it("rejects an empty message", () => {
    expect(validateFeedback({ ...validFeedback, message: "" })).toBe(false);
  });

  it("rejects an empty category", () => {
    expect(validateFeedback({ ...validFeedback, category: "" })).toBe(false);
  });

  it("rejects an invalid category", () => {
    expect(validateFeedback({ ...validFeedback, category: "Other" })).toBe(false);
  });

  it("accepts names with exactly 60 characters", () => {
    expect(validateFeedback({ ...validFeedback, name: "A".repeat(60) })).toBe(true);
  });

  it("rejects names with 61 characters", () => {
    expect(validateFeedback({ ...validFeedback, name: "A".repeat(61) })).toBe(false);
  });

  it("accepts messages with exactly 500 characters", () => {
    expect(validateFeedback({ ...validFeedback, message: "A".repeat(500) })).toBe(true);
  });

  it("rejects messages with 501 characters", () => {
    expect(validateFeedback({ ...validFeedback, message: "A".repeat(501) })).toBe(false);
  });

  it("rejects whitespace-only names", () => {
    expect(validateFeedback({ ...validFeedback, name: "   " })).toBe(false);
  });

  it("rejects whitespace-only messages", () => {
    expect(validateFeedback({ ...validFeedback, message: "   " })).toBe(false);
  });

  it("accepts surrounding whitespace around a valid name and message", () => {
    expect(
      validateFeedback({
        ...validFeedback,
        name: "  Anna  ",
        message: "  Nice site  ",
      })
    ).toBe(true);
  });
});