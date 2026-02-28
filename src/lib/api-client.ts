/**
 * Client-side API cache layer.
 * Prevents redundant network requests by serving cached responses within the TTL window.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // ms
}

class ApiClient {
  private cache: Map<string, CacheEntry<any>> = new Map();

  async fetch<T>(url: string, ttlMs: number = 60_000): Promise<T> {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    const data = (await res.json()) as T;

    this.cache.set(url, { data, timestamp: Date.now(), ttl: ttlMs });
    return data;
  }

  invalidate(url: string): void {
    this.cache.delete(url);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const api = new ApiClient();
