import { describe, expect, it, vi } from "vitest";
import { QueryController } from "../src/query.controller";
import type { QueryService } from "../src/query.service";

describe("QueryController", () => {
  it("delegates query execution to QueryService", async () => {
    const queryService = {
      query: vi.fn(async (question: string) => ({
        mode: "service",
        question
      }))
    } as Pick<QueryService, "query">;
    const controller = new QueryController(queryService as QueryService);

    await expect(controller.query({ question: "How does hybrid retrieval work?" })).resolves.toEqual({
      mode: "service",
      question: "How does hybrid retrieval work?"
    });

    expect(queryService.query).toHaveBeenCalledWith("How does hybrid retrieval work?");
  });
});
