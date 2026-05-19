import { submitSbom } from "./ingestion-api";

const mockPost = jest.fn();

jest.mock("@actions/http-client", () => ({
  HttpClient: jest.fn().mockImplementation(() => ({
    post: mockPost,
  })),
}));

describe("submitSbom", () => {
  const baseUrl = "https://api.example.com";
  const serviceId = "1cf4b6eb-4c86-4774-92af-ae681024f46b";
  const apiKey = "secret-key-123";
  const sbom = { spdxVersion: "SPDX-2.3", packages: [] };

  beforeEach(() => {
    mockPost.mockReset();
  });

  it("returns success on 2xx response", async () => {
    mockPost.mockResolvedValue({
      message: { statusCode: 200 },
      readBody: async () => "OK",
    });

    const result = await submitSbom(baseUrl, serviceId, apiKey, sbom);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(mockPost).toHaveBeenCalledWith(
      `${baseUrl}/api/modules/sbom/services/${serviceId}`,
      JSON.stringify(sbom),
      {
        "X-API-Key": apiKey,
        "Content-Type": "application/spdx+json",
      },
    );
  });

  it("returns success on 201 response", async () => {
    mockPost.mockResolvedValue({
      message: { statusCode: 201 },
      readBody: async () => "",
    });

    const result = await submitSbom(baseUrl, serviceId, apiKey, sbom);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(201);
  });

  it("returns failure with sanitized body on 401", async () => {
    mockPost.mockResolvedValue({
      message: { statusCode: 401 },
      readBody: async () => `Invalid key: ${apiKey}`,
    });

    const result = await submitSbom(baseUrl, serviceId, apiKey, sbom);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.errorMessage).toBe("Invalid key: ***");
    expect(result.errorMessage).not.toContain(apiKey);
  });

  it("returns failure on 400", async () => {
    mockPost.mockResolvedValue({
      message: { statusCode: 400 },
      readBody: async () => "Malformed SBOM payload",
    });

    const result = await submitSbom(baseUrl, serviceId, apiKey, sbom);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.errorMessage).toBe("Malformed SBOM payload");
  });

  it("returns failure on 500", async () => {
    mockPost.mockResolvedValue({
      message: { statusCode: 500 },
      readBody: async () => "Internal Server Error",
    });

    const result = await submitSbom(baseUrl, serviceId, apiKey, sbom);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });

  it("handles missing statusCode gracefully", async () => {
    mockPost.mockResolvedValue({
      message: { statusCode: undefined },
      readBody: async () => "",
    });

    const result = await submitSbom(baseUrl, serviceId, apiKey, sbom);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0);
  });
});
