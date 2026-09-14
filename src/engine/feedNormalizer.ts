import { Candle, InstrumentSymbol, MarketFeedProviderId, NormalizedTick } from '../types';

/**
 * Token and symbol mapping dictionaries for Indian Brokers
 */
export const BROKER_SYMBOL_MAPPINGS: Record<MarketFeedProviderId, Record<string, InstrumentSymbol>> = {
  kite: {
    '256265': 'NIFTY', // NSE Nifty 50 Index
    '260105': 'BANKNIFTY', // NSE Nifty Bank Index
    '265': 'SENSEX', // BSE Sensex Index
    '53490951': 'GOLD', // MCX Gold Future
    '53491463': 'SILVER', // MCX Silver Future
    '53491719': 'CRUDEOIL', // MCX Crude Oil Future
    // Text symbols fallback
    'NIFTY 50': 'NIFTY',
    'NIFTY BANK': 'BANKNIFTY',
    'SENSEX': 'SENSEX',
    'GOLD': 'GOLD',
    'SILVER': 'SILVER',
    'CRUDEOIL': 'CRUDEOIL',
  },
  upstox: {
    'NSE_INDEX|Nifty 50': 'NIFTY',
    'NSE_INDEX|Nifty Bank': 'BANKNIFTY',
    'BSE_INDEX|SENSEX': 'SENSEX',
    'MCX_FO|GOLD': 'GOLD',
    'MCX_FO|SILVER': 'SILVER',
    'MCX_FO|CRUDEOIL': 'CRUDEOIL',
    // Generic keys
    'NIFTY': 'NIFTY',
    'BANKNIFTY': 'BANKNIFTY',
    'SENSEX': 'SENSEX',
  },
  fyers: {
    'NSE:NIFTY50-INDEX': 'NIFTY',
    'NSE:NIFTYBANK-INDEX': 'BANKNIFTY',
    'BSE:SENSEX-INDEX': 'SENSEX',
    'MCX:GOLD24OCTFUT': 'GOLD',
    'MCX:SILVER24DECFUT': 'SILVER',
    'MCX:CRUDEOIL24NOVFUT': 'CRUDEOIL',
    // Generic keys
    'NIFTY': 'NIFTY',
    'BANKNIFTY': 'BANKNIFTY',
    'SENSEX': 'SENSEX',
    'GOLD': 'GOLD',
    'SILVER': 'SILVER',
    'CRUDEOIL': 'CRUDEOIL',
  },
  dhan: {
    '13': 'NIFTY',
    '25': 'BANKNIFTY',
    '51': 'SENSEX',
    '1001': 'GOLD',
    '1002': 'SILVER',
    '1003': 'CRUDEOIL',
    'NIFTY': 'NIFTY',
    'BANKNIFTY': 'BANKNIFTY',
    'SENSEX': 'SENSEX',
    'GOLD': 'GOLD',
    'SILVER': 'SILVER',
    'CRUDEOIL': 'CRUDEOIL',
  },
};

/**
 * Resolves any raw symbol or broker instrument token to standard InstrumentSymbol
 */
export function resolveInstrumentSymbol(rawKey: string | number, provider?: MarketFeedProviderId): InstrumentSymbol {
  const strKey = String(rawKey).trim();
  
  if (provider && BROKER_SYMBOL_MAPPINGS[provider]?.[strKey]) {
    return BROKER_SYMBOL_MAPPINGS[provider][strKey];
  }

  // Cross-check all providers
  for (const prov of ['kite', 'upstox', 'fyers', 'dhan'] as MarketFeedProviderId[]) {
    if (BROKER_SYMBOL_MAPPINGS[prov][strKey]) {
      return BROKER_SYMBOL_MAPPINGS[prov][strKey];
    }
  }

  // Heuristic string matching
  const upper = strKey.toUpperCase();
  if (upper.includes('BANK')) return 'BANKNIFTY';
  if (upper.includes('NIFTY')) return 'NIFTY';
  if (upper.includes('SENSEX')) return 'SENSEX';
  if (upper.includes('GOLD')) return 'GOLD';
  if (upper.includes('SILVER')) return 'SILVER';
  if (upper.includes('CRUDE')) return 'CRUDEOIL';

  return 'NIFTY';
}

/**
 * Normalizes raw broker WebSocket feed payloads into unified NormalizedTick
 */
