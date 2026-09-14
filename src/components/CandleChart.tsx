import React, { useState, useRef, useMemo } from 'react';
import { Candle, PivotLevel } from '../types';

interface CandleChartProps {
  candles: Candle[];
  vwapSeries?: number[];
  vwapVal: number;
  resLevels: PivotLevel[];
  supLevels: PivotLevel[];
  symbol: string;
  unit: string;
  volMA: number;
  volSpike: boolean;
  onSelectTimeframe?: (tf: string) => void;
  activeAlertPrice?: {
    action: 'BUY CALL' | 'BUY PUT';
    price: number;
    sl: number;
    tgt: number;
  } | null;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  candles,
  vwapVal,
  resLevels,
  supLevels,
  symbol,
  unit,
  volMA,
  volSpike,
  activeAlertPrice,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // We display the last 45 to 60 candles to keep the view crisp and clean
  const visibleCandles = useMemo(() => {
    return candles.slice(-50);
  }, [candles]);

  // Compute scale boundaries
  const { minPrice, maxPrice, maxVol, vwapValues } = useMemo(() => {
    if (visibleCandles.length === 0) {
      return { minPrice: 0, maxPrice: 100, maxVol: 1000, vwapValues: [] };
    }

    let min = Infinity;
    let max = -Infinity;
    let maxV = 0;

    // Calculate rolling VWAP for visible bars
    let cumV = 0;
    let cumVP = 0;
    const vwapArr: number[] = [];

    // Use full candle series up to visible range for accurate intraday vwap
    for (const c of candles) {
      const hlc3 = (c.high + c.low + c.close) / 3;
      cumV += c.volume;
      cumVP += hlc3 * c.volume;
    }
    const overallVWAP = cumV > 0 ? cumVP / cumV : visibleCandles[0].close;

    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > maxV) maxV = c.volume;
      vwapArr.push(overallVWAP);
    }

    // Include S/R levels and alert prices in range if nearby
    for (const r of resLevels) {
      if (r.price > max && r.price < max * 1.05) max = r.price;
    }
    for (const s of supLevels) {
      if (s.price < min && s.price > min * 0.95) min = s.price;
    }
    if (activeAlertPrice) {
      if (activeAlertPrice.tgt > max) max = activeAlertPrice.tgt;
      if (activeAlertPrice.sl < min) min = activeAlertPrice.sl;
    }

