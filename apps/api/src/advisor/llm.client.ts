import { Injectable, Logger } from '@nestjs/common';
import { ADVISOR_LLM_TIMEOUT_MS, type LlmClient } from './advisor.types';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Minimální klient OpenAI-compatible API (spec §6 P1, §15.2 timeout 20 s).
 * Bez `OPENAI_API_KEY` se chová jako nedostupný — služba přejde na šablonu.
 */
@Injectable()
export class OpenAiCompatibleClient implements LlmClient {
  private readonly logger = new Logger(OpenAiCompatibleClient.name);
  readonly model: string;
  private readonly apiKey: string | null;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? null;
    this.model = process.env.LLM_MODEL ?? DEFAULT_MODEL;
    this.baseUrl = (process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async complete(prompt: string): Promise<string> {
    if (this.apiKey === null || this.apiKey === '') {
      throw new Error('LLM není nakonfigurována (chybí OPENAI_API_KEY)');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Odpovídáš pouze validním JSON podle instrukcí. Žádný markdown.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(ADVISOR_LLM_TIMEOUT_MS),
    });

    if (!response.ok) {
      this.logger.warn(`LLM odpověděla ${response.status}`);
      throw new Error(`LLM odpověděla ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: readonly { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error('LLM vrátila prázdnou odpověď');
    }

    return content;
  }
}
