import { z } from 'zod';

/**
 * Validate an untrusted IPC payload against a zod schema. Throws a compact,
 * caller-safe Error on failure (handlers either return {ok:false,err} or let it
 * reject the IPC promise). Renderer input must never be trusted by shape alone —
 * this is the type-confusion / abuse guard for the main-process boundary.
 */
export function validate<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const where = first?.path?.length ? first.path.join('.') : '(root)';
    throw new Error(`IPC validation failed: ${where} — ${first?.message ?? 'invalid'}`);
  }
  return r.data;
}

const ChatMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(100_000),
});

/** `jarvis:complete` — the main LLM entry point. */
export const CompletePayload = z.object({
  messages: z.array(ChatMessage).min(1).max(50),
  system: z.string().max(20_000).optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
});

/** `jarvis:write-file` — content capped to a sane 5 MB. */
export const WriteFilePayload = z.object({
  filePath: z.string().min(1).max(4096),
  content: z.string().max(5_000_000),
});

/** `jarvis:read-file-content` — the path is the whole payload. */
export const ReadFilePath = z.string().min(1).max(4096);

/** `zeus:mt5` — bridge proxy. */
export const Mt5Payload = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  endpoint: z.string().min(1).max(256),
  method: z.enum(['GET', 'POST']).optional(),
  body: z.unknown().optional(),
});

/** `config:setKey` — stores an API key / setting (value goes to safeStorage). */
export const ConfigSetKey = z.object({
  name: z.string().min(1).max(128),
  value: z.string().max(20_000),
});

/** `composio:execute` — run a Composio tool/action for a connected account. */
export const ComposioExecute = z.object({
  slug: z.string().min(1).max(128),
  arguments: z.record(z.string(), z.unknown()).optional(),
  userId: z.string().max(128).optional(),
  connectedAccountId: z.string().max(128).optional(),
});

/** Path-only transfer — prefer filesystem paths over IPC blobs. */
export const PathOnlyPayload = z.object({
  path: z.string().min(1).max(4096),
});

/** `apps:add` — launcher entry (kind must match preload / main). */
export const AppsAddPayload = z.object({
  name: z.string().min(1).max(256),
  path: z.string().min(1).max(4096),
  kind: z.enum(['exe', 'url', 'folder', 'cmd']),
  tag: z.string().max(64).optional(),
});

const BLOB_KEYS = ['base64', 'blob', 'dataUrl', 'buffer'] as const;

/**
 * Reject blob-shaped file transfers at the IPC boundary (path-not-blob policy).
 * Callers that need file bytes must pass a filesystem path instead.
 */
export function assertNoBlobPayload(raw: unknown): void {
  if (raw == null || typeof raw !== 'object') return;
  const o = raw as Record<string, unknown>;
  for (const key of BLOB_KEYS) {
    if (key in o && o[key] != null) {
      throw new Error('path-not-blob: refuse blob/base64 file transfer — pass path only');
    }
  }
}
