"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  CheckSquare,
  Clock,
  Code2,
  Cpu,
  FileCode,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  ShieldAlert,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

export type KanbanColumnId =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "code_review"
  | "qa"
  | "rework"
  | "done";

export interface TaskItem {
  id: string;
  project_id?: string;
  title: string;
  description?: string;
  assigned_to?: string;
  status: string;
  dependencies?: string[];
  acceptance_criteria?: string[];
  artifacts?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

interface ProjectDetail {
  id: string;
  requirement: string;
  status: string;
  phase: string;
  tasks?: TaskItem[];
}

interface KanbanColumnConfig {
  id: KanbanColumnId;
  title: string;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
  dotBg: string;
}

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "backlog",
    title: "Backlog",
    badgeBg: "bg-slate-500/10",
    badgeText: "text-slate-400",
    borderAccent: "border-slate-800",
    dotBg: "bg-slate-400",
  },
  {
    id: "ready",
    title: "Ready",
    badgeBg: "bg-indigo-500/10",
    badgeText: "text-indigo-400",
    borderAccent: "border-indigo-900/40",
    dotBg: "bg-indigo-400",
  },
  {
    id: "in_progress",
    title: "In Progress",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-400",
    borderAccent: "border-blue-900/40",
    dotBg: "bg-blue-400",
  },
  {
    id: "blocked",
    title: "Blocked",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-400",
    borderAccent: "border-amber-900/40",
    dotBg: "bg-amber-400",
  },
  {
    id: "code_review",
    title: "Code Review",
    badgeBg: "bg-purple-500/10",
    badgeText: "text-purple-400",
    borderAccent: "border-purple-900/40",
    dotBg: "bg-purple-400",
  },
  {
    id: "qa",
    title: "QA",
    badgeBg: "bg-cyan-500/10",
    badgeText: "text-cyan-400",
    borderAccent: "border-cyan-900/40",
    dotBg: "bg-cyan-400",
  },
  {
    id: "rework",
    title: "Rework",
    badgeBg: "bg-rose-500/10",
    badgeText: "text-rose-400",
    borderAccent: "border-rose-900/40",
    dotBg: "bg-rose-400",
  },
  {
    id: "done",
    title: "Done",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-400",
    borderAccent: "border-emerald-900/40",
    dotBg: "bg-emerald-400",
  },
];

function mapStatusToColumn(status: string): KanbanColumnId {
  const s = (status || "").toLowerCase().trim();
  if (s === "completed" || s === "done" || s === "pass" || s === "finished") return "done";
  if (s === "rework" || s === "retry" || s === "failed" || s === "fail") return "rework";
  if (s === "qa" || s === "testing" || s === "test") return "qa";
  if (s === "code_review" || s === "review" || s === "peer_review") return "code_review";
  if (s === "blocked" || s === "waiting" || s === "waiting_approval" || s === "approval") return "blocked";
  if (s === "in_progress" || s === "running" || s === "active") return "in_progress";
  if (s === "ready" || s === "planned" || s === "queued") return "ready";
  return "backlog";
}

