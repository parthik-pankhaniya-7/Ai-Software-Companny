"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { FolderGit2, Terminal, ShieldCheck, AlertTriangle, RefreshCw, GitBranch, CheckCircle2, Clock } from "lucide-react";

interface ToolsData {
  git: {
    branch: string;
    status: string;
    safe_mode: boolean;
    forbidden_commands: string[];
  };
  shell: {
    allowlist: string[];
    timeout_seconds: number;
    status: string;
  };
}

export default function ToolsPage() {
  const [data, setData] = useState<ToolsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToolsStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ToolsData>("/tools");
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tools status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolsStatus();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderGit2 className="h-6 w-6 text-primary" />
            Git & Shell Tools Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Local execution sandbox with strict command allowlisting, timeout guards, and Git branch protection.
          </p>
        </div>
        <button
          onClick={fetchToolsStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-lg border border-border transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </button>
      </div>

      {error ? (
        <div className="p-6 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          Inspecting local git and shell sandbox...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Git Tool Guard */}
          <div className="p-6 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Git Repository Sandbox</h2>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                Safe Mode Enforced
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-background/50 border border-border/40 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Active Git Branch</span>
                <span className="text-sm font-mono font-semibold text-foreground px-2 py-0.5 rounded bg-muted">
                  {data?.git.branch || "main"}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-background/50 border border-border/40 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Working Tree Status</span>
                <span className="text-sm font-medium text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {data?.git.status || "clean"}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                <div className="flex items-center gap-2 text-destructive text-xs font-semibold uppercase tracking-wider">
                  <AlertTriangle className="h-4 w-4" />
                  Hard Forbidden Commands
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data?.git.forbidden_commands.map((cmd) => (
                    <span key={cmd} className="text-xs font-mono px-2 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">
                      git {cmd}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Agents can never auto-push, force-push, or hard-reset the user&apos;s repository.
                </p>
              </div>
            </div>
          </div>

          {/* Shell Tool Guard */}
          <div className="p-6 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Shell Tool Execution Allowlist</h2>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Clock className="h-3.5 w-3.5" />
                {data?.shell.timeout_seconds || 30}s Timeout Limit
              </span>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Only explicitly allowlisted CLI binaries are permitted for execution by QA and Developer agents:
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data?.shell.allowlist.map((bin) => (
                  <div
                    key={bin}
                    className="p-3 rounded-lg bg-background/50 border border-border/40 flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm font-mono font-medium text-foreground">{bin}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border border-border/40 space-y-2 mt-4">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Security Invariants</h3>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Zero arbitrary shell string interpolation or pipeline execution</li>
                  <li>All child processes run with timeouts enforced via <code>subprocess.run</code></li>
                  <li>Execution is scoped strictly to the local workspace folder</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
