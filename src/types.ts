export type InstrumentSymbol = 'NIFTY' | 'BANKNIFTY' | 'SENSEX' | 'GOLD' | 'SILVER' | 'CRUDEOIL';

export interface InstrumentConfig {
  symbol: InstrumentSymbol;
  name: string;
  category: 'INDEX' | 'COMMODITY';
  exchange: 'NSE' | 'BSE' | 'MCX';
  unit: string;
  tickSize: number;
  lotSize: number;
  defaultPrice: number;
  defaultSlPoints: number;
  volMultiplier: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

export type OIBias = 'Long Buildup' | 'Short Buildup' | 'Short Covering' | 'Long Unwinding' | 'Neutral';
export type SLType = 'Points' | 'ATR';

export interface PineScriptParams {
  // Manual Option Data
  manDelta: number;
  deltaMin: number;
  deltaMax: number;
  manIV: number;
  ivHighTh: number;
  oiBiasInput: OIBias;
  expiryYear: number;
  expiryMonth: number;
  expiryDay: number;
  minDaysToExpiry: number;

  // VWAP & Structure
  leftBars: number;
  rightBars: number;
  retestTol: number; // percentage, e.g. 0.15
  maxLevels: number;
  extendBars: number;

  // Volume
  volMALen: number;
  volMult: number;

  // Risk Management
  slType: SLType;
  slPoints: number;
  atrLen: number;
  atrMult: number;
  rr: number;
}

export interface PivotLevel {
  id: string;
  price: number;
  isRes: boolean;
  state: 0 | 1 | 2; // 0: untouched, 1: broken, 2: retested
  barIndex: number;
  time: number;
}

export interface PineCalculationResult {
  vwapVal: number;
  atrVal: number;
  volMA: number;
  volSpike: boolean;
  deltaOK: boolean;
  ivOK: boolean;
  oiBullish: boolean;
  oiBearish: boolean;
  daysToExpiry: number;
  expiryOK: boolean;
  bullResSignal: boolean;
  bearSupSignal: boolean;
  longCondition: boolean;
  shortCondition: boolean;
  priceAboveVWAP: boolean;
  resLevels: PivotLevel[];
  supLevels: PivotLevel[];
  entryPrice?: number;
  slPrice?: number;
  tgtPrice?: number;
  riskPts?: number;
}

export interface TradeAlert {
  id: string;
  ticker: InstrumentSymbol;
  name: string;
  action: 'BUY CALL' | 'BUY PUT';
  timestamp: number;
  price: number;
  slPrice: number;
  tgtPrice: number;
  riskPts: number;
  rewardPts: number;
  rrRatio: number;
  status: 'ACTIVE' | 'TARGET_HIT' | 'SL_HIT' | 'CANCELLED';
  currentPrice: number;
  pnlPoints: number;
  reason: string;
  filterSnapshot: {
    vwap: number;
    volSpike: boolean;
    oiBias: OIBias;
    delta: number;
    iv: number;
    daysToExpiry: number;
  };
  dispatches: {
    email: { sent: boolean; recipient: string; time: number; error?: string };
    telegram?: { sent: boolean; time: number; error?: string };
    browserPush?: { sent: boolean; time: number };
    audio?: { played: boolean; time: number };
    webhook?: { sent: boolean; time: number };
  };
  aiAnalysis?: string;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  targetEmail: string;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  browserPushEnabled: boolean;
  audioVoiceEnabled: boolean;
  webhookUrl: string;
  autoSendAlerts: boolean;
}

// Market Feed Providers Types (Fyers, Upstox, Zerodha Kite)
export type MarketFeedProviderId = 'kite' | 'upstox' | 'fyers' | 'dhan';

export type ProviderConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'streaming' | 'error';

export interface KiteConfig {
  apiKey: string;
  accessToken: string;
  enctoken?: string;
  mode: 'full' | 'quote' | 'ltp';
  wsUrl: string;
  enabled: boolean;
}

export interface UpstoxConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  mode: 'full' | 'ltpc';
  wsUrl: string;
  enabled: boolean;
}

export interface FyersConfig {
  appId: string;
  accessToken: string;
  dataMode: 'full' | 'lite';
  wsUrl: string;
  enabled: boolean;
}

export interface MarketFeedConfig {
  activeProvider: MarketFeedProviderId;
  autoConnect: boolean;
  timeframeMinutes: number; // e.g. 5
  kite: KiteConfig;
  upstox: UpstoxConfig;
  fyers: FyersConfig;
}

export interface NormalizedTick {
  symbol: InstrumentSymbol;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume: number;
  oi?: number;
  provider: MarketFeedProviderId | 'tradingview' | 'manual';
  timestamp: number;
}

export interface NormalizerStreamStats {
  totalTicksReceived: number;
  totalCandlesFormed: number;
  providerCounts: Record<string, number>;
  lastTickTime: number;
  activeInstrument: InstrumentSymbol;
  lastNormalizedCandle?: Candle;
}
