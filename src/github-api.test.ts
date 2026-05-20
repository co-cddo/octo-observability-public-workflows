import { fetchSbom } from "./github-api";

const mockRequest = jest.fn();
const mockInfo = jest.fn();

jest.mock("@actions/github", () => ({
  getOctokit: () => ({
    request: mockRequest,
  }),
}));

jest.mock("@actions/core", () => ({
  info: (...args: unknown[]) => mockInfo(...args),
}));

jest.useFakeTimers();

describe("fetchSbom", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockInfo.mockReset();
  });

  function generateReportResponse(uuid = "abc-123") {
    return {
      status: 201,
      data: {
        sbom_url: `https://api.github.com/repos/owner/repo/dependency-graph/sbom/fetch-report/${uuid}`,
      },
    };
  }

  function fetchReportReady(
    sbomData: unknown = { spdxVersion: "SPDX-2.3", packages: [] },
  ) {
    return { status: 200, data: sbomData };
  }

  function fetchReportPending() {
    return { status: 201, data: { status: "processing" } };
  }

  it("returns sbom data when report is immediately ready", async () => {
    mockRequest
      .mockResolvedValueOnce(generateReportResponse())
      .mockResolvedValueOnce(fetchReportReady());

    const result = await fetchSbom("token", "owner", "repo");

    expect(result.sbom).toEqual({ spdxVersion: "SPDX-2.3", packages: [] });
    expect(mockRequest).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/dependency-graph/sbom/generate-report",
      { owner: "owner", repo: "repo" },
    );
    expect(mockRequest).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/dependency-graph/sbom/fetch-report/{uuid}",
      { owner: "owner", repo: "repo", uuid: "abc-123" },
    );
  });

  it("polls until report is ready", async () => {
    mockRequest
      .mockResolvedValueOnce(generateReportResponse())
      .mockResolvedValueOnce(fetchReportPending())
      .mockResolvedValueOnce(fetchReportPending())
      .mockResolvedValueOnce(fetchReportReady({ spdxVersion: "SPDX-2.3" }));

    const promise = fetchSbom("token", "owner", "repo");

    await jest.advanceTimersByTimeAsync(5000);
    await jest.advanceTimersByTimeAsync(5000);

    const result = await promise;

    expect(result.sbom).toEqual({ spdxVersion: "SPDX-2.3" });
    expect(mockInfo).toHaveBeenCalledWith(
      "SBOM report still generating (attempt 1/24)",
    );
    expect(mockInfo).toHaveBeenCalledWith(
      "SBOM report still generating (attempt 2/24)",
    );
    expect(mockInfo).toHaveBeenCalledTimes(2);
  });

  it("throws timeout error after max attempts", async () => {
    mockRequest.mockResolvedValueOnce(generateReportResponse());
    for (let i = 0; i < 24; i++) {
      mockRequest.mockResolvedValueOnce(fetchReportPending());
    }

    const promise = fetchSbom("token", "owner", "repo");
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow(
      "Timed out waiting for SBOM report after 24 attempts",
    );
  });

  it("throws descriptive error on 403", async () => {
    const error = new Error("Forbidden");
    (error as unknown as { status: number }).status = 403;
    mockRequest.mockRejectedValue(error);

    await expect(fetchSbom("token", "owner", "repo")).rejects.toThrow(
      "Insufficient permissions",
    );
  });

  it("throws descriptive error on 404", async () => {
    const error = new Error("Not Found");
    (error as unknown as { status: number }).status = 404;
    mockRequest.mockRejectedValue(error);

    await expect(fetchSbom("token", "owner", "repo")).rejects.toThrow(
      "Dependency graph not available",
    );
  });

  it("throws with status code on other HTTP errors", async () => {
    const error = new Error("Server Error");
    (error as unknown as { status: number }).status = 500;
    mockRequest.mockRejectedValue(error);

    await expect(fetchSbom("token", "owner", "repo")).rejects.toThrow(
      "GitHub API returned HTTP 500",
    );
  });

  it("rethrows non-HTTP errors", async () => {
    mockRequest.mockRejectedValue(new TypeError("Network failure"));

    await expect(fetchSbom("token", "owner", "repo")).rejects.toThrow(
      "Network failure",
    );
  });

  it("extracts uuid from sbom_url correctly", async () => {
    const uuid = "61dd9b81-d0a2-4550-95cf-470c5e7fe4ca";
    mockRequest
      .mockResolvedValueOnce(generateReportResponse(uuid))
      .mockResolvedValueOnce(fetchReportReady());

    await fetchSbom("token", "owner", "repo");

    expect(mockRequest).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/dependency-graph/sbom/fetch-report/{uuid}",
      { owner: "owner", repo: "repo", uuid },
    );
  });
});
