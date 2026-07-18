const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_CHAT_API_URL = `${GROQ_API_BASE_URL}/chat/completions`;

let configuredApiKey: string | null = null;

export interface GroqMessage {
  role: 'system' | 'user';
  content: string;
}

export function configureGroqApiKey(apiKey: string | null): void {
  configuredApiKey = apiKey?.trim() || null;
}

export function isGroqConfigured(): boolean {
  return configuredApiKey !== null;
}

export type GroqApiKeyValidation = {
  valid: boolean;
  message?: string;
};

export async function validateGroqApiKey(
  apiKey: string,
): Promise<GroqApiKeyValidation> {
  const normalizedApiKey = apiKey.trim();
  if (!normalizedApiKey) {
    return { valid: false, message: 'Paste a Groq API key before continuing.' };
  }

  try {
    const response = await fetch(`${GROQ_API_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${normalizedApiKey}` },
      signal: AbortSignal.timeout(8_000),
    });

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: 'Groq rejected this API key. Check that it was copied correctly.',
      };
    }

    if (response.status === 429) {
      return {
        valid: false,
        message: 'Groq is rate-limiting validation right now. Try again shortly.',
      };
    }

    return {
      valid: false,
      message: 'Groq could not validate this key right now. Try again.',
    };
  } catch {
    return {
      valid: false,
      message: 'Could not reach Groq. Check your connection and try again.',
    };
  }
}

interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function callGroq(
  messages: GroqMessage[],
  options: {
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {},
): Promise<string | null> {
  const apiKey = configuredApiKey;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(GROQ_CHAT_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: options.temperature ?? 0.8,
        max_tokens: options.maxTokens ?? 400,
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GroqChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    return typeof content === 'string' && content.trim().length > 0 ? content : null;
  } catch {
    return null;
  }
}
