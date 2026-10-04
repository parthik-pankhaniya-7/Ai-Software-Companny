"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Position,
  Handle,
  MarkerType,
  BackgroundVariant,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { createWebSocketConnection, RealtimeClient } from "@/lib/ws";

export type AgentNodeStatus = "grey" | "blue" | "green" | "red";

export interface AgentCustomNodeData {
  id: string;
  role: string;
  title: string;
  description: string;
  model: string;
  status: AgentNodeStatus;
  statusLabel: string;
  currentTask?: string;
  tokens?: number;
  lastActive?: string;
}

interface ProjectDetail {
  id: string;
  requirement: string;
  status: string;
  phase: string;
}

interface WSEventData {
  type?: string;
  event?: string;
  agent?: string;
  role?: string;
  task?: string;
  status?: string;
  model?: string;
  tokens?: {
    total?: number;
  };
  usage?: {
    total_tokens?: number;
  };
  timestamp?: string;
}

/**
 * Custom Agent Node component with dynamic status coloring and handles.
 */
function AgentCustomNode({ data }: NodeProps<AgentCustomNodeData>) {
  const statusColors = useMemo(() => {
    switch (data.status) {
      case "blue": // Running
        return {
          container: "border-blue-500 bg-blue-950/40 shadow-blue-500/20 shadow-lg ring-1 ring-blue-500/50",
          badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
          iconBg: "bg-blue-500/20 text-blue-400",
          ping: true,
        };
      case "green": // Completed
        return {
          container: "border-emerald-500/80 bg-emerald-950/30 shadow-emerald-500/10 shadow-md ring-1 ring-emerald-500/30",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          iconBg: "bg-emerald-500/20 text-emerald-400",
          ping: false,
        };
      case "red": // Failed / Retrying
        return {
          container: "border-rose-500/80 bg-rose-950/40 shadow-rose-500/20 shadow-md ring-1 ring-rose-500/40",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
          iconBg: "bg-rose-500/20 text-rose-400",
          ping: false,
        };
      case "grey": // Idle / Pending
      default:
        return {
          container: "border-border bg-card/90 shadow-sm opacity-85",
          badge: "bg-secondary text-muted-foreground border-border",
          iconBg: "bg-secondary text-muted-foreground",
          ping: false,
        };
    }
  }, [data.status]);

  return (
    <div
      className={`relative min-w-[260px] max-w-[300px] rounded-xl border p-4 transition-all duration-300 backdrop-blur-md ${statusColors.container}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.iconBg}`}>
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground leading-tight">{data.title}</h4>
            <span className="text-[11px] text-muted-foreground font-mono">{data.role}</span>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors.badge}`}
        >
          {statusColors.ping && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />}
          {data.status === "green" && <CheckCircle2 className="w-3 h-3" />}
          {data.status === "red" && <ShieldAlert className="w-3 h-3" />}
          {data.statusLabel}
        </span>
      </div>

      {/* Current Task */}
      <div className="mt-2 text-xs bg-background/50 rounded-lg p-2 border border-border/50">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
          Current Assignment
        </div>
        <p className="text-foreground line-clamp-2 leading-relaxed text-[11px]">
          {data.currentTask || "Idle / Awaiting workflow execution"}
        </p>
      </div>

      {/* Footer Info */}
      <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span className="truncate max-w-[150px]">{data.model}</span>
        {data.tokens !== undefined && data.tokens > 0 && (
          <span className="text-foreground font-medium">{data.tokens.toLocaleString()} tok</span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

const nodeTypes = {
  agentNode: AgentCustomNode,
};

const INITIAL_NODES: Node<AgentCustomNodeData>[] = [
  {
    id: "cto",
    type: "agentNode",
    position: { x: 380, y: 30 },
    data: {
      id: "cto",
      role: "CTO",
      title: "Chief Technology Officer",
      description: "Architecture & Feasibility Analysis",
      model: "gemini/gemini-1.5-pro",
      status: "grey",
      statusLabel: "Idle",
      currentTask: "BRD & FRD architectural synthesis",
    },
  },
  {
    id: "pm",
    type: "agentNode",
    position: { x: 380, y: 190 },
    data: {
      id: "pm",
      role: "PM",
      title: "Product Manager",
      description: "Epics, Tasks, & Milestones",
      model: "gemini/gemini-1.5-pro",
      status: "grey",
      statusLabel: "Idle",
      currentTask: "Sprint decomposition & criteria",
    },
  },
  {
    id: "team_lead",
    type: "agentNode",
    position: { x: 380, y: 350 },
    data: {
      id: "team_lead",
      role: "Team Lead",
      title: "Engineering Team Lead",
      description: "Technical Design & Routing",
      model: "gemini/gemini-1.5-pro",
      status: "grey",
      statusLabel: "Idle",
      currentTask: "File mapping & UI requirement flag",
    },
  },
  {
    id: "uiux",
    type: "agentNode",
    position: { x: 120, y: 510 },
    data: {
      id: "uiux",
      role: "UI/UX",
      title: "UI/UX Designer",
      description: "Wireframes & Design System",
      model: "gemini/gemini-1.5-flash",
      status: "grey",
      statusLabel: "Idle",
      currentTask: "Tailwind & shadcn design specifications",
    },
  },
  {
    id: "developer",
    type: "agentNode",
    position: { x: 640, y: 510 },
    data: {
      id: "developer",
      role: "Developer",
      title: "Full-Stack Developer(s)",
      description: "Code & Test Implementation",
      model: "gemini/gemini-2.0-flash",
      status: "grey",
      statusLabel: "Idle",
      currentTask: "Multi-file implementation & modules",
    },
  },
  {
    id: "qa",
    type: "agentNode",
    position: { x: 640, y: 680 },
    data: {
      id: "qa",
      role: "QA",
      title: "QA / QC Engineer",
      description: "Audit & Test Verification",
      model: "gemini/gemini-2.0-flash",
      status: "grey",
      statusLabel: "Idle",
      currentTask: "Unit/integration suite verification",
    },
  },
  {
    id: "ai_engineer",
    type: "agentNode",
    position: { x: 380, y: 840 },
    data: {
      id: "ai_engineer",
      role: "AI Engineer",
      title: "AI Engineer",
      description: "Optimization & Escalations",
      model: "gemini/gemini-1.5-pro",
      status: "grey",
      statusLabel: "Idle",
      currentTask: "Token budget review & final sign-off",
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  {
    id: "e-cto-pm",
    source: "cto",
    target: "pm",
    label: "BRD / FRD Handoff",
    animated: true,
    style: { stroke: "#64748b", strokeWidth: 2 },
    labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
  },
  {
    id: "e-pm-tl",
    source: "pm",
    target: "team_lead",
    label: "Task Breakdown",
    animated: true,
    style: { stroke: "#64748b", strokeWidth: 2 },
    labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
  },
  {
    id: "e-tl-uiux",
    source: "team_lead",
    target: "uiux",
    label: "If UI Needed",
    animated: true,
    style: { stroke: "#3b82f6", strokeDasharray: "5 5", strokeWidth: 2 },
    labelStyle: { fill: "#60a5fa", fontSize: 11, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
  },
  {
    id: "e-tl-dev",
    source: "team_lead",
    target: "developer",
    label: "Direct Backend Flow",
    animated: true,
    style: { stroke: "#64748b", strokeWidth: 2 },
    labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
  },
  {
    id: "e-uiux-dev",
    source: "uiux",
    target: "developer",
    label: "UI Specs",
    animated: true,
    style: { stroke: "#64748b", strokeWidth: 2 },
    labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
  },
  {
    id: "e-dev-qa",
    source: "developer",
    target: "qa",
    label: "Code & Tests Handoff",
    animated: true,
    style: { stroke: "#64748b", strokeWidth: 2 },
    labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
  },
  {
    id: "e-qa-dev-retry",
    source: "qa",
    target: "developer",
    sourceHandle: "right-source",
    targetHandle: "left-target",
    label: "Retry Loop (Fail < 3)",
    animated: true,
    style: { stroke: "#f43f5e", strokeDasharray: "4 4", strokeWidth: 2 },
    labelStyle: { fill: "#fb7185", fontSize: 11, fontWeight: 600 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#f43f5e" },
  },
  {
    id: "e-qa-ai",
    source: "qa",
    target: "ai_engineer",
    label: "Audit Pass / Escalate",
    animated: true,
    style: { stroke: "#10b981", strokeWidth: 2 },
    labelStyle: { fill: "#34d399", fontSize: 11, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
  },
];

export default function WorkflowGraphPage() {
  const params = useParams();
  const projectId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [nodes, setNodes] = useState<Node<AgentCustomNodeData>[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  // Fetch project details
  const { data: project } = useQuery<ProjectDetail>({
    queryKey: ["project", projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });

  // Handle incoming live WebSocket updates
  const handleWebSocketMessage = useCallback((rawMessage: unknown) => {
    setWsConnected(true);
    if (!rawMessage || typeof rawMessage !== "object") return;

    const data = rawMessage as WSEventData;
    const agentKey = (data.agent || data.role || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

    setLastEvent(`${data.type || data.event || "event"} @ ${new Date().toLocaleTimeString()}`);

    if (agentKey) {
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id === agentKey || n.data.id === agentKey) {
            let nextStatus: AgentNodeStatus = n.data.status;
            let statusLabel = n.data.statusLabel;

            const s = (data.status || "").toLowerCase();
            const eventType = (data.type || data.event || "").toLowerCase();

            if (
              s === "running" ||
              s === "in_progress" ||
              s === "active" ||
              eventType === "agent_start" ||
              eventType === "node_start"
            ) {
              nextStatus = "blue";
              statusLabel = "Running";
            } else if (
              s === "completed" ||
              s === "ok" ||
              s === "pass" ||
              eventType === "agent_finish" ||
              eventType === "node_finish"
            ) {
              nextStatus = "green";
              statusLabel = "Completed";
            } else if (
              s === "failed" ||
              s === "fail" ||
              s === "error" ||
              s === "blocked" ||
              s === "escalate"
            ) {
              nextStatus = "red";
              statusLabel = "Failed / Retry";
            }

            const totalTokens =
              data.tokens?.total ?? data.usage?.total_tokens ?? n.data.tokens;

            return {
              ...n,
              data: {
                ...n.data,
                status: nextStatus,
                statusLabel,
                currentTask: data.task || n.data.currentTask,
                model: data.model || n.data.model,
                tokens: totalTokens,
                lastActive: data.timestamp || new Date().toLocaleTimeString(),
              },
            };
          }
          return n;
        })
      );
    }
  }, []);

  // Subscribe to WebSocket
  useEffect(() => {
    if (!projectId) return;

    let wsClient: RealtimeClient | null = null;
    try {
      wsClient = createWebSocketConnection(projectId, handleWebSocketMessage);
      setWsConnected(true);
    } catch {
      setWsConnected(false);
    }

    return () => {
      wsClient?.disconnect();
      setWsConnected(false);
    };
  }, [projectId, handleWebSocketMessage]);

  const activeCount = useMemo(
    () => nodes.filter((n) => n.data.status === "blue").length,
    [nodes]
  );
  const completedCount = useMemo(
    () => nodes.filter((n) => n.data.status === "green").length,
    [nodes]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
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
                Workflow Graph
              </h1>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                {projectId}
              </span>
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                  wsConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <Radio className={`w-3 h-3 ${wsConnected ? "animate-pulse" : ""}`} />
                {wsConnected ? "WS Live" : "Connecting..."}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {project?.requirement || "Autonomous LangGraph Multi-Agent Execution Pipeline"}
            </p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-muted-foreground">Idle</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Running ({activeCount})</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed ({completedCount})</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Failed / Retry</span>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 w-full rounded-xl border border-border bg-card/40 backdrop-blur-md overflow-hidden relative shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={1.5}
          attributionPosition="bottom-right"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="#334155"
          />
          <Controls className="!bg-card !border-border !fill-foreground !text-foreground [&>button]:!border-border [&>button]:!bg-card" />
          <MiniMap
            nodeColor={(n) => {
              const d = n.data as AgentCustomNodeData;
              if (d?.status === "blue") return "#3b82f6";
              if (d?.status === "green") return "#10b981";
              if (d?.status === "red") return "#f43f5e";
              return "#475569";
            }}
            maskColor="rgba(15, 23, 42, 0.7)"
            className="!bg-card !border-border rounded-lg overflow-hidden"
          />
        </ReactFlow>

        {lastEvent && (
          <div className="absolute bottom-4 left-4 text-[11px] font-mono bg-background/90 border border-border px-3 py-1.5 rounded-lg shadow-sm backdrop-blur text-muted-foreground">
            Latest stream update: <span className="text-foreground">{lastEvent}</span>
          </div>
        )}
      </div>
    </div>
  );
}
