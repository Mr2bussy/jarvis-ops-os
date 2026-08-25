/** IPC complete / completeStream payload — includes degraded offline fallback metadata. */
// @ts-nocheck

export type CompleteResult = {
  text: string;
  degraded?: boolean;
  reason?: string;
};

export function unwrapComplete(result: CompleteResult | string): CompleteResult {
  if (typeof result === 'string') return { text: result };
  return result;
}

export function completeText(result: CompleteResult | string): string {
  return unwrapComplete(result).text;
}
