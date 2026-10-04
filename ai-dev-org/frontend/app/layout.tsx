import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import {
  Activity,
  Bot,
  Boxes,
  Cpu,
  FileCode,
  FolderGit2,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ai-dev-org | Multi-Agent AI Development Organization",
  description: "Local-first multi-agent AI software development environment powered by Gemini API.",
};

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Agent Graph", href: "/graph", icon: Cpu },
  { label: "Tasks & Backlog", href: "/tasks", icon: Layers },
  { label: "Chat & Governance", href: "/chat", icon: MessageSquare },
  { label: "Artifacts", href: "/artifacts", icon: FileCode },
  { label: "Memory & Vectors", href: "/memory", icon: Boxes },
  { label: "AI Ops & Metrics", href: "/ai-ops", icon: Activity },
  { label: "Git & Shell Tools", href: "/tools", icon: FolderGit2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground flex`}>
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-md flex flex-col justify-between shrink-0 h-screen sticky top-0">
          <div>
            {/* Brand Header */}
            <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
              <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs">
                AI
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight leading-none">ai-dev-org</h1>
                <p className="text-xs text-muted-foreground mt-1">Multi-Agent Studio</p>
              </div>
            </div>

            {/* Nav Items */}
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Status */}
          <div className="p-4 border-t border-border bg-card/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Local Single-Process</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
