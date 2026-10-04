"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Sparkles,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

type TabKey = "brd" | "frd" | "architecture" | "code" | "tests";

interface TabConfig {
  key: TabKey;
  label: string;
  icon: typeof FileText;
  agentOwner: string;
  description: string;
}

interface ProjectDetail {
  id: string;
  requirement: string;
  status: string;
  phase: string;
  artifacts?: {
    brd?: string | Record<string, unknown>;
    frd?: string | Record<string, unknown>;
    architecture?: string | Record<string, unknown>;
    code?: string | Record<string, unknown> | Array<Record<string, unknown>>;
    tests?: string | Record<string, unknown> | Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

const TABS: TabConfig[] = [
  {
    key: "brd",
    label: "BRD",
    icon: BookOpen,
    agentOwner: "CTO / PM",
    description: "Business Requirements Document & Strategic Goals",
  },
  {
    key: "frd",
    label: "FRD",
    icon: FileSpreadsheet,
    agentOwner: "CTO / PM",
    description: "Functional Specifications & User Capabilities",
  },
  {
    key: "architecture",
    label: "Architecture",
    icon: Cpu,
    agentOwner: "CTO",
    description: "System Design, Component Boundaries & Governance",
  },
  {
    key: "code",
    label: "Code",
    icon: Code2,
    agentOwner: "Full-Stack Developer",
    description: "Implemented Source Code & Module Definitions",
  },
  {
    key: "tests",
    label: "Tests",
    icon: Terminal,
    agentOwner: "QA Engineer / Dev",
    description: "Unit, Integration & Acceptance Test Suites",
  },
];

/**
 * Lightweight native Markdown & Structure renderer.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-3 font-sans text-xs leading-relaxed text-foreground/90">
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-sm font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/40">
              {line.replace("### ", "")}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-base font-bold text-foreground mt-5 mb-2 pb-1 border-b border-border">
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={idx} className="text-lg font-bold text-foreground mt-6 mb-3 pb-1 border-b border-border">
              {line.replace("# ", "")}
            </h1>
          );
        }

        // Blockquotes
        if (line.startsWith("> ")) {
          return (
            <blockquote key={idx} className="pl-3 border-l-2 border-primary/60 text-muted-foreground italic my-2">
              {line.replace("> ", "")}
            </blockquote>
          );
        }

        // Unordered lists
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-primary mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span>{line.replace(/^[-*]\s+/, "")}</span>
            </div>
          );
        }

        // Ordered lists
        const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (orderedMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 font-mono">
              <span className="text-primary text-[11px] font-semibold shrink-0">{orderedMatch[1]}.</span>
              <span className="font-sans text-xs">{orderedMatch[2]}</span>
            </div>
          );
        }

        // Code fence or empty lines
        if (line.trim() === "") {
          return <div key={idx} className="h-1.5" />;
        }

        return (
          <p key={idx} className="leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Code Viewer component with line numbering, syntax headers, and clipboard copy.
 */
function CodeViewer({ code, language = "plaintext", filename }: { code: string; language?: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");

  return (
    <div className="rounded-xl border border-border bg-slate-950 overflow-hidden shadow-md">
      {/* Code Header */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          {filename && <span className="font-mono text-xs font-semibold text-foreground ml-2">{filename}</span>}
          <span className="font-mono text-[10px] text-muted-foreground uppercase bg-slate-800 px-2 py-0.5 rounded">
            {language}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy Code"}</span>
        </button>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="p-4 overflow-x-auto font-mono text-xs leading-relaxed max-h-[600px]">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-900/60">
                <td className="w-10 select-none text-right pr-4 text-slate-600 text-[11px] font-mono align-top">
                  {idx + 1}
                </td>
                <td className="text-slate-200 whitespace-pre font-mono align-top">
                  {line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ArtifactsPage() {
  const params = useParams();
  const projectId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const [activeTab, setActiveTab] = useState<TabKey>("brd");

  // Fetch project detail
  const { data: project, isLoading, isError, error } = useQuery<ProjectDetail>({
    queryKey: ["project", projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });

  const activeTabConfig = useMemo(
    () => TABS.find((t) => t.key === activeTab) || TABS[0],
    [activeTab]
  );

  const rawArtifact = project?.artifacts?.[activeTab];

  const formattedContent = useMemo(() => {
    if (!rawArtifact) return null;
    if (typeof rawArtifact === "string") return rawArtifact;
    return JSON.stringify(rawArtifact, null, 2);
  }, [rawArtifact]);

  const isCodeOrTest = activeTab === "code" || activeTab === "tests";

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-6 space-y-6 max-w-[1600px] mx-auto overflow-hidden">
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
                Project Artifacts Explorer
              </h1>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                {projectId}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {project?.requirement || "Synthesized requirements, architecture, source code, and verified tests."}
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

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading project artifacts from store...</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to load artifacts</p>
            <p className="text-xs mt-1">{(error as Error)?.message || "Failed to fetch from backend."}</p>
          </div>
        </div>
      )}

      {/* Content Area */}
      {!isLoading && !isError && (
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          {/* Tabs Navigation Sidebar */}
          <div className="w-full md:w-64 flex md:flex-col gap-2 shrink-0 overflow-x-auto md:overflow-visible">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const hasContent = Boolean(project?.artifacts?.[tab.key]);

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <div className="text-xs font-bold leading-none">{tab.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">{tab.agentOwner}</div>
                    </div>
                  </div>

                  {hasContent ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ml-2" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Viewer Area */}
          <div className="flex-1 flex flex-col rounded-xl border border-border bg-card/40 backdrop-blur-md overflow-hidden min-h-0 shadow-inner">
            {/* Viewer Header */}
            <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">{activeTabConfig.label} Artifact</h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border">
                    Owner: {activeTabConfig.agentOwner}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{activeTabConfig.description}</p>
              </div>

              {formattedContent && (
                <button
                  onClick={() => {
                    const blob = new Blob([formattedContent], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${projectId}-${activeTabConfig.key}.${isCodeOrTest ? "py" : "md"}`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Artifact
                </button>
              )}
            </div>

            {/* Viewer Body */}
            <div className="flex-1 p-6 overflow-y-auto min-h-0">
              {!formattedContent ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 py-16">
                  <FileCode className="w-10 h-10 text-muted-foreground/30" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">No {activeTabConfig.label} Generated Yet</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      This artifact will be generated when the corresponding agent ({activeTabConfig.agentOwner}) executes in the LangGraph workflow.
                    </p>
                  </div>
                </div>
              ) : isCodeOrTest ? (
                <CodeViewer
                  code={formattedContent}
                  language={activeTab === "code" ? "python" : "pytest"}
                  filename={`${projectId}_${activeTab}.${activeTab === "code" ? "py" : "py"}`}
                />
              ) : (
                <div className="p-6 rounded-xl border border-border bg-card/80 max-w-4xl shadow-sm">
                  <MarkdownRenderer content={formattedContent} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
