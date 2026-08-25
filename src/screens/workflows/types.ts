// @ts-nocheck
// Shared types for the Workflows screen. They live in their own module — rather
// than beside the component that happens to use them most — so that no two
// component files ever have to import from each other (which would risk an
// import cycle between the screen and the builder tab).
import type { WorkflowNode } from '../../data/os-data';

export interface LiveWF {
  id: string;
  name: string;
  trigger: string;
  owner: string;
  desc: string;
  kind: 'research' | 'content' | 'planday';
}

// ── Cell Edit Data ─────────────────────────────────────────────────────────────
export interface CellEditData {
  name: string;
  status: 'live' | 'warn' | 'idle';
  lead: string;
  trigger: string;
  notes: string;
}

export interface BuilderWF {
  id: string;
  name: string;
  desc: string;
  category: string;
  source: 'n8n' | 'github' | 'jarvis' | 'custom';
  trigger: string;
  tags: string[];
  owner: string;
  nodes: WorkflowNode[];
  edges: [string, string][];
  savedAt: string;
  fromTemplate?: string;
}

export type TplDef = Omit<BuilderWF, 'savedAt'>;

export interface WBChat {
  role: 'user' | 'jarvis';
  text: string;
}
