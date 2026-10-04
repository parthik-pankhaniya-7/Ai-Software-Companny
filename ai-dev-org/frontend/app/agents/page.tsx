"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { createWebSocketConnection, RealtimeClient } from "@/lib/ws";
import { useProjectStore } from "@/store/project";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProjectItem {
  id: string;
  requirement: string;
  status: string;
  phase: string;
}

export interface AgentRowData {
  id: string;
  name: string;
  role: string;
  currentTask: string;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  status: "idle" | "running" | "completed" | "failed" | "waiting_approval";
  lastActive?: string;
}

interface WSEventPayload {
  type?: string;
  event?: string;
  agent?: string;
  role?: string;
  task?: string;
  task_id?: string;
  model?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  status?: string;
  timestamp?: string;
}

const DEFAULT_AGENTS: AgentRowData[] = [
  {
    id: "cto",
    name: "Chief Technology Officer",
    role: "Governance & Architecture",
    currentTask: "Awaiting architectural review",
    model: "gemini/gemini-1.5-pro",
    tokens: { prompt: 0, completion: 0, total: 0 },
    status: "idle",
  },
  {
    id: "pm",
    name: "Product Manager",
    role: "Requirements & Milestones",
    currentTask: "Awaiting PRD & epic breakdown",
    model: "gemini/gemini-1.5-pro",
    tokens: { prompt: 0, completion: 0, total: 0 },
    status: "idle",
  },
  {
    id: "team_lead",
    name: "Engineering Team Lead",
    role: "Technical Design & Allocation",
    currentTask: "Awaiting implementation plan",
    model: "gemini/gemini-1.5-pro",
    tokens: { prompt: 0, completion: 0, total: 0 },
    status: "idle",
  },
  {
    id: "uiux",
    name: "UI/UX Designer",
    role: "Design System & Wireframes",
    currentTask: "Awaiting UI/UX specifications",
    model: "gemini/gemini-1.5-flash",
    tokens: { prompt: 0, completion: 0, total: 0 },
    status: "idle",
  },
  {
    id: "developer",
    name: "Full-Stack Developer",
    role: "Code Implementation",
    currentTask: "Awaiting task assignment",
    model: "gemini/gemini-2.0-flash",
    tokens: { prompt: 0, completion: 0, total: 0 },
    status: "idle",
  },
  {
    id: "qa",
    name: "QA / QC Engineer",
    role: "Verification & Audit",
    currentTask: "Awaiting test execution",
    model: "gemini/gemini-2.0-flash",
    tokens: { prompt: 0, completion: 0, total: 0 },
    status: "idle",
  },
  {
    id: "ai_engineer",
    name: "AI Engineer",
    role: "Budget Optimization & Routing",
    currentTask: "Monitoring token limits & routing",
    model: "gemini/gemini-1.5-pro",
    tokens: { prompt: 0, completion: 0, total: 0 },
    status: "idle",
  },
];

function getAgentStatusBadge(status: AgentRowData["status"]) {
  switch (status) {
    case "running":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
          Running
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    case "waiting_approval":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" />
          Approval Needed
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-3.5 h-3.5" />
          Failed
        </span>
      );
    case "idle":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
          Idle
        </span>
      );
  }
}

