/**
 * News Sentiment Scoring Edge Function
 *
 * Scores text on a -10 (extreme conflict) to +10 (extreme stability) scale.
 * Uses Groq LLM when available, falls back to keyword matching.
 * Accepts POST with { texts: string[] }.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT =
  'Score each text\'s geopolitical sentiment from -10 (extreme conflict/crisis) to +10 ' +
  '(extreme stability/peace). Return only a JSON array of numbers, one per input text.';

const NEGATIVE_WORDS = [
  'war', 'conflict', 'attack', 'killed', 'explosion', 'crisis', 'sanctions',
  'threat', 'missile', 'bomb', 'casualt', 'dead', 'strike', 'invasion',
  'massacre', 'violence', 'coup', 'assassination', 'terrorist', 'siege',
];
const POSITIVE_WORDS = [
  'peace', 'agreement', 'ceasefire', 'diplomatic', 'cooperation', 'deal',
  'treaty', 'stability', 'accord', 'reconciliation', 'dialogue', 'summit',
  'humanitarian', 'aid', 'relief', 'reconstruction',
];

function keywordScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) score -= 2;
  }
  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) score += 2;
  }

  return Math.max(-10, Math.min(10, score));
}

async function hashTexts(texts: string[]): Promise<string> {
  const combined = texts.join('\x00');
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

interface SentimentResult {
  scores: number[];
  timestamp: number;
}

export default withCors(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { texts: string[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const texts = body?.texts;
  if (!Array.isArray(texts) || texts.length === 0) {
    return new Response(JSON.stringify({ error: 'texts array required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  const hash = await hashTexts(texts);
  const cacheKey = `ai:sentiment:${hash}`;

  const result = await withCache<SentimentResult>(cacheKey, 1800, async () => {
    if (!apiKey) {
      return {
        scores: texts.map(keywordScore),
        timestamp: Date.now(),
      };
    }

    try {
      const userContent = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          max_tokens: 256,
          temperature: 0.1,
        }),
      });

      if (!res.ok) throw new Error(`Groq error: ${res.status}`);

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim() ?? '[]';

      // Extract JSON array from response (may have surrounding text)
      const match = content.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array in Groq response');

      const scores: number[] = JSON.parse(match[0]);
      const clamped = scores.map(s => Math.max(-10, Math.min(10, Number(s) || 0)));

      // Pad with keyword scores if Groq returned fewer items
      while (clamped.length < texts.length) {
        const t = texts[clamped.length] ?? '';
        clamped.push(keywordScore(t));
      }

      return { scores: clamped.slice(0, texts.length), timestamp: Date.now() };
    } catch {
      // Fallback to keyword scoring on Groq failure
      return {
        scores: texts.map(keywordScore),
        timestamp: Date.now(),
      };
    }
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=1800',
    },
  });
});
