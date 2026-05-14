import { ActionInputs, ValidationResult } from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateInputs(inputs: ActionInputs): ValidationResult {
  const errors: string[] = [];

  if (!inputs.apiKey) {
    errors.push("api-key is required and must not be empty");
  }

  try {
    const url = new URL(inputs.baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      errors.push("base-url must use https:// or http:// scheme");
    }
  } catch {
    errors.push("base-url must be a valid URL with https:// or http:// scheme");
  }

  if (!UUID_REGEX.test(inputs.serviceId)) {
    errors.push("service-id must be a valid UUID format");
  }

  if (!inputs.githubToken) {
    errors.push("github-token is required and must not be empty");
  }

  return { valid: errors.length === 0, errors };
}
