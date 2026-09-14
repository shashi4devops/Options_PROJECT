import { Candle, PineCalculationResult, PineScriptParams, PivotLevel } from '../types';

export function calculatePineStrategy(
  candles: Candle[],
  params: PineScriptParams,
  currentTimeMs: number = Date.now()
): PineCalculationResult {
  const n = candles.length;
  if (n < Math.max(params.leftBars + params.rightBars + 5, params.volMALen + 1)) {
    return createEmptyResult();
  }

  // 1. Calculate Intraday VWAP: ta.vwap(hlc3)
  let cumVol = 0;
  let cumVolPrice = 0;
  const vwapSeries: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const hlc3 = (c.high + c.low + c.close) / 3;
    cumVol += c.volume;
    cumVolPrice += hlc3 * c.volume;
    vwapSeries[i] = cumVol > 0 ? cumVolPrice / cumVol : c.close;
  }
  const currentVWAP = vwapSeries[n - 1];

  // 2. Calculate ATR: ta.atr(atrLen)
  const trSeries: number[] = new Array(n);
  trSeries[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hpc = Math.abs(candles[i].high - candles[i - 1].close);
    const lpc = Math.abs(candles[i].low - candles[i - 1].close);
    trSeries[i] = Math.max(hl, hpc, lpc);
  }
  let currentATR = 0;
  if (n >= params.atrLen) {
    let sumTR = 0;
    for (let i = n - params.atrLen; i < n; i++) {
      sumTR += trSeries[i];
    }
    currentATR = sumTR / params.atrLen;
  } else {
    currentATR = trSeries[n - 1] || 10;
  }

  // 3. Volume MA & Spike: volume > ta.sma(volume, volMALen) * volMult
  let sumVol = 0;
  const volLen = Math.min(params.volMALen, n);
  for (let i = n - volLen; i < n; i++) {
    sumVol += candles[i].volume;
  }
  const currentVolMA = sumVol / volLen;
  const currentVolume = candles[n - 1].volume;
  const volSpike = currentVolume > currentVolMA * params.volMult;

  // 4. Pivots & Levels Simulation (bar by bar to track breakout -> retest state)
  const resLevels: PivotLevel[] = [];
  const supLevels: PivotLevel[] = [];
  const retestTolFrac = params.retestTol / 100;

  let bullResSignal = false;
  let bearSupSignal = false;

  const left = params.leftBars;
  const right = params.rightBars;

  // Iterate chronologically to replicate Pine Script bar execution
  for (let i = left + right; i < n; i++) {
    const candidateIdx = i - right;
    const candidateCandle = candles[candidateIdx];

    // Pivot High detection
    let isPivotHigh = true;
    for (let j = candidateIdx - left; j <= candidateIdx + right; j++) {
      if (j !== candidateIdx && candles[j].high > candidateCandle.high) {
        isPivotHigh = false;
        break;
      }
    }
    if (isPivotHigh) {
      resLevels.push({
        id: `res-${candidateIdx}-${candidateCandle.high}`,
        price: candidateCandle.high,
        isRes: true,
        state: 0,
        barIndex: candidateIdx,
        time: candidateCandle.time,
      });
      if (resLevels.length > params.maxLevels) {
        resLevels.shift();
      }
    }

    // Pivot Low detection
    let isPivotLow = true;
    for (let j = candidateIdx - left; j <= candidateIdx + right; j++) {
      if (j !== candidateIdx && candles[j].low < candidateCandle.low) {
        isPivotLow = false;
        break;
      }
    }
    if (isPivotLow) {
      supLevels.push({
        id: `sup-${candidateIdx}-${candidateCandle.low}`,
        price: candidateCandle.low,
        isRes: false,
        state: 0,
        barIndex: candidateIdx,
        time: candidateCandle.time,
      });
      if (supLevels.length > params.maxLevels) {
        supLevels.shift();
      }
    }

    // Check level state transitions for current bar i
    const currCandle = candles[i];
    const prevClose = candles[i - 1].close;

    // Evaluate Resistance levels
    for (const lvl of resLevels) {
      if (lvl.state === 0 && currCandle.close > lvl.price && prevClose <= lvl.price) {
        lvl.state = 1; // broken
      } else if (
        lvl.state === 1 &&
        currCandle.low <= lvl.price * (1 + retestTolFrac) &&
        currCandle.low >= lvl.price * (1 - retestTolFrac) &&
        currCandle.close > lvl.price
      ) {
        lvl.state = 2; // retested and held
        if (i === n - 1) {
          bullResSignal = true;
        }
      }
    }

    // Evaluate Support levels
    for (const lvl of supLevels) {
      if (lvl.state === 0 && currCandle.close < lvl.price && prevClose >= lvl.price) {
        lvl.state = 1; // broken down
      } else if (
        lvl.state === 1 &&
        currCandle.high >= lvl.price * (1 - retestTolFrac) &&
        currCandle.high <= lvl.price * (1 + retestTolFrac) &&
        currCandle.close < lvl.price
      ) {
        lvl.state = 2; // retested and rejected
        if (i === n - 1) {
          bearSupSignal = true;
        }
      }
    }
  }

  // 5. Option Data & Expiry Filters
  const targetExpiry = new Date(
    params.expiryYear,
    params.expiryMonth - 1,
    params.expiryDay,
    15,
    30,
    0
  ).getTime();

  const daysToExpiry = (targetExpiry - currentTimeMs) / (1000 * 60 * 60 * 24);
  const expiryOK = daysToExpiry >= params.minDaysToExpiry;
  const ivOK = params.manIV <= params.ivHighTh;
  const deltaOK = params.manDelta >= params.deltaMin && params.manDelta <= params.deltaMax;

  const oiBullish = params.oiBiasInput === 'Long Buildup' || params.oiBiasInput === 'Short Covering';
  const oiBearish = params.oiBiasInput === 'Short Buildup' || params.oiBiasInput === 'Long Unwinding';

  const lastCandle = candles[n - 1];
  const priceAboveVWAP = lastCandle.close > currentVWAP;

  // 6. Composite Entry Conditions
  const longCondition =
    bullResSignal &&
    priceAboveVWAP &&
    volSpike &&
    oiBullish &&
    ivOK &&
    deltaOK &&
    expiryOK;

  const shortCondition =
    bearSupSignal &&
    !priceAboveVWAP &&
    volSpike &&
    oiBearish &&
    ivOK &&
    deltaOK &&
    expiryOK;

  // 7. Risk Management — Predefined SL and Target
  let slPrice: number | undefined;
  let tgtPrice: number | undefined;
  let riskPts: number | undefined;

  if (longCondition) {
    slPrice =
      params.slType === 'Points'
        ? lastCandle.close - params.slPoints
        : lastCandle.close - currentATR * params.atrMult;
    riskPts = lastCandle.close - slPrice;
    tgtPrice = lastCandle.close + riskPts * params.rr;
  } else if (shortCondition) {
    slPrice =
      params.slType === 'Points'
        ? lastCandle.close + params.slPoints
        : lastCandle.close + currentATR * params.atrMult;
    riskPts = slPrice - lastCandle.close;
    tgtPrice = lastCandle.close - riskPts * params.rr;
  }

  return {
    vwapVal: Number(currentVWAP.toFixed(2)),
    atrVal: Number(currentATR.toFixed(2)),
    volMA: Math.round(currentVolMA),
    volSpike,
    deltaOK,
    ivOK,
    oiBullish,
    oiBearish,
    daysToExpiry: Number(daysToExpiry.toFixed(1)),
    expiryOK,
    bullResSignal,
    bearSupSignal,
    longCondition,
    shortCondition,
    priceAboveVWAP,
    resLevels,
    supLevels,
    entryPrice: lastCandle.close,
    slPrice: slPrice ? Number(slPrice.toFixed(2)) : undefined,
    tgtPrice: tgtPrice ? Number(tgtPrice.toFixed(2)) : undefined,
    riskPts: riskPts ? Number(riskPts.toFixed(2)) : undefined,
  };
}

function createEmptyResult(): PineCalculationResult {
  return {
    vwapVal: 0,
    atrVal: 0,
    volMA: 0,
    volSpike: false,
    deltaOK: false,
    ivOK: false,
    oiBullish: false,
    oiBearish: false,
    daysToExpiry: 0,
    expiryOK: false,
    bullResSignal: false,
    bearSupSignal: false,
    longCondition: false,
    shortCondition: false,
    priceAboveVWAP: false,
    resLevels: [],
    supLevels: [],
  };
}
