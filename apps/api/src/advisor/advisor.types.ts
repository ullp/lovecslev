export interface AdvisorUsageResult {
  readonly allowed: boolean;
  readonly used: number;
}

/** Port pro denní rate-limit poradce (spec §6 P1: 10 dotazů/den). */
export interface AdvisorUsageRepository {
  incrementAndCheck(userId: string, day: string, limit: number): Promise<AdvisorUsageResult>;
}

export const ADVISOR_USAGE_REPOSITORY = Symbol('ADVISOR_USAGE_REPOSITORY');

/** Port pro LLM (spec §6 P1, §12). Vrací surový text odpovědi. */
export interface LlmClient {
  readonly model: string;
  complete(prompt: string): Promise<string>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');

export const ADVISOR_DAILY_LIMIT = 10;
export const ADVISOR_LLM_TIMEOUT_MS = 20_000;