    const padding = (max - min) * 0.12 || 10;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      maxVol: maxV * 1.35 || 1000,
      vwapValues: vwapArr,
    };
  }, [visibleCandles, resLevels, supLevels, activeAlertPrice, candles]);

  const width = 850;
  const height = 420;
  const priceHeight = 310;
  const volumeHeight = 90;
  const margin = { top: 20, right: 65, bottom: 25, left: 15 };
  const plotWidth = width - margin.left - margin.right;

  const candleWidth = Math.max(5, Math.min(13, (plotWidth / visibleCandles.length) * 0.65));
  const candleGap = plotWidth / visibleCandles.length;

  const getY = (price: number) => {
    if (maxPrice === minPrice) return priceHeight / 2;
    return margin.top + (1 - (price - minPrice) / (maxPrice - minPrice)) * (priceHeight - margin.top);
  };

  const getVolY = (vol: number) => {
    const volBottom = height - margin.bottom;
    const volTop = height - margin.bottom - volumeHeight;
    return volBottom - (vol / maxVol) * volumeHeight;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - margin.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= plotWidth) {
      const index = Math.floor(x / candleGap);
      if (index >= 0 && index < visibleCandles.length) {
        setHoveredCandle(visibleCandles[index]);
        setMousePos({ x: x + margin.left, y });
        return;
      }
    }
    setHoveredCandle(null);
    setMousePos(null);
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setMousePos(null);
  };

  const lastCandle = visibleCandles[visibleCandles.length - 1];

  // Format price helper
  const fmt = (p: number) => p.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div id="candle-chart-container" className="relative flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg select-none">
      {/* Chart Top Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs gap-2">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-slate-100 text-sm tracking-wide">{symbol}</span>
          <span className="text-slate-400">5m Intraday</span>
          {lastCandle && (
            <span className={`font-semibold px-2 py-0.5 rounded text-xs ${lastCandle.close >= lastCandle.open ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'}`}>
              LTP: ₹{fmt(lastCandle.close)}
            </span>
          )}
        </div>

        {/* OHLC Bar or Hover Info */}
        <div className="flex items-center space-x-3 text-slate-300 font-mono text-[11px]">
          {hoveredCandle ? (
            <>
              <span>O: <strong className="text-slate-100">{fmt(hoveredCandle.open)}</strong></span>
              <span>H: <strong className="text-slate-100">{fmt(hoveredCandle.high)}</strong></span>
              <span>L: <strong className="text-slate-100">{fmt(hoveredCandle.low)}</strong></span>
              <span>C: <strong className="text-slate-100">{fmt(hoveredCandle.close)}</strong></span>
              <span>Vol: <strong className="text-slate-100">{hoveredCandle.volume.toLocaleString()}</strong></span>
            </>
          ) : lastCandle ? (
            <>
              <span>O: {fmt(lastCandle.open)}</span>
              <span>H: {fmt(lastCandle.high)}</span>
              <span>L: {fmt(lastCandle.low)}</span>
              <span>C: {fmt(lastCandle.close)}</span>
              <span className="text-amber-400">VWAP: {fmt(vwapVal)}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-0.5 bg-amber-400"></div>
            <span className="text-amber-300">VWAP</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-0.5 bg-rose-500"></div>
            <span className="text-rose-400">Resistance</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2.5 h-0.5 bg-emerald-500"></div>
            <span className="text-emerald-400">Support</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Plot */}
      <div ref={containerRef} className="relative w-full overflow-x-auto bg-slate-950">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="vwapGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal prices) */}
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((frac, idx) => {
            const priceVal = minPrice + (maxPrice - minPrice) * frac;
            const y = getY(priceVal);
            return (
              <g key={idx}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={width - margin.right}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={width - margin.right + 8}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {fmt(priceVal)}
                </text>
              </g>
            );
          })}

          {/* Volume Section Divider */}
          <line
            x1={margin.left}
            y1={height - margin.bottom - volumeHeight}
            x2={width - margin.right}
            y2={height - margin.bottom - volumeHeight}
            stroke="#1e293b"
            strokeWidth="1"
          />
          <text
            x={margin.left + 5}
            y={height - margin.bottom - volumeHeight + 14}
            fill="#475569"
            fontSize="9"
            fontFamily="sans-serif"
            fontWeight="600"
          >
            VOLUME {volSpike ? '⚡ SPIKE > 1.3x 20-MA' : ''}
          </text>

          {/* Support and Resistance Pivot Lines from Pine Script */}
          {resLevels.map((lvl, idx) => {
            const y = getY(lvl.price);
            if (y < margin.top || y > priceHeight) return null;
            return (
              <g key={`res-${idx}`}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={width - margin.right}
                  y2={y}
                  stroke="#f43f5e"
                  strokeWidth={lvl.state === 2 ? "2" : "1.5"}
                  strokeDasharray={lvl.state === 1 ? "4 3" : undefined}
                  opacity={lvl.state === 2 ? 0.9 : 0.6}
                />
                <rect
                  x={width - margin.right - 70}
                  y={y - 8}
                  width="65"
                  height="16"
                  fill="#881337"
                  rx="3"
                  opacity="0.85"
                />
                <text
                  x={width - margin.right - 38}
                  y={y + 3.5}
                  fill="#fecdd3"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  R {fmt(lvl.price)}
                </text>
              </g>
            );
          })}

          {supLevels.map((lvl, idx) => {
            const y = getY(lvl.price);
            if (y < margin.top || y > priceHeight) return null;
            return (
              <g key={`sup-${idx}`}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={width - margin.right}
                  y2={y}
                  stroke="#10b981"
                  strokeWidth={lvl.state === 2 ? "2" : "1.5"}
                  strokeDasharray={lvl.state === 1 ? "4 3" : undefined}
                  opacity={lvl.state === 2 ? 0.9 : 0.6}
                />
                <rect
                  x={width - margin.right - 70}
                  y={y - 8}
                  width="65"
                  height="16"
                  fill="#064e3b"
                  rx="3"
                  opacity="0.85"
                />
                <text
                  x={width - margin.right - 38}
                  y={y + 3.5}
                  fill="#a7f3d0"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  S {fmt(lvl.price)}
                </text>
              </g>
            );
          })}

          {/* VWAP Line */}
          {visibleCandles.length > 1 && (
            <line
              x1={margin.left}
              y1={getY(vwapVal)}
              x2={width - margin.right}
              y2={getY(vwapVal)}
              stroke="#fbbf24"
              strokeWidth="2"
              strokeDasharray="6 2"
              opacity="0.9"
            />
          )}

          {/* Active Alert Trigger Lines (SL and Target) */}
          {activeAlertPrice && (
            <g>
              {/* Target Line */}
              <line
                x1={margin.left}
                y1={getY(activeAlertPrice.tgt)}
                x2={width - margin.right}
                y2={getY(activeAlertPrice.tgt)}
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <rect
                x={margin.left + 5}
                y={getY(activeAlertPrice.tgt) - 9}
                width="110"
                height="18"
                fill="#064e3b"
                rx="3"
              />
              <text
                x={margin.left + 60}
                y={getY(activeAlertPrice.tgt) + 4}
                fill="#6ee7b7"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                TARGET: ₹{fmt(activeAlertPrice.tgt)}
              </text>

              {/* Stop Loss Line */}
              <line
                x1={margin.left}
                y1={getY(activeAlertPrice.sl)}
                x2={width - margin.right}
                y2={getY(activeAlertPrice.sl)}
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <rect
                x={margin.left + 5}
                y={getY(activeAlertPrice.sl) - 9}
                width="110"
                height="18"
                fill="#7f1d1d"
                rx="3"
              />
              <text
                x={margin.left + 60}
                y={getY(activeAlertPrice.sl) + 4}
                fill="#fca5a5"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                SL: ₹{fmt(activeAlertPrice.sl)}
              </text>
            </g>
          )}

          {/* Candlesticks and Volume Bars */}
          {visibleCandles.map((c, i) => {
            const x = margin.left + i * candleGap + candleGap / 2;
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const isGreen = c.close >= c.open;
            const color = isGreen ? '#10b981' : '#f43f5e';
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));

            // Volume Bar
            const volY = getVolY(c.volume);
            const volBottom = height - margin.bottom;
            const volBarHeight = Math.max(2, volBottom - volY);
            const isVolSpike = c.volume > volMA * 1.3;

            return (
              <g key={c.time || i}>
                {/* Volume bar */}
                <rect
                  x={x - candleWidth / 2}
                  y={volY}
                  width={candleWidth}
                  height={volBarHeight}
                  fill={isVolSpike ? (isGreen ? '#34d399' : '#fb7185') : (isGreen ? '#064e3b' : '#881337')}
                  opacity={isVolSpike ? 0.9 : 0.55}
                />

                {/* Candle wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1.2"
                />

                {/* Candle body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  rx="1"
                />

                {/* Signal label on last bar if active */}
                {i === visibleCandles.length - 1 && activeAlertPrice && (
                  <g>
                    {activeAlertPrice.action === 'BUY CALL' ? (
                      <g transform={`translate(${x}, ${lowY + 18})`}>
                        <polygon points="0,-10 -7,2 7,2" fill="#10b981" />
                        <rect x="-42" y="4" width="84" height="18" rx="4" fill="#064e3b" stroke="#10b981" strokeWidth="1" />
                        <text x="0" y="16" fill="#a7f3d0" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                          BUY CALL
                        </text>
                      </g>
                    ) : (
                      <g transform={`translate(${x}, ${highY - 18})`}>
                        <polygon points="0,10 -7,-2 7,-2" fill="#f43f5e" />
                        <rect x="-40" y="-22" width="80" height="18" rx="4" fill="#881337" stroke="#f43f5e" strokeWidth="1" />
                        <text x="0" y="-10" fill="#fecdd3" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                          BUY PUT
                        </text>
                      </g>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Hover Crosshair */}
          {mousePos && (
            <g>
              <line
                x1={mousePos.x}
                y1={margin.top}
                x2={mousePos.x}
                y2={height - margin.bottom}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <line
                x1={margin.left}
                y1={mousePos.y}
                x2={width - margin.right}
                y2={mousePos.y}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
