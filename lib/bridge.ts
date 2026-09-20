// MetaTrader 5 WebSocket Bridge Client
// Connects to local MT5 daemon (Python/ZeroMQ/FastAPI or MQL5 WebSocket EA)
import { AccountMetrics, Trade, OperationalState } from '@/types/trading';

export type BridgeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BridgeLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface BridgeAccountData {
  balance: number;
  equity: number;
  freeMargin: number;
  margin: number;
  profit: number;
  broker?: string;
  accountNumber?: string | number;
  currency?: string;
  leverage?: number;
}

export type StatusCallback = (
  status: BridgeConnectionStatus,
  latencyMs: number | null,
  error: string | null
) => void;

export type AccountCallback = (account: BridgeAccountData) => void;
export type PositionCallback = (trade: Trade | null) => void;
export type HistoryCallback = (trades: Trade[]) => void;
export type ScanCallback = (state: OperationalState, message?: string) => void;
export type LogCallback = (log: BridgeLogEntry) => void;

class MT5BridgeClient {
  private socket: WebSocket | null = null;
  private url: string = 'ws://localhost:8080';
  private status: BridgeConnectionStatus = 'disconnected';
  private latencyMs: number | null = null;
  private lastError: string | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private pingStart: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldAutoReconnect: boolean = true;
  private reconnectAttempts: number = 0;

  // Listeners
  private statusListeners: Set<StatusCallback> = new Set();
  private accountListeners: Set<AccountCallback> = new Set();
  private positionListeners: Set<PositionCallback> = new Set();
  private historyListeners: Set<HistoryCallback> = new Set();
  private scanListeners: Set<ScanCallback> = new Set();
  private logListeners: Set<LogCallback> = new Set();

  public logs: BridgeLogEntry[] = [];

  constructor() {
    // Initialized as disconnected
  }

  public setUrl(newUrl: string) {
    if (this.url !== newUrl) {
      this.url = newUrl;
      if (this.status === 'connected' || this.status === 'connecting') {
        this.disconnect();
        this.connect();
      }
    }
  }

  public getStatus(): { status: BridgeConnectionStatus; latencyMs: number | null; error: string | null } {
    return {
      status: this.status,
      latencyMs: this.latencyMs,
      error: this.lastError,
    };
  }

