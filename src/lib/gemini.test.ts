// @vitest-environment node
import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { withRetry } from "./gemini";

const apiError = (status: number) =>
  new ApiError({ message: `{"error":{"code":${status}}}`, status });

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withRetry", () => {
  it("retries temporary Gemini errors and returns the eventual result", async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(apiError(500))
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValue("ok");

    await expect(withRetry(task, { delays: [0, 0] })).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("gives up after the last retry", async () => {
    const task = vi.fn().mockRejectedValue(apiError(500));

    await expect(withRetry(task, { delays: [0, 0] })).rejects.toMatchObject({ status: 500 });
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("does not retry errors that will not fix themselves", async () => {
    const task = vi.fn().mockRejectedValue(apiError(400));
    await expect(withRetry(task, { delays: [0, 0] })).rejects.toMatchObject({ status: 400 });

    const invalid = vi.fn().mockRejectedValue(new Error("Gemini did not return an image"));
    await expect(withRetry(invalid, { delays: [0, 0] })).rejects.toThrow("did not return");

    expect(task).toHaveBeenCalledTimes(1);
    expect(invalid).toHaveBeenCalledTimes(1);
  });

  it("stops retrying once the request has been aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn().mockRejectedValue(apiError(503));

    await expect(withRetry(task, { delays: [0, 0], signal: controller.signal })).rejects.toBeTruthy();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
