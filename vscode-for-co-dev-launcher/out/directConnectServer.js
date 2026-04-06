"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectConnectServer = void 0;
const http = __importStar(require("http"));
const vscode = __importStar(require("vscode"));
const events_1 = require("events");
const ws_1 = require("ws");
// ─── DirectConnectServer ─────────────────────────────────────────────────────
class DirectConnectServer extends events_1.EventEmitter {
    constructor() {
        super();
        this.sessions = new Map();
        this.port = 0;
        this.httpServer = http.createServer();
        this.wss = new ws_1.WebSocketServer({ noServer: true });
        this._setupUpgradeHandler();
        this._setupConnectionHandler();
    }
    // ── Typed emit / on wrappers ───────────────────────────────────────────────
    on(event, listener) {
        return super.on(event, listener);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
    /** control_request에 대한 응답 전송 */
    respondToControl(sessionId, requestId, decision) {
        this.sendToSession(sessionId, {
            type: 'control_response',
            response: { id: requestId, decision },
        });
    }
    // ── Lifecycle ──────────────────────────────────────────────────────────────
    start() {
        return new Promise((resolve, reject) => {
            this.httpServer.once('error', reject);
            this.httpServer.listen(0, '127.0.0.1', () => {
                const addr = this.httpServer.address();
                this.port = addr.port;
                resolve(this.port);
            });
        });
    }
    stop() {
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
    createSession(sessionId, roleName) {
        // 동일 ID 충돌 방지: 기존 세션이 있으면 -2, -3 ... suffix 추가
        let resolvedId = sessionId;
        let suffix = 2;
        while (this.sessions.has(resolvedId)) {
            resolvedId = `${sessionId}-${suffix++}`;
        }
        const wsUrl = `ws://127.0.0.1:${this.port}/sessions/${resolvedId}`;
        const outputChannel = vscode.window.createOutputChannel(`Co-Dev [${roleName}]`);
        const handle = {
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
    getSession(id) {
        return this.sessions.get(id);
    }
    getSessions() {
        return [...this.sessions.values()];
    }
    sendToSession(sessionId, message) {
        const handle = this.sessions.get(sessionId);
        if (!handle || handle.ws?.readyState !== ws_1.WebSocket.OPEN) {
            return false;
        }
        handle.ws.send(JSON.stringify(message));
        return true;
    }
    // ── WebSocket setup ────────────────────────────────────────────────────────
    _setupUpgradeHandler() {
        this.httpServer.on('upgrade', (req, socket, head) => {
            const match = req.url?.match(/^\/sessions\/([^/]+)$/);
            if (!match) {
                socket.destroy();
                return;
            }
            const sessionId = decodeURIComponent(match[1]);
            if (!this.sessions.has(sessionId)) {
                socket.destroy();
                return;
            }
            this.wss.handleUpgrade(req, socket, head, (ws) => {
                this.wss.emit('connection', ws, sessionId);
            });
        });
    }
    _setupConnectionHandler() {
        this.wss.on('connection', (ws, sessionId) => {
            const handle = this.sessions.get(sessionId);
            if (!handle) {
                ws.close();
                return;
            }
            handle.ws = ws;
            this._setStatus(handle, 'active');
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this._handleMessage(handle, msg);
                    this.emit('session:message', sessionId, msg);
                }
                catch {
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
    _handleMessage(handle, msg) {
        switch (msg.type) {
            case 'control_request': {
                const raw = (msg.request ?? msg);
                const req = {
                    id: String(raw.id ?? raw.request_id ?? ''),
                    type: String(raw.type ?? 'permission'),
                    tool: raw.tool ? String(raw.tool) : undefined,
                    raw,
                };
                handle.outputChannel.appendLine(`[Permission request] ${req.type}${req.tool ? ` — ${req.tool}` : ''}`);
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
                const message = msg.message;
                const content = message?.content;
                if (Array.isArray(content)) {
                    for (const block of content) {
                        if (block.type === 'text' && typeof block.text === 'string') {
                            handle.outputChannel.append(block.text);
                        }
                        else if (block.type === 'tool_use' && typeof block.name === 'string') {
                            handle.outputChannel.appendLine(`\n[tool] ${block.name}`);
                        }
                    }
                }
                break;
            }
            case 'result': {
                const subtype = msg.subtype;
                if (subtype === 'error_max_turns' || subtype === 'error') {
                    handle.outputChannel.appendLine(`\n[Error] ${msg.error ?? subtype}`);
                }
                break;
            }
        }
    }
    _setStatus(handle, status) {
        handle.status = status;
        this.emit('session:status', handle.id, status);
    }
}
exports.DirectConnectServer = DirectConnectServer;
//# sourceMappingURL=directConnectServer.js.map