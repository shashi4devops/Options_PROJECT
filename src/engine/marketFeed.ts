import { Candle, InstrumentConfig, InstrumentSymbol } from '../types';

export function generateInitialCandles(instrument: InstrumentConfig, count: number = 90): Candle[] {
  const candles: Candle[] = [];
  const basePrice = instrument.defaultPrice;
  const tick = instrument.tickSize;
  const intervalMs = 5 * 60 * 1000; // 5-minute bars
  const now = Date.now();
  let currentPrice = basePrice * (1 - 0.008); // start slightly lower

  // Base volume depending on asset
  const baseVol = instrument.category === 'INDEX' ? 120000 : 8500;

  for (let i = count; i >= 1; i--) {
    const time = now - i * intervalMs;
    // Walk price with slight trend and volatility
    const volatility = (basePrice * 0.0018);
    const delta = (Math.random() - 0.48) * volatility;
    const open = currentPrice;
    const close = Math.round((open + delta) / tick) * tick;
    const high = Math.round((Math.max(open, close) + Math.random() * volatility * 0.6) / tick) * tick;
    const low = Math.round((Math.min(open, close) - Math.random() * volatility * 0.6) / tick) * tick;
    
    // Some volume variability
    const isVolSpikeBar = i === 12 || i === 35 || i === 65;
    const volume = isVolSpikeBar
      ? Math.round(baseVol * (2.2 + Math.random() * 0.8))
      : Math.round(baseVol * (0.6 + Math.random() * 0.8));

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

export function updateCurrentCandleWithTick(
  candles: Candle[],
  instrument: InstrumentConfig,
  forceSignalType?: 'BUY' | 'SELL'
): { updatedCandles: Candle[]; newCandleOpened: boolean } {
  if (candles.length === 0) {
    return { updatedCandles: generateInitialCandles(instrument), newCandleOpened: false };
  }

  const result = [...candles];
  const lastIndex = result.length - 1;
  const last = { ...result[lastIndex] };
  const intervalMs = 5 * 60 * 1000;
  const now = Date.now();
  const tick = instrument.tickSize;
  const volatility = instrument.defaultPrice * 0.0006;

  let newCandleOpened = false;

  if (now - last.time > intervalMs) {
    // Open new candle
    const open = last.close;
    let close = open + (Math.random() - 0.49) * volatility;
    if (forceSignalType === 'BUY') close = open + volatility * 2.5;
    if (forceSignalType === 'SELL') close = open - volatility * 2.5;
    close = Math.round(close / tick) * tick;

    const high = Math.max(open, close) + Math.random() * volatility * 0.4;
    const low = Math.min(open, close) - Math.random() * volatility * 0.4;
    const volume = forceSignalType ? 250000 : Math.round(50000 + Math.random() * 60000);

    result.push({
      time: now,
      open,
      high: Math.round(high / tick) * tick,
      low: Math.round(low / tick) * tick,
      close,
      volume,
    });

    if (result.length > 150) {
      result.shift();
    }
    newCandleOpened = true;
  } else {
    // Update active candle
    let delta = (Math.random() - 0.49) * volatility * 0.4;
    if (forceSignalType === 'BUY') delta = volatility * 1.8;
    if (forceSignalType === 'SELL') delta = -volatility * 1.8;

    const newClose = Math.round((last.close + delta) / tick) * tick;
    last.close = newClose;
    last.high = Math.max(last.high, newClose);
    last.low = Math.min(last.low, newClose);
    last.volume += Math.round(forceSignalType ? 12000 : 2500 + Math.random() * 3000);
    result[lastIndex] = last;
  }

  return { updatedCandles: result, newCandleOpened };
}
