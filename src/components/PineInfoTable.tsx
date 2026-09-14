import React from 'react';
import { PineCalculationResult, PineScriptParams } from '../types';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface PineInfoTableProps {
  calc: PineCalculationResult;
  params: PineScriptParams;
  currentClose: number;
}

export const PineInfoTable: React.FC<PineInfoTableProps> = ({ calc, params, currentClose }) => {
  const isAboveVWAP = currentClose > calc.vwapVal;

  return (
    <div id="pine-info-table" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Pine Script Strategy Filter Table
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
          Pine v5 Table Mirror
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/80 text-slate-300 font-semibold uppercase text-[11px]">
            <tr>
              <th className="px-3 py-2 border-b border-slate-700">Filter</th>
              <th className="px-3 py-2 border-b border-slate-700">Value / Setting</th>
              <th className="px-3 py-2 border-b border-slate-700 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {/* Delta */}
            <tr className="hover:bg-slate-800/30">
              <td className="px-3 py-2 font-sans font-medium text-slate-300">Delta</td>
              <td className="px-3 py-2 text-slate-400">
                {params.manDelta.toFixed(2)} <span className="text-[10px] text-slate-500">[{params.deltaMin}-{params.deltaMax}]</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold ${calc.deltaOK ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                  {calc.deltaOK ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                  {calc.deltaOK ? 'OK' : 'FAIL'}
                </span>
              </td>
            </tr>

            {/* IV */}
            <tr className="hover:bg-slate-800/30">
              <td className="px-3 py-2 font-sans font-medium text-slate-300">IV (%)</td>
              <td className="px-3 py-2 text-slate-400">
                {params.manIV.toFixed(1)}% <span className="text-[10px] text-slate-500">[Max: {params.ivHighTh}%]</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold ${calc.ivOK ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                  {calc.ivOK ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                  {calc.ivOK ? 'OK' : 'HIGH'}
                </span>
              </td>
            </tr>

            {/* OI Bias */}
            <tr className="hover:bg-slate-800/30">
              <td className="px-3 py-2 font-sans font-medium text-slate-300">OI Bias</td>
              <td className="px-3 py-2 text-slate-200 font-semibold">{params.oiBiasInput}</td>
              <td className="px-3 py-2 text-right">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  calc.oiBullish
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : calc.oiBearish
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {calc.oiBullish ? 'BULLISH' : calc.oiBearish ? 'BEARISH' : 'NEUTRAL'}
                </span>
              </td>
            </tr>

            {/* Days to Expiry */}
            <tr className="hover:bg-slate-800/30">
              <td className="px-3 py-2 font-sans font-medium text-slate-300">Days to Exp</td>
              <td className="px-3 py-2 text-slate-400">
                {calc.daysToExpiry} d <span className="text-[10px] text-slate-500">[Min: {params.minDaysToExpiry}d]</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold ${calc.expiryOK ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                  {calc.expiryOK ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <AlertCircle className="w-3 h-3 inline mr-1" />}
                  {calc.expiryOK ? 'OK' : 'TOO CLOSE'}
                </span>
              </td>
            </tr>

            {/* Volume Spike */}
            <tr className="hover:bg-slate-800/30">
              <td className="px-3 py-2 font-sans font-medium text-slate-300">Vol Spike</td>
              <td className="px-3 py-2 text-slate-400">
                {calc.volSpike ? '> 1.3x 20-MA' : 'Normal Volume'}
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${calc.volSpike ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                  {calc.volSpike ? 'YES ⚡' : 'no'}
                </span>
              </td>
            </tr>

            {/* Price vs VWAP */}
            <tr className="hover:bg-slate-800/30">
              <td className="px-3 py-2 font-sans font-medium text-slate-300">Price vs VWAP</td>
              <td className="px-3 py-2 text-slate-400">
                VWAP: ₹{calc.vwapVal.toLocaleString('en-IN')}
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isAboveVWAP ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                  {isAboveVWAP ? 'Above (Bull)' : 'Below (Bear)'}
                </span>
              </td>
            </tr>

            {/* Structure / Pivot Retest */}
            <tr className="hover:bg-slate-800/30">
              <td className="px-3 py-2 font-sans font-medium text-slate-300">S/R Structure</td>
              <td className="px-3 py-2 text-slate-400">
                {calc.bullResSignal ? 'Res. Retest Hold' : calc.bearSupSignal ? 'Sup. Retest Rejection' : 'Forming Structure'}
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  calc.bullResSignal
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : calc.bearSupSignal
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {calc.bullResSignal ? 'BULL RETEST' : calc.bearSupSignal ? 'BEAR RETEST' : 'WAITING'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pine Composite Entry Condition Result Banner */}
      <div className="mt-3 p-3 rounded-lg border bg-slate-950/70 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Composite Trigger:</span>
        {calc.longCondition ? (
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-700 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>BUY CALL SIGNAL ACTIVE</span>
          </div>
        ) : calc.shortCondition ? (
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs bg-rose-950/80 px-2.5 py-1 rounded border border-rose-700 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>BUY PUT SIGNAL ACTIVE</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-slate-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            <span>Awaiting full confluence alignment</span>
          </div>
        )}
      </div>
    </div>
  );
};
