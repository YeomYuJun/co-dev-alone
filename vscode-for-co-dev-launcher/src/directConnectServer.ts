import * as http from 'http';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SessionStatus = 'pending' | 'active' | 'done';

export interface SessionHandle {
  id: string;
  wsUrl: string;
  roleName: string;
  ws: WebSocket | null;
  status: SessionStatus;
  outputChannel: vscode.OutputChannel;
  startedAt: Date;
}

export interface ControlRequest {
  id: string;
  /** 요청 유형 (permission, confirmation 등) */
  type: string;
  /** 도구 이름 또는 동작 설명 */
  tool?: string;
  /** 요청 원문 — 알 수 없는 필드 포함 보존 */
  raw: Record<string, unknown>;
}

/** WebView 패널 등이 구독하는 서버 이벤트 */
export interface DirectConnectServerEvents {
  /** 세션 상태 변경 (pending → active → done) */
  'session:status': (sessionId: string, status: SessionStatus) => void;
  /** stream-json 메시지 수신 */
  'session:message': (sessionId: string, msg: Record<string, unknown>) => void;
  /** 새 세션 생성 */
  'session:created': (handle: SessionHandle) => void;
  /** claude 권한 요청 */
  'session:control-request': (sessionId: string, req: ControlRequest) => void;
}

// ─── DirectConnectServer ─────────────────────────────────────────────────────

export class DirectConnectServer extends EventEmitter {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private sessions = new Map<string, SessionHandle>();
  private port = 0;

  constructor() {
    super();
    this.httpServer = http.createServer();
    this.wss = new WebSocketServer({ noServer: true });
    this._setupUpgradeHandler();
    this._setupConnectionHandler();
  }

  // ── Typed emit / on wrappers ───────────────────────────────────────────────

