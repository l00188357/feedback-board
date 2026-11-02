import type { Feedback } from "./validation";

const API_URL =
  import.meta.env.PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";

const RECORDS_URL = API_URL + "/api/collections/feedbacks/records";

export interface FeedbackRecord extends Feedback {
  id: string;
  created: string;
  updated: string;
}

interface FeedbackListResponse {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: FeedbackRecord[];
}

export async function getFeedbacks(): Promise<FeedbackRecord[]> {
  const response = await fetch(RECORDS_URL + "?sort=-created&perPage=50");

  if (!response.ok) {
    throw new Error("Failed to load feedbacks. HTTP " + response.status);
  }

  const data: FeedbackListResponse = await response.json();
  return data.items;
}

export async function createFeedback(
  feedback: Feedback
): Promise<FeedbackRecord> {
  const response = await fetch(RECORDS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(feedback),
  });

  if (!response.ok) {
    throw new Error("Failed to submit feedback. HTTP " + response.status);
  }

  return (await response.json()) as FeedbackRecord;
}