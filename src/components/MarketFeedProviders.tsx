import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Wifi,
  Check,
  Copy,
  Server,
  Zap,
  Play,
  RotateCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Code2,
  ExternalLink,
  Cpu,
  Download,
  Radio,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';
import {
  Candle,
  InstrumentSymbol,
  MarketFeedConfig,
  MarketFeedProviderId,
  ProviderConnectionStatus,
} from '../types';

interface MarketFeedProvidersProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol: InstrumentSymbol;
  onCandleNormalized?: (candle: Candle, symbol: InstrumentSymbol) => void;
}

const DEFAULT_CONFIG: MarketFeedConfig = {
  activeProvider: 'kite',
  autoConnect: false,
  timeframeMinutes: 5,
  kite: {
    apiKey: '',
    accessToken: '',
    enctoken: '',
    mode: 'full',
    wsUrl: 'wss://ws.kite.trade',
    enabled: true,
  },
  upstox: {
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    mode: 'full',
    wsUrl: 'wss://api.upstox.com/v2/feed/market-data-feed',
    enabled: false,
  },
  fyers: {
    appId: '',
    accessToken: '',
    dataMode: 'full',
    wsUrl: 'wss://socket.fyers.in/data/v3',
    enabled: false,
  },
};

export const MarketFeedProviders: React.FC<MarketFeedProvidersProps> = ({
  isOpen,
  onClose,
  selectedSymbol,
  onCandleNormalized,
}) => {
  const [activeTab, setActiveTab] = useState<MarketFeedProviderId | 'sandbox' | 'scripts'>('kite');
  const [config, setConfig] = useState<MarketFeedConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Connection testing states
  const [testStatus, setTestStatus] = useState<Record<string, { status: ProviderConnectionStatus; message: string; latency?: number }>>({
    kite: { status: 'disconnected', message: 'Idle' },
    upstox: { status: 'disconnected', message: 'Idle' },
    fyers: { status: 'disconnected', message: 'Idle' },
  });
  const [isTesting, setIsTesting] = useState(false);

  // Zerodha Kite Live Direct WebSocket State
  const [kiteLiveStream, setKiteLiveStream] = useState<{
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    isConnected: boolean;
    connectionType: string;
    totalTicksReceived: number;
    lastTickTimestamp: number | null;
    lastError: string | null;
    activeTokens: number[];
    subscribedSymbols: string[];
  }>({
    status: 'disconnected',
    isConnected: false,
    connectionType: 'none',
    totalTicksReceived: 0,
    lastTickTimestamp: null,
    lastError: null,
    activeTokens: [],
    subscribedSymbols: [],
  });
  const [isKiteConnecting, setIsKiteConnecting] = useState(false);
  const [kiteAuthMethod, setKiteAuthMethod] = useState<'enctoken' | 'api_key'>('enctoken');
  const [showEnctokenGuide, setShowEnctokenGuide] = useState(false);

  // Sandbox / Normalizer Simulation State
  const [simProvider, setSimProvider] = useState<MarketFeedProviderId>('kite');
  const [simSymbol, setSimSymbol] = useState<InstrumentSymbol>(selectedSymbol);
  const [simPrice, setSimPrice] = useState<number>(24880);
  const [simVolume, setSimVolume] = useState<number>(150000);
  const [simOi, setSimOi] = useState<number>(12800000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastRawPayload, setLastRawPayload] = useState<any>(null);
  const [lastNormalizedCandle, setLastNormalizedCandle] = useState<Candle | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [normalizerStats, setNormalizerStats] = useState<{
    totalTicksReceived: number;
    totalCandlesFormed: number;
    providerCounts: Record<string, number>;
  } | null>(null);

  // Load config from server or localStorage on open
  useEffect(() => {
    if (!isOpen) return;

    const loadConfig = async () => {
      try {
        const res = await fetch('/api/market/providers');
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig(data.config);
          }
          if (data.stats) {
            setNormalizerStats(data.stats);
          }
        }
      } catch (err) {
        // Fallback to localStorage
        const saved = localStorage.getItem('pine_market_feed_config');
        if (saved) {
          try {
            setConfig(JSON.parse(saved));
          } catch (_) {}
        }
      }
    };

    loadConfig();
  }, [isOpen]);

  // Update simulation default price based on selected symbol
  useEffect(() => {
    const symbolDefaults: Record<InstrumentSymbol, number> = {
      NIFTY: 24880,
      BANKNIFTY: 53250,
      SENSEX: 81450,
      GOLD: 74300,
      SILVER: 89600,
      CRUDEOIL: 6180,
    };
    setSimPrice(symbolDefaults[simSymbol] || 24880);
  }, [simSymbol]);

  if (!isOpen) return null;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      localStorage.setItem('pine_market_feed_config', JSON.stringify(config));
      const res = await fetch('/api/market/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSaveSuccessMsg('Provider configurations saved and active in engine!');
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      }
    } catch (err: any) {
      setSaveSuccessMsg('Saved to local storage');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (provider: MarketFeedProviderId) => {
    setIsTesting(true);
    setTestStatus((prev) => ({
      ...prev,
      [provider]: { status: 'connecting', message: 'Initiating WebSocket handshake...' },
    }));

    try {
      const payload: any = { provider };
      if (provider === 'kite') {
        payload.apiKey = config.kite.apiKey;
        payload.accessToken = config.kite.accessToken;
        payload.enctoken = config.kite.enctoken;
        payload.wsUrl = config.kite.wsUrl;
      } else if (provider === 'upstox') {
        payload.apiKey = config.upstox.apiKey;
        payload.accessToken = config.upstox.accessToken;
        payload.wsUrl = config.upstox.wsUrl;
      } else if (provider === 'fyers') {
        payload.appId = config.fyers.appId;
        payload.accessToken = config.fyers.accessToken;
        payload.wsUrl = config.fyers.wsUrl;
      }

      const res = await fetch('/api/market/provider-test-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTestStatus((prev) => ({
        ...prev,
        [provider]: {
          status: data.status === 'connected' ? 'connected' : 'error',
          message: data.message || 'Connection verified',
          latency: data.latencyMs,
        },
      }));
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [provider]: {
          status: 'error',
          message: err.message || 'Failed to connect',
        },
      }));
    } finally {
      setIsTesting(false);
    }
  };

  // Poll Kite live stream status periodically
  useEffect(() => {
    if (!isOpen) return;

    const fetchKiteStatus = async () => {
      try {
        const res = await fetch('/api/market/kite/status');
        const data = await res.json();
        if (data.success && data.status) {
          setKiteLiveStream(data.status);
        }
      } catch {}
    };

    fetchKiteStatus();
    const timer = setInterval(fetchKiteStatus, 2500);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Connect to Zerodha Kite Live WebSocket Stream
  const handleConnectKiteLive = async () => {
    setIsKiteConnecting(true);
    try {
      const res = await fetch('/api/market/kite/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.kite.apiKey,
          accessToken: config.kite.accessToken,
          enctoken: config.kite.enctoken,
        }),
      });
      const data = await res.json();
      if (data.status) {
        setKiteLiveStream(data.status);
      }
    } catch (err: any) {
      setKiteLiveStream((prev) => ({
        ...prev,
        status: 'error',
        lastError: err.message,
      }));
    } finally {
      setIsKiteConnecting(false);
    }
  };

  // Disconnect from Zerodha Kite Live WebSocket Stream
  const handleDisconnectKiteLive = async () => {
    try {
      const res = await fetch('/api/market/kite/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.status) {
        setKiteLiveStream(data.status);
      }
    } catch (err) {}
  };

  // 1-Click Download of Python Bridge Script
  const downloadKiteBridgeScript = () => {
    const script = `"""
Zerodha Kite Ticker Live Stream Bridge
Pipes real-time market ticks into your Pine Script Alert System applet.

Requirements:
    pip install kiteconnect requests
"""

import time
import requests
from kiteconnect import KiteTicker

# 1. Credentials
API_KEY = "${config.kite.apiKey || 'YOUR_KITE_API_KEY'}"
ACCESS_TOKEN = "${config.kite.accessToken || 'YOUR_DAILY_ACCESS_TOKEN'}"

# 2. Your Applet Normalizer Ingestion URL
APP_URL = "${streamFeedUrl}"

# Instruments to stream:
# 256265 = NIFTY 50
# 260105 = NIFTY BANK
# 265    = SENSEX
# 53490951 = MCX GOLD FUT
# 53491463 = MCX SILVER FUT
# 53491719 = MCX CRUDE OIL FUT
TOKENS = [256265, 260105, 265, 53490951, 53491463, 53491719]

kws = KiteTicker(API_KEY, ACCESS_TOKEN)

def on_ticks(ws, ticks):
    try:
        # Forwards raw ticks straight into the engine normalizer
        resp = requests.post(
            APP_URL,
            json=ticks,
            headers={"x-broker-provider": "kite"},
            timeout=2.0
        )
        if resp.status_code == 200:
            print(f"[OK] Streamed {len(ticks)} ticks to Pine Script Alert App")
        else:
            print(f"[ERR] {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[ERR] Forwarding failed: {e}")

def on_connect(ws, response):
    print("[CONNECTED] Connected to Zerodha Kite Ticker WebSocket.")
    ws.subscribe(TOKENS)
    ws.set_mode(ws.MODE_FULL, TOKENS)
    print(f"[SUBSCRIBED] Subscribed to {len(TOKENS)} tokens in FULL mode.")

def on_close(ws, code, reason):
    print(f"[CLOSED] WebSocket closed: {code} - {reason}")

def on_error(ws, code, reason):
    print(f"[ERROR] WebSocket error: {code} - {reason}")

kws.on_ticks = on_ticks
kws.on_connect = on_connect
kws.on_close = on_close
kws.on_error = on_error

print("Connecting to Zerodha Kite Ticker...")
kws.connect(threaded=False)
`;

    const blob = new Blob([script], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kite_live_bridge.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate realistic broker payloads for the test simulation
  const generateBrokerPayload = (
    provider: MarketFeedProviderId,
    symbol: InstrumentSymbol,
    price: number,
    volume: number,
    oi: number
  ) => {
    const now = Date.now();
    const tick = symbol === 'CRUDEOIL' ? 1 : symbol === 'NIFTY' ? 0.05 : 0.25;
    const open = Math.round((price - (Math.random() - 0.5) * price * 0.001) / tick) * tick;
    const high = Math.round((Math.max(price, open) + Math.random() * price * 0.0008) / tick) * tick;
    const low = Math.round((Math.min(price, open) - Math.random() * price * 0.0008) / tick) * tick;

    if (provider === 'kite') {
      const tokenMap: Record<InstrumentSymbol, number> = {
        NIFTY: 256265,
        BANKNIFTY: 260105,
        SENSEX: 265,
        GOLD: 53490951,
        SILVER: 53491463,
        CRUDEOIL: 53491719,
      };
      return {
        tradable: true,
        mode: 'full',
        instrument_token: tokenMap[symbol] || 256265,
        last_price: price,
        last_traded_quantity: 50,
        average_traded_price: price - 0.2,
        volume_traded: volume,
        ohlc: { open, high, low, close: price - 0.5 },
        change: 0.18,
        last_trade_time: now,
        oi,
        source: 'ZERODHA_KITE_TICKER',
      };
    }

    if (provider === 'upstox') {
      const upstoxKeyMap: Record<InstrumentSymbol, string> = {
        NIFTY: 'NSE_INDEX|Nifty 50',
        BANKNIFTY: 'NSE_INDEX|Nifty Bank',
        SENSEX: 'BSE_INDEX|SENSEX',
        GOLD: 'MCX_FO|GOLD',
        SILVER: 'MCX_FO|SILVER',
        CRUDEOIL: 'MCX_FO|CRUDEOIL',
      };
      const key = upstoxKeyMap[symbol] || 'NSE_INDEX|Nifty 50';
      return {
        feeds: {
          [key]: {
            ltpc: { ltp: price, ltt: now, cp: price - 0.5 },
            ff: {
              marketFF: {
                marketOHLC: {
                  ohlc: [
                    { interval: 'I1', open, high, low, close: price, vol: volume, ts: now },
                  ],
                },
                eFeedDetails: { totalBuyQty: 450000, totalSellQty: 390000 },
                oi,
              },
            },
          },
        },
        source: 'UPSTOX_MARKET_FEED_V2',
      };
    }

    if (provider === 'fyers') {
      const fyersSymMap: Record<InstrumentSymbol, string> = {
        NIFTY: 'NSE:NIFTY50-INDEX',
        BANKNIFTY: 'NSE:NIFTYBANK-INDEX',
        SENSEX: 'BSE:SENSEX-INDEX',
        GOLD: 'MCX:GOLD24OCTFUT',
        SILVER: 'MCX:SILVER24DECFUT',
        CRUDEOIL: 'MCX:CRUDEOIL24NOVFUT',
      };
      return {
        s: 'ok',
        d: {
          '7208': [
            {
              symbol: fyersSymMap[symbol] || 'NSE:NIFTY50-INDEX',
              ltp: price,
              prev_close_price: price - 0.5,
              high_price: high,
              low_price: low,
              open_price: open,
              vol_traded_today: volume,
              last_traded_time: Math.floor(now / 1000),
              oi,
            },
          ],
        },
        source: 'FYERS_SOCKET_V3',
      };
    }

    return { symbol, price, volume, oi, timestamp: now, source: 'GENERIC_FEED' };
  };

  const handleSimulateStreamTick = async () => {
    setIsSimulating(true);
    try {
      const rawPayload = generateBrokerPayload(simProvider, simSymbol, simPrice, simVolume, simOi);
      setLastRawPayload(rawPayload);

      const res = await fetch('/api/market/stream-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-broker-provider': simProvider,
        },
        body: JSON.stringify(rawPayload),
      });

      const data = await res.json();
      if (data.success && data.results?.[0]?.candle) {
        const normalizedCandle: Candle = data.results[0].candle;
        setLastNormalizedCandle(normalizedCandle);
        if (data.stats) setNormalizerStats(data.stats);

        // Notify parent application so chart reflects this candle!
        if (onCandleNormalized) {
          onCandleNormalized(normalizedCandle, simSymbol);
        }
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const streamFeedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/market/stream-feed`
    : 'https://.../api/market/stream-feed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-100">Market Feed Providers & Engine Normalizer</h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-[11px] font-mono">
                  WebSocket v3 / v2
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure live WebSocket keys for Zerodha Kite, Upstox & Fyers to normalize streaming ticks into 5m Candles & VWAP.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Active Provider Bar */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Active Feed Provider:</span>
            {(['kite', 'upstox', 'fyers'] as MarketFeedProviderId[]).map((prov) => (
              <button
                key={prov}
                onClick={() => setConfig((prev) => ({ ...prev, activeProvider: prov }))}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  config.activeProvider === prov
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {prov === 'kite' ? 'Zerodha Kite' : prov === 'upstox' ? 'Upstox v2' : 'Fyers v3'}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-4 font-mono text-[11px] text-slate-400">
            <div>
              Total Ticks: <span className="text-cyan-400 font-bold">{normalizerStats?.totalTicksReceived || 0}</span>
            </div>
            <div>
              5m Candles Formed: <span className="text-emerald-400 font-bold">{normalizerStats?.totalCandlesFormed || 0}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-300">Engine Normalizer Ready</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('kite')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'kite'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Zerodha Kite</span>
            {config.kite.apiKey && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            onClick={() => setActiveTab('upstox')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'upstox'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Upstox API v2</span>
            {config.upstox.apiKey && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            onClick={() => setActiveTab('fyers')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'fyers'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Fyers API v3</span>
            {config.fyers.appId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'sandbox'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Normalizer Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('scripts')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'scripts'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>WebSocket Bridges</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: ZERODHA KITE */}
          {activeTab === 'kite' && (
            <div className="space-y-5">
              {/* LIVE WEBSOCKET STATUS & CONTROL CARD */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  kiteLiveStream.isConnected
                    ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/40'
                    : kiteLiveStream.status === 'connecting' || isKiteConnecting
                    ? 'bg-amber-950/30 border-amber-500/50'
                    : kiteLiveStream.status === 'error'
                    ? 'bg-rose-950/30 border-rose-500/50'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        kiteLiveStream.isConnected
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : kiteLiveStream.status === 'connecting' || isKiteConnecting
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      }`}
                    >
                      <Radio
                        className={`w-5 h-5 ${
                          kiteLiveStream.isConnected
                            ? 'animate-pulse'
                            : kiteLiveStream.status === 'connecting' || isKiteConnecting
                            ? 'animate-spin'
                            : ''
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-100">
                          Zerodha Kite Live WebSocket Stream
                        </h3>
                        {kiteLiveStream.isConnected ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            <span>STREAMING LIVE</span>
                          </span>
                        ) : kiteLiveStream.status === 'connecting' || isKiteConnecting ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            <span>CONNECTING...</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <span>DISCONNECTED</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Direct server-side binary WebSocket connection parsing ticks for Nifty, Bank Nifty, Sensex & MCX
                      </p>
                    </div>
                  </div>

                  {/* Connect / Disconnect Buttons */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {kiteLiveStream.isConnected ? (
                      <button
                        onClick={handleDisconnectKiteLive}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow transition"
                      >
                        Disconnect Stream
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectKiteLive}
                        disabled={isKiteConnecting || (!config.kite.enctoken && (!config.kite.apiKey || !config.kite.accessToken))}
                        className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white rounded-lg text-xs font-bold shadow-md shadow-orange-950 transition flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Zap className={`w-3.5 h-3.5 ${isKiteConnecting ? 'animate-spin' : ''}`} />
                        <span>{isKiteConnecting ? 'Connecting...' : 'Connect Live Stream'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Metrics if Connected or Error message if Error */}
                {kiteLiveStream.isConnected && (
                  <div className="mt-4 pt-3 border-t border-emerald-900/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400/80 block">Ticks Received</span>
                      <span className="text-emerald-200 font-mono font-bold text-sm">
                        {kiteLiveStream.totalTicksReceived.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400/80 block">Session Type</span>
                      <span className="text-emerald-200 font-mono font-semibold text-xs">
                        {kiteLiveStream.connectionType === 'enctoken' ? 'Free Enctoken' : 'Kite Connect API'}
                      </span>
                    </div>
                    <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400/80 block">Subscribed Tokens</span>
                      <span className="text-emerald-200 font-mono font-semibold text-xs">
                        {kiteLiveStream.activeTokens.length || 6} Instruments
                      </span>
                    </div>
                    <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400/80 block">Last Packet</span>
                      <span className="text-emerald-200 font-mono text-xs">
                        {kiteLiveStream.lastTickTimestamp
                          ? new Date(kiteLiveStream.lastTickTimestamp).toLocaleTimeString()
                          : 'Receiving...'}
                      </span>
                    </div>
                  </div>
                )}

                {kiteLiveStream.lastError && (
                  <div className="mt-3 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Connection issue: </span>
                      <span>{kiteLiveStream.lastError}</span>
                      <p className="text-[11px] text-rose-400/80 mt-1">
                        Zerodha enctoken or access tokens expire daily (or at 6:00 AM IST). If authentication fails, grab a fresh enctoken from kite.zerodha.com cookies.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* AUTHENTICATION METHOD SELECTOR */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Authentication Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setKiteAuthMethod('enctoken')}
                    className={`p-3 rounded-xl text-left border transition ${
                      kiteAuthMethod === 'enctoken'
                        ? 'bg-orange-950/40 border-orange-500 ring-1 ring-orange-500/30 text-white'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-300">
                        Method 1: Free Enctoken (Recommended)
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        100% FREE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Zero API subscription required (no ₹2,000/mo fee). Uses your active web session cookie from kite.zerodha.com.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setKiteAuthMethod('api_key')}
                    className={`p-3 rounded-xl text-left border transition ${
                      kiteAuthMethod === 'api_key'
                        ? 'bg-orange-950/40 border-orange-500 ring-1 ring-orange-500/30 text-white'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-300">
                        Method 2: Kite Connect Developer API
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                        OFFICIAL API
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      For traders who subscribed to the official Zerodha Kite Connect developer portal with API Key & daily access_token.
                    </p>
                  </button>
                </div>
              </div>

              {/* METHOD 1: ENCTOKEN INPUT & INTERACTIVE GUIDE */}
              {kiteAuthMethod === 'enctoken' && (
                <div className="space-y-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                        <span>Zerodha Enctoken</span>
                        <span className="text-orange-400">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowEnctokenGuide(!showEnctokenGuide)}
                        className="text-xs text-orange-400 hover:text-orange-300 flex items-center space-x-1 transition underline"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>{showEnctokenGuide ? 'Hide Guide' : 'How to get Enctoken (3 steps)'}</span>
                      </button>
                    </div>
                    <input
                      type="password"
                      value={config.kite.enctoken || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          kite: { ...prev.kite, enctoken: e.target.value.trim() },
                        }))
                      }
                      placeholder="Paste your enctoken string here (e.g. jf98437h237f...)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Stored securely in your server engine. Used directly to initiate the binary WebSocket tick session.
                    </p>
                  </div>

                  {/* Step-by-step Visual Tutorial */}
                  {showEnctokenGuide && (
                    <div className="p-3.5 rounded-lg bg-orange-950/20 border border-orange-800/40 text-xs text-slate-300 space-y-2.5">
                      <div className="font-bold text-orange-300 flex items-center space-x-1.5">
                        <Info className="w-4 h-4" />
                        <span>How to copy your Enctoken from Zerodha Kite in 15 seconds:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                        <li>
                          Open your browser (Chrome, Brave, Edge, etc.) and log in to{' '}
                          <a
                            href="https://kite.zerodha.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-orange-400 underline font-semibold"
                          >
                            kite.zerodha.com
                          </a>
                          .
                        </li>
                        <li>
                          Press <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px]">F12</kbd>{' '}
                          (or right-click anywhere on the page and select <strong>Inspect</strong>) to open Developer Tools.
                        </li>
                        <li>
                          Click the <strong>Application</strong> tab (in Firefox: <strong>Storage</strong>) at the top of Developer Tools.
                        </li>
                        <li>
                          In the left sidebar, expand <strong>Cookies</strong> and click on{' '}
                          <code className="px-1 bg-slate-900 rounded text-orange-300">https://kite.zerodha.com</code>.
                        </li>
                        <li>
                          Find the cookie named <strong className="text-orange-300">enctoken</strong>, double-click its <strong>Value</strong> to select it, press <kbd className="px-1 bg-slate-800 rounded font-mono text-[10px]">Ctrl+C</kbd> (or <kbd className="px-1 bg-slate-800 rounded font-mono text-[10px]">Cmd+C</kbd>), and paste it above!
                        </li>
                        <li>
                          Click <strong className="text-orange-400">Connect Live Stream</strong> at the top of this card!
                        </li>
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* METHOD 2: OFFICIAL KITE CONNECT API KEY & TOKEN */}
              {kiteAuthMethod === 'api_key' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Kite API Key <span className="text-orange-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={config.kite.apiKey}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            kite: { ...prev.kite, apiKey: e.target.value },
                          }))
                        }
                        placeholder="e.g. your_kite_api_key"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-orange-500"
                      />
                      <Key className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Daily Access Token <span className="text-orange-400">*</span>
                    </label>
                    <input
                      type="password"
                      value={config.kite.accessToken}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          kite: { ...prev.kite, accessToken: e.target.value },
                        }))
                      }
                      placeholder="Enter active session access_token"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Generated daily through Kite Connect login flow.
                    </span>
                  </div>
                </div>
              )}

              {/* STREAMING SETTINGS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    WebSocket Streaming Mode
                  </label>
                  <select
                    value={config.kite.mode}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        kite: { ...prev.kite, mode: e.target.value as any },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="full">Full (LTP + OHLC + Volume + OI) - Recommended</option>
                    <option value="quote">Quote (LTP + OHLC + Volume)</option>
                    <option value="ltp">LTP Only (Lightweight)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kite Ticker WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={config.kite.wsUrl}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        kite: { ...prev.kite, wsUrl: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Status & Test Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">Connection Handshake:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      testStatus.kite.status === 'connected'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : testStatus.kite.status === 'connecting'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : testStatus.kite.status === 'error'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {testStatus.kite.status.toUpperCase()}
                  </span>
                  {testStatus.kite.latency && (
                    <span className="text-slate-500 font-mono">({testStatus.kite.latency}ms)</span>
                  )}
                  <span className="text-slate-400 text-[11px] truncate max-w-xs">{testStatus.kite.message}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTestConnection('kite')}
                    disabled={isTesting}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>Test Handshake</span>
                  </button>
                </div>
              </div>

              {/* Token Mapping Reference */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-300">
                    Zerodha Token Mapping (Auto-Subscribed & Normalized by Engine)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono">NSE + BSE + MCX Active</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px] font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-orange-400 font-bold block">256265</span>
                    <span className="text-slate-300 font-semibold">NIFTY 50</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-orange-400 font-bold block">260105</span>
                    <span className="text-slate-300 font-semibold">BANK NIFTY</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-orange-400 font-bold block">265</span>
                    <span className="text-slate-300 font-semibold">SENSEX</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-orange-400 font-bold block">53490951</span>
                    <span className="text-slate-300 font-semibold">GOLD FUT</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-orange-400 font-bold block">53491463</span>
                    <span className="text-slate-300 font-semibold">SILVER FUT</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-orange-400 font-bold block">53491719</span>
                    <span className="text-slate-300 font-semibold">CRUDEOIL</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UPSTOX API V2 */}
          {activeTab === 'upstox' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-purple-200 flex items-center space-x-2">
                    <span>Upstox API v2 Market Data Feed</span>
                    <span className="px-2 py-0.5 rounded bg-purple-900/60 text-[10px] text-purple-300 font-mono">
                      wss://api.upstox.com/v2/feed/market-data-feed
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Upstox v2 WebSocket streams high-frequency market depth, 1-minute OHLC, total buy/sell quantities, and open interest for NSE & MCX instruments using Protocol Buffers or JSON.
                  </p>
                </div>
                <a
                  href="https://upstox.com/developer/api-documentation/#tag/Market-Data-Feed"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 text-xs text-purple-400 hover:text-purple-300 transition underline underline-offset-4 shrink-0"
                >
                  <span>Upstox Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Upstox API Key <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.upstox.apiKey}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        upstox: { ...prev.upstox, apiKey: e.target.value },
                      }))
                    }
                    placeholder="Enter your Upstox App API Key"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Upstox API Secret
                  </label>
                  <input
                    type="password"
                    value={config.upstox.apiSecret}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        upstox: { ...prev.upstox, apiSecret: e.target.value },
                      }))
                    }
                    placeholder="Enter Upstox App Secret"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Bearer Access Token <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={config.upstox.accessToken}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        upstox: { ...prev.upstox, accessToken: e.target.value },
                      }))
                    }
                    placeholder="Paste your active OAuth 2.0 Bearer Token"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Acquired via Upstox authorization code flow (`POST /v2/login/authorization/token`).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Feed Mode
                  </label>
                  <select
                    value={config.upstox.mode}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        upstox: { ...prev.upstox, mode: e.target.value as any },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="full">Full (Market OHLC + Volume + OI + Depth) - Recommended</option>
                    <option value="ltpc">LTPC (Last Traded Price & Close)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    WebSocket Feed URL
                  </label>
                  <input
                    type="text"
                    value={config.upstox.wsUrl}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        upstox: { ...prev.upstox, wsUrl: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Status & Test Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">Connection Handshake:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      testStatus.upstox.status === 'connected'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : testStatus.upstox.status === 'connecting'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : testStatus.upstox.status === 'error'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {testStatus.upstox.status.toUpperCase()}
                  </span>
                  {testStatus.upstox.latency && (
                    <span className="text-slate-500 font-mono">({testStatus.upstox.latency}ms)</span>
                  )}
                  <span className="text-slate-400 text-[11px] truncate max-w-xs">{testStatus.upstox.message}</span>
                </div>

                <button
                  onClick={() => handleTestConnection('upstox')}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>
              </div>

              {/* Instrument Keys Guide */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-300 mb-2">Upstox Instrument Keys Reference</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-purple-400 font-bold block">NSE_INDEX|Nifty 50</span>
                    <span className="text-slate-400">NIFTY</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-purple-400 font-bold block">NSE_INDEX|Nifty Bank</span>
                    <span className="text-slate-400">BANK NIFTY</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-purple-400 font-bold block">BSE_INDEX|SENSEX</span>
                    <span className="text-slate-400">SENSEX</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-purple-400 font-bold block">MCX_FO|GOLD</span>
                    <span className="text-slate-400">GOLD</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-purple-400 font-bold block">MCX_FO|SILVER</span>
                    <span className="text-slate-400">SILVER</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-purple-400 font-bold block">MCX_FO|CRUDEOIL</span>
                    <span className="text-slate-400">CRUDEOIL</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FYERS API V3 */}
          {activeTab === 'fyers' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-blue-200 flex items-center space-x-2">
                    <span>Fyers API v3 WebSocket Feed</span>
                    <span className="px-2 py-0.5 rounded bg-blue-900/60 text-[10px] text-blue-300 font-mono">
                      wss://socket.fyers.in/data/v3
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Fyers v3 WebSocket delivers sub-millisecond price updates, open interest accumulation, and daily high/lows directly into the engine normalizer.
                  </p>
                </div>
                <a
                  href="https://myapi.fyers.in/docs/#tag/WebSocket-Data"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition underline underline-offset-4 shrink-0"
                >
                  <span>Fyers Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Fyers App ID (Client ID) <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.fyers.appId}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        fyers: { ...prev.fyers, appId: e.target.value },
                      }))
                    }
                    placeholder="e.g. XC12345-100"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Found in your Fyers API dashboard under registered apps.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Daily Bearer Access Token <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={config.fyers.accessToken}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        fyers: { ...prev.fyers, accessToken: e.target.value },
                      }))
                    }
                    placeholder="Paste active Fyers Bearer JWT Token"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Data Mode
                  </label>
                  <select
                    value={config.fyers.dataMode}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        fyers: { ...prev.fyers, dataMode: e.target.value as any },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="full">Full (LTP + Open + High + Low + Volume + OI) - Recommended</option>
                    <option value="lite">Lite (LTP Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Fyers WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={config.fyers.wsUrl}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        fyers: { ...prev.fyers, wsUrl: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Status & Test Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">Connection Handshake:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      testStatus.fyers.status === 'connected'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : testStatus.fyers.status === 'connecting'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : testStatus.fyers.status === 'error'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {testStatus.fyers.status.toUpperCase()}
                  </span>
                  {testStatus.fyers.latency && (
                    <span className="text-slate-500 font-mono">({testStatus.fyers.latency}ms)</span>
                  )}
                  <span className="text-slate-400 text-[11px] truncate max-w-xs">{testStatus.fyers.message}</span>
                </div>

                <button
                  onClick={() => handleTestConnection('fyers')}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>
              </div>

              {/* Symbol Mapping Guide */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-300 mb-2">Fyers Symbol Format Reference</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-blue-400 font-bold block">NSE:NIFTY50-INDEX</span>
                    <span className="text-slate-400">NIFTY</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-blue-400 font-bold block">NSE:NIFTYBANK-INDEX</span>
                    <span className="text-slate-400">BANK NIFTY</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-blue-400 font-bold block">BSE:SENSEX-INDEX</span>
                    <span className="text-slate-400">SENSEX</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-blue-400 font-bold block">MCX:GOLD24OCTFUT</span>
                    <span className="text-slate-400">GOLD</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-blue-400 font-bold block">MCX:SILVER24DECFUT</span>
                    <span className="text-slate-400">SILVER</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-blue-400 font-bold block">MCX:CRUDEOIL24NOVFUT</span>
                    <span className="text-slate-400">CRUDEOIL</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NORMALIZER ENGINE SANDBOX & LIVE STREAM TESTER */}
          {activeTab === 'sandbox' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-200 flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      <span>Live Feed Normalizer Sandbox</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Simulate or test streaming ticks from Zerodha Kite, Upstox, or Fyers to inspect how the backend engine middleware processes the raw broker packet into the standard <code className="text-emerald-300">Candle</code> format with rolling VWAP.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-mono">
                    Timeframe: 5m
                  </div>
                </div>
              </div>

              {/* Simulation Controls */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-200">Interactive Feed Ingestion Simulator</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Provider Format</label>
                    <select
                      value={simProvider}
                      onChange={(e) => setSimProvider(e.target.value as MarketFeedProviderId)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="kite">Zerodha Kite</option>
                      <option value="upstox">Upstox API v2</option>
                      <option value="fyers">Fyers API v3</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Instrument</label>
                    <select
                      value={simSymbol}
                      onChange={(e) => setSimSymbol(e.target.value as InstrumentSymbol)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="NIFTY">NIFTY 50</option>
                      <option value="BANKNIFTY">BANK NIFTY</option>
                      <option value="SENSEX">SENSEX</option>
                      <option value="GOLD">GOLD</option>
                      <option value="SILVER">SILVER</option>
                      <option value="CRUDEOIL">CRUDE OIL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Tick Price (₹)</label>
                    <input
                      type="number"
                      value={simPrice}
                      onChange={(e) => setSimPrice(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Tick Volume</label>
                    <input
                      type="number"
                      value={simVolume}
                      onChange={(e) => setSimVolume(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Open Interest (OI)</label>
                    <input
                      type="number"
                      value={simOi}
                      onChange={(e) => setSimOi(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400">
                    Sends to: <code className="text-cyan-400 font-mono">POST /api/market/stream-feed</code>
                  </span>
                  <button
                    onClick={handleSimulateStreamTick}
                    disabled={isSimulating}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-500/20 transition flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isSimulating ? 'Processing Tick...' : 'Send Raw Packet & Normalize'}</span>
                  </button>
                </div>
              </div>

              {/* Side-by-Side: Raw Input vs Normalized Candle Output */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Raw Broker Feed Payload */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>1. Raw Incoming Broker Payload</span>
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {simProvider} format
                    </span>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-amber-300/90 overflow-x-auto max-h-56">
                    {lastRawPayload
                      ? JSON.stringify(lastRawPayload, null, 2)
                      : '// Click "Send Raw Packet & Normalize" above to trigger a live sample'}
                  </pre>
                </div>

                {/* Right: Normalized Candle Output */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>2. Normalized Candle Format Output</span>
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                      Standard Candle Interface
                    </span>
                  </div>

                  {lastNormalizedCandle ? (
                    <div className="space-y-2">
                      <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-40">
                        {JSON.stringify(lastNormalizedCandle, null, 2)}
                      </pre>
                      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1">
                        <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-center">
                          <span className="text-slate-400 block">OHLC</span>
                          <span className="text-slate-200 font-bold">
                            {lastNormalizedCandle.open} / {lastNormalizedCandle.close}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-center">
                          <span className="text-slate-400 block">Rolling VWAP</span>
                          <span className="text-cyan-400 font-bold">₹{lastNormalizedCandle.vwap || '—'}</span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-center">
                          <span className="text-slate-400 block">Bar Volume</span>
                          <span className="text-amber-400 font-bold">{lastNormalizedCandle.volume.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-center text-xs text-slate-500 p-4 text-center">
                      No ticks normalized yet. Hit "Send Raw Packet & Normalize" to test.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PYTHON & NODE.JS WEBSOCKET BRIDGES */}
          {activeTab === 'scripts' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40">
                <h3 className="text-sm font-semibold text-cyan-200 flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <span>Standalone WebSocket Client Bridges</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Run these lightweight scripts on your local terminal or VPS with your broker credentials. They establish the persistent WebSocket connection with Zerodha Kite, Upstox, or Fyers and stream ticks directly to this app's normalizer endpoint.
                </p>
              </div>

              {/* Ingestion URL Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Your Streaming Ingestion Endpoint:</span>
                  <span className="text-xs font-mono text-cyan-300">{streamFeedUrl}</span>
                </div>
                <button
                  onClick={() => copyText(streamFeedUrl, 'stream-url')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center space-x-1"
                >
                  {copiedKey === 'stream-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'stream-url' ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>

              {/* Kite Python Bridge */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-300">Option 1: Zerodha Kite Ticker Bridge (Python Standalone)</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={downloadKiteBridgeScript}
                      className="px-2.5 py-1 bg-orange-950 hover:bg-orange-900 text-orange-300 border border-orange-700/60 rounded text-xs flex items-center space-x-1"
                      title="Download executable python bridge"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download .py</span>
                    </button>
                    <button
                      onClick={() =>
                        copyText(
                          `import requests\nfrom kiteconnect import KiteTicker\n\nkws = KiteTicker("${config.kite.apiKey || 'YOUR_API_KEY'}", "${config.kite.accessToken || 'YOUR_ACCESS_TOKEN'}")\nAPP_URL = "${streamFeedUrl}"\n\ndef on_ticks(ws, ticks):\n    try:\n        requests.post(APP_URL, json=ticks, headers={"x-broker-provider": "kite"}, timeout=2)\n    except Exception as e:\n        pass\n\ndef on_connect(ws, response):\n    # 256265 = NIFTY 50, 260105 = BANK NIFTY\n    ws.subscribe([256265, 260105])\n    ws.set_mode(ws.MODE_FULL, [256265, 260105])\n\nkws.on_ticks = on_ticks\nkws.on_connect = on_connect\nkws.connect()`,
                          'kite-py'
                        )
                      }
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center space-x-1"
                    >
                      {copiedKey === 'kite-py' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'kite-py' ? 'Copied' : 'Copy Script'}</span>
                    </button>
                  </div>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
{`import requests
from kiteconnect import KiteTicker

kws = KiteTicker("${config.kite.apiKey || 'YOUR_API_KEY'}", "${config.kite.accessToken || 'YOUR_ACCESS_TOKEN'}")
APP_URL = "${streamFeedUrl}"

def on_ticks(ws, ticks):
    try:
        # Pipes directly into our backend engine normalizer
        requests.post(APP_URL, json=ticks, headers={"x-broker-provider": "kite"}, timeout=2)
    except Exception as e:
        pass

def on_connect(ws, response):
    # Subscribe to NIFTY (256265) & BANK NIFTY (260105)
    ws.subscribe([256265, 260105])
    ws.set_mode(ws.MODE_FULL, [256265, 260105])

kws.on_ticks = on_ticks
kws.on_connect = on_connect
kws.connect()`}
                </pre>
              </div>

              {/* Fyers / Upstox Node.js Bridge */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300">Option 2: Fyers / Upstox Node.js WebSocket Forwarder</span>
                  <button
                    onClick={() =>
                      copyText(
                        `const WebSocket = require('ws');\nconst axios = require('axios');\n\nconst APP_URL = '${streamFeedUrl}';\nconst ws = new WebSocket('${config.fyers.wsUrl || 'wss://socket.fyers.in/data/v3'}');\n\nws.on('message', async (data) => {\n  try {\n    const payload = JSON.parse(data);\n    await axios.post(APP_URL, payload, { headers: { 'x-broker-provider': 'fyers' } });\n  } catch (err) {}\n});`,
                        'fyers-node'
                      )
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center space-x-1"
                  >
                    {copiedKey === 'fyers-node' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'fyers-node' ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
{`const WebSocket = require('ws');
const axios = require('axios');

const APP_URL = '${streamFeedUrl}';
const ws = new WebSocket('${config.fyers.wsUrl || 'wss://socket.fyers.in/data/v3'}');

ws.on('message', async (data) => {
  try {
    const payload = JSON.parse(data);
    await axios.post(APP_URL, payload, { headers: { 'x-broker-provider': 'fyers' } });
  } catch (err) {}
});`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            {saveSuccessMsg ? (
              <span className="text-emerald-400 font-medium flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{saveSuccessMsg}</span>
              </span>
            ) : (
              <span className="text-slate-400">
                Credentials are saved securely in app engine memory & local state.
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Close
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save & Activate Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