  on<K extends keyof DirectConnectServerEvents>(
    event: K,
    listener: DirectConnectServerEvents[K],
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof DirectConnectServerEvents>(
    event: K,
    listener: DirectConnectServerEvents[K],
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  /** control_request에 대한 응답 전송 */
  respondToControl(sessionId: string, requestId: string, decision: 'allow' | 'deny'): void {
    // flat 구조로 전송 (nested response 객체 대신)
    this.sendToSession(sessionId, {
      type: 'control_response',
      id: requestId,
      decision,
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.listen(0, '127.0.0.1', () => {
        const addr = this.httpServer.address() as { port: number };
        this.port = addr.port;
        resolve(this.port);
      });
    });
  }

  stop(): void {
    for (const handle of this.sessions.values()) {
      handle.ws?.close();
      handle.outputChannel.dispose();
    }
    this.sessions.clear();
    this.wss.close();
    this.httpServer.close();
    this.removeAllListeners();
  }

  // ── Session management ─────────────────────────────────────────────────────

  createSession(sessionId: string, roleName: string): SessionHandle {
    // 동일 ID 충돌 방지: 기존 세션이 있으면 -2, -3 ... suffix 추가
    let resolvedId = sessionId;
    let suffix = 2;
    while (this.sessions.has(resolvedId)) {
      resolvedId = `${sessionId}-${suffix++}`;
    }

    const wsUrl = `ws://127.0.0.1:${this.port}/sessions/${resolvedId}`;
    const outputChannel = vscode.window.createOutputChannel(`Co-Dev [${roleName}]`);

    const handle: SessionHandle = {
      id: resolvedId,
      wsUrl,
      roleName,
      ws: null,
      status: 'pending',
      outputChannel,
      startedAt: new Date(),
    };

    this.sessions.set(resolvedId, handle);
    outputChannel.show(true);
    this.emit('session:created', handle);
    return handle;
  }

  getSession(id: string): SessionHandle | undefined {
    return this.sessions.get(id);
  }

  getSessions(): SessionHandle[] {
    return [...this.sessions.values()];
  }

  sendToSession(sessionId: string, message: unknown): boolean {
    const handle = this.sessions.get(sessionId);
    if (!handle || handle.ws?.readyState !== WebSocket.OPEN) {
      return false;
    }
    handle.ws.send(JSON.stringify(message) + '\n');  // stream-json: line-delimited
    return true;
  }

  // ── WebSocket setup ────────────────────────────────────────────────────────

  private _setupUpgradeHandler(): void {
    this.httpServer.on('upgrade', (req, socket, head) => {
      console.log(`[Co-Dev] WS upgrade: ${req.url}`);
      const match = req.url?.match(/^\/sessions\/([^/]+)$/);
      if (!match) {
        console.log(`[Co-Dev] WS upgrade rejected: no session match for ${req.url}`);
        socket.destroy();
        return;
      }
      const sessionId = decodeURIComponent(match[1]);
      if (!this.sessions.has(sessionId)) {
        console.log(`[Co-Dev] WS upgrade rejected: session '${sessionId}' not found`);
        socket.destroy();
        return;
      }
      console.log(`[Co-Dev] WS upgrade accepted: session '${sessionId}'`);
      this.wss.handleUpgrade(req, socket as import('net').Socket, head, (ws) => {
        this.wss.emit('connection', ws, sessionId);
      });
    });
  }

  private _setupConnectionHandler(): void {
    this.wss.on('connection', (ws: WebSocket, sessionId: string) => {
      const handle = this.sessions.get(sessionId);
      if (!handle) {
        ws.close();
        return;
      }

      handle.ws = ws;
      this._setStatus(handle, 'active');

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          this._handleMessage(handle, msg);
          this.emit('session:message', sessionId, msg);
        } catch {
          // non-JSON 무시
        }
      });

      ws.on('close', () => {
        handle.ws = null;
        this._setStatus(handle, 'done');
        handle.outputChannel.appendLine('\n[Session ended]');
      });

      ws.on('error', (err) => {
        handle.outputChannel.appendLine(`[WS error] ${err.message}`);
      });
    });
  }

  // ── Message handling ───────────────────────────────────────────────────────

  private _handleMessage(handle: SessionHandle, msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'control_request': {
        // 실제 구조 확인용 로그
        handle.outputChannel.appendLine(`[control_request] ${JSON.stringify(msg)}`);
        // ID는 여러 위치에 있을 수 있음
        const inner = (msg.request ?? msg) as Record<string, unknown>;
        const id = String(
          msg.id ?? msg.request_id ??
          inner.id ?? inner.request_id ?? ''
        );
        const req: ControlRequest = {
          id,
          type: String(inner.type ?? msg.type ?? 'permission'),
          tool: (inner.tool ?? msg.tool) ? String(inner.tool ?? msg.tool) : undefined,
          raw: msg,
        };
        handle.outputChannel.appendLine(`[Permission request] id=${id} type=${req.type}${req.tool ? ` tool=${req.tool}` : ''}`);
        this.emit('session:control-request', handle.id, req);
        break;
      }
      case 'system': {
        if (msg.subtype === 'init') {
          handle.outputChannel.appendLine('[Session initialized]');
        }
        break;
      }
      case 'assistant': {
        const message = msg.message as Record<string, unknown> | undefined;
        const content = message?.content as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && typeof block.text === 'string') {
              handle.outputChannel.append(block.text);
            } else if (block.type === 'tool_use' && typeof block.name === 'string') {
              handle.outputChannel.appendLine(`\n[tool] ${block.name}`);
            }
          }
        }
        break;
      }
      case 'result': {
        const subtype = msg.subtype as string | undefined;
        if (subtype === 'error_max_turns' || subtype === 'error') {
          handle.outputChannel.appendLine(`\n[Error] ${msg.error ?? subtype}`);
        }
        break;
      }
    }
  }

  private _setStatus(handle: SessionHandle, status: SessionStatus): void {
    handle.status = status;
    this.emit('session:status', handle.id, status);
  }
}
