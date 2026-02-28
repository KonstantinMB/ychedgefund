/**
 * AI Intelligence Brief Generation Edge Function
 *
 * Accepts POST with event data, generates a 2-3 sentence intelligence brief
 * using Groq (Llama 3.1 8B). Results are cached by events hash for 1 hour.
 * Falls back gracefully if Groq API key is not configured.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT =
  'You are a geopolitical intelligence analyst. Generate a concise 2-3 sentence ' +
  'intelligence brief from the provided events. Focus on strategic implications. ' +
  'Be factual and objective. Use intelligence community language.';

interface InputEvent {
  title: string;
  country?: string;
  type?: string;
}

interface RequestBody {
  events: InputEvent[];
  context?: string;
}

interface BriefResult {
  brief: string;
  timestamp: number;
  model: string;
  tokensUsed: number;
}

interface GroqResponse {
  choices: Array<{
    message: { content: string };
  }>;
  usage: {
    total_tokens: number;
  };
}

async function hashEvents(events: InputEvent[]): Promise<string> {
  const text = JSON.stringify(events);
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

const FALLBACK: BriefResult = {
  brief: 'Intelligence brief generation requires Groq API key configuration.',
  timestamp: Date.now(),
  model: 'none',
  tokensUsed: 0,
};

export default withCors(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GROQ_API_KEY;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const events = body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return new Response(JSON.stringify({ error: 'events array required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ ...FALLBACK, timestamp: Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hash = await hashEvents(events);
  const cacheKey = `ai:brief:${hash}`;

  const result = await withCache<BriefResult>(cacheKey, 3600, async () => {
    const userContent =
      events.map((e, i) => `${i + 1}. ${e.title}${e.country ? ` (${e.country})` : ''}${e.type ? ` [${e.type}]` : ''}`).join('\n') +
      (body.context ? `\n\nContext: ${body.context}` : '');

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
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`Groq error: ${res.status}`);

    const data: GroqResponse = await res.json();
    return {
      brief: data.choices[0]?.message?.content?.trim() ?? '',
      timestamp: Date.now(),
      model: MODEL,
      tokensUsed: data.usage?.total_tokens ?? 0,
    };
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=3600',
    },
  });
});
