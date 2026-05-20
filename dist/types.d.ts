export interface ActionInputs {
    baseUrl: string;
    serviceId: string;
    apiKey: string;
    githubToken: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export interface SbomResponse {
    sbom: unknown;
}
export interface GenerateReportResponse {
    sbom_url: string;
}
export interface SubmissionResult {
    success: boolean;
    statusCode: number;
    errorMessage?: string;
}
