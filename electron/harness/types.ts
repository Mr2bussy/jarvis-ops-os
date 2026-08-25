/** Shared harness types — Pi-pattern agent loop + Prime continual state. */

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON-schema-like parameter description for the LLM system prompt. */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  ok: boolean;
  output: string;
  error?: string;
}

export interface AgentTurnResult {
  sessionId: string;
  turn: number;
  assistantText: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  done: boolean;
  blockedByHitl?: boolean;
  hitlReason?: string;
}

export interface CompleteFn {
  (input: { messages: ChatMessage[]; system: string; maxTokens?: number }): Promise<string>;
}

export interface AgentLoopDeps {
  complete: CompleteFn;
  executeTool: (call: ToolCall, ctx: ToolContext) => Promise<ToolResult>;
  maxTurns?: number;
  onTurn?: (info: { turn: number; assistantText: string }) => void;
}

export interface ToolContext {
  sessionId: string;
  workspaceRoot: string;
  hitlArmed: boolean;
  requestApproval: (reason: string, payload: Record<string, unknown>) => Promise<boolean>;
  verify: (checkId: string) => Promise<{ ok: boolean; detail: string }>;
}

export interface ContinualHarnessState {
  version: number;
  supplementalPrompts: string[];
  memories: HarnessMemory[];
  skillDescriptions: HarnessSkillMeta[];
  subagentSpecs: SubagentSpec[];
  refineHistory: RefineRecord[];
  updatedAt: string;
}

export interface HarnessMemory {
  id: string;
  text: string;
  tags: string[];
  evidence: string;
  createdAt: string;
  useCount: number;
}

export interface HarnessSkillMeta {
  id: string;
  name: string;
  description: string;
  trigger: string;
  evidence: string;
  createdAt: string;
}

export interface SubagentSpec {
  id: string;
  name: string;
  system: string;
  tools: string[];
  evidence: string;
}

export interface RefineRecord {
  id: string;
  at: string;
  summary: string;
  delta: Partial<ContinualHarnessState>;
  snapshotId: string;
}

export interface BenchmarkCaseResult {
  id: string;
  success: boolean;
  /** Explicit outcome; skipped cases must not count as failures. */
  outcome?: 'pass' | 'fail' | 'skipped';
  turns: number;
  tokensIn: number;
  tokensOut: number;
  wallMs: number;
  surgical: number;
  safety: number;
  recovery: number;
  caseScore: number;
  notes?: string;
}

export interface BenchmarkRunResult {
  harness: string;
  harnessScore: number;
  criticScore: number;
  cases: BenchmarkCaseResult[];
  compare?: {
    piDelta?: number;
    hermesDelta?: number;
    primeDelta?: number;
  };
  manifest: Record<string, unknown>;
}

export type RiskClass = 'read' | 'write' | 'shell' | 'trading' | 'browser' | 'destructive';

export interface RiskAssessment {
  class: RiskClass;
  requiresHitl: boolean;
  reason: string;
}

export interface PendingApproval {
  id: string;
  createdAt: string;
  reason: string;
  payload: Record<string, unknown>;
  resolved: boolean;
  approved?: boolean;
}
