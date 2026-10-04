"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  ArrowLeft,
  Bot,
  CheckCircle2,
  Radio,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { connectProject } from "@/lib/ws";

export type AgentStatus = "idle" | "running" | "completed" | "failed";

export interface AgentCustomNodeData {
  id: string;
  role: string;
  title: string;
  description: string;
  model: string;
  status: AgentStatus;
  tokens_in?: number;
  tokens_out?: number;
  error?: string;
}

interface ProjectDetail {
  id: string;
  requirement: string;
  status: string;
  phase: string;
}

/**
 * Custom Agent Node component with dynamic status coloring and handles.
 */
function AgentCustomNode({ data }: NodeProps<AgentCustomNodeData>) {
  const statusColors = useMemo(() => {
    switch (data.status) {
      case "running":
        return {
          container: "border-blue-500 bg-blue-950/40 shadow-blue-500/20 shadow-lg ring-1 ring-blue-500/50",
          badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
          iconBg: "bg-blue-500/20 text-blue-400",
          label: "Running",
          ping: true,
        };
      case "completed":
        return {
          container: "border-emerald-500/80 bg-emerald-950/30 shadow-emerald-500/10 shadow-md ring-1 ring-emerald-500/30",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          iconBg: "bg-emerald-500/20 text-emerald-400",
          label: "Completed",
          ping: false,
        };
      case "failed":
        return {
          container: "border-rose-500/80 bg-rose-950/40 shadow-rose-500/20 shadow-md ring-1 ring-rose-500/40",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
          iconBg: "bg-rose-500/20 text-rose-400",
          label: "Failed",
          ping: false,
        };
      case "idle":
      default:
        return {
          container: "border-border bg-card/90 shadow-sm opacity-85",
          badge: "bg-secondary text-muted-foreground border-border",
          iconBg: "bg-secondary text-muted-foreground",
          label: "Idle",
          ping: false,
        };
    }
  }, [data.status]);

  const displayedModel = useMemo(() => {
    if (data.status === "idle") return "—";
    if (data.status === "running") return "...";
    return data.model || "—";
  }, [data.status, data.model]);

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
          {data.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
          {data.status === "failed" && <ShieldAlert className="w-3 h-3" />}
          {statusColors.label}
        </span>
      </div>

      {/* Description / Task / Error */}
      <div className="mt-2 text-xs bg-background/50 rounded-lg p-2 border border-border/50">
        {data.error ? (
          <p className="text-rose-400 text-[11px] line-clamp-2 leading-relaxed flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {data.error}
          </p>
        ) : (
          <p className="text-foreground line-clamp-2 leading-relaxed text-[11px]">
            {data.description}
          </p>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span className="truncate max-w-[150px]">{displayedModel}</span>
        {data.status === "completed" && data.tokens_in !== undefined && data.tokens_out !== undefined ? (
          <span className="text-foreground font-medium">
            {data.tokens_in}/{data.tokens_out} tok
          </span>
        ) : null}
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
      model: "—",
      status: "idle",
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
      model: "—",
      status: "idle",
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
      model: "—",
      status: "idle",
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
      model: "—",
      status: "idle",
    },
  },
  {
    id: "developer",
    type: "agentNode",
    position: { x: 640, y: 510 },
    data: {
      id: "developer",
      role: "Developer",
      title: "Full-Stack Developer",
      description: "Code & Test Implementation",
      model: "—",
      status: "idle",
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
      model: "—",
      status: "idle",
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
      model: "—",
      status: "idle",
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
  const [edges] = useState<Edge[]>(INITIAL_EDGES);
  const [_status, setStatus] = useState<string>("in_progress");
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Fetch project details
  const { data: project } = useQuery<ProjectDetail>({
    queryKey: ["project", projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });

  // Subscribe to live WebSocket events
  useEffect(() => {
    if (!projectId) return;

    setWsConnected(true);
    const cleanup = connectProject(projectId, (event) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== event.agent) return n;
          if (event.type === "agent_started") {
            return {
              ...n,
              data: {
                ...n.data,
                status: "running",
                model: "...",
              },
            };
          }
          if (event.type === "agent_completed") {
            return {
              ...n,
              data: {
                ...n.data,
                status: "completed",
                model: event.model || n.data.model,
                tokens_in: event.tokens_in,
                tokens_out: event.tokens_out,
              },
            };
          }
          if (event.type === "agent_failed") {
            return {
              ...n,
              data: {
                ...n.data,
                status: "failed",
                error: event.error,
              },
            };
          }
          return n;
        })
      );

      if (event.type === "workflow_completed") setStatus("completed");
      if (event.type === "workflow_failed") setStatus("failed");
    });

    return () => {
      cleanup();
      setWsConnected(false);
    };
  }, [projectId]);

  // Live node status counters
  const running = useMemo(
    () => nodes.filter((n) => n.data.status === "running").length,
    [nodes]
  );
  const completed = useMemo(
    () => nodes.filter((n) => n.data.status === "completed").length,
    [nodes]
  );
  const failed = useMemo(
    () => nodes.filter((n) => n.data.status === "failed").length,
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

        {/* Live Counters */}
        <div className="flex items-center gap-3 text-xs font-medium">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Running ({running})</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed ({completed})</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Failed ({failed})</span>
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
              if (d?.status === "running") return "#3b82f6";
              if (d?.status === "completed") return "#10b981";
              if (d?.status === "failed") return "#f43f5e";
              return "#475569";
            }}
            maskColor="rgba(15, 23, 42, 0.7)"
            className="!bg-card !border-border rounded-lg overflow-hidden"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
