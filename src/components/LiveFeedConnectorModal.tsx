import React, { useState, useEffect } from 'react';
import { Radio, Check, Copy, Terminal, ExternalLink, Activity, Server, Zap, Globe, X, Play, RefreshCw } from 'lucide-react';
import { InstrumentSymbol } from '../types';

interface LiveFeedStatus {
  activeSources: string[];
  totalTicksReceived: number;
  instruments: Array<{
    symbol: string;
    lastPrice: number;
    source: string;
    lastUpdated: number;
    latencySeconds: number;
    isLive: boolean;
  }>;
}

interface LiveFeedConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendCustomTick: (symbol: InstrumentSymbol, price: number, volume?: number, oi?: number) => Promise<boolean>;
  selectedSymbol: InstrumentSymbol;
}

export const LiveFeedConnectorModal: React.FC<LiveFeedConnectorModalProps> = ({
  isOpen,
  onClose,
  onSendCustomTick,
  selectedSymbol,
}) => {
  const [activeTab, setActiveTab] = useState<'tradingview' | 'brokers' | 'api' | 'status'>('tradingview');
  const [feedStatus, setFeedStatus] = useState<LiveFeedStatus | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manual Tick Injection Form state
  const [tickSymbol, setTickSymbol] = useState<InstrumentSymbol>(selectedSymbol);
  const [tickPrice, setTickPrice] = useState<number>(24865);
  const [tickVolume, setTickVolume] = useState<number>(18500);
  const [tickOI, setTickOI] = useState<number>(12500000);
  const [isSubmittingTick, setIsSubmittingTick] = useState(false);
  const [tickStatusMsg, setTickStatusMsg] = useState<string | null>(null);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/tradingview`
    : 'https://.../api/webhook/tradingview';

  const tickEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/market/tick`
    : 'https://.../api/market/tick';

  // Fetch status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/market/live-feed-status');
      const data = await res.json();
      setFeedStatus(data);
    } catch (e) {
      console.warn('Failed to fetch feed status:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePushTestTick = async () => {
    setIsSubmittingTick(true);
    setTickStatusMsg(null);
    try {
      const ok = await onSendCustomTick(tickSymbol, tickPrice, tickVolume, tickOI);
      if (ok) {
        setTickStatusMsg(`Live tick for ${tickSymbol} (₹${tickPrice}) successfully fed into strategy engine!`);
        fetchStatus();
      } else {
        setTickStatusMsg('Failed to inject tick.');
      }
    } catch (err: any) {
      setTickStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsSubmittingTick(false);
    }
  };

  // Python DhanHQ Code snippet
  const pythonDhanScript = `# ============================================================
# dhan_live_feed_bridge.py
# Streams real-time NSE, BSE & MCX ticks from DhanHQ WebSocket
# directly into your Pine Script Alert System applet.
# ============================================================
import json
import requests
import websocket # pip install websocket-client requests

APP_TICK_URL = "${tickEndpoint}"
DHAN_CLIENT_ID = "YOUR_DHAN_CLIENT_ID"
DHAN_ACCESS_TOKEN = "YOUR_DHAN_ACCESS_TOKEN"

# Symbols: NIFTY, BANKNIFTY, SENSEX, GOLD, SILVER, CRUDEOIL
INSTRUMENT_MAP = {
    "13": "NIFTY",       # Nifty 50 Index token
    "25": "BANKNIFTY",   # Bank Nifty token
    "51": "SENSEX",      # BSE Sensex token
    "1001": "GOLD",      # MCX Gold Future
    "1002": "SILVER",    # MCX Silver Future
    "1003": "CRUDEOIL"   # MCX Crude Oil Future
}

def on_message(ws, message):
    data = json.loads(message)
    # Parse Dhan tick packet
    security_id = str(data.get("security_id"))
    symbol = INSTRUMENT_MAP.get(security_id)
    if symbol and "LTP" in data:
        payload = {
            "symbol": symbol,
            "price": float(data["LTP"]),
            "volume": int(data.get("volume", 0)),
            "oi": int(data.get("oi", 0)),
            "source": "DHAN_WEBSOCKET"
        }
        # Post tick to the applet
        requests.post(APP_TICK_URL, json=payload, timeout=2)
        print(f"[LIVE TICK FED] {symbol} @ ₹{payload['price']}")

def on_open(ws):
    print("Connected to Dhan live market WebSocket feed!")
    # Subscribe to tokens...
    sub_msg = {"RequestCode": 15, "InstrumentCount": 6, "InstrumentList": [{"ExchangeSegment": "NSE_FNO", "SecurityId": "13"}]}
    ws.send(json.dumps(sub_msg))

ws = websocket.WebSocketApp(
    "wss://api-feed.dhan.co",
    header={"access-token": DHAN_ACCESS_TOKEN, "client-id": DHAN_CLIENT_ID},
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()`;

  // Python Zerodha Kite Code snippet
  const pythonKiteScript = `# ============================================================
# kite_live_feed_bridge.py
# Streams real-time ticks from Zerodha Kite Ticker to your app
# ============================================================
from kiteconnect import KiteTicker
import requests

APP_TICK_URL = "${tickEndpoint}"
API_KEY = "YOUR_KITE_API_KEY"
ACCESS_TOKEN = "YOUR_KITE_ACCESS_TOKEN"

kws = KiteTicker(API_KEY, ACCESS_TOKEN)

# Kite Instrument Tokens (example)
TOKENS = {
    256265: "NIFTY",
    260105: "BANKNIFTY",
    265: "SENSEX",
    53490951: "GOLD",
    53491463: "SILVER",
    53491719: "CRUDEOIL"
}

def on_ticks(ws, ticks):
    for tick in ticks:
        token = tick.get("instrument_token")
        symbol = TOKENS.get(token)
        if symbol:
            requests.post(APP_TICK_URL, json={
                "symbol": symbol,
                "price": tick.get("last_price"),
                "volume": tick.get("volume_traded", 0),
                "oi": tick.get("oi", 0),
                "source": "ZERODHA_KITE"
            }, timeout=2)
            print(f"[KITE LIVE] {symbol} ₹{tick.get('last_price')}")

def on_connect(ws, response):
    ws.subscribe(list(TOKENS.keys()))
    ws.set_mode(ws.MODE_FULL, list(TOKENS.keys()))

kws.on_ticks = on_ticks
kws.on_connect = on_connect
kws.connect()`;

  // Curl example
  const curlExample = `curl -X POST "${tickEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{"symbol": "NIFTY", "price": 24875.50, "volume": 25000, "oi": 12800000, "source": "MY_LIVE_FEED"}'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 text-sm">
                  Live NSE / BSE &amp; MCX Feed Integration Guide
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  REAL-TIME BRIDGE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Connect live tick-by-tick prices and Option Chain OI for Nifty, BankNifty, Sensex, Gold, Silver &amp; Crude Oil
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 p-1.5 bg-slate-950 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('tradingview')}
            className={`flex-1 py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'tradingview'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>1. TradingView Webhook (Zero Fees)</span>
          </button>

          <button
            onClick={() => setActiveTab('brokers')}
            className={`flex-1 py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'brokers'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>2. Indian Broker WebSockets</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`flex-1 py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'api'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>3. Direct REST Ingestion &amp; Test</span>
          </button>

          <button
            onClick={() => setActiveTab('status')}
            className={`py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'status'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Feed Status</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* TAB 1: TRADINGVIEW WEBHOOK (RECOMMENDED) */}
          {activeTab === 'tradingview' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-1">
                <span className="font-bold text-emerald-300 text-sm flex items-center space-x-1.5">
                  <Check className="w-4 h-4" />
                  <span>Why TradingView Webhook is the #1 Recommended Method:</span>
                </span>
                <p className="text-[11px] text-emerald-100 leading-relaxed">
                  Your strategy is written in <strong>Pine Script v5</strong>. TradingView already has the official, real-time tick feeds directly from <strong>NSE</strong> (NIFTY, BANKNIFTY), <strong>BSE</strong> (SENSEX), and <strong>MCX</strong> (GOLD, SILVER, CRUDEOIL).
                  By connecting TradingView Alerts to this applet, you get 100% accurate exchange data and automatic execution without paying ₹2,000–₹5,000/month for raw exchange feeds!
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                  3 Simple Steps to Hook Up Live NSE/BSE/MCX:
                </h4>

                <div className="space-y-2.5">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start space-x-3">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-200 block">Open TradingView Chart</span>
                      <p className="text-slate-400 text-[11px]">
                        Open the 5-minute chart for your desired symbol (e.g. <code>NSE:NIFTY</code>, <code>NSE:BANKNIFTY</code>, <code>BSE:SENSEX</code>, <code>MCX:GOLD1!</code>, <code>MCX:SILVER1!</code>, or <code>MCX:CRUDEOIL1!</code>).
                        In Pine Editor, paste the strategy code and click <strong>"Add to chart"</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start space-x-3">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <span className="font-semibold text-slate-200 block">Create Alert with App Webhook URL</span>
                      <p className="text-slate-400 text-[11px]">
                        Press <code>Alt + A</code> (or click the Clock Alert icon). Set <strong>Condition</strong> to the strategy name. Check <strong>"Webhook URL"</strong> and paste this exact URL:
                      </p>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          readOnly
                          value={webhookUrl}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono select-all"
                        />
                        <button
                          onClick={() => copyToClipboard(webhookUrl, 'tv_url')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center space-x-1"
                        >
                          {copiedKey === 'tv_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'tv_url' ? 'Copied' : 'Copy URL'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start space-x-3">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <span className="font-semibold text-slate-200 block">Set Alert Message Template</span>
                      <p className="text-slate-400 text-[11px]">
                        In the TradingView Alert Message box, paste this JSON payload:
                      </p>
                      <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto">
{`{
  "ticker": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": {{close}},
  "sl": {{plot_0}},
  "tgt": {{plot_1}},
  "message": "BUY/SELL signal triggered"
}`}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(`{\n  "ticker": "{{ticker}}",\n  "action": "{{strategy.order.action}}",\n  "price": {{close}},\n  "sl": {{plot_0}},\n  "tgt": {{plot_1}},\n  "message": "BUY/SELL signal triggered"\n}`, 'tv_json')}
                        className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center space-x-1"
                      >
                        {copiedKey === 'tv_json' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'tv_json' ? 'Copied JSON Template' : 'Copy Message JSON'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BROKER WEBSOCKETS (DHAN, KITE, ANGEL ONE) */}
          {activeTab === 'brokers' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-slate-200 text-sm">Direct Indian Broker WebSocket Feeds</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  If you hold a demat account with <strong>DhanHQ</strong> (free API), <strong>Zerodha Kite</strong>, <strong>Angel One SmartAPI</strong>, <strong>Upstox</strong>, or <strong>Fyers</strong>, you can stream real-time ticks and Option Chain OI from your terminal to this app via WebSocket.
                </p>
              </div>

              {/* DhanHQ Bridge */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-bold font-mono text-[10px]">
                      Option A: DhanHQ (Free for Demat users)
                    </span>
                    <span className="text-slate-300 font-semibold">Python Dhan WebSocket Bridge</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(pythonDhanScript, 'dhan_py')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium flex items-center space-x-1"
                  >
                    {copiedKey === 'dhan_py' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'dhan_py' ? 'Copied' : 'Copy Python Script'}</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[10.5px] text-slate-300 overflow-x-auto max-h-48">
                  <code>{pythonDhanScript}</code>
                </pre>
              </div>

              {/* Zerodha Kite Bridge */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 font-bold font-mono text-[10px]">
                      Option B: Zerodha Kite Connect
                    </span>
                    <span className="text-slate-300 font-semibold">Kite Ticker Python Bridge</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(pythonKiteScript, 'kite_py')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium flex items-center space-x-1"
                  >
                    {copiedKey === 'kite_py' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'kite_py' ? 'Copied' : 'Copy Python Script'}</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[10.5px] text-slate-300 overflow-x-auto max-h-48">
                  <code>{pythonKiteScript}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: DIRECT REST INGESTION & INTERACTIVE INJECTION */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200 text-sm block">
                  Interactive Live Tick Injector
                </span>
                <p className="text-[11px] text-slate-400">
                  Inject a live tick directly to test the strategy engine, VWAP calculations, and alert triggers in real time!
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Instrument</label>
                    <select
                      value={tickSymbol}
                      onChange={(e) => setTickSymbol(e.target.value as InstrumentSymbol)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100"
                    >
                      <option value="NIFTY">NIFTY 50</option>
                      <option value="BANKNIFTY">BANK NIFTY</option>
                      <option value="SENSEX">SENSEX</option>
                      <option value="GOLD">MCX GOLD</option>
                      <option value="SILVER">MCX SILVER</option>
                      <option value="CRUDEOIL">MCX CRUDE OIL</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Price (₹)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={tickPrice}
                      onChange={(e) => setTickPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Volume</label>
                    <input
                      type="number"
                      value={tickVolume}
                      onChange={(e) => setTickVolume(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Open Interest (OI)</label>
                    <input
                      type="number"
                      value={tickOI}
                      onChange={(e) => setTickOI(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-emerald-400 font-mono">
                    {tickStatusMsg || `Ready to inject tick into ${tickSymbol}`}
                  </span>
                  <button
                    onClick={handlePushTestTick}
                    disabled={isSubmittingTick}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center space-x-1.5 transition shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isSubmittingTick ? 'Feeding...' : 'Inject Live Tick'}</span>
                  </button>
                </div>
              </div>

              {/* cURL Specification */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">HTTP REST Ingestion Endpoint</span>
                  <button
                    onClick={() => copyToClipboard(curlExample, 'curl_cmd')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center space-x-1"
                  >
                    {copiedKey === 'curl_cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'curl_cmd' ? 'Copied' : 'Copy cURL'}</span>
                  </button>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Any external program (Python, Node.js, Excel, or broker terminal) can push ticks to: <code>{tickEndpoint}</code>
                </p>
                <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto">
                  <code>{curlExample}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE FEED STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="text-xs text-slate-400 block">Total Ingested Ticks:</span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    {feedStatus?.totalTicksReceived || 0} ticks
                  </span>
                </div>
                <button
                  onClick={fetchStatus}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Status</span>
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Latest Price</th>
                      <th className="px-3 py-2">Feed Source</th>
                      <th className="px-3 py-2">Latency</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {feedStatus?.instruments.map((inst) => (
                      <tr key={inst.symbol} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-bold text-slate-200">{inst.symbol}</td>
                        <td className="px-3 py-2 text-slate-100 font-semibold">
                          ₹{inst.lastPrice.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-[11px]">{inst.source}</td>
                        <td className="px-3 py-2 text-slate-400">
                          {inst.latencySeconds}s ago
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              inst.isLive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                inst.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                              }`}
                            ></span>
                            <span>{inst.isLive ? 'LIVE' : 'STANDBY'}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Active Feed Receiver: <strong className="text-emerald-400">TradingView &amp; Broker Ingestion Bridge</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
