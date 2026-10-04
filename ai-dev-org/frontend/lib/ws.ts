/**
 * Type-safe WebSocket client wrapper for real-time agent execution streaming.
 */

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WebSocketMessageHandler = (data: unknown) => void;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private projectId: string;
  private onMessageCallback: WebSocketMessageHandler;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isExplicitlyClosed = false;

  constructor(projectId: string, onMessage: WebSocketMessageHandler) {
    this.projectId = projectId;
    this.onMessageCallback = onMessage;
    this.connect();
  }

  private connect(): void {
    if (typeof window === "undefined") return;

    const cleanId = this.projectId.replace(/^projects\//, "").replace(/^\//, "");
    const url = `${WS_BASE_URL.replace(/\/$/, "")}/ws/projects/${cleanId}`;
    this.socket = new WebSocket(url);

    this.socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as unknown;
        this.onMessageCallback(parsed);
      } catch {
        this.onMessageCallback(event.data);
      }
    };

    this.socket.onclose = () => {
      if (!this.isExplicitlyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts += 1;
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
        setTimeout(() => this.connect(), delay);
      }
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  public send(data: unknown): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export function createWebSocketConnection(
  projectId: string,
  onMessage: WebSocketMessageHandler
): RealtimeClient {
  return new RealtimeClient(projectId, onMessage);
}
