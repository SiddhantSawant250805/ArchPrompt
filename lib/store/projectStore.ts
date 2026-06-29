// ── REPO SYSTEM: Phase 1 ──────────────────────────────────────
// lib/store/projectStore.ts
// Pure TypeScript module managing projects within the WorkspaceRoot.

import { getWorkspace, saveWorkspace } from "./workspaceStore";

export interface Project {
  id: string;
  name: string;
  color: string; // Hex color string or Tailwind color name
  createdAt: string;
}

export function listProjects(): Project[] {
  const ws = getWorkspace();
  return Object.values(ws.projects) as Project[];
}

export function getProject(id: string): Project | null {
  const ws = getWorkspace();
  return (ws.projects[id] as Project) || null;
}

export function saveProject(project: Project): void {
  const ws = getWorkspace();
  ws.projects[project.id] = project;
  saveWorkspace(ws);
}

export function deleteProject(id: string): void {
  const ws = getWorkspace();
  // Delete the project
  delete ws.projects[id];
  // Cascade delete all applications belonging to this project
  for (const appId of Object.keys(ws.applications)) {
    const app = ws.applications[appId] as { projectId?: string };
    if (app && app.projectId === id) {
      delete ws.applications[appId];
    }
  }
  saveWorkspace(ws);
}
// ── END REPO SYSTEM: Phase 1 ──────────────────────────────────
