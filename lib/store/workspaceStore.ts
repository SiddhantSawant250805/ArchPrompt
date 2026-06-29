// ── REPO SYSTEM: Phase 1 ──────────────────────────────────────
// lib/store/workspaceStore.ts
// Pure TypeScript — no React imports.
// Single localStorage key for the entire workspace.

const WORKSPACE_KEY = "archprompt_workspace";

/** Root structure stored under WORKSPACE_KEY */
export interface WorkspaceRoot {
  /** Map of project id → raw project object */
  projects: Record<string, unknown>;
  /** Map of application id → raw application object */
  applications: Record<string, unknown>;
}

const EMPTY_WORKSPACE: WorkspaceRoot = {
  projects: {},
  applications: {},
};

/** Read the full workspace from localStorage. Returns empty defaults on any error. */
export function getWorkspace(): WorkspaceRoot {
  if (typeof window === "undefined") return structuredClone(EMPTY_WORKSPACE);
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return structuredClone(EMPTY_WORKSPACE);
    const parsed = JSON.parse(raw) as Partial<WorkspaceRoot>;
    return {
      projects: parsed.projects ?? {},
      applications: parsed.applications ?? {},
    };
  } catch {
    return structuredClone(EMPTY_WORKSPACE);
  }
}

/** Persist the full workspace to localStorage. Silent on quota/parse errors. */
export function saveWorkspace(ws: WorkspaceRoot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
  } catch {
    // Storage quota exceeded or serialisation error — swallow silently.
  }
}

/** Wipe the workspace from localStorage. */
export function resetWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    // Ignore.
  }
}
// ── END REPO SYSTEM: Phase 1 ──────────────────────────────────
