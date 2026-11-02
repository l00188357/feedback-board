import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFeedback, getFeedbacks } from "../lib/api";

const exampleFeedback = {
  name: "Anna",
  category: "Suggestion",
  message: "Great website!",
};

const exampleRecord = {
  ...exampleFeedback,
  id: "abc123",
  created: "2026-11-02 17:00:00.000Z",
  updated: "2026-11-02 17:00:00.000Z",
};

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFeedbacks", () => {
  it("requests the feedbacks collection with newest records first", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [exampleRecord] }),
    } as Response);

    const result = await getFeedbacks();

    expect(result).toEqual([exampleRecord]);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/collections\/feedbacks\/records\?sort=-created&perPage=50$/
      )
    );
  });

  it("returns an empty array when no feedback exists", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);

    await expect(getFeedbacks()).resolves.toEqual([]);
  });

  it("throws when PocketBase returns an HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 } as Response);

    await expect(getFeedbacks()).rejects.toThrow(
      "Failed to load feedbacks. HTTP 403"
    );
  });

  it("throws when the network is unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network unavailable"));

    await expect(getFeedbacks()).rejects.toThrow("Network unavailable");
  });
});

describe("createFeedback", () => {
  it("sends a POST request containing the expected feedback fields", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => exampleRecord,
    } as Response);

    const result = await createFeedback(exampleFeedback);

    expect(result).toEqual(exampleRecord);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/collections\/feedbacks\/records$/);
    expect(options).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exampleFeedback),
    });
  });

  it("throws when PocketBase rejects the submission", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 } as Response);

    await expect(createFeedback(exampleFeedback)).rejects.toThrow(
      "Failed to submit feedback. HTTP 400"
    );
  });

  it("throws when the network fails during submission", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection lost"));

    await expect(createFeedback(exampleFeedback)).rejects.toThrow(
      "Connection lost"
    );
  });
});
