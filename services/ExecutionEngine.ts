// ExecutionEngine: Standalone MetaTrader 5 Bridge & Execution Service
// Manages real-time WebSocket connection to MT5 bridge daemon, account stream,
// standardized order execution API, heartbeat, and local demo/simulation fallback.

import {
  AccountMetrics,
  Trade,
  TradeDirection,
  OperationalState,
  AVAILABLE_SYMBOLS,
} from '@/types/trading';
import { StorageService } from '@/lib/storage';
import { ruleEngine } from '@/services/RuleEngine';
import { aiService } from '@/services/AIService';

export type EngineConnectionStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'SIMULATION';

export interface OpenTradePayload {
  symbol: string;
  type: TradeDirection;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface EngineLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export type StatusListener = (
  status: EngineConnectionStatus,
  latencyMs: number | null,
  error: string | null
) => void;
export type AccountListener = (account: AccountMetrics) => void;
export type PositionListener = (position: Trade | null) => void;
export type HistoryListener = (trades: Trade[]) => void;
export type StateListener = (state: OperationalState, message?: string) => void;
export type LogListener = (log: EngineLogEntry) => void;

export class ExecutionEngine {
  private socket: WebSocket | null = null;
  private url: string = 'ws://localhost:8080';
  private status: EngineConnectionStatus = 'DISCONNECTED';
  private latencyMs: number | null = null;
  private lastError: string | null = null;
  private isSimulation: boolean = false;

  // Timers
  private pingInterval: NodeJS.Timeout | null = null;
  private pingStart: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private shouldAutoReconnect: boolean = true;
  private simScanTimer: NodeJS.Timeout | null = null;
  private simTickInterval: NodeJS.Timeout | null = null;

  // Active state
  private currentMetrics: AccountMetrics = {
    balance: 0,
    equity: 0,
    freeMargin: 0,
    marginUsed: 0,
    todayPnl: 0,
    todayPnlPercent: 0,
    isConnected: false,
  };
  private currentPosition: Trade | null = null;
  private operationalState: OperationalState = 'at_rest';
  public logs: EngineLogEntry[] = [];

  // Listeners
  private statusListeners: Set<StatusListener> = new Set();
  private accountListeners: Set<AccountListener> = new Set();
  private positionListeners: Set<PositionListener> = new Set();
  private historyListeners: Set<HistoryListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private logListeners: Set<LogListener> = new Set();

  constructor() {
    // Listen to RuleEngine circuit breaker triggers
    ruleEngine.onCircuitBreaker((reason, drawdownPercent) => {
      this.addLog('error', `[RuleEngine Circuit Breaker] ${reason} (${drawdownPercent}% DD)`);
      this.emergencyStop();
    });
  }

  // -------------------------------------------------------------
  // Configuration & Bridge URL Resolution
  // -------------------------------------------------------------
  public getStoredBridgeUrl(): string {
    if (typeof window === 'undefined') return 'ws://localhost:8080';
    try {
      const stored = StorageService.getSettings();
      if (stored?.bridgeUrl) {
        return stored.bridgeUrl;
      }
    } catch (e) {
      console.warn('ExecutionEngine: Failed to read bridge URL from localStorage', e);
    }
    return 'ws://localhost:8080';
  }

  public setUrl(newUrl: string): void {
    if (this.url !== newUrl) {
      this.url = newUrl;
      if (!this.isSimulation && (this.status === 'CONNECTED' || this.status === 'RECONNECTING')) {
        this.disconnect();
        this.connect(newUrl);
      }
    }
  }

  public getUrl(): string {
    return this.url;
  }

  public getStatus(): {
    status: EngineConnectionStatus;
    latencyMs: number | null;
    error: string | null;
    isSimulation: boolean;
  } {
    return {
      status: this.status,
      latencyMs: this.latencyMs,
      error: this.lastError,
      isSimulation: this.isSimulation,
    };
  }

