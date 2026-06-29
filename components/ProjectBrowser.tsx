// ── REPO SYSTEM: Phase 2 ──────────────────────────────────────
// components/ProjectBrowser.tsx
// Full-screen project explorer displaying existing workspaces and supporting project CRUD.

import React, { useState, useEffect } from "react";
import { Folder, Plus, Trash2, Edit3, X, ChevronRight, Layers, LayoutGrid } from "lucide-react";
import { Project, listProjects, saveProject, deleteProject } from "../lib/store/projectStore";
import { listApplications } from "../lib/store/applicationStore";

interface ProjectBrowserProps {
  onOpenProject: (projectId: string) => void;
}

const PRESET_COLORS = [
  "#d4ff00", // Accent Yellow
  "#9d72ff", // Violet
  "#38d9c0", // Teal
  "#f87171", // Rose
  "#60a5fa", // Blue
  "#fbbf24", // Amber
];

export default function ProjectBrowser({ onOpenProject }: ProjectBrowserProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [projectAppCounts, setProjectAppCounts] = useState<Record<string, number>>({});

  // Reload projects list on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    const allProjects = listProjects();
    setProjects(allProjects);
    
    // Compute application counts for each project
    const counts: Record<string, number> = {};
    allProjects.forEach(p => {
      counts[p.id] = listApplications(p.id).length;
    });
    setProjectAppCounts(counts);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProject: Project = {
      id: "proj_" + Math.random().toString(36).substr(2, 9),
      name: newProjectName.trim(),
      color: selectedColor,
      createdAt: new Date().toISOString(),
    };

    saveProject(newProject);
    setNewProjectName("");
    loadProjects();
  };

  const handleDeleteProject = (id: string) => {
    deleteProject(id);
    setDeleteConfirmId(null);
    loadProjects();
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] text-[#F0F0F0] flex flex-col font-sans select-none overflow-y-auto">
      {/* Top Header */}
      <header className="h-[70px] border-b border-white/10 bg-[#0A0A0A] px-8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#d4ff00]/10 border border-[#d4ff00]/30 flex items-center justify-center">
            <LayoutGrid className="h-5 w-5 text-[#d4ff00]" />
          </div>
          <div>
            <h1 className="font-serif text-xl italic font-bold tracking-tight text-[#F0F0F0]">
              ArchPrompt Studio
            </h1>
            <p className="text-[10px] text-[#999999] tracking-wider uppercase font-mono mt-0.5">
              Workspace & Multi-Project Manager
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-10 flex flex-col md:flex-row gap-8">
        
        {/* Left Side: Create Form */}
        <section className="w-full md:w-[320px] bg-white/5 border border-white/10 rounded-2xl p-6 h-fit space-y-6">
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#F0F0F0] flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#d4ff00]" />
              New Project
            </h2>
            <p className="text-[10px] text-[#999999] leading-relaxed">
              Create a isolated project sandbox to organize architecture layout versions and subsystem flows.
            </p>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#999999] tracking-wider block">
                Project Name
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Gateway microservice, Auth v2"
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-[#F0F0F0] placeholder-[#999999]/30 focus:outline-none focus:border-[#d4ff00] transition"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#999999] tracking-wider block">
                Theme Color
              </label>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className="aspect-square rounded-full transition-all border relative flex items-center justify-center cursor-pointer hover:scale-105"
                    style={{
                      backgroundColor: c,
                      borderColor: selectedColor === c ? "#FFFFFF" : "transparent",
                      boxShadow: selectedColor === c ? `0 0 10px ${c}` : "none",
                    }}
                  >
                    {selectedColor === c && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#d4ff00] hover:bg-white text-black text-xs font-bold uppercase tracking-wider rounded-xl transition duration-150 cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(212,255,0,0.12)]"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </button>
          </form>
        </section>

        {/* Right Side: Projects Grid */}
        <section className="flex-1 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-[10px] font-bold text-[#999999] uppercase tracking-wider">
              Active Projects ({projects.length})
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-2xl py-20 text-center space-y-4 bg-white/[0.01]">
              <div className="h-14 w-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-[#999999]">
                <Folder className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-[#F0F0F0]">No projects found</h3>
                <p className="text-[10px] text-[#999999] max-w-xs mx-auto leading-relaxed">
                  Get started by creating your first system architecture catalog in the left panel.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.map((proj) => {
                const appCount = projectAppCounts[proj.id] || 0;
                return (
                  <div
                    key={proj.id}
                    className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.07] transition duration-200 group relative"
                  >
                    {/* Delete Icon Overlay */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(proj.id);
                      }}
                      className="absolute top-4 right-4 p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 transition cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Delete Project and all inner apps"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: proj.color,
                            boxShadow: `0 0 8px ${proj.color}40`,
                          }}
                        />
                        <h3 className="text-sm font-bold text-[#F0F0F0] truncate max-w-[80%]">
                          {proj.name}
                        </h3>
                      </div>

                      <p className="text-[10px] text-[#999999]">
                        Created {new Date(proj.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex justify-between items-center mt-6 pt-3 border-t border-white/5">
                      <span className="text-[10px] font-mono text-[#999999] bg-white/5 px-2.5 py-1 rounded-md">
                        {appCount} {appCount === 1 ? "diagram" : "diagrams"}
                      </span>

                      <button
                        onClick={() => onOpenProject(proj.id)}
                        className="py-1.5 px-3.5 bg-[#d4ff00]/10 hover:bg-[#d4ff00]/20 border border-[#d4ff00]/25 text-[10px] text-[#d4ff00] font-bold uppercase tracking-wider rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        Enter Studio
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">
              Danger: Delete Project
            </h3>
            <p className="text-xs text-[#999999] leading-relaxed">
              This action will permanently delete the project and all inner saved diagrams. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-white/10 text-xs text-[#999999] hover:text-[#F0F0F0] rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(deleteConfirmId)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ── END REPO SYSTEM: Phase 2 ──────────────────────────────────
