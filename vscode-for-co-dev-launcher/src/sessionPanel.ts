import * as vscode from 'vscode';
import { DirectConnectServer, SessionHandle, SessionStatus, ControlRequest } from './directConnectServer';

// ─── Types shared with WebView ────────────────────────────────────────────────

interface FeedItem {
  kind: 'text' | 'tool' | 'status' | 'error';
  text: string;
  ts: string;
}

type ExtToWebView =
  | { type: 'card-add'; id: string; roleName: string; status: SessionStatus; startedAt: string }
  | { type: 'card-status'; id: string; status: SessionStatus }
  | { type: 'feed-update'; id: string; feed: FeedItem[] }
  | { type: 'control-request'; sessionId: string; requestId: string; reqType: string; tool?: string; detail: string }
  | { type: 'reset' };

type WebViewToExt =
  | { type: 'send'; sessionId: string; text: string }
  | { type: 'control-response'; sessionId: string; requestId: string; decision: 'allow' | 'deny' }
  | { type: 'ready' };

// ─── SessionPanel ─────────────────────────────────────────────────────────────

export class SessionPanel {
  private static instance: SessionPanel | undefined;

  private panel: vscode.WebviewPanel;
  private server: DirectConnectServer;
  /** 세션별 활동 피드 링버퍼 (최대 200개) */
  private feeds = new Map<string, FeedItem[]>();

  private constructor(panel: vscode.WebviewPanel, server: DirectConnectServer) {
    this.panel = panel;
    this.server = server;

    this._subscribeServerEvents();
    this._subscribeWebViewMessages();

    panel.onDidDispose(() => {
      this._unsubscribeServerEvents();
      SessionPanel.instance = undefined;
    });

    // 초기 렌더: 기존 세션을 포함한 전체 HTML
    this.panel.webview.html = this._buildHtml();
  }

  static show(server: DirectConnectServer, context: vscode.ExtensionContext): void {
    if (SessionPanel.instance) {
      SessionPanel.instance.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'co-dev.sessions',
      'Co-Dev Sessions',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      }
    );

