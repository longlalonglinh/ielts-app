import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-4-hydrogen';

/**
 * Validates whether a server-side Gemini API key format is acceptable.
 * Rejects empty values, placeholder strings, and unsupported OAuth-style tokens.
 */
export function isValidGeminiApiKey(key: string | undefined | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 20) return false;
  if (trimmed.startsWith('AQ.')) return false;
  if (trimmed.includes('MY_GEMINI_API_KEY')) return false;
  return true;
}

/**
 * Returns a configured server-side @google/genai client or null if GEMINI_API_KEY is unset.
 */
export function getServerGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isValidGeminiApiKey(apiKey)) {
    return null;
  }

  return new GoogleGenAI({
    apiKey: apiKey!.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}
