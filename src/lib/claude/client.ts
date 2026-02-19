import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  client = new OpenAI({ apiKey });
  return client;
}
