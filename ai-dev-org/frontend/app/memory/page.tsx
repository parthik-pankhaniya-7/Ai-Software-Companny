"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Boxes, Database, Search, Sparkles, RefreshCw, Filter, Layers } from "lucide-react";

interface MemoryEntry {
  project_id?: string;
  kind?: string;
  ref_id?: string;
  content?: string;
  created_at?: string;
  [key: string]: unknown;
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKind, setSelectedKind] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<MemoryEntry[]>("/memory");
      setMemories(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memory store");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const filteredMemories = memories.filter((item) => {
    const content = (item.content || "").toLowerCase();
    const refId = (item.ref_id || "").toLowerCase();
    const projId = (item.project_id || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = content.includes(query) || refId.includes(query) || projId.includes(query);
    const matchesKind = selectedKind === "all" || (item.kind || "").toLowerCase() === selectedKind.toLowerCase();
    return matchesSearch && matchesKind;
  });

  const availableKinds = Array.from(new Set(memories.map((m) => m.kind || "general"))).filter(Boolean);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            Memory & Vector Store
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Local JSONL episodic logs and ChromaDB vector memory for cross-agent semantic recall.
          </p>
        </div>
        <button
          onClick={fetchMemories}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-lg border border-border transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Memory
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-card/60 border border-border backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Stored Snippets</span>
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{memories.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Atomic ./data/memory/*.jsonl entries</p>
        </div>

        <div className="p-5 rounded-xl bg-card/60 border border-border backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Indexed Kinds</span>
            <Layers className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{availableKinds.length || 1}</div>
          <p className="text-xs text-muted-foreground mt-1">Architecture, patterns, rules & context</p>
        </div>

        <div className="p-5 rounded-xl bg-card/60 border border-border backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ChromaDB Vector Backend</span>
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">Active</div>
          <p className="text-xs text-muted-foreground mt-1">Embedded Cosine Similarity Search</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search memory entries, ref IDs, project names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card/60 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
            className="px-3 py-2 bg-card/60 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Categories</option>
            {availableKinds.map((k) => (
              <option key={k} value={k}>
                {k.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Memory Table / List */}
      <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            Loading local memory records...
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No memory entries found matching the query. Entries are created automatically as agent workflows run.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredMemories.map((entry, idx) => (
              <div key={idx} className="p-4 hover:bg-accent/40 transition-colors">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary border border-primary/20">
                      {entry.kind || "memory"}
                    </span>
                    {entry.ref_id && (
                      <span className="text-xs font-mono text-muted-foreground">
                        #{entry.ref_id}
                      </span>
                    )}
                    {entry.project_id && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {entry.project_id}
                      </span>
                    )}
                  </div>
                  {entry.created_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/90 font-mono bg-background/50 p-3 rounded-lg border border-border/40 whitespace-pre-wrap">
                  {entry.content || JSON.stringify(entry)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
