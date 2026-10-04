"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useProjectStore } from "@/store/project";

interface ProjectItem {
  id: string;
}

export default function ChatIndexPage() {
  const router = useRouter();
  const { currentProjectId } = useProjectStore();

  const { data: projects } = useQuery<ProjectItem[]>({
    queryKey: ["projects"],
    queryFn: () => api.get<ProjectItem[]>("/projects"),
  });

  useEffect(() => {
    if (currentProjectId) {
      router.replace(`/chat/${currentProjectId}`);
    } else if (projects && projects.length > 0) {
      router.replace(`/chat/${projects[0].id}`);
    }
  }, [currentProjectId, projects, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm">Connecting to active agent console...</p>
    </div>
  );
}
