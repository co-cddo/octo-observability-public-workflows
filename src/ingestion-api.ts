import { HttpClient } from "@actions/http-client";
import { SubmissionResult } from "./types";

export async function submitSbom(
  baseUrl: string,
  serviceId: string,
  apiKey: string,
  sbom: unknown,
): Promise<SubmissionResult> {
  const url = `${baseUrl}/api/modules/sbom/services/${serviceId}`;
  const client = new HttpClient("submit-sbom-action", undefined, {
    socketTimeout: 30000,
  });

  const response = await client.post(url, JSON.stringify(sbom), {
    "X-API-Key": apiKey,
    "Content-Type": "application/spdx+json",
  });

  const statusCode = response.message.statusCode ?? 0;

  if (statusCode >= 200 && statusCode < 300) {
    return { success: true, statusCode };
  }

  const body = await response.readBody();
  const sanitizedBody = body.replaceAll(apiKey, "***");

  return {
    success: false,
    statusCode,
    errorMessage: sanitizedBody,
  };
}