export default function AgentsPage() {
  const { currentProjectId, setProjectId } = useProjectStore();
  const [agents, setAgents] = useState<AgentRowData[]>(DEFAULT_AGENTS);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);

  // Fetch available projects
  const { data: projects, isLoading: isProjectsLoading } = useQuery<ProjectItem[]>({
    queryKey: ["projects"],
    queryFn: () => api.get<ProjectItem[]>("/projects"),
  });

  // Set default active project if none selected
  const selectedProjectId = currentProjectId || (projects && projects.length > 0 ? projects[0].id : null);

  useEffect(() => {
    if (!currentProjectId && projects && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [currentProjectId, projects, setProjectId]);

  // Handle WebSocket subscription for the active project
  useEffect(() => {
    if (!selectedProjectId) return;

    let wsClient: RealtimeClient | null = null;

    try {
      wsClient = createWebSocketConnection(selectedProjectId, (rawMessage: unknown) => {
        setWsConnected(true);
        setLastEventTime(new Date().toLocaleTimeString());

        if (!rawMessage || typeof rawMessage !== "object") return;
        const data = rawMessage as WSEventPayload;

        const targetAgent = (data.agent || data.role || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

        setAgents((prevAgents) =>
          prevAgents.map((ag) => {
            if (ag.id === targetAgent || ag.name.toLowerCase().includes(targetAgent)) {
              const updatedTokens = {
                prompt:
                  data.tokens?.prompt ??
                  data.usage?.prompt_tokens ??
                  ag.tokens.prompt,
                completion:
                  data.tokens?.completion ??
                  data.usage?.completion_tokens ??
                  ag.tokens.completion,
                total:
                  data.tokens?.total ??
                  data.usage?.total_tokens ??
                  (data.tokens?.prompt && data.tokens?.completion
                    ? data.tokens.prompt + data.tokens.completion
                    : ag.tokens.total),
              };

              let nextStatus: AgentRowData["status"] = ag.status;
              if (data.status) {
                const s = data.status.toLowerCase();
                if (s === "running" || s === "in_progress" || s === "active") nextStatus = "running";
                else if (s === "completed" || s === "ok" || s === "done") nextStatus = "completed";
                else if (s === "failed" || s === "error" || s === "escalate") nextStatus = "failed";
                else if (s === "waiting" || s === "approval") nextStatus = "waiting_approval";
                else if (s === "idle") nextStatus = "idle";
              } else if (data.type === "agent_start") {
                nextStatus = "running";
              } else if (data.type === "agent_finish") {
                nextStatus = "completed";
              }

              return {
                ...ag,
                currentTask: data.task || ag.currentTask,
                model: data.model || ag.model,
                tokens: updatedTokens,
                status: nextStatus,
                lastActive: data.timestamp || new Date().toLocaleTimeString(),
              };
            }
            return ag;
          })
        );
      });
      setWsConnected(true);
    } catch {
      setWsConnected(false);
    }

    return () => {
      wsClient?.disconnect();
      setWsConnected(false);
    };
  }, [selectedProjectId]);

  const totalTokens = useMemo(() => {
    return agents.reduce((acc, curr) => acc + curr.tokens.total, 0);
  }, [agents]);

  const activeAgentsCount = useMemo(() => {
    return agents.filter((a) => a.status === "running").length;
  }, [agents]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Multi-Agent Roster</h1>
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                wsConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <Radio className={`w-3 h-3 ${wsConnected ? "animate-pulse" : ""}`} />
              {wsConnected ? "Live WS Connected" : "Connecting WS..."}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time status, active tasks, model routing, and token budget consumption.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="project-select" className="text-xs font-medium text-muted-foreground">
            Project:
          </label>
          <select
            id="project-select"
            value={selectedProjectId || ""}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={isProjectsLoading || !projects || projects.length === 0}
            className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {isProjectsLoading && <option>Loading projects...</option>}
            {!isProjectsLoading && (!projects || projects.length === 0) && (
              <option value="">No projects available</option>
            )}
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.requirement.slice(0, 30)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Agents</p>
            <p className="text-xl font-bold text-foreground">{agents.length} Specialized</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Invocations</p>
            <p className="text-xl font-bold text-foreground">
              {activeAgentsCount} {activeAgentsCount === 1 ? "Agent" : "Agents"} Running
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Session Token Usage</p>
            <p className="text-xl font-bold text-foreground">
              {totalTokens.toLocaleString()} tokens
            </p>
          </div>
        </div>
      </div>

      {/* Agents Table */}
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Active Org Graph</h2>
          </div>
          {lastEventTime && (
            <span className="text-xs text-muted-foreground">
              Last event received: {lastEventTime}
            </span>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Agent</TableHead>
              <TableHead>Current Task</TableHead>
              <TableHead className="w-[200px]">Model Policy</TableHead>
              <TableHead className="w-[140px] text-right">Tokens</TableHead>
              <TableHead className="w-[140px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id} className="group">
                {/* Agent Column */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">{agent.role}</div>
                    </div>
                  </div>
                </TableCell>

                {/* Current Task Column */}
                <TableCell>
                  <div className="text-xs text-foreground max-w-md line-clamp-2">
                    {agent.currentTask}
                  </div>
                </TableCell>

                {/* Model Column */}
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-muted/60 text-muted-foreground border border-border">
                    <Sparkles className="w-3 h-3 text-primary shrink-0" />
                    <span className="truncate">{agent.model}</span>
                  </span>
                </TableCell>

                {/* Tokens Column */}
                <TableCell className="text-right">
                  <div className="font-mono text-xs font-medium text-foreground">
                    {agent.tokens.total.toLocaleString()}
                  </div>
                  {(agent.tokens.prompt > 0 || agent.tokens.completion > 0) && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {agent.tokens.prompt} in / {agent.tokens.completion} out
                    </div>
                  )}
                </TableCell>

                {/* Status Column */}
                <TableCell className="text-center">
                  {getAgentStatusBadge(agent.status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
