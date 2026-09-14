import React, { useState } from 'react';
import { Radio, Check, Copy, ExternalLink, Zap, Terminal, Shield, ArrowRight, Play, CheckCircle2, AlertCircle, X, Smartphone } from 'lucide-react';
import { InstrumentSymbol } from '../types';

interface DhanWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol: InstrumentSymbol;
}

export const DhanWebhookModal: React.FC<DhanWebhookModalProps> = ({
  isOpen,
  onClose,
  selectedSymbol,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'app_webhook' | 'dhan_order' | 'tester'>('app_webhook');

  // Test state
  const [testSymbol, setTestSymbol] = useState<string>(selectedSymbol);
  const [testAction, setTestAction] = useState<'BUY' | 'SELL'>('BUY');
  const [testPrice, setTestPrice] = useState<number>(24875);
  const [testQty, setTestQty] = useState<number>(25);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  if (!isOpen) return null;

  const appDhanWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/dhan`
    : 'https://ais-dev-glsblevzzpyxgkaypy5b2b-798977067091.asia-southeast1.run.app/api/webhook/dhan';

  const dhanOfficialWebhookUrl = 'https://api.dhan.co/v2/orders/tradingview';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Sample payloads
  const dhanOrderPayloadSample = `{
  "dhanClientId": "YOUR_DHAN_CLIENT_ID",
  "transactionType": "BUY",
  "exchangeSegment": "NSE_FNO",
  "productType": "INTRADAY",
  "orderType": "MARKET",
  "validity": "DAY",
  "securityId": "13",
  "quantity": 25,
  "price": 0,
  "triggerPrice": 0
}`;

  const dhanTradingViewAlertSample = `{
  "ticker": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": {{close}},
  "sl": {{plot_0}},
  "tgt": {{plot_1}},
  "dhanClientId": "YOUR_DHAN_CLIENT_ID",
  "message": "Dhan TradingView Order Triggered"
}`;

  const handleTriggerTestDhanWebhook = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/webhook/dhan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: testSymbol,
          transactionType: testAction,
          price: testPrice,
          quantity: testQty,
          dhanClientId: "DHAN_1002345",
          productType: "INTRADAY",
          message: `Dhan App Webhook Test: ${testAction} ${testSymbol} @ ₹${testPrice} (Qty: ${testQty})`,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 text-sm">
                  Dhan / Dhani App Webhook Configuration
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800">
                  DHANHQ API v2
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Webhook URLs and payload formats to integrate with Dhan App and TradingView
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

        {/* Tab navigation */}
        <div className="flex items-center space-x-1 p-1.5 bg-slate-950 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('app_webhook')}
            className={`flex-1 py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'app_webhook'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>1. This App Webhook for Dhan</span>
          </button>

          <button
            onClick={() => setActiveTab('dhan_order')}
            className={`flex-1 py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'dhan_order'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>2. Dhan Direct Order URL</span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`py-2 px-4 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'tester'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Test Webhook</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* TAB 1: App Webhook URL */}
          {activeTab === 'app_webhook' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Your Dedicated Webhook URL for Dhan / Dhani App
                </span>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={appDhanWebhookUrl}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-orange-400 font-semibold select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(appDhanWebhookUrl, 'dhan_app_url')}
                    className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold flex items-center space-x-1.5 shadow"
                  >
                    {copiedKey === 'dhan_app_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'dhan_app_url' ? 'Copied!' : 'Copy URL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Any alert sent to this URL is immediately recorded in your trade journal and dispatched to your email (<strong>telangana.shashi@gmail.com</strong>) and mobile push notifications.
                </p>
              </div>

              {/* How to setup in Dhan App */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                  How to setup in Dhan App / web.dhan.co:
                </h4>

                <div className="space-y-2">
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-start space-x-3">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-orange-400 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <div>
                      <span className="font-semibold text-slate-200">Open Dhan App &amp; Navigate to Webhooks</span>
                      <p className="text-slate-400 text-[11px]">
                        Go to <strong>My Profile &gt; DhanHQ Trading APIs &amp; Webhooks &gt; Webhook Alerts</strong> (or visit <code>web.dhan.co</code>).
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-start space-x-3">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-orange-400 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <div>
                      <span className="font-semibold text-slate-200">Paste App Webhook URL in TradingView Alert</span>
                      <p className="text-slate-400 text-[11px]">
                        In your TradingView Alert, enable <strong>Webhook URL</strong> and paste: <code className="text-orange-300 select-all">{appDhanWebhookUrl}</code>
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-start space-x-3">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-orange-400 font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <span className="font-semibold text-slate-200">Message Payload JSON for TradingView</span>
                      <pre className="p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[10.5px] text-slate-300 overflow-x-auto">
                        {dhanTradingViewAlertSample}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(dhanTradingViewAlertSample, 'tv_dhan_sample')}
                        className="text-orange-400 hover:text-orange-300 text-[11px] font-semibold flex items-center space-x-1"
                      >
                        {copiedKey === 'tv_dhan_sample' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'tv_dhan_sample' ? 'Copied Payload!' : 'Copy Alert Payload'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Direct Dhan Order Execution URL */}
          {activeTab === 'dhan_order' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Dhan Official TradingView Order Execution Webhook URL
                </span>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={dhanOfficialWebhookUrl}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 font-semibold select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(dhanOfficialWebhookUrl, 'dhan_exec_url')}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold flex items-center space-x-1.5"
                  >
                    {copiedKey === 'dhan_exec_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'dhan_exec_url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Note: Dhan also provides a personalized Webhook URL containing your secret token in your Dhan Webhook profile.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs">Official Dhan Order Payload (JSON)</span>
                  <button
                    onClick={() => copyToClipboard(dhanOrderPayloadSample, 'dhan_order_json')}
                    className="text-orange-400 hover:text-orange-300 text-[11px] font-semibold flex items-center space-x-1"
                  >
                    {copiedKey === 'dhan_order_json' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'dhan_order_json' ? 'Copied JSON' : 'Copy Payload'}</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10.5px] text-slate-300 overflow-x-auto">
                  {dhanOrderPayloadSample}
                </pre>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <p>• <strong>exchangeSegment</strong>: <code>NSE_FNO</code> (Futures &amp; Options) or <code>NSE_EQ</code> (Equity) or <code>MCX_COMM</code> (Commodity)</p>
                  <p>• <strong>securityId</strong>: Nifty (<code>13</code>), BankNifty (<code>25</code>), Sensex (<code>51</code>), or Option Contract Strike ID</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Interactive Tester */}
          {activeTab === 'tester' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div>
                  <span className="font-bold text-slate-100 text-sm block">Simulate Dhan App Webhook Call</span>
                  <p className="text-[11px] text-slate-400">
                    Test the endpoint now to verify your email and notifications trigger instantly.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Symbol</label>
                    <select
                      value={testSymbol}
                      onChange={(e) => setTestSymbol(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100 text-xs"
                    >
                      <option value="NIFTY">NIFTY</option>
                      <option value="BANKNIFTY">BANKNIFTY</option>
                      <option value="SENSEX">SENSEX</option>
                      <option value="GOLD">MCX GOLD</option>
                      <option value="SILVER">MCX SILVER</option>
                      <option value="CRUDEOIL">MCX CRUDEOIL</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Action</label>
                    <select
                      value={testAction}
                      onChange={(e) => setTestAction(e.target.value as 'BUY' | 'SELL')}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100 text-xs"
                    >
                      <option value="BUY">BUY (CALL)</option>
                      <option value="SELL">SELL (PUT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Price (₹)</label>
                    <input
                      type="number"
                      value={testPrice}
                      onChange={(e) => setTestPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Quantity</label>
                    <input
                      type="number"
                      value={testQty}
                      onChange={(e) => setTestQty(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 font-mono text-slate-100 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Recipient: <strong className="text-slate-200">telangana.shashi@gmail.com</strong>
                  </span>
                  <button
                    onClick={handleTriggerTestDhanWebhook}
                    disabled={isTesting}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center space-x-1.5 transition shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isTesting ? 'Sending Webhook...' : 'Fire Dhan Webhook Test'}</span>
                  </button>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border font-mono text-xs ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800 text-rose-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold mb-1">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{testResult.success ? 'Webhook Successfully Received!' : 'Webhook Error'}</span>
                  </div>
                  <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            DhanHQ Webhook Engine: <strong className="text-orange-400">Active &amp; Ready</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
