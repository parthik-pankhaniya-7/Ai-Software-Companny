"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CornerDownLeft,
  Cpu,
  FileCode,
  Flame,
  HelpCircle,
  Layers,
  Loader2,
  MessageSquare,
  Radio,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  User,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { createWebSocketConnection, RealtimeClient } from "@/lib/ws";

export interface LogMessage {
  id: string;
  sender: string;
  receiver?: string;
  type: "text" | "task" | "handoff" | "approval" | "system" | "error" | string;
  text?: string;
  summary?: string;
  content?: string;
  payload?: {
    task_id?: string;
    task_title?: string;
    decision?: string;
    reason?: string;
    artifacts?: Record<string, unknown>;
    questions?: string[];
    risks?: string[];
    [key: string]: unknown;
  };
  timestamp: string;
}

interface ProjectDetail {
  id: string;
  requirement: string;
  status: string;
  phase: string;
}

interface ApprovePayload {
  task_id: string;
  decision: "approve" | "reject" | "escalate";
  reason?: string;
  approver?: string;
}

function getSenderIcon(sender: string) {
  const s = sender.toLowerCase();
  if (s.includes("user") || s.includes("human")) {
    return <User className="w-4 h-4 text-primary" />;
  }
  return <Bot className="w-4 h-4 text-primary" />;
}

function getSenderBadge(sender: string) {
  const s = sender.toLowerCase();
  if (s.includes("cto")) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
        CTO
      </span>
    );
  }
  if (s.includes("pm")) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
        PM
      </span>
    );
  }
  if (s.includes("lead")) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
        Team Lead
      </span>
    );
  }
  if (s.includes("uiux") || s.includes("design")) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
        UI/UX
      </span>
    );
  }
  if (s.includes("developer") || s.includes("dev")) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
        Developer
      </span>
    );
  }
  if (s.includes("qa")) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        QA
      </span>
    );
  }
  if (s.includes("ai_engineer") || s.includes("ai")) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        AI Engineer
      </span>
    );
  }
  if (s.includes("system")) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
        System
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-secondary text-secondary-foreground border border-border">
      {sender}
    </span>
  );
}

