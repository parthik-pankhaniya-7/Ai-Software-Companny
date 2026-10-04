"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ObservabilityRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ai-ops");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm">Loading AI operations telemetry...</p>
    </div>
  );
}
