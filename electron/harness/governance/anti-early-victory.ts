export interface VictoryClaim {
  claimedDone: boolean;
  verifierId: string;
}

export interface VerificationResult {
  ok: boolean;
  detail: string;
  shouldContinue: boolean;
}

/**
 * Anti-early-victory sensor (Shopify pattern): reject "done" until verifier passes.
 */
export async function verifyCompletion(
  claim: VictoryClaim,
  runVerifier: (id: string) => Promise<{ ok: boolean; detail: string }>,
): Promise<VerificationResult> {
  if (!claim.claimedDone) {
    return { ok: true, detail: 'No completion claim', shouldContinue: true };
  }

  const result = await runVerifier(claim.verifierId);
  if (result.ok) {
    return { ok: true, detail: result.detail, shouldContinue: false };
  }

  return {
    ok: false,
    detail: `Anti-early-victory: ${result.detail}`,
    shouldContinue: true,
  };
}

export function parseDoneClaim(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    /\b(task complete|done\.|finished\.|all tests pass|successfully completed)\b/.test(t) ||
    t.endsWith('done') ||
    t.endsWith('complete.')
  );
}
