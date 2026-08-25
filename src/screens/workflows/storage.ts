// @ts-nocheck
// localStorage persistence layer for the Workflows screen. Extracted so the
// screen and the builder tab can read and write the same keys without importing
// each other. The LS_* key names are the on-disk contract — changing one orphans
// every edit a user has already saved.
import type { Workflow } from '../../data/os-data';
import type { BuilderWF, CellEditData } from './types';

const LS_WF_KEY = 'jarvis.workflows.edits';
export function loadEdits(): Record<string, Partial<Workflow>> {
  try {
    return JSON.parse(localStorage.getItem(LS_WF_KEY) || '{}');
  } catch {
    return {};
  }
}
export function saveEdits(edits: Record<string, Partial<Workflow>>) {
  localStorage.setItem(LS_WF_KEY, JSON.stringify(edits));
}
export function mergeWorkflows(base: Workflow[]): Workflow[] {
  const edits = loadEdits();
  return base.map((w) => (edits[w.id] ? { ...w, ...edits[w.id] } : w));
}

export const LS_CELL_EDITS = 'jarvis.wf.cell_edits';
export function loadCellEdits(): Record<string, CellEditData> {
  try {
    return JSON.parse(localStorage.getItem(LS_CELL_EDITS) || '{}');
  } catch {
    return {};
  }
}

const LS_BUILDER = 'jarvis.builder.wfs';
export function loadBuilderWFs(): BuilderWF[] {
  try {
    return JSON.parse(localStorage.getItem(LS_BUILDER) || '[]');
  } catch {
    return [];
  }
}
export function saveBuilderWFs(wfs: BuilderWF[]) {
  localStorage.setItem(LS_BUILDER, JSON.stringify(wfs));
}
