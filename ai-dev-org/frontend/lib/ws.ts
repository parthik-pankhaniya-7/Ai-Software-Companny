/**
 * Type-safe WebSocket client wrapper for real-time agent execution streaming.
 */

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WebSocketMessageHandler = (data: any) => void;

/**
 * Connect to project WebSocket stream and listen for execution events.
 * Handles automatic exponential backoff reconnection and returns cleanup function.
 */
export function connectProject(
  projectId: string,
  onEvent: (event: any) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let socket: WebSocket | null = null;
  let isClosed = false;
  let attempt = 0;
  let reconnectTimer: NodeJS.Timeout | null = null;

  function connect() {
    if (isClosed) return;
    const cleanId = projectId.replace(/^projects\//, "").replace(/^\//, "");
    const base = WS_BASE_URL.replace(/\/$/, "");
    const url = `${base}/ws/projects/${cleanId}`;

    socket = new WebSocket(url);

    socket.onopen = () => {
      attempt = 0;
    };

    socket.onmessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(data);
      } catch {
        onEvent(e.data);
      }
    };

    socket.onclose = () => {
      if (!isClosed) {
        attempt += 1;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        reconnectTimer = setTimeout(connect, delay);
      }
    };

    socket.onerror = () => {
      socket?.close();
    };
  }

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) {
      socket.close();
      socket = null;
    }
  };
}

export class RealtimeClient {
  private cleanup: () => void;

  constructor(projectId: string, onMessage: WebSocketMessageHandler) {
    this.cleanup = connectProject(projectId, onMessage);
  }

  public send(_data: unknown): void {}

  public disconnect(): void {
    this.cleanup();
  }
}

export function createWebSocketConnection(
  projectId: string,
  onMessage: WebSocketMessageHandler
): RealtimeClient {
  return new RealtimeClient(projectId, onMessage);
}
