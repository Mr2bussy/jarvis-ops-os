export type SwarmMode = 'solo' | 'parallel' | 'sequential';

export interface SwarmPlan {
  mode: SwarmMode;
  subagents: SubagentRole[];
  reason: string;
}

export interface SubagentRole {
  id: string;
  name: string;
  focus: string;
}

const PARALLEL_HINTS = /\b(parallel|swarm|multi-agent|all at once|simultaneously)\b/i;
const SEQUENTIAL_HINTS = /\b(then|after that|step by step|pipeline|sequential)\b/i;
const COMPLEX_HINTS = /\b(refactor|audit|full scan|migrate|benchmark|eval)\b/i;

/**
 * Ruflo-inspired lightweight router — classifies task shape for subagent orchestration.
 */
export function planSwarm(message: string): SwarmPlan {
  const text = message.trim();
  if (!text) {
    return { mode: 'solo', subagents: [], reason: 'empty message' };
  }

  if (PARALLEL_HINTS.test(text)) {
    return {
      mode: 'parallel',
      subagents: [
        { id: 'research', name: 'Researcher', focus: 'gather context and constraints' },
        { id: 'implement', name: 'Implementer', focus: 'apply minimal surgical changes' },
        { id: 'verify', name: 'Verifier', focus: 'run checks and anti-early-victory' },
      ],
      reason: 'explicit parallel intent',
    };
  }

  if (SEQUENTIAL_HINTS.test(text) || COMPLEX_HINTS.test(text)) {
    return {
      mode: 'sequential',
      subagents: [
        { id: 'plan', name: 'Planner', focus: 'decompose with verify checkpoints' },
        { id: 'execute', name: 'Executor', focus: 'implement one step at a time' },
      ],
      reason: 'multi-step or complex task keywords',
    };
  }

  return { mode: 'solo', subagents: [], reason: 'default single-agent path' };
}

export function swarmSystemPrompt(plan: SwarmPlan): string {
  if (plan.mode === 'solo') return '';
  const roles = plan.subagents.map((s) => `- ${s.name}: ${s.focus}`).join('\n');
  return [`Swarm mode: ${plan.mode}`, plan.reason, 'Subagent roles:', roles].join('\n');
}