    SessionPanel.instance = new SessionPanel(panel, server);
  }

  // ── Server event handlers ──────────────────────────────────────────────────

  private _onCreated = (handle: SessionHandle) => {
    this.feeds.set(handle.id, []);
    this._addFeedItem(handle.id, 'status', `Session started: ${handle.roleName}`);

    // 새 카드를 WebView에 추가 (전체 재렌더 없음)
    this._post<ExtToWebView>({
      type: 'card-add',
      id: handle.id,
      roleName: handle.roleName,
      status: handle.status,
      startedAt: handle.startedAt.toLocaleTimeString(),
    });
    this._pushFeedUpdate(handle.id);
  };

  private _onStatus = (sessionId: string, status: SessionStatus) => {
    this._addFeedItem(sessionId, 'status', `Status → ${status}`);
    // 카드 배지만 업데이트
    this._post<ExtToWebView>({ type: 'card-status', id: sessionId, status });
    this._pushFeedUpdate(sessionId);
  };

  private _onMessage = (sessionId: string, msg: Record<string, unknown>) => {
    switch (msg.type) {
      case 'assistant': {
        const content = (msg.message as Record<string, unknown>)?.content as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && typeof block.text === 'string') {
              this._addFeedItem(sessionId, 'text', block.text);
            } else if (block.type === 'tool_use' && typeof block.name === 'string') {
              this._addFeedItem(sessionId, 'tool', String(block.name));
            }
          }
        }
        break;
      }
      case 'result': {
        const subtype = msg.subtype as string | undefined;
        if (subtype === 'error' || subtype === 'error_max_turns') {
          this._addFeedItem(sessionId, 'error', String(msg.error ?? subtype));
        }
        break;
      }
    }
    this._pushFeedUpdate(sessionId);
  };

  private _onControlRequest = (sessionId: string, req: ControlRequest) => {
    const detail = JSON.stringify(req.raw, null, 2);
    this._addFeedItem(sessionId, 'status', `[Permission] ${req.type}${req.tool ? ` — ${req.tool}` : ''}`);
    this._pushFeedUpdate(sessionId);
    this._post<ExtToWebView>({
      type: 'control-request',
      sessionId,
      requestId: req.id,
      reqType: req.type,
      tool: req.tool,
      detail,
    });
  };

  private _subscribeServerEvents(): void {
    this.server.on('session:created', this._onCreated);
    this.server.on('session:status', this._onStatus);
    this.server.on('session:message', this._onMessage);
    this.server.on('session:control-request', this._onControlRequest);
  }

  private _unsubscribeServerEvents(): void {
    this.server.off('session:created', this._onCreated);
    this.server.off('session:status', this._onStatus);
    this.server.off('session:message', this._onMessage);
    this.server.off('session:control-request', this._onControlRequest);
  }

  // ── WebView message handler ────────────────────────────────────────────────

  private _subscribeWebViewMessages(): void {
    this.panel.webview.onDidReceiveMessage((msg: WebViewToExt) => {
      if (msg.type === 'send') {
        this.server.sendToSession(msg.sessionId, {
          type: 'user',
          message: { role: 'user', content: [{ type: 'text', text: msg.text }] },
        });
        this._addFeedItem(msg.sessionId, 'text', `[You] ${msg.text}`);
        this._pushFeedUpdate(msg.sessionId);
      } else if (msg.type === 'control-response') {
        this.server.respondToControl(msg.sessionId, msg.requestId, msg.decision);
        this._addFeedItem(
          msg.sessionId,
          'status',
          `[Permission] ${msg.decision === 'allow' ? '✓ 승인' : '✗ 거절'} (${msg.requestId})`
        );
        this._pushFeedUpdate(msg.sessionId);
      } else if (msg.type === 'ready') {
        // WebView 재열기 or 리로드 후 완전 리셋 → 현재 서버 세션만 재렌더
        this.feeds.clear();
        this._post<ExtToWebView>({ type: 'reset' });
        for (const handle of this.server.getSessions()) {
          // done 세션은 패널에 표시하지 않음
          if (handle.status === 'done') { continue; }
          this.feeds.set(handle.id, []);
          this._post<ExtToWebView>({
            type: 'card-add',
            id: handle.id,
            roleName: handle.roleName,
            status: handle.status,
            startedAt: handle.startedAt.toLocaleTimeString(),
          });
        }
      }
    });
  }

  // ── Feed helpers ───────────────────────────────────────────────────────────

  private _addFeedItem(sessionId: string, kind: FeedItem['kind'], text: string): void {
    if (!this.feeds.has(sessionId)) {
      this.feeds.set(sessionId, []);
    }
    const feed = this.feeds.get(sessionId)!;
    feed.push({ kind, text, ts: new Date().toLocaleTimeString() });
    if (feed.length > 200) {
      feed.splice(0, feed.length - 200);
    }
  }

  private _pushFeedUpdate(sessionId: string): void {
    const feed = this.feeds.get(sessionId) ?? [];
    this._post<ExtToWebView>({ type: 'feed-update', id: sessionId, feed });
  }

  private _post<T>(msg: T): void {
    this.panel.webview.postMessage(msg);
  }

  // ── Initial HTML (전체 렌더는 최초 1회만) ────────────────────────────────────

  private _buildHtml(): string {
    // done 세션 제외 — 현재 활성/대기 세션만 표시
    const existingSessions = this.server.getSessions().filter(h => h.status !== 'done');
    const initialCardsHtml = existingSessions.length === 0
      ? `<p class="empty" id="empty-hint">실행 중인 세션이 없습니다.<br>Co-Dev: New Session 커맨드로 시작하세요.</p>`
      : existingSessions.map(h => this._buildCardHtml(
          h.id, h.roleName, h.status, h.startedAt.toLocaleTimeString()
        )).join('');

    return /* html */`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 12px;
  }
  h1 { font-size: 1.1em; margin-bottom: 12px; opacity: .8; }
  .empty { opacity: .5; line-height: 1.8; }

  .card {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--vscode-sideBar-background);
  }
  .badge {
    font-size: .75em;
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 600;
  }
  .badge-pending  { background: #555; color: #ccc; }
  .badge-active   { background: #1a7f37; color: #fff; }
  .badge-done     { background: #444; color: #aaa; }

  .card-meta { font-size: .78em; opacity: .55; margin-left: auto; }

  .feed {
    height: 220px;
    overflow-y: auto;
    padding: 8px 12px;
    font-size: .82em;
    line-height: 1.55;
  }
  .feed-item { margin-bottom: 3px; }
  .feed-item.text  { white-space: pre-wrap; word-break: break-word; }
  .feed-item.tool  { color: var(--vscode-symbolIcon-functionForeground); }
  .feed-item.status { color: var(--vscode-descriptionForeground); font-style: italic; }
  .feed-item.error { color: var(--vscode-errorForeground); }
  .ts { opacity: .4; font-size: .85em; margin-right: 5px; }

  .input-row {
    display: flex;
    gap: 6px;
    padding: 6px 12px 10px;
    background: var(--vscode-sideBar-background);
  }
  .input-row input {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    padding: 4px 8px;
    font-family: inherit;
    font-size: inherit;
  }
  .input-row input:focus { outline: 1px solid var(--vscode-focusBorder); }
  .input-row button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 4px;
    padding: 4px 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .input-row button:hover { background: var(--vscode-button-hoverBackground); }
  .input-row button:disabled { opacity: .4; cursor: not-allowed; }

  /* ── Permission modal ── */
  .modal-backdrop {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,.55);
    z-index: 100;
    align-items: center;
    justify-content: center;
  }
  .modal-backdrop.visible { display: flex; }
  .modal {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 8px;
    padding: 20px 24px;
    min-width: 320px;
    max-width: 520px;
    box-shadow: 0 8px 32px rgba(0,0,0,.4);
  }
  .modal h2 { font-size: 1em; margin-bottom: 8px; }
  .modal .modal-meta {
    font-size: .8em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 10px;
  }
  .modal pre {
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    padding: 8px;
    font-size: .78em;
    max-height: 160px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
    margin-bottom: 14px;
  }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .btn-allow {
    background: #1a7f37; color: #fff;
    border: none; border-radius: 4px;
    padding: 5px 16px; cursor: pointer;
    font-family: inherit;
  }
  .btn-allow:hover { background: #158030; }
  .btn-deny {
    background: var(--vscode-button-secondaryBackground, #444);
    color: var(--vscode-button-secondaryForeground, #ccc);
    border: none; border-radius: 4px;
    padding: 5px 16px; cursor: pointer;
    font-family: inherit;
  }
  .btn-deny:hover { opacity: .85; }
</style>
</head>
<body>
<h1>Co-Dev Sessions</h1>
<div id="cards-container">${initialCardsHtml}</div>

<!-- Permission modal -->
<div class="modal-backdrop" id="modal-backdrop">
  <div class="modal">
    <h2>⚠️ Permission Request</h2>
    <div class="modal-meta" id="modal-meta"></div>
    <pre id="modal-detail"></pre>
    <div class="modal-actions">
      <button class="btn-deny" id="modal-deny">Deny</button>
      <button class="btn-allow" id="modal-allow">Allow</button>
    </div>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();

  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  function buildCard(id, roleName, status, startedAt) {
    const isActive = status === 'active';
    return \`<div class="card" data-session-id="\${escHtml(id)}">
  <div class="card-header">
    <strong>\${escHtml(roleName)}</strong>
    <span class="badge badge-\${status}">\${status}</span>
    <span class="card-meta">started \${startedAt}</span>
  </div>
  <div class="feed" id="feed-\${escHtml(id)}"></div>
  <div class="input-row">
    <input id="input-\${escHtml(id)}"
      placeholder="\${isActive ? 'Claude에게 메시지 전송...' : '세션이 종료되었습니다'}"
      \${isActive ? '' : 'disabled'}>
    <button id="btn-\${escHtml(id)}" \${isActive ? '' : 'disabled'}>Send</button>
  </div>
</div>\`;
  }

  function wireCard(id) {
    const input = document.getElementById('input-' + id);
    const btn = document.getElementById('btn-' + id);
    if (!input || !btn) return;
    btn.addEventListener('click', () => sendMsg(id));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(id); }
    });
  }

  function sendMsg(sessionId) {
    const input = document.getElementById('input-' + sessionId);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    vscode.postMessage({ type: 'send', sessionId, text });
    input.value = '';
  }

  // 초기 카드 이벤트 연결
  document.querySelectorAll('[data-session-id]').forEach(el => {
    wireCard(el.dataset.sessionId);
    const feed = document.getElementById('feed-' + el.dataset.sessionId);
    if (feed) feed.scrollTop = feed.scrollHeight;
  });

  // ── Permission modal ──────────────────────────────────────────────────────
  let _pendingControl = null;

  function showControlModal(sessionId, requestId, reqType, tool, detail) {
    _pendingControl = { sessionId, requestId };
    const meta = document.getElementById('modal-meta');
    const detailEl = document.getElementById('modal-detail');
    meta.textContent = (tool ? tool + ' — ' : '') + reqType;
    detailEl.textContent = detail;
    document.getElementById('modal-backdrop').classList.add('visible');
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('visible');
    _pendingControl = null;
  }

  document.getElementById('modal-allow').addEventListener('click', () => {
    if (!_pendingControl) return;
    vscode.postMessage({ type: 'control-response', ...(_pendingControl), decision: 'allow' });
    closeModal();
  });

  document.getElementById('modal-deny').addEventListener('click', () => {
    if (!_pendingControl) return;
    vscode.postMessage({ type: 'control-response', ...(_pendingControl), decision: 'deny' });
    closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _pendingControl) {
      vscode.postMessage({ type: 'control-response', ...(_pendingControl), decision: 'deny' });
      closeModal();
    }
  });

  // ── 단일 메시지 핸들러 ────────────────────────────────────────────────────
  window.addEventListener('message', e => {
    const msg = e.data;

    if (msg.type === 'reset') {
      document.getElementById('cards-container').innerHTML =
        '<p class="empty" id="empty-hint">실행 중인 세션이 없습니다.<br>Co-Dev: New Session 커맨드로 시작하세요.</p>';
    }

    else if (msg.type === 'card-add') {
      const container = document.getElementById('cards-container');
      const hint = document.getElementById('empty-hint');
      if (hint) hint.remove();
      const div = document.createElement('div');
      div.innerHTML = buildCard(msg.id, msg.roleName, msg.status, msg.startedAt);
      container.appendChild(div.firstElementChild);
      wireCard(msg.id);
    }

    else if (msg.type === 'card-status') {
      const card = document.querySelector('[data-session-id="' + CSS.escape(msg.id) + '"]');
      if (!card) return;
      const badge = card.querySelector('.badge');
      if (badge) {
        badge.className = 'badge badge-' + msg.status;
        badge.textContent = msg.status;
      }
      const input = card.querySelector('input');
      const btn = card.querySelector('button');
      const isActive = msg.status === 'active';
      if (input) {
        input.disabled = !isActive;
        input.placeholder = isActive ? 'Claude에게 메시지 전송...' : '세션이 종료되었습니다';
      }
      if (btn) btn.disabled = !isActive;
    }

    else if (msg.type === 'feed-update') {
      const feedEl = document.getElementById('feed-' + msg.id);
      if (!feedEl) return;
      const atBottom = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 40;
      feedEl.innerHTML = msg.feed.map(item =>
        '<div class="feed-item ' + item.kind + '">' +
        '<span class="ts">' + item.ts + '</span>' +
        escHtml(item.text) + '</div>'
      ).join('');
      if (atBottom) feedEl.scrollTop = feedEl.scrollHeight;
    }

    else if (msg.type === 'control-request') {
      showControlModal(msg.sessionId, msg.requestId, msg.reqType, msg.tool, msg.detail);
    }
  });

  // 준비 완료 신호 (패널 재열기 시 피드 복원용)
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }

  /** 서버 이벤트 기반 card-add 메시지에 쓰이는 카드 HTML 골격 */
  private _buildCardHtml(id: string, roleName: string, status: SessionStatus, startedAt: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isActive = status === 'active';
    return `<div class="card" data-session-id="${esc(id)}">
  <div class="card-header">
    <strong>${esc(roleName)}</strong>
    <span class="badge badge-${status}">${status}</span>
    <span class="card-meta">started ${startedAt}</span>
  </div>
  <div class="feed" id="feed-${esc(id)}"></div>
  <div class="input-row">
    <input id="input-${esc(id)}"
      placeholder="${isActive ? 'Claude에게 메시지 전송...' : '세션이 종료되었습니다'}"
      ${isActive ? '' : 'disabled'}>
    <button id="btn-${esc(id)}" ${isActive ? '' : 'disabled'}>Send</button>
  </div>
</div>`;
  }
}
