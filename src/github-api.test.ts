import { fetchSbom } from "./github-api";

const mockRequest = jest.fn();

jest.mock("@actions/github", () => ({
  getOctokit: () => ({
    request: mockRequest,
  }),
}));

describe("fetchSbom", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("returns sbom data on success", async () => {
    const sbomData = { sbom: { spdxVersion: "SPDX-2.3", packages: [] } };
    mockRequest.mockResolvedValue({ data: sbomData });

    const result = await fetchSbom("token", "owner", "repo");

    expect(result.sbom).toEqual(sbomData);
    expect(mockRequest).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/dependency-graph/sbom",
      { owner: "owner", repo: "repo" },
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

  it("throws with status code on other errors", async () => {
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
});