export function normalizeBrokerPayload(
  payload: any,
  preferredProvider?: MarketFeedProviderId
): NormalizedTick[] {
  if (!payload) return [];
  const ticks: NormalizedTick[] = [];
  const now = Date.now();

  // 1. Array of packets (e.g. Zerodha Kite binary-unpacked ticks)
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const normalized = normalizeSinglePayload(item, preferredProvider || 'kite');
      if (normalized) ticks.push(normalized);
    }
    return ticks;
  }

  // 2. Upstox v2 Market Feed protobuf/JSON object structure
  // Structure: { feeds: { [instrument_key]: { ltpc: { ltp, cp }, ff: { ... } } } }
  if (payload.feeds && typeof payload.feeds === 'object') {
    for (const [instKey, feedData] of Object.entries<any>(payload.feeds)) {
      const symbol = resolveInstrumentSymbol(instKey, 'upstox');
      const ltp = Number(feedData?.ltpc?.ltp || feedData?.ff?.marketFF?.marketOHLC?.ohlc?.[0]?.close || 0);
      if (ltp > 0) {
        const ohlc = feedData?.ff?.marketFF?.marketOHLC?.ohlc?.[0];
        const volume = Number(ohlc?.vol || feedData?.ff?.marketFF?.v || 0);
        const oi = Number(feedData?.ff?.marketFF?.oi || 0);
        const timestamp = Number(feedData?.ltpc?.ltt || feedData?.timestamp || now);

        ticks.push({
          symbol,
          price: ltp,
          open: ohlc?.open ? Number(ohlc.open) : undefined,
          high: ohlc?.high ? Number(ohlc.high) : undefined,
          low: ohlc?.low ? Number(ohlc.low) : undefined,
          volume,
          oi,
          provider: 'upstox',
          timestamp: timestamp > 1000000000 ? timestamp : now,
        });
      }
    }
    if (ticks.length > 0) return ticks;
  }

  // 3. Fyers API v3 WebSocket response structure
  // Structure: { s: 'ok', d: { "7208": [ { symbol, ltp, high_price, low_price, open_price, vol_traded_today } ] } }
  if (payload.d && typeof payload.d === 'object') {
    for (const group of Object.values<any>(payload.d)) {
      const list = Array.isArray(group) ? group : [group];
      for (const item of list) {
        if (item && (item.ltp !== undefined || item.symbol)) {
          const symbol = resolveInstrumentSymbol(item.symbol || item.name, 'fyers');
          const ltp = Number(item.ltp || 0);
          if (ltp > 0) {
            ticks.push({
              symbol,
              price: ltp,
              open: item.open_price ? Number(item.open_price) : undefined,
              high: item.high_price ? Number(item.high_price) : undefined,
              low: item.low_price ? Number(item.low_price) : undefined,
              volume: Number(item.vol_traded_today || item.volume || 0),
              oi: Number(item.oi || 0),
              provider: 'fyers',
              timestamp: item.last_traded_time ? item.last_traded_time * 1000 : now,
            });
          }
        }
      }
    }
    if (ticks.length > 0) return ticks;
  }

  // 4. Single item fallback
  const single = normalizeSinglePayload(payload, preferredProvider);
  if (single) ticks.push(single);

  return ticks;
}

function normalizeSinglePayload(
  item: any,
  preferredProvider: MarketFeedProviderId = 'kite'
): NormalizedTick | null {
  if (!item || typeof item !== 'object') return null;

  // Zerodha Kite tick format
  // { instrument_token: 256265, last_price: 24850, volume_traded: 15000, ohlc: { ... }, oi: 120000 }
  const rawToken = item.instrument_token || item.token || item.security_id || item.symbol || item.ticker;
  const ltp = Number(item.last_price ?? item.price ?? item.ltp ?? item.avgPrice ?? 0);
  if (!ltp || isNaN(ltp)) return null;

  const symbol = resolveInstrumentSymbol(rawToken, preferredProvider);
  const now = Date.now();

  let provider: MarketFeedProviderId = preferredProvider;
  if (item.source?.toLowerCase().includes('kite') || item.instrument_token) provider = 'kite';
  else if (item.source?.toLowerCase().includes('upstox') || item.feeds) provider = 'upstox';
  else if (item.source?.toLowerCase().includes('fyers') || item.fy_symbol) provider = 'fyers';
  else if (item.source?.toLowerCase().includes('dhan')) provider = 'dhan';

  return {
    symbol,
    price: ltp,
    open: item.ohlc?.open ?? item.open,
    high: item.ohlc?.high ?? item.high,
    low: item.ohlc?.low ?? item.low,
    volume: Number(item.volume_traded ?? item.volume ?? item.last_traded_quantity ?? 100),
    oi: item.oi !== undefined ? Number(item.oi) : undefined,
    provider,
    timestamp: Number(item.last_trade_time ?? item.timestamp ?? now),
  };
}

/**
 * In-Memory Candle Aggregator Engine
 * Normalizes live streaming ticks into standard 5-minute OHLCV candles with VWAP
 */
