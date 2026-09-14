import React from 'react';
import { TradeAlert } from '../types';
import { Mail, Send, Bell, Volume2, Sparkles, CheckCircle, Clock } from 'lucide-react';

interface AlertsListProps {
  alerts: TradeAlert[];
  onTriggerAI: (alert: TradeAlert) => void;
  onResendEmail: (alert: TradeAlert) => void;
  onClearAlerts: () => void;
  userEmail: string;
}

export const AlertsList: React.FC<AlertsListProps> = ({
  alerts,
  onTriggerAI,
  onResendEmail,
  onClearAlerts,
  userEmail,
}) => {
  const fmt = (p: number) => p.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div id="alerts-history-list" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Real-time Buy / Sell Alert Feed ({alerts.length})
          </h3>
        </div>
        {alerts.length > 0 && (
          <button
            onClick={onClearAlerts}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition"
          >
            Clear History
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-xs">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
          <p className="font-medium text-slate-400">No active alerts triggered yet.</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
            The Pine Script engine continuously scans NIFTY, SENSEX, BANK NIFTY, GOLD, SILVER &amp; CRUDE OIL. Use the "Trigger Test Signal" button above to send a test alert to your email &amp; mobile!
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {alerts.map((alert) => {
            const isCall = alert.action.includes('CALL') || alert.action.includes('BUY');
            const timeStr = new Date(alert.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border transition ${
                  isCall
                    ? 'bg-emerald-950/30 border-emerald-800/60 hover:border-emerald-700'
                    : 'bg-rose-950/30 border-rose-800/60 hover:border-rose-700'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                        isCall
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {alert.action}
                    </span>
                    <span className="font-bold text-slate-100 text-sm">{alert.ticker}</span>
                    <span className="text-[11px] text-slate-400 font-mono">@{timeStr}</span>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                      alert.status === 'ACTIVE'
                        ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                        : alert.status === 'TARGET_HIT'
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>

                {/* Price Matrix */}
                <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-slate-950/70 rounded-lg border border-slate-800/80 text-xs font-mono mb-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Entry Price</span>
                    <span className="font-bold text-slate-100">₹{fmt(alert.price)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-400 block font-sans">Stop Loss</span>
                    <span className="font-bold text-rose-400">₹{fmt(alert.slPrice)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400 block font-sans">Target (1:2)</span>
                    <span className="font-bold text-emerald-400">₹{fmt(alert.tgtPrice)}</span>
                  </div>
                </div>

                {/* Pine Filter Verification Badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mb-2.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    VWAP: ₹{fmt(alert.filterSnapshot.vwap)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    Delta: {alert.filterSnapshot.delta.toFixed(2)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    IV: {alert.filterSnapshot.iv.toFixed(1)}%
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-medium">
                    OI: {alert.filterSnapshot.oiBias}
                  </span>
                  {alert.filterSnapshot.volSpike && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                      ⚡ Vol Spike
                    </span>
                  )}
                </div>

                {/* Dispatch Status & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  {/* Delivery Channels */}
                  <div className="flex items-center space-x-2 text-[11px]">
                    <span className="flex items-center space-x-1 text-emerald-400" title={`Email sent to ${userEmail}`}>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email ({userEmail.split('@')[0]}@...)</span>
                    </span>
                    <span className="flex items-center space-x-1 text-sky-400" title="Mobile Push Notification">
                      <Bell className="w-3.5 h-3.5" />
                      <span>Mobile Push</span>
                    </span>
                    <span className="flex items-center space-x-1 text-amber-400" title="Audio Voice Alert">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Voice</span>
                    </span>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onResendEmail(alert)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium flex items-center space-x-1 transition"
                      title="Resend this alert to email & mobile"
                    >
                      <Send className="w-3 h-3" />
                      <span>Resend</span>
                    </button>

                    <button
                      onClick={() => onTriggerAI(alert)}
                      className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-[11px] font-bold flex items-center space-x-1.5 shadow-sm transition"
                      title="Analyze this Pine Script signal using Gemini 3.1 Pro with High Thinking Mode"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>AI Deep Thinking</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