  // -------------------------------------------------------------
  // Connection Manager & Heartbeat
  // -------------------------------------------------------------
  public connect(url?: string): void {
    if (typeof window === 'undefined') return;

    if (url) {
      this.url = url;
    } else {
      this.url = this.getStoredBridgeUrl();
    }

    // If simulation mode was active, turning connect explicitly disables simulation mode
    if (this.isSimulation) {
      this.stopSimulation();
      this.isSimulation = false;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.shouldAutoReconnect = true;
    this.updateStatus('RECONNECTING', null, null);
    this.addLog('info', `[ExecutionEngine] Connecting to MetaTrader 5 Bridge at ${this.url}...`);

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateStatus('CONNECTED', null, null);
        this.addLog(
          'success',
          `[ExecutionEngine] Socket connected to MT5 Bridge daemon (${this.url})`
        );

        // Send standard handshake and initial state queries
        this.sendRaw({ action: 'CONNECT', client: 'VectorTraderExecutionEngine', version: '2.0' });
        this.getAccountDetails();
        this.getOpenPositions();
        this.sendRaw({ action: 'GET_HISTORY', limit: 20 });

        // Start heartbeat ping every 4 seconds to measure true latency
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        this.handleSocketMessage(event.data);
      };

      this.socket.onerror = () => {
        const errorMsg = `Unable to reach MT5 WebSocket daemon at ${this.url}`;
        this.addLog('error', `[ExecutionEngine] ${errorMsg}`);
        this.updateStatus('DISCONNECTED', null, errorMsg);
      };

      this.socket.onclose = (event) => {
        this.stopHeartbeat();
        const wasClean = event.wasClean ? 'clean' : 'abrupt';
        this.addLog(
          'warn',
          `[ExecutionEngine] Connection closed (${wasClean}, code: ${event.code})`
        );

        // Reconnection Exponential Backoff: (1s, 2s, 5s, 10s) up to 5 attempts
        const BACKOFF_INTERVALS_MS = [1000, 2000, 5000, 10000, 10000];
        const MAX_ATTEMPTS = 5;

        if (this.shouldAutoReconnect && this.reconnectAttempts < MAX_ATTEMPTS) {
          const delay = BACKOFF_INTERVALS_MS[this.reconnectAttempts] || 10000;
          this.reconnectAttempts++;
          const delaySec = (delay / 1000).toFixed(0);
          this.updateStatus(
            'RECONNECTING',
            null,
            `Reconnecting in ${delaySec}s (Attempt ${this.reconnectAttempts}/${MAX_ATTEMPTS})...`
          );
          this.addLog(
            'warn',
            `[ExecutionEngine] WebSocket bridge dropped. Reconnection attempt ${this.reconnectAttempts}/${MAX_ATTEMPTS} scheduled in ${delaySec}s (Exponential backoff)`
          );
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, delay);
        } else {
          // 5 attempts exhausted: Force the app into "At Rest" state
          this.reconnectAttempts = 0;
          this.shouldAutoReconnect = false;
          this.operationalState = 'at_rest';
          this.emitState(
            'at_rest',
            'WebSocket bridge dropped: 5 consecutive reconnection attempts exhausted. System forced into At Rest state.'
          );
          this.updateStatus(
            'DISCONNECTED',
            null,
            'Connection lost: 5 backoff attempts exhausted. App forced into At Rest state.'
          );
          this.addLog(
            'error',
            '[ExecutionEngine] WebSocket bridge dropped: 5 consecutive reconnection attempts failed. System forced into At Rest state.'
          );
        }
      };
    } catch (err: any) {
      const msg = err?.message || 'WebSocket initialization failed';
      this.updateStatus('DISCONNECTED', null, msg);
      this.addLog('error', `[ExecutionEngine] Initialization exception: ${msg}`);
    }
  }

  public disconnect(): void {
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

    if (!this.isSimulation) {
      this.updateStatus('DISCONNECTED', null, null);
      this.addLog('info', '[ExecutionEngine] Disconnected from MT5 Bridge.');
    }
  }

  public reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.ping();
    this.pingInterval = setInterval(() => {
      this.ping();
    }, 4000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private ping(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.pingStart = Date.now();
      this.sendRaw({ action: 'PING', timestamp: this.pingStart });
    }
  }

  // -------------------------------------------------------------
  // Standardized Execution API Methods
  // -------------------------------------------------------------

  /**
   * Requests balance/equity overview.
   */
  public getAccountDetails(): void {
    if (this.isSimulation) {
      this.emitAccount(this.currentMetrics);
      return;
    }

    this.sendRaw({ action: 'GET_ACCOUNT', timestamp: Date.now() });
  }

  /**
   * Constructs and dispatches trade execution payload formatted as JSON:
   * { "action": "TRADE_EXECUTE", "symbol": "EURUSD", "type": "BUY" | "SELL", "volume": 0.01, "sl": 0.0, "tp": 0.0 }
   */
  public openTrade({
    symbol,
    type,
    volume,
    stopLoss,
    takeProfit,
  }: OpenTradePayload): void {
    // -------------------------------------------------------------
    // Data Validation Guard: Incomplete price/order checks
    // -------------------------------------------------------------
    if (
      !symbol ||
      !type ||
      typeof volume !== 'number' ||
      isNaN(volume) ||
      !Number.isFinite(volume) ||
      volume <= 0 ||
      (stopLoss !== undefined && (isNaN(Number(stopLoss)) || !Number.isFinite(Number(stopLoss)))) ||
      (takeProfit !== undefined && (isNaN(Number(takeProfit)) || !Number.isFinite(Number(takeProfit))))
    ) {
      this.addLog(
        'error',
        `[Data Validation Guard] Prevented unintended order trigger: Incomplete or NaN order parameters (symbol: ${symbol}, vol: ${volume}, SL: ${stopLoss}, TP: ${takeProfit})`
      );
      return;
    }

    // -------------------------------------------------------------
    // Hard Risk Guardrail Validation via RuleEngine
    // -------------------------------------------------------------
    const activePositions = this.currentPosition ? [this.currentPosition] : [];

    // Guardrail 1: Max Open Positions Limit
    const posCheck = ruleEngine.checkMaxPositions(activePositions);
    if (!posCheck.passed) {
      this.addLog('warn', `[RuleEngine Guardrail Blocked] ${posCheck.message}`);
      return;
    }

    // Guardrail 2: Max Daily Drawdown Circuit Breaker
    const ddCheck = ruleEngine.checkDailyDrawdown(this.currentMetrics, activePositions);
    if (!ddCheck.passed) {
      this.addLog('error', `[RuleEngine Circuit Breaker] ${ddCheck.message}`);
      this.emergencyStop();
      return;
    }

    const payload = {
      action: 'TRADE_EXECUTE',
      symbol,
      type,
      volume: Number(volume) || 0.01,
      sl: Number(stopLoss) || 0.0,
      tp: Number(takeProfit) || 0.0,
      timestamp: Date.now(),
    };

    this.addLog(
      'info',
      `[ExecutionEngine] openTrade -> ${payload.type} ${payload.volume} ${payload.symbol} (SL: ${payload.sl}, TP: ${payload.tp})`
    );

    if (this.isSimulation) {
      this.executeSimulatedTrade(payload);
      return;
    }

    const sent = this.sendRaw(payload);
    if (!sent) {
      this.addLog('error', '[ExecutionEngine] openTrade failed: MT5 bridge not connected');
    }
  }

  /**
   * Dispatches trade closure payload for a specific ticket.
   */
  public closeTrade(ticketId: string | number): void {
    const payload = {
      action: 'TRADE_CLOSE',
      ticket: ticketId,
      ticketId: ticketId,
      timestamp: Date.now(),
    };

    this.addLog('info', `[ExecutionEngine] closeTrade -> Ticket #${ticketId}`);

    if (this.isSimulation) {
      this.closeSimulatedTrade(ticketId);
      return;
    }

    this.sendRaw(payload);
    // Also send secondary convention CLOSE_POSITION for broader EA daemon compatibility
    this.sendRaw({ action: 'CLOSE_POSITION', ticket: ticketId });
  }

  /**
   * Requests all active running trades.
   */
  public getOpenPositions(): void {
    if (this.isSimulation) {
      this.emitPosition(this.currentPosition);
      return;
    }

    this.sendRaw({ action: 'GET_POSITIONS', timestamp: Date.now() });
  }

  /**
   * Hook for starting algorithmic scanning on a symbol.
   */
  public startScanning(
    symbol: string,
    risk: number = 1.0,
    maxDailyDrawdown: number = 3.0
  ): void {
    this.operationalState = 'scanning';
    this.emitState('scanning', `Scanning order depth on ${symbol}`);
    this.addLog(
      'info',
      `[ExecutionEngine] startScanning -> ${symbol} (Risk: ${risk}%, MaxDD: ${maxDailyDrawdown}%)`
    );

    if (this.isSimulation) {
      this.startSimulatedScanning(symbol, risk);
      return;
    }

    this.sendRaw({
      action: 'START_SCAN',
      symbol,
      risk,
      drawdownLimit: maxDailyDrawdown,
      timestamp: Date.now(),
    });
  }

  /**
   * Hook for stopping scanning.
   */
  public stopScanning(): void {
    this.operationalState = 'at_rest';
    this.emitState('at_rest', 'Scanner stopped');
    this.addLog('info', '[ExecutionEngine] stopScanning called');

    if (this.isSimulation) {
      if (this.simScanTimer) {
        clearTimeout(this.simScanTimer);
        this.simScanTimer = null;
      }
      return;
    }

    this.sendRaw({ action: 'STOP_SCAN', timestamp: Date.now() });
  }

  /**
   * Emergency Stop switch: immediately halts scanner and closes open positions.
   */
  public emergencyStop(): void {
    this.operationalState = 'at_rest';
    this.emitState('at_rest', 'EMERGENCY STOP triggered');
    this.addLog('warn', '[ExecutionEngine] EMERGENCY STOP: Halting operations and liquidating active positions');

    if (this.isSimulation) {
      if (this.simScanTimer) {
        clearTimeout(this.simScanTimer);
        this.simScanTimer = null;
      }
      if (this.currentPosition) {
        this.closeSimulatedTrade(this.currentPosition.id);
      }
      return;
    }

    this.sendRaw({
      action: 'EMERGENCY_STOP',
      closePositions: true,
      timestamp: Date.now(),
    });
  }

  // -------------------------------------------------------------
  // Raw Socket Messaging
  // -------------------------------------------------------------
  public sendRaw(payload: Record<string, any>): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.socket.send(JSON.stringify(payload));
      return true;
    } catch (e: any) {
      this.addLog('error', `[ExecutionEngine] Send error: ${e?.message}`);
      return false;
    }
  }

  private handleSocketMessage(rawData: any): void {
    try {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const type = data.type || data.action;

      switch (type) {
        case 'PONG': {
          if (this.pingStart > 0) {
            const rtt = Date.now() - this.pingStart;
            this.latencyMs = rtt;
            this.updateStatus('CONNECTED', rtt, null);
          }
          break;
        }

        case 'ACCOUNT':
        case 'ACCOUNT_UPDATE':
        case 'ACCOUNT_STATE': {
          const acc = data.data || data.account || data;
          if (acc && typeof acc.balance === 'number') {
            const updated: AccountMetrics = {
              balance: acc.balance ?? this.currentMetrics.balance,
              equity: acc.equity ?? acc.balance ?? this.currentMetrics.equity,
              freeMargin: acc.freeMargin ?? acc.balance ?? this.currentMetrics.freeMargin,
              marginUsed: acc.margin ?? acc.marginUsed ?? 0,
              todayPnl: acc.profit ?? acc.todayPnl ?? 0,
              todayPnlPercent:
                acc.balance > 0 ? ((acc.profit ?? acc.todayPnl ?? 0) / acc.balance) * 100 : 0,
              broker: acc.broker ?? this.currentMetrics.broker,
              accountNumber: acc.accountNumber ?? this.currentMetrics.accountNumber,
              currency: acc.currency ?? this.currentMetrics.currency ?? 'USD',
              leverage: acc.leverage ?? this.currentMetrics.leverage ?? 100,
              isConnected: true,
            };
            this.currentMetrics = updated;
            this.emitAccount(updated);
            this.addLog(
              'info',
              `[ExecutionEngine] Account: Balance $${updated.balance.toFixed(2)} | Equity $${updated.equity.toFixed(2)}`
            );
          }
          break;
        }

        case 'POSITION':
        case 'POSITION_UPDATE':
        case 'ACTIVE_TRADE':
        case 'TRADE_OPENED': {
          const rawPosition = data.data || data.position || data.trade || null;
          if (rawPosition) {
            const trade: Trade = {
              id: String(rawPosition.ticket || rawPosition.id || Date.now()),
              symbol: rawPosition.symbol,
              type: rawPosition.type === 'SELL' ? 'SELL' : 'BUY',
              lotSize: Number(rawPosition.volume || rawPosition.lotSize || 0.1),
              entryPrice: Number(rawPosition.entryPrice || rawPosition.openPrice || rawPosition.price || 0),
              currentPrice: Number(rawPosition.currentPrice || rawPosition.price || rawPosition.entryPrice || 0),
              stopLoss: Number(rawPosition.sl || rawPosition.stopLoss || 0),
              takeProfit: Number(rawPosition.tp || rawPosition.takeProfit || 0),
              netPnl: Number(rawPosition.pnl || rawPosition.profit || rawPosition.netPnl || 0),
              outcome: 'ACTIVE',
              timestamp: rawPosition.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              pips: rawPosition.pips ?? 0,
            };
            this.currentPosition = trade;
            this.operationalState = 'trade_running';
            this.emitPosition(trade);
            this.emitState('trade_running', `Active position: ${trade.symbol} ${trade.type}`);
          } else {
            this.currentPosition = null;
            if (this.operationalState === 'trade_running') {
              this.operationalState = 'at_rest';
              this.emitState('at_rest');
            }
            this.emitPosition(null);
          }
          break;
        }

        case 'POSITIONS_LIST':
        case 'GET_POSITIONS': {
          const list = Array.isArray(data.data) ? data.data : Array.isArray(data.positions) ? data.positions : [];
          if (list.length > 0) {
            const first = list[0];
            const trade: Trade = {
              id: String(first.ticket || first.id),
              symbol: first.symbol,
              type: first.type === 'SELL' ? 'SELL' : 'BUY',
              lotSize: Number(first.volume || first.lotSize || 0.1),
              entryPrice: Number(first.openPrice || first.entryPrice || 0),
              currentPrice: Number(first.currentPrice || first.price || first.openPrice || 0),
              stopLoss: Number(first.sl || first.stopLoss || 0),
              takeProfit: Number(first.tp || first.takeProfit || 0),
              netPnl: Number(first.profit || first.pnl || 0),
              outcome: 'ACTIVE',
              timestamp: first.openTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              pips: first.pips ?? 0,
            };
            this.currentPosition = trade;
            this.operationalState = 'trade_running';
            this.emitPosition(trade);
            this.emitState('trade_running');
          } else {
            this.currentPosition = null;
            this.emitPosition(null);
          }
          break;
        }

        case 'HISTORY':
        case 'TRADES_HISTORY': {
          const list = Array.isArray(data.data) ? data.data : Array.isArray(data.trades) ? data.trades : [];
          if (list.length > 0) {
            const formatted: Trade[] = list.map((item: any) => ({
              id: String(item.ticket || item.id || Date.now()),
              symbol: item.symbol || 'EURUSD',
              type: item.type === 'SELL' ? 'SELL' : 'BUY',
              lotSize: Number(item.volume || item.lotSize || 0.1),
              entryPrice: Number(item.openPrice || item.entryPrice || 0),
              exitPrice: Number(item.closePrice || item.exitPrice || 0),
              stopLoss: Number(item.sl || item.stopLoss || 0),
              takeProfit: Number(item.tp || item.takeProfit || 0),
              netPnl: Number(item.profit || item.netPnl || 0),
              outcome: (item.profit || item.netPnl || 0) >= 0 ? 'WIN' : 'LOSS',
              timestamp: item.openTime || item.timestamp || '',
              exitTime: item.closeTime || item.exitTime || '',
              pips: item.pips,
            }));
            this.emitHistory(formatted);
          }
          break;
        }

        case 'SCAN_STATUS': {
          const newState: OperationalState =
            data.status === 'scanning'
              ? 'scanning'
              : data.status === 'trade_running'
              ? 'trade_running'
              : 'at_rest';
          this.operationalState = newState;
          this.emitState(newState, data.message);
          break;
        }

        case 'LOG': {
          if (data.message) {
            this.addLog(data.level || 'info', data.message);
          }
          break;
        }

        case 'ERROR': {
          this.addLog('error', `[ExecutionEngine] Bridge Error: ${data.message || 'Unknown error'}`);
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.warn('ExecutionEngine: Unable to parse socket message', rawData);
    }
  }

  // -------------------------------------------------------------
  // Fallback Simulation / Mock Mode
  // -------------------------------------------------------------
  public setSimulationMode(enabled: boolean): void {
    if (this.isSimulation === enabled) return;
    this.isSimulation = enabled;

    if (enabled) {
      // Disconnect socket if open
      this.disconnect();
      this.updateStatus('SIMULATION', 12, null);
      this.addLog(
        'success',
        '[ExecutionEngine] Demo / Simulation Mode ENABLED. Simulated MT5 execution active.'
      );

      // Seed realistic simulation metrics
      this.currentMetrics = {
        balance: 10000.0,
        equity: 10000.0,
        freeMargin: 10000.0,
        marginUsed: 0,
        todayPnl: 0,
        todayPnlPercent: 0,
        broker: 'MetaTrader 5 (Demo Sandbox)',
        accountNumber: 'DEMO-89104',
        currency: 'USD',
        leverage: 100,
        isConnected: true,
      };
      this.emitAccount(this.currentMetrics);
    } else {
      this.stopSimulation();
      this.updateStatus('DISCONNECTED', null, null);
      this.addLog('info', '[ExecutionEngine] Simulation mode disabled. Attempting real MT5 Bridge connection...');
      // Reconnect to real bridge
      this.connect();
    }
  }

  public isSimulationMode(): boolean {
    return this.isSimulation;
  }

  private stopSimulation(): void {
    if (this.simScanTimer) {
      clearTimeout(this.simScanTimer);
      this.simScanTimer = null;
    }
    if (this.simTickInterval) {
      clearInterval(this.simTickInterval);
      this.simTickInterval = null;
    }
  }

  private startSimulatedScanning(symbol: string, risk: number): void {
    if (this.simScanTimer) {
      clearTimeout(this.simScanTimer);
    }

    this.addLog(
      'info',
      `[RuleEngine] Starting deterministic indicator and risk evaluation stream for ${symbol}...`
    );

    let scanTicks = 0;
    const evaluateStep = async () => {
      if (!this.isSimulation || this.operationalState !== 'scanning') return;
      scanTicks++;

      const symbolObj =
        AVAILABLE_SYMBOLS.find((s) => s.symbol === symbol) || AVAILABLE_SYMBOLS[0];

      let basePrice = 1.0850;
      if (symbol === 'GBPUSD') basePrice = 1.2940;
      if (symbol === 'USDJPY') basePrice = 153.25;
      if (symbol === 'XAUUSD') basePrice = 2645.50;
      if (symbol === 'BTCUSD') basePrice = 64200.0;
      if (symbol === 'US30') basePrice = 42100.0;
      if (symbol === 'NAS100') basePrice = 19800.0;

      const pipVal = ruleEngine.getPipSize(symbol);
      const priceJitter = (Math.random() - 0.48) * pipVal * 3;
      const currentPrice = Number((basePrice + priceJitter).toFixed(symbolObj.digits));
      const spreadPips = Number((symbolObj.spread + (Math.random() - 0.5) * 0.2).toFixed(1));

      // Data Validation Guard 1: Incomplete or non-finite price ticks
      if (
        typeof currentPrice !== 'number' ||
        isNaN(currentPrice) ||
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0
      ) {
        this.addLog(
          'warn',
          `[Data Validation Guard] Ignored incomplete or non-finite price tick: ${currentPrice}. Order trigger prevented.`
        );
        this.simScanTimer = setTimeout(evaluateStep, 1500);
        return;
      }

      const activePositions = this.currentPosition ? [this.currentPosition] : [];
      const evalResult = ruleEngine.evaluateSetup({
        symbol,
        currentPrice,
        spreadPips,
        accountState: this.currentMetrics,
        activePositions,
      });

      // Data Validation Guard 2: Reject NaN or non-finite indicator outputs
      if (evalResult.reason && evalResult.reason.includes('Data Validation Guard')) {
        this.addLog('warn', `[Data Validation Guard] ${evalResult.reason}`);
        this.simScanTimer = setTimeout(evaluateStep, 1500);
        return;
      }

      this.addLog(
        evalResult.riskPassed ? 'success' : 'info',
        `[RuleEngine] ${symbol} @ ${currentPrice} | Signal: ${evalResult.signal} (EMA ${evalResult.indicators.fastEma}/${evalResult.indicators.slowEma}, RSI: ${evalResult.indicators.rsi}, ATR: ${evalResult.indicators.atr}) | Risk: ${evalResult.riskPassed ? 'PASSED' : 'REJECTED/WAIT'}`
      );

      // Once conditions match and at least 2 ticks verified
      if (evalResult.riskPassed && evalResult.signal !== 'NEUTRAL' && scanTicks >= 2) {
        this.addLog(
          'info',
          `[RuleEngine Signal] ${evalResult.signal} detected on ${symbol}. Submitting to Gemini AI Trade Overseer for market context verification...`
        );

        // Transition main status indicator to reflect 'AI Analyzing...' state
        this.operationalState = 'ai_analyzing';
        this.emitState('ai_analyzing', `AI Analyzing: Evaluating market regime for ${evalResult.signal} on ${symbol}...`);

        try {
          const aiDecision = await aiService.analyzeMarketContext(
            {
              symbol,
              signal: evalResult.signal,
              price: currentPrice,
              spreadPips,
              lotSize: evalResult.calculatedLotSize,
              stopLoss: evalResult.slPrice,
              takeProfit: evalResult.tpPrice,
              indicators: evalResult.indicators,
              riskReason: evalResult.reason,
            },
            this.currentMetrics
          );

          // API Key Guard: Check if AI is offline
          if (aiDecision.isAiOffline || aiDecision.warningBadge) {
            this.addLog(
              'warn',
              `[API Key Guard] ${aiDecision.warningBadge || 'AI Offline - Enforcing Hardcoded Rules Only'}`
            );
          }

          if (aiDecision.approved) {
            const adjustedLot = Number(
              Math.max(
                0.01,
                evalResult.calculatedLotSize * (aiDecision.adjustedLotSizeMultiplier || 1.0)
              ).toFixed(2)
            );

            if (aiDecision.isAiOffline) {
              this.addLog(
                'warn',
                `[API Key Guard] AI Offline - Enforcing Hardcoded Rules Only: Trade executed on ${symbol} ${adjustedLot} lots based strictly on Hardcoded Rule Engine.`
              );
            } else {
              this.addLog(
                'success',
                `[AI Overseer Approved] Confidence: ${aiDecision.confidenceScore}% | Regime: ${aiDecision.marketRegime} | Lot Size: ${adjustedLot} | "${aiDecision.reasoning}"`
              );
            }

            this.openTrade({
              symbol,
              type: evalResult.signal,
              volume: adjustedLot,
              stopLoss: evalResult.slPrice,
              takeProfit: evalResult.tpPrice,
            });
          } else {
            this.addLog(
              'warn',
              `[AI Overseer VETO] Confidence: ${aiDecision.confidenceScore}% | Regime: ${aiDecision.marketRegime} | Veto Reason: "${aiDecision.reasoning}"`
            );

            this.operationalState = 'scanning';
            this.emitState('scanning', `AI Vetoed: ${aiDecision.reasoning.substring(0, 50)}... Continuing scan.`);
            this.simScanTimer = setTimeout(evaluateStep, 2400);
          }
        } catch (err: any) {
          // API Key Guard fallback: Automatic fallback to executing trades strictly on Hardcoded Rule Engine
          this.addLog(
            'warn',
            `[API Key Guard] AI Offline - Enforcing Hardcoded Rules Only (${err?.message || 'Gemini Offline'}). Executing trade via RuleEngine.`
          );
          this.openTrade({
            symbol,
            type: evalResult.signal,
            volume: evalResult.calculatedLotSize,
            stopLoss: evalResult.slPrice,
            takeProfit: evalResult.tpPrice,
          });
        }
      } else {
        this.simScanTimer = setTimeout(evaluateStep, 1600);
      }
    };

    this.simScanTimer = setTimeout(evaluateStep, 1200);
  }

  private executeSimulatedTrade(payload: OpenTradePayload): void {
    const symbolObj =
      AVAILABLE_SYMBOLS.find((s) => s.symbol === payload.symbol) || AVAILABLE_SYMBOLS[0];

    let basePrice = 1.0850;
    if (payload.symbol === 'GBPUSD') basePrice = 1.2940;
    if (payload.symbol === 'USDJPY') basePrice = 153.25;
    if (payload.symbol === 'XAUUSD') basePrice = 2645.50;
    if (payload.symbol === 'BTCUSD') basePrice = 64200.0;
    if (payload.symbol === 'US30') basePrice = 42100.0;
    if (payload.symbol === 'NAS100') basePrice = 19800.0;

    const ticket = Math.floor(1000000 + Math.random() * 9000000).toString();
    const trade: Trade = {
      id: ticket,
      symbol: payload.symbol,
      type: payload.type,
      lotSize: payload.volume,
      entryPrice: basePrice,
      currentPrice: basePrice,
      stopLoss: payload.stopLoss || (payload.type === 'BUY' ? basePrice * 0.99 : basePrice * 1.01),
      takeProfit: payload.takeProfit || (payload.type === 'BUY' ? basePrice * 1.02 : basePrice * 0.98),
      netPnl: 0.0,
      outcome: 'ACTIVE',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      pips: 0.0,
    };

    this.currentPosition = trade;
    this.operationalState = 'trade_running';
    this.emitPosition(trade);
    this.emitState('trade_running', `Position open: ${trade.symbol} ${trade.type} #${trade.id}`);

    // Update margin in account
    const marginReq = payload.volume * 100;
    this.currentMetrics = {
      ...this.currentMetrics,
      marginUsed: marginReq,
      freeMargin: this.currentMetrics.balance - marginReq,
    };
    this.emitAccount(this.currentMetrics);

    // Start live simulated tick price drift
    if (this.simTickInterval) clearInterval(this.simTickInterval);
    const pipMultiplier = symbolObj.digits === 2 ? 0.05 : symbolObj.digits === 3 ? 0.005 : symbolObj.digits === 1 ? 0.5 : 0.00005;

    this.simTickInterval = setInterval(() => {
      if (!this.currentPosition || !this.isSimulation) {
        if (this.simTickInterval) clearInterval(this.simTickInterval);
        return;
      }

      // Random price walk
      const delta = (Math.random() - 0.48) * pipMultiplier;
      const newPrice = Number((this.currentPosition.currentPrice! + delta).toFixed(symbolObj.digits));
      const priceDiff =
        this.currentPosition.type === 'BUY'
          ? newPrice - this.currentPosition.entryPrice
          : this.currentPosition.entryPrice - newPrice;

      const pipScale = symbolObj.digits === 5 ? 10000 : symbolObj.digits === 3 ? 100 : 1;
      const pips = Number((priceDiff * pipScale).toFixed(1));
      const netPnl = Number((pips * this.currentPosition.lotSize * 10).toFixed(2));

      this.currentPosition = {
        ...this.currentPosition,
        currentPrice: newPrice,
        pips,
        netPnl,
      };

      this.emitPosition(this.currentPosition);

      // Reflect in floating equity
      this.currentMetrics = {
        ...this.currentMetrics,
        equity: Number((this.currentMetrics.balance + this.currentMetrics.todayPnl + netPnl).toFixed(2)),
      };
      this.emitAccount(this.currentMetrics);

      // Verify circuit breaker against floating drawdown
      const ddCheck = ruleEngine.checkDailyDrawdown(this.currentMetrics, [this.currentPosition]);
      if (!ddCheck.passed) {
        this.addLog('error', `[Circuit Breaker] ${ddCheck.message}`);
        this.emergencyStop();
      }
    }, 1200);
  }

  private closeSimulatedTrade(ticketId: string | number): void {
    if (!this.currentPosition) return;
    if (this.simTickInterval) {
      clearInterval(this.simTickInterval);
      this.simTickInterval = null;
    }

    const trade = this.currentPosition;
    const finalPnl = trade.netPnl;
    const outcome = finalPnl >= 0 ? 'WIN' : 'LOSS';

    const closedTrade: Trade = {
      ...trade,
      exitPrice: trade.currentPrice || trade.entryPrice,
      outcome,
      exitTime: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    // Update account metrics
    const newBalance = Number((this.currentMetrics.balance + finalPnl).toFixed(2));
    const newTodayPnl = Number((this.currentMetrics.todayPnl + finalPnl).toFixed(2));
    const newTodayPercent = (newTodayPnl / 10000.0) * 100;

    this.currentMetrics = {
      ...this.currentMetrics,
      balance: newBalance,
      equity: newBalance,
      freeMargin: newBalance,
      marginUsed: 0,
      todayPnl: newTodayPnl,
      todayPnlPercent: newTodayPercent,
    };

    this.currentPosition = null;
    this.operationalState = 'at_rest';

    this.emitPosition(null);
    this.emitAccount(this.currentMetrics);
    this.emitState('at_rest', `Position #${ticketId} closed (${outcome}: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)})`);

    // Add to trade history
    const existingTrades = StorageService.getTrades();
    const updated = [closedTrade, ...existingTrades.slice(0, 9)];
    StorageService.saveTrades(updated);
    this.emitHistory(updated);

    this.addLog(
      finalPnl >= 0 ? 'success' : 'warn',
      `[Simulation] Closed #${ticketId} at ${closedTrade.exitPrice}. Realized P&L: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)}`
    );
  }

  // -------------------------------------------------------------
  // Internal Event Emission Helpers
  // -------------------------------------------------------------
  private updateStatus(
    status: EngineConnectionStatus,
    latencyMs: number | null,
    error: string | null
  ): void {
    this.status = status;
    this.latencyMs = latencyMs;
    this.lastError = error;
    this.statusListeners.forEach((cb) => cb(status, latencyMs, error));
  }

  private emitAccount(metrics: AccountMetrics): void {
    this.accountListeners.forEach((cb) => cb(metrics));
  }

  private emitPosition(pos: Trade | null): void {
    this.positionListeners.forEach((cb) => cb(pos));
  }

  private emitHistory(trades: Trade[]): void {
    this.historyListeners.forEach((cb) => cb(trades));
  }

  private emitState(state: OperationalState, message?: string): void {
    this.stateListeners.forEach((cb) => cb(state, message));
  }

  private addLog(level: 'info' | 'warn' | 'error' | 'success', message: string): void {
    const entry: EngineLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      level,
      message,
    };
    this.logs = [entry, ...this.logs.slice(0, 49)];
    this.logListeners.forEach((cb) => cb(entry));
  }

  // -------------------------------------------------------------
  // Public Subscription Listeners
  // -------------------------------------------------------------
  public onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status, this.latencyMs, this.lastError);
    return () => this.statusListeners.delete(cb);
  }

  public onAccount(cb: AccountListener): () => void {
    this.accountListeners.add(cb);
    cb(this.currentMetrics);
    return () => this.accountListeners.delete(cb);
  }

  public onPosition(cb: PositionListener): () => void {
    this.positionListeners.add(cb);
    cb(this.currentPosition);
    return () => this.positionListeners.delete(cb);
  }

  public onHistory(cb: HistoryListener): () => void {
    this.historyListeners.add(cb);
    return () => this.historyListeners.delete(cb);
  }

  public onState(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    cb(this.operationalState);
    return () => this.stateListeners.delete(cb);
  }

  public onLog(cb: LogListener): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  public clearLogs(): void {
    this.logs = [];
    this.logListeners.forEach((cb) =>
      cb({
        id: `clear-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'info',
        message: 'Telemetry console cleared',
      })
    );
  }
}

// Global Singleton Instance
export const executionEngine = new ExecutionEngine();
export default executionEngine;
