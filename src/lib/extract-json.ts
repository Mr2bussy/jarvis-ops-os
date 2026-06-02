/**
 * Best-effort extraction of a single JSON object from an LLM text response.
 *
 * LLMs frequently wrap JSON in ```json fences or surround it with prose despite
 * "JSON only" instructions. This finds the first `{ ... }` span (optionally inside
 * a fenced block) and parses it. Returns null if nothing parseable is found, so
 * callers can fall back to a raw rendering instead of throwing.
 */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
