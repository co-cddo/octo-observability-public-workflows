import { SbomResponse } from "./types";
export declare function fetchSbom(token: string, owner: string, repo: string): Promise<SbomResponse>;