function getAgentBadge(assigned?: string) {
  const agent = (assigned || "Unassigned").toLowerCase();
  let label = "Unassigned";
  let color = "bg-secondary text-muted-foreground border-border";

  if (agent.includes("cto")) {
    label = "CTO";
    color = "bg-purple-500/10 text-purple-400 border-purple-500/20";
  } else if (agent.includes("pm")) {
    label = "PM";
    color = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  } else if (agent.includes("lead")) {
    label = "Team Lead";
    color = "bg-sky-500/10 text-sky-400 border-sky-500/20";
  } else if (agent.includes("uiux") || agent.includes("design")) {
    label = "UI/UX";
    color = "bg-pink-500/10 text-pink-400 border-pink-500/20";
  } else if (agent.includes("dev") || agent.includes("developer")) {
    label = "Developer";
    color = "bg-blue-500/10 text-blue-400 border-blue-500/20";
  } else if (agent.includes("qa")) {
    label = "QA";
    color = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  } else if (agent.includes("ai")) {
    label = "AI Engineer";
    color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono border ${color}`}>
      <Bot className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function TasksKanbanPage() {
  const params = useParams();
  const projectId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Fetch project details and tasks
  const { data: project, isLoading, isError, error } = useQuery<ProjectDetail>({
    queryKey: ["project", projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });

  // Group tasks by Kanban column
  const groupedTasks = useMemo(() => {
    const map: Record<KanbanColumnId, TaskItem[]> = {
      backlog: [],
      ready: [],
      in_progress: [],
      blocked: [],
      code_review: [],
      qa: [],
      rework: [],
      done: [],
    };

    if (project?.tasks) {
      project.tasks.forEach((t) => {
        const col = mapStatusToColumn(t.status);
        map[col].push(t);
      });
    }

    return map;
  }, [project?.tasks]);

  const totalTasksCount = project?.tasks?.length || 0;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-6 space-y-6 max-w-[1700px] mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Task Kanban Backlog
              </h1>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                {projectId}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                <Layers className="w-3 h-3" />
                {totalTasksCount} {totalTasksCount === 1 ? "Task" : "Tasks"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {project?.requirement || "Read-only synchronized agent task allocation backlog."}
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-3">
          <Link
            href={`/workflow/${projectId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5" />
            View Workflow Graph
          </Link>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading project task backlog...</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to load tasks</p>
            <p className="text-xs mt-1">{(error as Error)?.message || "Failed to fetch from backend."}</p>
          </div>
        </div>
      )}

      {/* Kanban Board Container */}
      {!isLoading && !isError && (
        <div className="flex-1 min-h-0 overflow-x-auto pb-4">
          <div className="flex gap-4 h-full min-w-max">
            {KANBAN_COLUMNS.map((column) => {
              const tasksInCol = groupedTasks[column.id] || [];
              return (
                <div
                  key={column.id}
                  className={`w-72 flex flex-col rounded-xl border ${column.borderAccent} bg-card/40 backdrop-blur-md overflow-hidden`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${column.dotBg}`} />
                      <span className="text-xs font-bold text-foreground tracking-wide">
                        {column.title}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${column.badgeBg} ${column.badgeText}`}
                    >
                      {tasksInCol.length}
                    </span>
                  </div>

                  {/* Tasks Column Body */}
                  <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                    {tasksInCol.length === 0 ? (
                      <div className="h-24 flex items-center justify-center text-center p-3 border border-dashed border-border/40 rounded-lg text-muted-foreground/60 text-xs">
                        No tasks in {column.title.toLowerCase()}
                      </div>
                    ) : (
                      tasksInCol.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="group relative p-3.5 rounded-lg border border-border bg-card/80 hover:bg-card hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md space-y-2.5"
                        >
                          {/* Top Row: Task ID + Assigned Agent */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {task.id.slice(0, 8)}
                            </span>
                            {getAgentBadge(task.assigned_to)}
                          </div>

                          {/* Title */}
                          <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                            {task.title}
                          </h4>

                          {/* Criteria & Artifact Count Badges */}
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                            {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
                              <span className="flex items-center gap-1 text-[10px]">
                                <CheckSquare className="w-3 h-3 text-emerald-400" />
                                {task.acceptance_criteria.length} criteria
                              </span>
                            )}
                            {task.artifacts && Object.keys(task.artifacts).length > 0 && (
                              <span className="flex items-center gap-1 text-[10px]">
                                <FileCode className="w-3 h-3 text-blue-400" />
                                {Object.keys(task.artifacts).length} artifacts
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Detail Slide-Over Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm animate-in fade-in-0">
          <div
            className="w-full max-w-xl h-full bg-card border-l border-border shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-border flex items-start justify-between gap-4 shrink-0 bg-muted/20">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border">
                    {selectedTask.id}
                  </span>
                  <span className="text-xs capitalize font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {selectedTask.status}
                  </span>
                </div>
                <h2 className="text-base font-bold text-foreground leading-snug">
                  {selectedTask.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              {/* Assigned Agent */}
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" /> Assigned Agent
                </h3>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground capitalize">
                      {selectedTask.assigned_to || "Unassigned"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Responsible for contract fulfillment and test validation
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Description
                  </h3>
                  <div className="p-3.5 rounded-lg border border-border bg-background/50 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedTask.description}
                  </div>
                </div>
              )}

              {/* Acceptance Criteria */}
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" /> Acceptance Criteria
                </h3>
                {!selectedTask.acceptance_criteria || selectedTask.acceptance_criteria.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No explicit acceptance criteria specified for this ticket.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedTask.acceptance_criteria.map((crit, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-background/50 text-xs"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-foreground leading-relaxed">{crit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dependencies */}
              {selectedTask.dependencies && selectedTask.dependencies.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Dependencies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.dependencies.map((dep, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-xs px-2.5 py-1 rounded bg-secondary text-secondary-foreground border border-border"
                      >
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Artifacts Produced */}
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" /> Produced Artifacts
                </h3>
                {!selectedTask.artifacts || Object.keys(selectedTask.artifacts).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No artifacts generated yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(selectedTask.artifacts).map(([key, val]) => (
                      <div key={key} className="rounded-lg border border-border bg-background/60 overflow-hidden">
                        <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-xs font-mono font-semibold text-foreground flex items-center justify-between">
                          <span>{key}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {typeof val === "object" ? "JSON Object" : typeof val}
                          </span>
                        </div>
                        <pre className="p-3 text-[11px] font-mono text-foreground/90 overflow-x-auto max-h-48 leading-relaxed">
                          {typeof val === "string" ? val : JSON.stringify(val, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
              <span className="font-mono">Project: {projectId}</span>
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-medium transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
