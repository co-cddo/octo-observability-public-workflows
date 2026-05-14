import { validateInputs } from "./validate";
import { ActionInputs } from "./types";

function validInputs(): ActionInputs {
  return {
    baseUrl: "https://api.example.com",
    serviceId: "1cf4b6eb-4c86-4774-92af-ae681024f46b",
    apiKey: "test-api-key-123",
    githubToken: "ghp_testtoken123",
  };
}

describe("validateInputs", () => {
  it("returns valid for correct inputs", () => {
    const result = validateInputs(validInputs());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts http:// base URL", () => {
    const inputs = { ...validInputs(), baseUrl: "http://localhost:3000" };
    const result = validateInputs(inputs);
    expect(result.valid).toBe(true);
  });

  it("rejects empty api-key", () => {
    const inputs = { ...validInputs(), apiKey: "" };
    const result = validateInputs(inputs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "api-key is required and must not be empty",
    );
  });

  it("rejects invalid base-url", () => {
    const inputs = { ...validInputs(), baseUrl: "not-a-url" };
    const result = validateInputs(inputs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/base-url must be a valid URL/);
  });

  it("rejects base-url without scheme", () => {
    const inputs = { ...validInputs(), baseUrl: "ftp://example.com" };
    const result = validateInputs(inputs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/https:\/\/ or http:\/\//);
  });

  it("rejects invalid service-id", () => {
    const inputs = { ...validInputs(), serviceId: "not-a-uuid" };
    const result = validateInputs(inputs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("service-id must be a valid UUID format");
  });

  it("accepts uppercase UUID", () => {
    const inputs = {
      ...validInputs(),
      serviceId: "1CF4B6EB-4C86-4774-92AF-AE681024F46B",
    };
    const result = validateInputs(inputs);
    expect(result.valid).toBe(true);
  });

  it("rejects empty github-token", () => {
    const inputs = { ...validInputs(), githubToken: "" };
    const result = validateInputs(inputs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "github-token is required and must not be empty",
    );
  });

  it("collects all errors at once", () => {
    const inputs: ActionInputs = {
      baseUrl: "",
      serviceId: "bad",
      apiKey: "",
      githubToken: "",
    };
    const result = validateInputs(inputs);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});
