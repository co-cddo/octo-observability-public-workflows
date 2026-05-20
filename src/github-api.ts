import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import { GenerateReportResponse, SbomResponse } from "./types";

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 24;

type Octokit = ReturnType<typeof getOctokit>;

export async function fetchSbom(
  token: string,
  owner: string,
  repo: string,
): Promise<SbomResponse> {
  const octokit = getOctokit(token);

  const sbomUrl = await requestReport(octokit, owner, repo);
  const uuid = sbomUrl.split("/").pop()!;
  const sbom = await pollForReport(octokit, owner, repo, uuid);

  return { sbom };
}

async function requestReport(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<string> {
  try {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/dependency-graph/sbom/generate-report",
      { owner, repo },
    );
    const data = response.data as GenerateReportResponse;
    return data.sbom_url;
  } catch (error: unknown) {
    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 403) {
        throw new Error(
          "Insufficient permissions — ensure GITHUB_TOKEN has `contents: read` and dependency graph is enabled",
          { cause: error },
        );
      }
      if (status === 404) {
        throw new Error(
          "Dependency graph not available — ensure it is enabled in repository settings",
          { cause: error },
        );
      }
      throw new Error(`GitHub API returned HTTP ${status}`, { cause: error });
    }
    throw error;
  }
}

async function pollForReport(
  octokit: Octokit,
  owner: string,
  repo: string,
  uuid: string,
): Promise<unknown> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/dependency-graph/sbom/fetch-report/{uuid}",
      { owner, repo, uuid },
    );

    if (response.status === 200) {
      return response.data;
    }

    core.info(
      `SBOM report still generating (attempt ${attempt}/${MAX_ATTEMPTS})`,
    );
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting for SBOM report after ${MAX_ATTEMPTS} attempts`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
