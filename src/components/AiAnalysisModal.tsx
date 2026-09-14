import React from 'react';
import { TradeAlert } from '../types';
import { Sparkles, Brain, X, CheckCircle2, ShieldCheck, TrendingUp } from 'lucide-react';

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: TradeAlert | null;
  analysisText: string;
  isLoading: boolean;
  error?: string | null;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  isOpen,
  onClose,
  alert,
  analysisText,
  isLoading,
  error,
}) => {
  if (!isOpen || !alert) return null;

  const fmt = (p: number) => p.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-purple-800/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-b border-purple-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Brain className="w-4 h-4 text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 text-sm">
                  Gemini 3.1 Pro Deep Thinking Analysis
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-900/80 text-purple-300 border border-purple-700">
                  ThinkingLevel.HIGH
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Institutional Confluence &amp; Risk Architecture for {alert.ticker} ({alert.action})
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

        {/* Signal Snapshot Bar */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
          <div>
            <span className="text-slate-400">Signal: </span>
            <span className="font-bold text-emerald-400">{alert.action}</span>
          </div>
          <div>
            <span className="text-slate-400">Price: </span>
            <span className="font-bold text-slate-100">₹{fmt(alert.price)}</span>
          </div>
          <div>
            <span className="text-slate-400">SL: </span>
            <span className="font-bold text-rose-400">₹{fmt(alert.slPrice)}</span>
          </div>
          <div>
            <span className="text-slate-400">Target (1:2): </span>
            <span className="font-bold text-emerald-400">₹{fmt(alert.tgtPrice)}</span>
          </div>
          <div>
            <span className="text-slate-400">OI Bias: </span>
            <span className="font-bold text-amber-400">{alert.filterSnapshot.oiBias}</span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-300">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="relative w-12 h-12 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-purple-500/30"></div>
                <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
                <Sparkles className="w-5 h-5 absolute inset-0 m-auto text-purple-400 animate-pulse" />
              </div>
              <p className="font-semibold text-slate-200 text-sm">
                Thinking in High Reasoning Mode...
              </p>
              <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
                Evaluating VWAP structure, S/R pivot retest validation, Option Delta/IV decay dynamics, and multi-tier trade invalidation parameters.
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 space-y-2">
              <p className="font-bold">Thinking Analysis Notice:</p>
              <p className="text-[11px] text-rose-200">{error}</p>
              <p className="text-[11px] text-slate-400">
                You can attach your GEMINI_API_KEY in the Google AI Studio Settings &gt; Secrets panel to activate live high-thinking model outputs.
              </p>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-3">
              <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl mb-3 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                <span className="text-purple-200 text-[11px]">
                  Institutional Confluence Validated: Model examined mathematical pine logic, delta suitability, and order-flow buildup.
                </span>
              </div>

              {/* Formatted Analysis text */}
              <div className="whitespace-pre-wrap font-sans text-slate-200 text-xs leading-6 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                {analysisText}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-mono">
            Powered by gemini-3.1-pro-preview
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
