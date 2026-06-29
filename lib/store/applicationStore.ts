// ── REPO SYSTEM: Phase 1 ──────────────────────────────────────
// lib/store/applicationStore.ts
// Pure TypeScript module managing applications (diagrams) in the WorkspaceRoot.

import { getWorkspace, saveWorkspace } from "./workspaceStore";

export interface Application {
  id: string;
  projectId: string;
  name: string;
  version: string; // e.g. "1.0.0"
  tags: string[];
  thumbnail: string; // SVG serialization or data URL representation
  blueprint: any; // Raw intermediate JSON representation
  mermaidCode: string;
  drawioXML: string;
  entryNodes: string[]; // List of boundary nodes (sources with no internal input)
  exitNodes: string[]; // List of boundary nodes (sinks with no internal output)
  createdAt: string;
  updatedAt: string;
}

export function listApplications(projectId?: string): Application[] {
  const ws = getWorkspace();
  const apps = Object.values(ws.applications) as Application[];
  if (projectId) {
    return apps.filter(app => app.projectId === projectId);
  }
  return apps;
}

export function getApplication(id: string): Application | null {
  const ws = getWorkspace();
  return (ws.applications[id] as Application) || null;
}

/** Compute boundary nodes to allow proper proxy mapping in referencing panels. */
export function computeBoundaryNodes(blueprint: any): { entryNodes: string[]; exitNodes: string[] } {
  const entryNodes: string[] = [];
  const exitNodes: string[] = [];
  if (!blueprint || !blueprint.groups) return { entryNodes, exitNodes };

  // Collect all node IDs
  const allNodeIds = new Set<string>();
  for (const group of blueprint.groups || []) {
    for (const node of group.nodes || []) {
      allNodeIds.add(node.id);
    }
  }

  // Track in-degrees and out-degrees
  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};
  for (const id of allNodeIds) {
    inDegree[id] = 0;
    outDegree[id] = 0;
  }

  for (const edge of blueprint.edges || []) {
    if (allNodeIds.has(edge.from) && allNodeIds.has(edge.to)) {
      outDegree[edge.from] = (outDegree[edge.from] || 0) + 1;
      inDegree[edge.to] = (inDegree[edge.to] || 0) + 1;
    }
  }

  // Entry: nodes with in-degree == 0 (and at least some outbound connection if not totally isolated)
  // Exit: nodes with out-degree == 0 (and at least some inbound connection if not totally isolated)
  for (const id of allNodeIds) {
    if (inDegree[id] === 0) {
      entryNodes.push(id);
    }
    if (outDegree[id] === 0) {
      exitNodes.push(id);
    }
  }

  return { entryNodes, exitNodes };
}

export function saveApplication(app: Omit<Application, "entryNodes" | "exitNodes">): Application {
  const ws = getWorkspace();
  const { entryNodes, exitNodes } = computeBoundaryNodes(app.blueprint);
  
  const fullApp: Application = {
    ...app,
    entryNodes,
    exitNodes,
  };

  ws.applications[app.id] = fullApp;
  saveWorkspace(ws);
  return fullApp;
}

export function deleteApplication(id: string): void {
  const ws = getWorkspace();
  delete ws.applications[id];
  saveWorkspace(ws);
}

export function moveToProject(id: string, targetProjectId: string): void {
  const ws = getWorkspace();
  const app = ws.applications[id] as Application | undefined;
  if (app) {
    app.projectId = targetProjectId;
    ws.applications[id] = app;
    saveWorkspace(ws);
  }
}
// ── END REPO SYSTEM: Phase 1 ──────────────────────────────────