export default function ProjectChatPage() {
  const params = useParams();
  const projectId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<LogMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [actionReason, setActionReason] = useState<Record<string, string>>({});
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wsClientRef = useRef<RealtimeClient | null>(null);

  // Fetch Project Info
  const { data: project } = useQuery<ProjectDetail>({
    queryKey: ["project", projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });

  // Fetch Existing Messages
  const { data: initialMessages } = useQuery<LogMessage[]>({
    queryKey: ["messages", projectId],
    queryFn: () => api.get<LogMessage[]>(`/messages?project_id=${projectId}`),
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((raw: unknown) => {
    setWsConnected(true);
    if (!raw || typeof raw !== "object") return;

    const data = raw as Record<string, unknown>;

    const newMsg: LogMessage = {
      id: String(data.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      sender: String(data.sender || data.agent || data.role || "system"),
      receiver: data.receiver ? String(data.receiver) : undefined,
      type: String(data.type || "text"),
      text: data.text ? String(data.text) : data.message ? String(data.message) : undefined,
      summary: data.summary ? String(data.summary) : undefined,
      content: data.content ? String(data.content) : undefined,
      payload: (data.payload as Record<string, unknown>) || {
        task_id: data.task_id as string | undefined,
        task_title: data.task as string | undefined,
        artifacts: data.artifacts as Record<string, unknown> | undefined,
        questions: data.questions as string[] | undefined,
        risks: data.risks as string[] | undefined,
      },
      timestamp: String(data.timestamp || new Date().toISOString()),
    };

    setMessages((prev) => [...prev, newMsg]);
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!projectId) return;

    try {
      const client = createWebSocketConnection(projectId, handleWebSocketMessage);
      wsClientRef.current = client;
      setWsConnected(true);
    } catch {
      setWsConnected(false);
    }

    return () => {
      wsClientRef.current?.disconnect();
      setWsConnected(false);
    };
  }, [projectId, handleWebSocketMessage]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Approval Mutation
  const approveMutation = useMutation({
    mutationFn: (payload: ApprovePayload) =>
      api.post(`/projects/${projectId}/approve`, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["messages", projectId] });
      setActionSuccess(`Successfully sent decision: ${variables.decision.toUpperCase()}`);
      setTimeout(() => setActionSuccess(null), 4000);
    },
  });

  const handleDecision = (taskId: string, decision: "approve" | "reject" | "escalate") => {
    const reason = actionReason[taskId] || "";
    approveMutation.mutate({
      task_id: taskId,
      decision,
      reason,
      approver: "Human Operator",
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage: LogMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: "Human Operator",
      type: "text",
      text: inputText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Send over WebSocket if available
    wsClientRef.current?.send({
      type: "user_message",
      project_id: projectId,
      sender: "user",
      text: inputText,
      timestamp: new Date().toISOString(),
    });

    setInputText("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-6 space-y-4 max-w-[1500px] mx-auto">
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
                Agent Live Console & Governance
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
                {wsConnected ? "Live Log Streaming" : "WS Reconnecting..."}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {project?.requirement || "Real-time communication, handoffs, and human approval gates."}
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
            Workflow Graph
          </Link>
          <Link
            href={`/tasks/${projectId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            Task Backlog
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between animate-in fade-in-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Message Stream Container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 rounded-xl border border-border bg-card/40 backdrop-blur-md space-y-4 shadow-inner min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 py-20">
            <Terminal className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-semibold text-foreground">Awaiting Agent Communications</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                As autonomous agents execute tasks in LangGraph, their messages, handoffs, and approval requests will appear here live.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isApprovalRequest =
              msg.type === "approval" ||
              msg.type === "approval_request" ||
              Boolean(msg.payload?.task_id && msg.type.includes("approval"));
            const taskId = msg.payload?.task_id || `gate-${index}`;

            return (
              <div
                key={msg.id || index}
                className={`p-4 rounded-xl border transition-all ${
                  isApprovalRequest
                    ? "border-amber-500/40 bg-amber-950/20 ring-1 ring-amber-500/30"
                    : msg.sender.toLowerCase().includes("user")
                    ? "border-primary/40 bg-primary/5 ml-auto max-w-2xl"
                    : "border-border/80 bg-card/90 max-w-3xl"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
                      {getSenderIcon(msg.sender)}
                    </div>
                    {getSenderBadge(msg.sender)}
                    {msg.receiver && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                        <ArrowRight className="w-3 h-3" />
                        {msg.receiver}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Text / Summary */}
                <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {msg.text || msg.summary || msg.content || "Agent state execution update."}
                </div>

                {/* Questions & Risks */}
                {msg.payload?.questions && msg.payload.questions.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-background/50 border border-border text-xs space-y-1">
                    <div className="text-[10px] font-semibold uppercase text-amber-400 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> Clarification Questions
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                      {msg.payload.questions.map((q, qIdx) => (
                        <li key={qIdx} className="text-foreground/90">{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {msg.payload?.risks && msg.payload.risks.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs space-y-1">
                    <div className="text-[10px] font-semibold uppercase text-destructive flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Identified Risks
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-destructive/90">
                      {msg.payload.risks.map((r, rIdx) => (
                        <li key={rIdx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Artifact Previews */}
                {msg.payload?.artifacts && Object.keys(msg.payload.artifacts).length > 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-background/50 border border-border/80 text-xs space-y-2">
                    <div className="text-[10px] font-semibold uppercase text-blue-400 flex items-center gap-1">
                      <FileCode className="w-3 h-3" /> Attached Artifacts
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(msg.payload.artifacts).map(([k, v]) => (
                        <div key={k} className="p-2 rounded bg-card/60 border border-border/50">
                          <span className="font-mono font-semibold text-[11px] text-foreground">{k}:</span>
                          <pre className="text-[10px] font-mono text-muted-foreground mt-1 max-h-28 overflow-x-auto">
                            {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approval Card Decision Controls */}
                {isApprovalRequest && (
                  <div className="mt-4 pt-3 border-t border-amber-500/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Human Gate Approval Required
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder="Optional feedback note / instructions for agents..."
                      value={actionReason[taskId] || ""}
                      onChange={(e) =>
                        setActionReason((prev) => ({ ...prev, [taskId]: e.target.value }))
                      }
                      className="w-full text-xs rounded-lg border border-input bg-background/60 px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleDecision(taskId, "approve")}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecision(taskId, "reject")}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleDecision(taskId, "escalate")}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Escalate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Message Form */}
      <form onSubmit={handleSendMessage} className="shrink-0 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send guidance, feedback, or command to agent organization..."
          className="flex-1 rounded-xl border border-input bg-card/80 backdrop-blur px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </form>
    </div>
  );
}