export class StreamingCandleNormalizer {
  private timeframeMs: number;
  private activeCandles: Map<InstrumentSymbol, Candle> = new Map();
  private candleHistory: Map<InstrumentSymbol, Candle[]> = new Map();
  private cumulativeTypicalVol: Map<InstrumentSymbol, number> = new Map();
  private cumulativeVol: Map<InstrumentSymbol, number> = new Map();
  private totalTicksReceived: number = 0;
  private totalCandlesFormed: number = 0;
  private providerCounts: Record<string, number> = {
    kite: 0,
    upstox: 0,
    fyers: 0,
    dhan: 0,
    tradingview: 0,
  };

  constructor(timeframeMinutes: number = 5) {
    this.timeframeMs = timeframeMinutes * 60 * 1000;
  }

  /**
   * Initializes historical candles for an instrument
   */
  public seedCandles(symbol: InstrumentSymbol, candles: Candle[]): void {
    this.candleHistory.set(symbol, [...candles]);
    if (candles.length > 0) {
      this.activeCandles.set(symbol, { ...candles[candles.length - 1] });
    }
  }

  /**
   * Ingests a normalized tick and updates/forms 5-minute Candles
   */
  public processTick(tick: NormalizedTick): {
    candle: Candle;
    newCandleOpened: boolean;
    symbol: InstrumentSymbol;
    history: Candle[];
  } {
    this.totalTicksReceived++;
    this.providerCounts[tick.provider] = (this.providerCounts[tick.provider] || 0) + 1;

    const symbol = tick.symbol;
    const tickTime = tick.timestamp || Date.now();
    const tickPrice = tick.price;
    const tickVol = Math.max(1, tick.volume || 100);

    // Calculate current candle bar bucket boundary (e.g. 09:15:00, 09:20:00)
    const candleTime = Math.floor(tickTime / this.timeframeMs) * this.timeframeMs;

    let activeCandle = this.activeCandles.get(symbol);
    let history = this.candleHistory.get(symbol) || [];
    let newCandleOpened = false;

    // Check if we need to roll to a new candle
    if (!activeCandle || candleTime > activeCandle.time) {
      if (activeCandle) {
        // Finalize previous candle in history
        history.push({ ...activeCandle });
        if (history.length > 150) history.shift();
        this.totalCandlesFormed++;
      }

      // Initialize brand new candle bar
      activeCandle = {
        time: candleTime,
        open: tick.open ?? tickPrice,
        high: tick.high ? Math.max(tick.high, tickPrice) : tickPrice,
        low: tick.low ? Math.min(tick.low, tickPrice) : tickPrice,
        close: tickPrice,
        volume: tickVol,
      };
      newCandleOpened = true;
    } else {
      // Update the active candle in the current bar timeframe
      activeCandle.high = Math.max(activeCandle.high, tickPrice, tick.high ?? tickPrice);
      activeCandle.low = Math.min(activeCandle.low, tickPrice, tick.low ?? tickPrice);
      activeCandle.close = tickPrice;
      activeCandle.volume += tickVol;
    }

    // Incremental VWAP computation: Typical Price = (H + L + C) / 3
    const typicalPrice = (activeCandle.high + activeCandle.low + activeCandle.close) / 3;
    const prevCumTPV = this.cumulativeTypicalVol.get(symbol) || 0;
    const prevCumV = this.cumulativeVol.get(symbol) || 0;

    const newCumTPV = prevCumTPV + typicalPrice * tickVol;
    const newCumV = prevCumV + tickVol;
    this.cumulativeTypicalVol.set(symbol, newCumTPV);
    this.cumulativeVol.set(symbol, newCumV);

    activeCandle.vwap = Math.round((newCumTPV / Math.max(1, newCumV)) * 100) / 100;

    this.activeCandles.set(symbol, activeCandle);
    this.candleHistory.set(symbol, history);

    return {
      candle: { ...activeCandle },
      newCandleOpened,
      symbol,
      history: [...history, { ...activeCandle }],
    };
  }

  public getCandles(symbol: InstrumentSymbol): Candle[] {
    const history = this.candleHistory.get(symbol) || [];
    const active = this.activeCandles.get(symbol);
    if (active && (!history.length || history[history.length - 1].time !== active.time)) {
      return [...history, { ...active }];
    }
    return history;
  }

  public getStats() {
    return {
      totalTicksReceived: this.totalTicksReceived,
      totalCandlesFormed: this.totalCandlesFormed,
      providerCounts: this.providerCounts,
    };
  }
}

// Global singleton instance for applet engine
export const globalStreamingNormalizer = new StreamingCandleNormalizer(5);
