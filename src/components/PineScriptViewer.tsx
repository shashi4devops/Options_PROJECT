import React, { useState } from 'react';
import { Copy, Check, Code, ExternalLink } from 'lucide-react';

export const PINE_SCRIPT_CODE = `//@version=5
strategy("Composite: VWAP+PA+S/R+Vol, filtered by Delta/IV/OI/Expiry, fixed SL",
     overlay=true, initial_capital=100000,
     default_qty_type=strategy.percent_of_equity, default_qty_value=10,
     pyramiding=0, calc_on_every_tick=false)

// ═══════════════════════════════════════════════════════════
// MANUAL OPTION DATA — Pine has no live NSE option chain feed.
// Update these from your broker/option chain before/while trading.
// ═══════════════════════════════════════════════════════════
g_opt   = "Manual Option Data (from option chain)"
manDelta   = input.float(0.5, "Current Option Delta (ATM≈0.5)", minval=0, maxval=1, group=g_opt)
deltaMin   = input.float(0.35, "Min Acceptable |Delta|", group=g_opt)
deltaMax   = input.float(0.65, "Max Acceptable |Delta|", group=g_opt)

manIV      = input.float(15.0, "Current IV (%)", group=g_opt)
ivHighTh   = input.float(25.0, "IV 'too high to buy' threshold (%)", group=g_opt)

oiBiasInput = input.string("Long Buildup", "OI Bias (read from chain)",
     options=["Long Buildup", "Short Buildup", "Short Covering", "Long Unwinding", "Neutral"], group=g_opt)

expiryYear  = input.int(2026, "Expiry Year", group=g_opt)
expiryMonth = input.int(9,    "Expiry Month", group=g_opt)
expiryDay   = input.int(25,   "Expiry Day", group=g_opt)
minDaysToExpiry = input.int(1, "Min Days-to-Expiry to allow new entry", group=g_opt)

// ═══════════════════════════════════════════════════════════
// VWAP / PRICE ACTION / SUPPORT-RESISTANCE
// ═══════════════════════════════════════════════════════════
g_pa = "VWAP & Structure"
leftBars   = input.int(15, "Pivot Left Bars", group=g_pa)
rightBars  = input.int(15, "Pivot Right Bars", group=g_pa)
retestTol  = input.float(0.15, "Retest Tolerance %", group=g_pa) / 100
maxLevels  = input.int(6, "Max Active Levels Each Side", group=g_pa)
extendBars = input.int(150, "Line Extend (bars)", group=g_pa)

vwapVal = ta.vwap(hlc3)

ph = ta.pivothigh(high, leftBars, rightBars)
pl = ta.pivotlow(low, leftBars, rightBars)

var float[] resLevels = array.new_float(0)
var line[]  resLines  = array.new_line(0)
var int[]   resState  = array.new_int(0)   // 0 untouched, 1 broken, 2 retested

var float[] supLevels = array.new_float(0)
var line[]  supLines  = array.new_line(0)
var int[]   supState  = array.new_int(0)

addLevel(arrLevels, arrLines, arrState, price, isRes) =>
    col = isRes ? color.new(color.red, 0) : color.new(color.lime, 0)
    ln = line.new(bar_index - rightBars, price, bar_index + extendBars, price, color=col, width=2)
    array.push(arrLevels, price)
    array.push(arrLines, ln)
    array.push(arrState, 0)
    if array.size(arrLevels) > maxLevels
        line.delete(array.shift(arrLines))
        array.shift(arrLevels)
        array.shift(arrState)

if not na(ph)
    addLevel(resLevels, resLines, resState, ph, true)
if not na(pl)
    addLevel(supLevels, supLines, supState, pl, false)

if array.size(resLines) > 0
    for i = 0 to array.size(resLines) - 1
        line.set_x2(array.get(resLines, i), bar_index + extendBars)
if array.size(supLines) > 0
    for i = 0 to array.size(supLines) - 1
        line.set_x2(array.get(supLines, i), bar_index + extendBars)

bullResSignal = false
bearSupSignal = false

if array.size(resLevels) > 0
    for i = 0 to array.size(resLevels) - 1
        lvl = array.get(resLevels, i)
        st  = array.get(resState, i)
        if st == 0 and close > lvl and close[1] <= lvl
            array.set(resState, i, 1)
        else if st == 1 and low <= lvl * (1 + retestTol) and low >= lvl * (1 - retestTol) and close > lvl
            array.set(resState, i, 2)
            bullResSignal := true

if array.size(supLevels) > 0
    for i = 0 to array.size(supLevels) - 1
        lvl = array.get(supLevels, i)
        st  = array.get(supState, i)
        if st == 0 and close < lvl and close[1] >= lvl
            array.set(supState, i, 1)
        else if st == 1 and high >= lvl * (1 - retestTol) and high <= lvl * (1 + retestTol) and close < lvl
            array.set(supState, i, 2)
            bearSupSignal := true

// ═══════════════════════════════════════════════════════════
// VOLUME
// ═══════════════════════════════════════════════════════════
g_vol = "Volume"
volMALen = input.int(20, "Volume MA Length", group=g_vol)
volMult  = input.float(1.3, "Volume Spike Multiplier", group=g_vol)
volSpike = volume > ta.sma(volume, volMALen) * volMult

// ═══════════════════════════════════════════════════════════
// RISK MANAGEMENT — predefined SL
// ═══════════════════════════════════════════════════════════
g_risk = "Risk Management"
slType   = input.string("Points", "SL Type", options=["Points", "ATR"], group=g_risk)
slPoints = input.float(20, "SL (points, if Points)", group=g_risk)
atrLen   = input.int(14, "ATR Length (if ATR SL)", group=g_risk)
atrMult  = input.float(1.5, "ATR Multiple (if ATR SL)", group=g_risk)
rr       = input.float(2.0, "Reward:Risk Multiple", group=g_risk)
atrVal = ta.atr(atrLen)

// ═══════════════════════════════════════════════════════════
// FILTERS FROM MANUAL OPTION DATA
// ═══════════════════════════════════════════════════════════
expiryTime    = timestamp(expiryYear, expiryMonth, expiryDay, 15, 30)
daysToExpiry  = (expiryTime - time) / (1000 * 60 * 60 * 24)
expiryOK      = daysToExpiry >= minDaysToExpiry
ivOK          = manIV <= ivHighTh
deltaOK       = manDelta >= deltaMin and manDelta <= deltaMax
oiBullish     = oiBiasInput == "Long Buildup" or oiBiasInput == "Short Covering"
oiBearish     = oiBiasInput == "Short Buildup" or oiBiasInput == "Long Unwinding"

// ═══════════════════════════════════════════════════════════
// COMPOSITE ENTRY CONDITIONS
// ═══════════════════════════════════════════════════════════
longCondition = bullResSignal and close > vwapVal and volSpike and oiBullish and ivOK and deltaOK and expiryOK
shortCondition = bearSupSignal and close < vwapVal and volSpike and oiBearish and ivOK and deltaOK and expiryOK

if longCondition and strategy.position_size == 0
    slPrice = slType == "Points" ? close - slPoints : close - atrVal * atrMult
    riskPts = close - slPrice
    tgtPrice = close + riskPts * rr
    strategy.entry("Long CALL", strategy.long)
    strategy.exit("Exit Long", "Long CALL", stop=slPrice, limit=tgtPrice)
    label.new(bar_index, low, "BUY CALL\\nSL:" + str.tostring(slPrice, format.mintick) + " TGT:" + str.tostring(tgtPrice, format.mintick),
         style=label.style_label_up, color=color.new(color.lime, 0), textcolor=color.black, size=size.small)
    alert("BUY CALL — VWAP+Structure+Vol+OI/IV/Delta aligned. SL " + str.tostring(slPrice, format.mintick), alert.freq_once_per_bar_close)

if shortCondition and strategy.position_size == 0
    slPrice = slType == "Points" ? close + slPoints : close + atrVal * atrMult
    riskPts = slPrice - close
    tgtPrice = close - riskPts * rr
    strategy.entry("Long PUT", strategy.short)
    strategy.exit("Exit Short", "Long PUT", stop=slPrice, limit=tgtPrice)
    label.new(bar_index, high, "BUY PUT\\nSL:" + str.tostring(slPrice, format.mintick) + " TGT:" + str.tostring(tgtPrice, format.mintick),
         style=label.style_label_down, color=color.new(color.red, 0), textcolor=color.white, size=size.small)
    alert("BUY PUT — VWAP+Structure+Vol+OI/IV/Delta aligned. SL " + str.tostring(slPrice, format.mintick), alert.freq_once_per_bar_close)

// ═══════════════════════════════════════════════════════════
// PLOTS
// ═══════════════════════════════════════════════════════════
plot(vwapVal, "VWAP", color=color.new(color.yellow, 0), linewidth=2)

// ═══════════════════════════════════════════════════════════
// INFO TABLE
// ═══════════════════════════════════════════════════════════
var table infoTable = table.new(position.top_right, 2, 7, border_width=1)
if barstate.islast
    table.cell(infoTable, 0, 0, "Filter", bgcolor=color.gray, text_color=color.white)
    table.cell(infoTable, 1, 0, "Status", bgcolor=color.gray, text_color=color.white)
    table.cell(infoTable, 0, 1, "Delta")
    table.cell(infoTable, 1, 1, str.tostring(manDelta) + (deltaOK ? " OK" : " FAIL"), text_color=deltaOK ? color.lime : color.red)
    table.cell(infoTable, 0, 2, "IV")
    table.cell(infoTable, 1, 2, str.tostring(manIV) + "%" + (ivOK ? " OK" : " HIGH"), text_color=ivOK ? color.lime : color.red)
    table.cell(infoTable, 0, 3, "OI Bias")
    table.cell(infoTable, 1, 3, oiBiasInput)
    table.cell(infoTable, 0, 4, "Days to Exp")
    table.cell(infoTable, 1, 4, str.tostring(daysToExpiry, "#.#") + (expiryOK ? " OK" : " TOO CLOSE"), text_color=expiryOK ? color.lime : color.red)
    table.cell(infoTable, 0, 5, "Vol Spike")
    table.cell(infoTable, 1, 5, volSpike ? "YES" : "no", text_color=volSpike ? color.lime : color.gray)
    table.cell(infoTable, 0, 6, "Price vs VWAP")
    table.cell(infoTable, 1, 6, close > vwapVal ? "Above" : "Below", text_color=close > vwapVal ? color.lime : color.red)`;

export const PineScriptViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PINE_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="pine-script-viewer" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Code className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Source Pine Script v5 Strategy
          </h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied Code' : 'Copy Pine Script'}</span>
        </button>
      </div>

      <p className="text-xs text-slate-400">
        This Pine Script code executes natively inside TradingView on NIFTY, BANK NIFTY, SENSEX, GOLD, SILVER &amp; CRUDE OIL. When configured with the webhook bridge, TradingView automatically triggers the mobile &amp; email alerts in this application!
      </p>

      <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto max-h-96 leading-5 selection:bg-emerald-800">
        <code>{PINE_SCRIPT_CODE}</code>
      </pre>
    </div>
  );
};
