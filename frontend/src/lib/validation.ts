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

export function validateFeedback(feedback: Feedback): boolean {
  const name = feedback.name.trim();
  const message = feedback.message.trim();

  // Validate name
  if (name.length === 0 || name.length > 60) {
    return false;
  }

  // Validate category
  if (!allowedCategories.includes(feedback.category)) {
    return false;
  }

  // Validate message
  if (message.length === 0 || message.length > 500) {
    return false;
  }

  return true;
}