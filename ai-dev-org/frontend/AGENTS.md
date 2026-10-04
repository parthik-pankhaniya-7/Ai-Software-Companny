# AGENTS.md — frontend/

Inherit /AGENTS.md.

## Stack
Next.js 14 App Router, TypeScript strict, Tailwind, shadcn/ui,
TanStack Query, Zustand, React Flow, Lucide React.

## Rules
1. Function components only.
2. No any. No @ts-ignore.
3. All API calls through lib/api.ts.
4. All WebSocket calls through lib/ws.ts.
5. Tailwind classes only. No inline styles.
6. No new dependency without approval.
7. "use client" only when hooks are needed.
8. Backend URL from NEXT_PUBLIC_API_URL.
9. WS URL from NEXT_PUBLIC_WS_URL.

## Forbidden
axios, styled-components, emotion, redux, moment.js,
any UI library other than shadcn/ui.
