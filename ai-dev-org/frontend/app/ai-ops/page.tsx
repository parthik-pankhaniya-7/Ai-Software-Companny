"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  DollarSign,
  FileText,
  Filter,
  Flame,
  Layers,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";

export interface LogRecord {
  timestamp: string;
  project_id: string;
  agent: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency: number;
  status?: string;
  retries?: number;
  task_type?: string;
  error?: string;
  success?: boolean;
}

const PALETTE = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#8b5cf6", // purple-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f43f5e", // rose-500
];

/**
 * Pure SVG Pie Chart component without third-party dependencies.
 */
function SvgPieChart({
  data,
}: {
  data: { label: string; value: number; color: string; percentage: number }[];
}) {
  let accumulatedAngle = 0;

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs">
        <PieChartIcon className="w-8 h-8 opacity-40 mb-2" />
        <span>No routing trace data available</span>
      </div>
    );
  }

  const slices = data.map((item) => {
    const angle = (item.percentage / 100) * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    // Convert angles to SVG arc paths
    const x1 = 100 + 80 * Math.cos((Math.PI * (startAngle - 90)) / 180);
    const y1 = 100 + 80 * Math.sin((Math.PI * (startAngle - 90)) / 180);
    const x2 = 100 + 80 * Math.cos((Math.PI * (endAngle - 90)) / 180);
    const y2 = 100 + 80 * Math.sin((Math.PI * (endAngle - 90)) / 180);
    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData =
      item.percentage >= 99.9
        ? "M 100 20 A 80 80 0 1 1 99.99 20 Z"
        : `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    return {
      ...item,
      pathData,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
      {/* SVG Donut / Pie */}
      <div className="relative w-48 h-48 shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-0">
          {slices.map((slice, idx) => (
            <path
              key={idx}
              d={slice.pathData}
              fill={slice.color}
              className="hover:opacity-85 transition-opacity cursor-pointer stroke-background stroke-2"
            />
          ))}
          {/* Inner cutout for Donut effect */}
          <circle cx="100" cy="100" r="45" fill="hsl(var(--card))" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Models
          </span>
          <span className="text-xs font-bold text-foreground font-mono">
            {data.length} Total
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-[200px]">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2 truncate">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-mono truncate text-foreground/90">{item.label}</span>
            </div>
            <span className="font-mono font-semibold text-muted-foreground shrink-0">
              {item.percentage.toFixed(1)}% ({item.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiOpsDashboard() {
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  // Fetch logs from backend GET /logs
  const { data: logs, isLoading, isError, error, refetch, isRefetching } = useQuery<LogRecord[]>({
    queryKey: ["logs"],
    queryFn: () => api.get<LogRecord[]>("/logs"),
    refetchInterval: 5000,
  });

  const logRecords = useMemo(() => logs || [], [logs]);

  // Unique models & agents for filtering
  const uniqueModels = useMemo(() => {
    const set = new Set<string>();
    logRecords.forEach((l) => {
      if (l.model) set.add(l.model);
    });
    return Array.from(set);
  }, [logRecords]);

  const uniqueAgents = useMemo(() => {
    const set = new Set<string>();
    logRecords.forEach((l) => {
      if (l.agent) set.add(l.agent);
    });
    return Array.from(set);
  }, [logRecords]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logRecords.filter((l) => {
      if (selectedModel !== "all" && l.model !== selectedModel) return false;
      if (selectedAgent !== "all" && l.agent !== selectedAgent) return false;
      return true;
    });
  }, [logRecords, selectedModel, selectedAgent]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalLatency = 0;
    let failuresCount = 0;
    let retriesCount = 0;

    const modelTokens: Record<string, { prompt: number; completion: number; total: number; calls: number }> = {};
    const routingCounts: Record<string, number> = {};

    logRecords.forEach((l) => {
      const p = l.tokens_in || 0;
      const c = l.tokens_out || 0;
      const tot = p + c;

      totalPrompt += p;
      totalCompletion += c;
      totalLatency += l.latency || 0;

      const modelKey = l.model || "gemini/gemini-1.5-pro";
      if (!modelTokens[modelKey]) {
        modelTokens[modelKey] = { prompt: 0, completion: 0, total: 0, calls: 0 };
      }
      modelTokens[modelKey].prompt += p;
      modelTokens[modelKey].completion += c;
      modelTokens[modelKey].total += tot;
      modelTokens[modelKey].calls += 1;

      routingCounts[modelKey] = (routingCounts[modelKey] || 0) + 1;

      if (l.status === "failed" || l.status === "error" || l.error || l.success === false) {
        failuresCount += 1;
      }
      if ((l.retries && l.retries > 0) || l.status === "retry") {
        retriesCount += l.retries || 1;
      }
    });

    const totalCalls = logRecords.length || 1;
    const avgLatency = (totalLatency / totalCalls).toFixed(2);
    const successRate = logRecords.length > 0
      ? (((logRecords.length - failuresCount) / logRecords.length) * 100).toFixed(1)
      : "100.0";

    // Format Pie chart data
    const pieData = Object.entries(routingCounts).map(([model, count], idx) => ({
      label: model.replace(/^gemini\//, ""),
      value: count,
      color: PALETTE[idx % PALETTE.length],
      percentage: (count / totalCalls) * 100,
    }));

    return {
      totalTokens: totalPrompt + totalCompletion,
      totalPrompt,
      totalCompletion,
      avgLatency,
      failuresCount,
      retriesCount,
      successRate,
      modelTokens,
      pieData,
    };
  }, [logRecords]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Operations & Observability</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live JSONL Observability
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Token telemetry, Gemini model routing breakdown, latency diagnostics, and retry analytics.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-border bg-card hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin text-primary" : ""}`} />
          <span>Refresh Traces</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Reading observability traces from ./logs/langfuse.jsonl...</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to read observability logs</p>
            <p className="text-xs mt-1">{(error as Error)?.message || "Failed to fetch from backend GET /logs."}</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Tokens */}
            <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-3">
                <span className="text-xs font-medium uppercase tracking-wider">Total Tokens</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {metrics.totalTokens.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-1">
                  {metrics.totalPrompt.toLocaleString()} in / {metrics.totalCompletion.toLocaleString()} out
                </div>
              </div>
            </div>

            {/* Success & Retries */}
            <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-3">
                <span className="text-xs font-medium uppercase tracking-wider">Success Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {metrics.successRate}%
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-1 flex items-center gap-2">
                  <span className="text-amber-400">{metrics.retriesCount} Retries</span>
                  <span>•</span>
                  <span className="text-rose-400">{metrics.failuresCount} Failures</span>
                </div>
              </div>
            </div>

            {/* Latency */}
            <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-3">
                <span className="text-xs font-medium uppercase tracking-wider">Avg Latency</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {metrics.avgLatency}s
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Per agent call execution
                </div>
              </div>
            </div>

            {/* Cost (Gemini Free Tier) */}
            <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-3">
                <span className="text-xs font-medium uppercase tracking-wider">Operating Cost</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  $0.00
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Gemini API Free Tier (0.00 cost)
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row: Model Tokens Breakdown + Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Tokens per Model */}
            <div className="lg:col-span-7 rounded-xl border border-border bg-card/60 backdrop-blur-md p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">Tokens Used per Model</h2>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {Object.keys(metrics.modelTokens).length} Active Models
                </span>
              </div>

              {Object.keys(metrics.modelTokens).length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-10 text-center">
                  No model token traces recorded yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(metrics.modelTokens).map(([model, data]) => {
                    const percentOfTotal =
                      metrics.totalTokens > 0 ? (data.total / metrics.totalTokens) * 100 : 0;

                    return (
                      <div key={model} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-foreground truncate max-w-[260px]">
                            {model}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {data.total.toLocaleString()} tokens ({data.calls} calls)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(percentOfTotal, 4)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <span>In: {data.prompt.toLocaleString()}</span>
                          <span>Out: {data.completion.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Routing Breakdown Pie Chart */}
            <div className="lg:col-span-5 rounded-xl border border-border bg-card/60 backdrop-blur-md p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <PieChartIcon className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Routing Breakdown</h2>
              </div>

              <div className="my-auto py-2">
                <SvgPieChart data={metrics.pieData} />
              </div>

              <div className="pt-3 border-t border-border/50 text-center">
                <p className="text-[11px] text-muted-foreground">
                  Adaptive routing between Pro and Flash models via router policy.
                </p>
              </div>
            </div>
          </div>

          {/* Trace Log Inspector Table */}
          <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md shadow-sm overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Trace Execution Log</h2>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                  {filteredLogs.length} Records
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Model Filter */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter className="w-3.5 h-3.5" />
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="rounded-lg border border-input bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Models</option>
                    {uniqueModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Agent Filter */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Bot className="w-3.5 h-3.5" />
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="rounded-lg border border-input bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Agents</option>
                    {uniqueAgents.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-mono text-[11px] border-b border-border sticky top-0 backdrop-blur">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Project</th>
                    <th className="p-3">Agent</th>
                    <th className="p-3">Model</th>
                    <th className="p-3 text-right">Tokens In</th>
                    <th className="p-3 text-right">Tokens Out</th>
                    <th className="p-3 text-right">Latency</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground italic font-sans">
                        No observability records matching active filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.slice().reverse().map((log, idx) => {
                      const isFailure =
                        log.status === "failed" || log.status === "error" || log.error || log.success === false;
                      const isRetry = (log.retries && log.retries > 0) || log.status === "retry";

                      return (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-muted-foreground text-[11px] whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-foreground truncate max-w-[120px]">
                            {log.project_id || "default"}
                          </td>
                          <td className="p-3 text-foreground font-sans capitalize font-medium">
                            {log.agent}
                          </td>
                          <td className="p-3 text-muted-foreground text-[11px] truncate max-w-[180px]">
                            {log.model}
                          </td>
                          <td className="p-3 text-right text-foreground">
                            {log.tokens_in?.toLocaleString() || 0}
                          </td>
                          <td className="p-3 text-right text-foreground">
                            {log.tokens_out?.toLocaleString() || 0}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {log.latency ? `${log.latency.toFixed(2)}s` : "0.0s"}
                          </td>
                          <td className="p-3 text-center">
                            {isFailure ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Failed
                              </span>
                            ) : isRetry ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Retry ({log.retries})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
