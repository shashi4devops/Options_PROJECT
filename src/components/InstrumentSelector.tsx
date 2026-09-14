import React from 'react';
import { InstrumentConfig, InstrumentSymbol } from '../types';
import { TrendingUp, TrendingDown, Zap, Send, ShieldAlert } from 'lucide-react';

interface InstrumentSelectorProps {
  instruments: InstrumentConfig[];
  selectedSymbol: InstrumentSymbol;
  onSelect: (symbol: InstrumentSymbol) => void;
  currentPrices: Record<InstrumentSymbol, number>;
  priceChanges: Record<InstrumentSymbol, { diff: number; pct: number }>;
  onForceSignal: (symbol: InstrumentSymbol, type: 'BUY' | 'SELL') => void;
  onQuickTestEmail: () => void;
  userEmail: string;
}

export const InstrumentSelector: React.FC<InstrumentSelectorProps> = ({
  instruments,
  selectedSymbol,
  onSelect,
  currentPrices,
  priceChanges,
  onForceSignal,
  onQuickTestEmail,
  userEmail,
}) => {
  const fmt = (p: number) => p.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div id="instrument-selector-bar" className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-3">
      {/* Instrument Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {instruments.map((inst) => {
          const isSelected = inst.symbol === selectedSymbol;
          const price = currentPrices[inst.symbol] || inst.defaultPrice;
          const change = priceChanges[inst.symbol] || { diff: 0, pct: 0 };
          const isPositive = change.pct >= 0;

          return (
            <button
              key={inst.symbol}
              onClick={() => onSelect(inst.symbol)}
              className={`p-2.5 rounded-lg text-left transition border ${
                isSelected
                  ? 'bg-slate-800 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-slate-200">{inst.symbol}</span>
                <span className="text-[10px] text-slate-500 font-mono px-1 rounded bg-slate-900">
                  {inst.exchange}
                </span>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-100">
                ₹{fmt(price)}
              </div>
              <div className={`flex items-center space-x-1 text-[10px] font-mono mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                <span>{isPositive ? '+' : ''}{change.pct.toFixed(2)}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Action Toolbar */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-medium text-[11px]">Instant Signal Testing on {selectedSymbol}:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Force Buy Call Alert */}
          <button
            onClick={() => onForceSignal(selectedSymbol, 'BUY')}
            className="px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 transition shadow-sm"
            title={`Simulate instant Pine BUY CALL signal for ${selectedSymbol} & dispatch to mobile and email`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Test BUY CALL</span>
          </button>

          {/* Force Buy Put Alert */}
          <button
            onClick={() => onForceSignal(selectedSymbol, 'SELL')}
            className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 transition shadow-sm"
            title={`Simulate instant Pine BUY PUT signal for ${selectedSymbol} & dispatch to mobile and email`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Test BUY PUT</span>
          </button>

          {/* Quick Email Dispatch */}
          <button
            onClick={onQuickTestEmail}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-xs flex items-center space-x-1.5 transition border border-slate-700"
            title={`Send test trade alert directly to ${userEmail}`}
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Dispatch Test Email</span>
            <span className="sm:hidden">Test Email</span>
          </button>
        </div>
      </div>
    </div>
  );
};