  public connect(url?: string) {
    if (url) this.url = url;
    if (typeof window === 'undefined') return;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.updateStatus('connecting', null, null);
    this.addLog('info', `Connecting to MT5 Bridge at ${this.url}...`);

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateStatus('connected', null, null);
        this.addLog('success', `WebSocket connected to MT5 Bridge daemon (${this.url})`);

        // Send initial handshake and query account & positions
        this.send({ action: 'CONNECT', client: 'VectorTraderWeb', version: '1.0' });
        this.send({ action: 'GET_ACCOUNT' });
        this.send({ action: 'GET_POSITIONS' });
        this.send({ action: 'GET_HISTORY', limit: 20 });

        // Start heartbeat ping every 4 seconds to measure actual latency
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onerror = (event) => {
        const errorMsg = `Unable to connect to MT5 bridge daemon at ${this.url}`;
        this.updateStatus('error', null, errorMsg);
        this.addLog('error', `Connection error: ${errorMsg}`);
      };

      this.socket.onclose = (event) => {
        this.stopHeartbeat();
        const wasConnected = this.status === 'connected';
        const clean = event.wasClean ? 'graceful' : 'abrupt';
        this.updateStatus('disconnected', null, `Connection closed (${clean})`);
        this.addLog('warn', `Disconnected from MT5 Bridge (${clean}, code: ${event.code})`);

        if (this.shouldAutoReconnect && this.reconnectAttempts < 5) {
          const delay = Math.min(3000 * Math.pow(1.5, this.reconnectAttempts), 15000);
          this.reconnectAttempts++;
          this.addLog('info', `Auto-retry scheduled in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/5)`);
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, delay);
        }
      };
    } catch (e: any) {
      const msg = e?.message || 'WebSocket initialization failed';
      this.updateStatus('error', null, msg);
      this.addLog('error', `Initialization failure: ${msg}`);
    }
  }

  public disconnect() {
    this.shouldAutoReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopHeartbeat();
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // ignore
      }
      this.socket = null;
    }
    this.updateStatus('disconnected', null, null);
    this.addLog('info', 'Disconnected from MT5 Bridge by user.');
  }

  public manualReconnect() {
    this.shouldAutoReconnect = true;
    this.reconnectAttempts = 0;
    this.disconnect();
    this.connect();
  }

  public send(payload: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.addLog('warn', `Send failed: Bridge not connected (${payload.action || 'message'})`);
      return false;
    }
    try {
      this.socket.send(JSON.stringify(payload));
      return true;
    } catch (e: any) {
      this.addLog('error', `Send error: ${e?.message}`);
      return false;
    }
  }

  // Trading actions
  public startScanning(symbol: string, risk: number, drawdownLimit: number) {
    this.addLog('info', `Dispatched START_SCAN command to MT5 daemon: ${symbol} (Risk: ${risk}%, Max DD: ${drawdownLimit}%)`);
    this.send({
      action: 'START_SCAN',
      symbol,
      risk,
      drawdownLimit,
      timestamp: Date.now(),
    });
  }

  public stopScanning() {
    this.addLog('info', 'Dispatched STOP_SCAN command to MT5 daemon');
    this.send({
      action: 'STOP_SCAN',
      timestamp: Date.now(),
    });
  }

  public emergencyStop() {
    this.addLog('warn', 'EMERGENCY STOP executed: Halting scanner and commanding MT5 to close active positions');
    this.send({
      action: 'EMERGENCY_STOP',
      closePositions: true,
      timestamp: Date.now(),
    });
  }

  public closePosition(ticket: string) {
    this.addLog('info', `Dispatched CLOSE_POSITION for ticket #${ticket}`);
    this.send({
      action: 'CLOSE_POSITION',
      ticket,
      timestamp: Date.now(),
    });
  }

  private handleMessage(rawData: any) {
    try {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

      switch (data.type || data.action) {
        case 'PONG': {
          if (this.pingStart > 0) {
            const currentLatency = Date.now() - this.pingStart;
            this.latencyMs = currentLatency;
            this.updateStatus('connected', currentLatency, null);
          }
          break;
        }

        case 'ACCOUNT':
        case 'ACCOUNT_UPDATE': {
          if (data.data) {
            this.accountListeners.forEach((cb) => cb(data.data));
            this.addLog('info', `Account update: Bal $${data.data.balance?.toFixed(2)} | Eq $${data.data.equity?.toFixed(2)}`);
          }
          break;
        }

        case 'POSITION':
        case 'POSITION_UPDATE':
        case 'ACTIVE_TRADE': {
          const trade: Trade | null = data.data || null;
          this.positionListeners.forEach((cb) => cb(trade));
          if (trade) {
            this.addLog('info', `Active position on MT5: ${trade.symbol} ${trade.type} (${trade.lotSize} lots, Ticket: ${trade.id})`);
          }
          break;
        }

        case 'HISTORY':
        case 'TRADES_HISTORY': {
          if (Array.isArray(data.data)) {
            this.historyListeners.forEach((cb) => cb(data.data));
            this.addLog('info', `Synchronized ${data.data.length} trades from MT5 account history`);
          }
          break;
        }

        case 'SCAN_STATUS': {
          const state: OperationalState = data.status === 'scanning' ? 'scanning' : data.status === 'trade_running' ? 'trade_running' : 'at_rest';
          this.scanListeners.forEach((cb) => cb(state, data.message));
          if (data.message) {
            this.addLog('info', `MT5 Scanner: ${data.message}`);
          }
          break;
        }

        case 'LOG': {
          if (data.message) {
            this.addLog(data.level || 'info', data.message);
          }
          break;
        }

        case 'ERROR': {
          this.addLog('error', `MT5 Bridge Error: ${data.message || 'Unknown bridge error'}`);
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.warn('Unable to parse message from MT5 bridge:', rawData);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.ping();
    this.pingInterval = setInterval(() => {
      this.ping();
    }, 4000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private ping() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.pingStart = Date.now();
      this.socket.send(JSON.stringify({ action: 'PING', timestamp: this.pingStart }));
    }
  }

  private updateStatus(status: BridgeConnectionStatus, latencyMs: number | null, error: string | null) {
    this.status = status;
    this.latencyMs = latencyMs;
    this.lastError = error;
    this.statusListeners.forEach((cb) => cb(status, latencyMs, error));
  }

  private addLog(level: 'info' | 'warn' | 'error' | 'success', message: string) {
    const entry: BridgeLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level,
      message,
    };
    this.logs = [entry, ...this.logs.slice(0, 49)];
    this.logListeners.forEach((cb) => cb(entry));
  }

  // Subscription methods
  public onStatus(cb: StatusCallback) {
    this.statusListeners.add(cb);
    cb(this.status, this.latencyMs, this.lastError);
    return () => this.statusListeners.delete(cb);
  }

  public onAccount(cb: AccountCallback) {
    this.accountListeners.add(cb);
    return () => this.accountListeners.delete(cb);
  }

  public onPosition(cb: PositionCallback) {
    this.positionListeners.add(cb);
    return () => this.positionListeners.delete(cb);
  }

  public onHistory(cb: HistoryCallback) {
    this.historyListeners.add(cb);
    return () => this.historyListeners.delete(cb);
  }

  public onScan(cb: ScanCallback) {
    this.scanListeners.add(cb);
    return () => this.scanListeners.delete(cb);
  }

  public onLog(cb: LogCallback) {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }
}

// Global client instance singleton
export const bridgeClient = new MT5BridgeClient();
