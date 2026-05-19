import { getOctokit } from "@actions/github";
import { SbomResponse } from "./types";

export async function fetchSbom(
  token: string,
  owner: string,
  repo: string,
): Promise<SbomResponse> {
  const octokit = getOctokit(token);

  try {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/dependency-graph/sbom",
      { owner, repo },
    );
    return response.data as SbomResponse;
  } catch (error: unknown) {
    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 403) {
        throw new Error(
          "Insufficient permissions \u2014 ensure GITHUB_TOKEN has `contents: read` and dependency graph is enabled",
          { cause: error },
        );
      }
      if (status === 404) {
        throw new Error(
          "Dependency graph not available \u2014 ensure it is enabled in repository settings",
          { cause: error },
        );
      }
      throw new Error(`GitHub API returned HTTP ${status}`, { cause: error });
    }
    throw error;
  }
}
