import * as core from "@actions/core";
import * as github from "@actions/github";
import { validateInputs } from "./validate";
import { fetchSbom } from "./github-api";
import { submitSbom } from "./ingestion-api";
import { ActionInputs } from "./types";

export async function run(): Promise<void> {
  try {
    const inputs: ActionInputs = {
      baseUrl: core.getInput("base-url", { required: true }),
      serviceId: core.getInput("service-id", { required: true }),
      apiKey: core.getInput("api-key", { required: true }),
      githubToken: core.getInput("github-token"),
    };

    core.setSecret(inputs.apiKey);

    const validation = validateInputs(inputs);
    if (!validation.valid) {
      core.setFailed(validation.errors.join("; "));
      return;
    }

    const { owner, repo } = github.context.repo;

    const { sbom } = await fetchSbom(inputs.githubToken, owner, repo);

    const result = await submitSbom(
      inputs.baseUrl,
      inputs.serviceId,
      inputs.apiKey,
      sbom,
    );

    if (!result.success) {
      core.setFailed(
        `Ingestion API returned HTTP ${result.statusCode}: ${result.errorMessage}`,
      );
      return;
    }

    core.summary
      .addRaw("SBOM submitted successfully to ingestion API.")
      .write();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Unexpected error: ${message}`);
  }
}

run();
