export interface Feedback {
  name: string;
  category: string;
  message: string;
}

const allowedCategories = [
  "Suggestion",
  "Bug",
  "Compliment",
];

export function validateFeedback(
  feedback: Feedback
): boolean {
  if (!feedback.name.trim() || feedback.name.length > 60) {
    return false;
  }

  if (!allowedCategories.includes(feedback.category)) {
    return false;
  }

  if (
    !feedback.message.trim() ||
    feedback.message.length > 500
  ) {
    return false;
  }

  return true;
}