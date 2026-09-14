import React from 'react';
import { PineScriptParams, OIBias, SLType } from '../types';
import { Sliders, RotateCcw } from 'lucide-react';

interface PineParamsFormProps {
  params: PineScriptParams;
  onChange: (updated: PineScriptParams) => void;
  onReset: () => void;
  instrumentName: string;
}

export const PineParamsForm: React.FC<PineParamsFormProps> = ({
  params,
  onChange,
  onReset,
  instrumentName,
}) => {
  const updateField = <K extends keyof PineScriptParams>(key: K, val: PineScriptParams[K]) => {
    onChange({ ...params, [key]: val });
  };

  return (
    <div id="pine-params-form" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Pine Script Strategy Inputs ({instrumentName})
          </h3>
        </div>
        <button
          onClick={onReset}
          className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition"
          title="Reset to default Pine script values"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* 1. Manual Option Data (from Option Chain) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            1. Manual Option Data (Option Chain)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">group=g_opt</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Option Delta */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Current Delta (ATM ≈ 0.5)</span>
              <span className="font-mono font-bold text-emerald-400">{params.manDelta.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.manDelta}
              onChange={(e) => updateField('manDelta', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Min: {params.deltaMin}</span>
              <span>Max: {params.deltaMax}</span>
            </div>
          </div>

          {/* Implied Volatility (IV) */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Current IV (%)</span>
              <span className="font-mono font-bold text-amber-400">{params.manIV.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="45"
              step="0.5"
              value={params.manIV}
              onChange={(e) => updateField('manIV', parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Threshold: Max {params.ivHighTh}%</span>
              <span className={params.manIV <= params.ivHighTh ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {params.manIV <= params.ivHighTh ? 'IV OK' : 'IV TOO HIGH'}
              </span>
            </div>
          </div>

          {/* OI Bias Dropdown */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <label className="block text-slate-300 mb-1">OI Bias (read from chain)</label>
            <select
              value={params.oiBiasInput}
              onChange={(e) => updateField('oiBiasInput', e.target.value as OIBias)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="Long Buildup">Long Buildup (Bullish)</option>
              <option value="Short Covering">Short Covering (Bullish)</option>
              <option value="Short Buildup">Short Buildup (Bearish)</option>
              <option value="Long Unwinding">Long Unwinding (Bearish)</option>
              <option value="Neutral">Neutral (No Bias)</option>
            </select>
          </div>

          {/* Expiry Date */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <label className="block text-slate-300 mb-1">Expiry Date (YYYY-MM-DD)</label>
            <div className="grid grid-cols-3 gap-1">
              <input
                type="number"
                value={params.expiryYear}
                onChange={(e) => updateField('expiryYear', parseInt(e.target.value) || 2026)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono text-slate-100"
              />
              <input
                type="number"
                min="1"
                max="12"
                value={params.expiryMonth}
                onChange={(e) => updateField('expiryMonth', parseInt(e.target.value) || 9)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono text-slate-100"
              />
              <input
                type="number"
                min="1"
                max="31"
                value={params.expiryDay}
                onChange={(e) => updateField('expiryDay', parseInt(e.target.value) || 25)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-mono text-slate-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. VWAP & Support/Resistance Structure */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
            2. VWAP & Structure (Pivot S/R)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">group=g_pa</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Pivot Left Bars</span>
            <input
              type="number"
              min="3"
              max="50"
              value={params.leftBars}
              onChange={(e) => updateField('leftBars', parseInt(e.target.value) || 15)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
            />
          </div>

          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Pivot Right Bars</span>
            <input
              type="number"
              min="3"
              max="50"
              value={params.rightBars}
              onChange={(e) => updateField('rightBars', parseInt(e.target.value) || 15)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
            />
          </div>

          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Retest Tol %</span>
            <input
              type="number"
              step="0.05"
              min="0.01"
              max="2.0"
              value={params.retestTol}
              onChange={(e) => updateField('retestTol', parseFloat(e.target.value) || 0.15)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
            />
          </div>

          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Max S/R Levels</span>
            <input
              type="number"
              min="2"
              max="12"
              value={params.maxLevels}
              onChange={(e) => updateField('maxLevels', parseInt(e.target.value) || 6)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 3. Volume Filter & Risk Management */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            3. Volume & Risk Management (SL / TP)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">group=g_vol &amp; g_risk</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Vol MA Len</span>
            <input
              type="number"
              min="5"
              max="50"
              value={params.volMALen}
              onChange={(e) => updateField('volMALen', parseInt(e.target.value) || 20)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
            />
          </div>

          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Vol Spike Mult</span>
            <input
              type="number"
              step="0.1"
              min="1.0"
              max="3.0"
              value={params.volMult}
              onChange={(e) => updateField('volMult', parseFloat(e.target.value) || 1.3)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
            />
          </div>

          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">SL Type</span>
            <select
              value={params.slType}
              onChange={(e) => updateField('slType', e.target.value as SLType)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
            >
              <option value="Points">Points</option>
              <option value="ATR">ATR Based</option>
            </select>
          </div>

          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[11px]">
              {params.slType === 'Points' ? 'SL Points' : 'ATR Mult'}
            </span>
            {params.slType === 'Points' ? (
              <input
                type="number"
                min="5"
                max="1000"
                value={params.slPoints}
                onChange={(e) => updateField('slPoints', parseFloat(e.target.value) || 20)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
              />
            ) : (
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="5.0"
                value={params.atrMult}
                onChange={(e) => updateField('atrMult', parseFloat(e.target.value) || 1.5)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
              />
            )}
          </div>
        </div>

        <div className="mt-2.5 bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-300">Reward-to-Risk (RR) Ratio Multiple:</span>
          <div className="flex items-center space-x-2">
            {[1.5, 2.0, 2.5, 3.0].map((val) => (
              <button
                key={val}
                onClick={() => updateField('rr', val)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${params.rr === val ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                1:{val}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
