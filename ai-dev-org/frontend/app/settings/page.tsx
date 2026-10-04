"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  FolderGit2,
  HardDrive,
  Info,
  KeyRound,
  Layers,
  Lock,
  Radio,
  Save,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

export interface ApprovalGatesState {
  requireCtoSignoff: boolean;
  requirePmMilestoneReview: boolean;
  requireQaFailureEscalation: boolean;
  requireBudgetOverrideApproval: boolean;
  autoApproveCodeReview: boolean;
}

const DEFAULT_GATES: ApprovalGatesState = {
  requireCtoSignoff: true,
  requirePmMilestoneReview: true,
  requireQaFailureEscalation: true,
  requireBudgetOverrideApproval: false,
  autoApproveCodeReview: false,
};

const STORAGE_KEY = "ai_dev_org_approval_gates";

export default function SettingsPage() {
  const [gates, setGates] = useState<ApprovalGatesState>(DEFAULT_GATES);
  const [isSaved, setIsSaved] = useState(false);
  const [showKeyHint, setShowKeyHint] = useState(false);

  // Load gates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ApprovalGatesState;
        setGates({ ...DEFAULT_GATES, ...parsed });
      }
    } catch {
      // Use defaults if parse fails
    }
  }, []);

  const handleToggle = (key: keyof ApprovalGatesState) => {
    setGates((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      } catch {
        // localStorage not available
      }
      return updated;
    });
  };

  const resetDefaults = () => {
    setGates(DEFAULT_GATES);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GATES));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      // no-op
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">System Settings & Policies</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
              <Lock className="w-3 h-3 text-emerald-400" />
              Local Security Enforced
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Model routing configuration, human-in-the-loop approval gates, and environment policies.
          </p>
        </div>

        {isSaved && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-in fade-in-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settings saved to localStorage</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Section 1: Masked Security & API Credentials */}
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <KeyRound className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Gemini API Credentials (Masked)</h2>
              <p className="text-xs text-muted-foreground">
                Strict Zero-Exposure Policy: Actual API key values are never returned to or rendered in client code.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-border bg-background/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="font-mono text-xs font-semibold text-foreground">GEMINI_API_KEY</span>
                <p className="text-xs text-muted-foreground">
                  Read exclusively by backend from <code className="text-foreground font-mono">.env</code> on server process.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="font-mono text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground border border-border select-none tracking-widest">
                  AIzaSy••••••••••••••••••••••••••••••••
                </div>
                <button
                  onClick={() => setShowKeyHint((prev) => !prev)}
                  className="p-2 rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Toggle security explanation"
                >
                  {showKeyHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showKeyHint && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2.5 animate-in fade-in-0">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Per Root Security Rule #3, raw API credentials are never sent across the REST/WebSocket layer. Backend calls LiteLLM using backend environment variables.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Model Policy Configuration (Read-Only from Env) */}
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <Cpu className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-bold text-foreground">LLM Model Policy Matrix</h2>
              <p className="text-xs text-muted-foreground">
                Configured via backend router mapping with automatic 2-failure fallback to Flash.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl border border-border bg-background/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-sans font-medium text-xs">Reasoning / Complex</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Pro Tier
                </span>
              </div>
              <div className="text-sm font-bold text-foreground">gemini/gemini-1.5-pro</div>
              <p className="text-[11px] font-sans text-muted-foreground">
                Assigned to: CTO (Architecture), PM (Epics), Team Lead (Technical Design), AI Engineer (Evaluation)
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-background/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-sans font-medium text-xs">Coding / Fast Execution</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Flash Tier
                </span>
              </div>
              <div className="text-sm font-bold text-foreground">gemini/gemini-2.0-flash</div>
              <p className="text-[11px] font-sans text-muted-foreground">
                Assigned to: Full-Stack Developer (Implementation), QA Engineer (Test Execution)
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-background/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-sans font-medium text-xs">UI/UX & Documentation</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  Fast Tier
                </span>
              </div>
              <div className="text-sm font-bold text-foreground">gemini/gemini-1.5-flash</div>
              <p className="text-[11px] font-sans text-muted-foreground">
                Assigned to: UI/UX Designer (Wireframes, Components, Tokens)
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-background/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-sans font-medium text-xs">Router Fallback Policy</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Adaptive
                </span>
              </div>
              <div className="text-sm font-bold text-foreground">gemini/gemini-1.5-flash</div>
              <p className="text-[11px] font-sans text-muted-foreground">
                Triggered on 2 consecutive Pro 429/timeout exceptions with exponential backoff
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Human Approval Gates (localStorage toggles) */}
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <div>
                <h2 className="text-sm font-bold text-foreground">Human Governance & Approval Gates</h2>
                <p className="text-xs text-muted-foreground">
                  Control which autonomous handoffs pause for operator approval in <code className="text-foreground">localStorage</code>.
                </p>
              </div>
            </div>

            <button
              onClick={resetDefaults}
              className="text-xs text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="space-y-3">
            {/* Gate 1 */}
            <div
              onClick={() => handleToggle("requireCtoSignoff")}
              className="p-4 rounded-xl border border-border bg-background/50 flex items-center justify-between gap-4 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Require CTO Architectural Approval</span>
                  {gates.requireCtoSignoff && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active Gate
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pause workflow after CTO finishes BRD/FRD to review architectural boundaries before PM epic generation.
                </p>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  gates.requireCtoSignoff ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    gates.requireCtoSignoff ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Gate 2 */}
            <div
              onClick={() => handleToggle("requirePmMilestoneReview")}
              className="p-4 rounded-xl border border-border bg-background/50 flex items-center justify-between gap-4 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Require PM Sprint & Milestone Review</span>
                  {gates.requirePmMilestoneReview && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active Gate
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pause workflow to inspect ticket breakdown and acceptance criteria before technical design starts.
                </p>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  gates.requirePmMilestoneReview ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    gates.requirePmMilestoneReview ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Gate 3 */}
            <div
              onClick={() => handleToggle("requireQaFailureEscalation")}
              className="p-4 rounded-xl border border-border bg-background/50 flex items-center justify-between gap-4 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Escalate QA Test Failures to Operator</span>
                  {gates.requireQaFailureEscalation && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active Gate
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Send high-priority approval card in Chat if QA audits fail after retry attempts exceed thresholds.
                </p>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  gates.requireQaFailureEscalation ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    gates.requireQaFailureEscalation ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Gate 4 */}
            <div
              onClick={() => handleToggle("requireBudgetOverrideApproval")}
              className="p-4 rounded-xl border border-border bg-background/50 flex items-center justify-between gap-4 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Require Approval for Token Budget Overrides (&gt;8k tokens)</span>
                  {gates.requireBudgetOverrideApproval && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active Gate
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Notify operator before running high-complexity reasoning steps with large context prompts.
                </p>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  gates.requireBudgetOverrideApproval ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    gates.requireBudgetOverrideApproval ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: Local Storage & Persistence Environment */}
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <HardDrive className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Local Environment Topology</h2>
              <p className="text-xs text-muted-foreground">
                Runtime pathing and persistent storage paths on local disk.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-lg border border-border bg-background/50 space-y-1">
              <span className="text-muted-foreground font-sans">Data Root</span>
              <div className="text-foreground font-semibold">./data (JSON/JSONL)</div>
            </div>
            <div className="p-3.5 rounded-lg border border-border bg-background/50 space-y-1">
              <span className="text-muted-foreground font-sans">Vector DB</span>
              <div className="text-foreground font-semibold">./data/chroma (Embedded)</div>
            </div>
            <div className="p-3.5 rounded-lg border border-border bg-background/50 space-y-1">
              <span className="text-muted-foreground font-sans">Log Rotation</span>
              <div className="text-foreground font-semibold">./logs/langfuse.jsonl (50MB)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
