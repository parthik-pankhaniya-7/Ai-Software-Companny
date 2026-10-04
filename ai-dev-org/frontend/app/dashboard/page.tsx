"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderGit2,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

interface TaskItem {
  id: string;
  status: string;
}

interface ProjectItem {
  id: string;
  requirement: string;
  status: string;
  phase: string;
  tasks?: TaskItem[];
  created_at?: string;
  updated_at?: string;
}

function calculateProgress(project: ProjectItem): number {
  if (project.status === "completed") return 100;
  if (!project.tasks || project.tasks.length === 0) {
    if (project.phase === "initiation" || project.status === "planning") return 15;
    if (project.status === "in_progress") return 50;
    if (project.status === "review") return 85;
    return 0;
  }
  const completed = project.tasks.filter((t) => t.status === "completed").length;
  return Math.round((completed / project.tasks.length) * 100);
}

function getStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Clock className="w-3 h-3 animate-spin" />
          In Progress
        </span>
      );
    case "failed":
    case "blocked":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-3 h-3" />
          {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
          <Clock className="w-3 h-3" />
          {status || "Planning"}
        </span>
      );
  }
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requirement, setRequirement] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch projects list via TanStack Query
  const { data: projects, isLoading, isError, error } = useQuery<ProjectItem[]>({
    queryKey: ["projects"],
    queryFn: () => api.get<ProjectItem[]>("/projects"),
  });

  // Create Project mutation
  const createProjectMutation = useMutation({
    mutationFn: (newRequirement: string) =>
      api.post<ProjectItem>("/projects", { requirement: newRequirement }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsModalOpen(false);
      setRequirement("");
      setErrorMessage(null);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || "Failed to create project");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requirement.trim()) {
      setErrorMessage("Please enter a project requirement specification.");
      return;
    }
    createProjectMutation.mutate(requirement);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage autonomous multi-agent engineering workflows and system delivery.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading active projects from storage...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to retrieve projects</p>
            <p className="text-xs mt-1">{(error as Error)?.message || "Failed to fetch from backend API."}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && (!projects || projects.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border rounded-xl bg-card/30 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">No projects found</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first project to trigger the CTO, PM, Team Lead, and Developer agent workflow.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      )}

      {/* Project Grid */}
      {!isLoading && !isError && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const progress = calculateProgress(proj);
            return (
              <div
                key={proj.id}
                className="group relative rounded-xl border border-border bg-card/60 backdrop-blur-md p-5 hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {proj.id}
                    </span>
                    {getStatusBadge(proj.status)}
                  </div>

                  {/* Requirement Preview */}
                  <h3 className="text-base font-semibold text-foreground line-clamp-2 mb-2">
                    {proj.requirement || "Untitled Requirement"}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Phase: <span className="text-foreground capitalize">{proj.phase || "Planning"}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderGit2 className="w-3.5 h-3.5" />
                      Tasks: <span className="text-foreground">{proj.tasks?.length || 0}</span>
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Footer */}
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-foreground">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <Link
                    href={`/workflow/${proj.id}`}
                    className="mt-4 flex items-center justify-between text-xs font-medium text-primary group-hover:text-primary/80 transition-colors"
                  >
                    <span>Inspect Agent Workflow</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create New Project</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Describe what you want the autonomous agent team to build.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="requirement-input"
                  className="block text-xs font-medium text-foreground mb-1.5"
                >
                  Project Requirement Specification
                </label>
                <textarea
                  id="requirement-input"
                  rows={5}
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value)}
                  placeholder="e.g. Build a local-first multi-agent development environment using FastAPI, LangGraph, and Next.js 14..."
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  disabled={createProjectMutation.isPending}
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={createProjectMutation.isPending}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createProjectMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Launch Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
