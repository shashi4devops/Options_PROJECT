import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  InstrumentSymbol,
  InstrumentConfig,
  Candle,
  PineScriptParams,
  PineCalculationResult,
  TradeAlert,
  NotificationSettings,
} from './types';
import { INSTRUMENTS, DEFAULT_PINE_PARAMS } from './data/instruments';
import { calculatePineStrategy } from './engine/pineStrategy';
import { generateInitialCandles, updateCurrentCandleWithTick } from './engine/marketFeed';
import { Header } from './components/Header';
import { InstrumentSelector } from './components/InstrumentSelector';
import { CandleChart } from './components/CandleChart';
import { PineInfoTable } from './components/PineInfoTable';
import { PineParamsForm } from './components/PineParamsForm';
import { AlertsList } from './components/AlertsList';
import { AiAnalysisModal } from './components/AiAnalysisModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { LiveFeedConnectorModal } from './components/LiveFeedConnectorModal';
import { DhanWebhookModal } from './components/DhanWebhookModal';
import { MarketFeedProviders } from './components/MarketFeedProviders';
import { PineScriptViewer } from './components/PineScriptViewer';
import { playAlertSound, speakAlertVoice, showNativeNotification, requestPushPermission } from './utils/audioAlert';
import { Bell, Sliders, Code2, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  // 1. Core State
  const [selectedSymbol, setSelectedSymbol] = useState<InstrumentSymbol>('NIFTY');

  // Pine Parameters per instrument
  const [paramsMap, setParamsMap] = useState<Record<InstrumentSymbol, PineScriptParams>>(DEFAULT_PINE_PARAMS);

  // Candles per instrument
  const [candlesMap, setCandlesMap] = useState<Record<InstrumentSymbol, Candle[]>>(() => {
    const initial: Record<string, Candle[]> = {};
    for (const inst of INSTRUMENTS) {
      initial[inst.symbol] = generateInitialCandles(inst, 75);
    }
    return initial as Record<InstrumentSymbol, Candle[]>;
  });

  // Alerts History
  const [alerts, setAlerts] = useState<TradeAlert[]>([]);

  // Notification Configuration
  const [settings, setSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    targetEmail: 'telangana.shashi@gmail.com',
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    browserPushEnabled: true,
    audioVoiceEnabled: true,
    webhookUrl: '',
    autoSendAlerts: true,
  });

  // UI Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLiveFeedOpen, setIsLiveFeedOpen] = useState(false);
  const [isDhanWebhookOpen, setIsDhanWebhookOpen] = useState(false);
  const [isMarketFeedOpen, setIsMarketFeedOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'params' | 'pinescript'>('alerts');

  // Callback when a candle is normalized from Fyers, Upstox, or Zerodha Kite WebSocket
  const handleNormalizedCandle = (candle: Candle, symbol: InstrumentSymbol) => {
    setCandlesMap((prev) => {
      const existing = prev[symbol] || [];
      if (existing.length === 0) return { ...prev, [symbol]: [candle] };
      const last = existing[existing.length - 1];
      if (candle.time > last.time) {
        return { ...prev, [symbol]: [...existing, candle] };
      } else {
        const copy = [...existing];
        copy[copy.length - 1] = candle;
        return { ...prev, [symbol]: copy };
      }
    });
  };

  // AI Thinking Mode Modal State
  const [selectedAlertForAI, setSelectedAlertForAI] = useState<TradeAlert | null>(null);
  const [aiAnalysisText, setAiAnalysisText] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Cooldown tracker to prevent repetitive alert firing on every tick
  const lastAlertTimeRef = useRef<Record<string, number>>({});

  // Real Market Feed Status Tracker
  const [realFeedInfo, setRealFeedInfo] = useState<{
    isActive: boolean;
    source: string;
    lastTickTime: number | null;
    totalTicks: number;
    kiteConnected: boolean;
  }>({
    isActive: false,
    source: 'Synthetic Engine',
    lastTickTime: null,
    totalTicks: 0,
    kiteConnected: false,
  });

  // Active instrument config and data
  const currentInstrument = useMemo(() => {
    return INSTRUMENTS.find((i) => i.symbol === selectedSymbol) || INSTRUMENTS[0];
  }, [selectedSymbol]);

  const currentCandles = candlesMap[selectedSymbol] || [];
  const currentParams = paramsMap[selectedSymbol] || DEFAULT_PINE_PARAMS[selectedSymbol];

  // Run Pine Script calculation for active instrument
  const currentCalc = useMemo(() => {
    return calculatePineStrategy(currentCandles, currentParams);
  }, [currentCandles, currentParams]);

  // Current Prices and Day Changes Map
  const { currentPrices, priceChanges } = useMemo(() => {
    const prices: Record<string, number> = {};
    const changes: Record<string, { diff: number; pct: number }> = {};

    for (const inst of INSTRUMENTS) {
      const c = candlesMap[inst.symbol];
      if (c && c.length > 0) {
        const last = c[c.length - 1];
        const first = c[0];
        prices[inst.symbol] = last.close;
        const diff = last.close - first.open;
        const pct = (diff / first.open) * 100;
        changes[inst.symbol] = { diff, pct };
      } else {
        prices[inst.symbol] = inst.defaultPrice;
        changes[inst.symbol] = { diff: 0, pct: 0 };
      }
    }

    return {
      currentPrices: prices as Record<InstrumentSymbol, number>,
      priceChanges: changes as Record<InstrumentSymbol, { diff: number; pct: number }>,
    };
  }, [candlesMap]);

  // Active alert price for chart lines
  const activeAlertPrice = useMemo(() => {
    const active = alerts.find(
      (a) => a.ticker === selectedSymbol && a.status === 'ACTIVE'
    );
    if (!active) return null;
    return {
      action: active.action,
      price: active.price,
      sl: active.slPrice,
      tgt: active.tgtPrice,
    };
  }, [alerts, selectedSymbol]);

  // -------------------------------------------------------------
  // Alert Dispatcher Helper
  // -------------------------------------------------------------
  const dispatchAlert = useCallback(
    async (
      ticker: InstrumentSymbol,
      action: 'BUY CALL' | 'BUY PUT',
      price: number,
      slPrice: number,
      tgtPrice: number,
      calcSnapshot: PineCalculationResult,
      reason: string
    ) => {
      const riskPts = Math.abs(price - slPrice);
      const rewardPts = Math.abs(tgtPrice - price);

      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newAlert: TradeAlert = {
        id: alertId,
        ticker,
        name: INSTRUMENTS.find((i) => i.symbol === ticker)?.name || ticker,
        action,
        timestamp: Date.now(),
        price,
        slPrice,
        tgtPrice,
        riskPts: Number(riskPts.toFixed(2)),
        rewardPts: Number(rewardPts.toFixed(2)),
        rrRatio: currentParams.rr,
        status: 'ACTIVE',
        currentPrice: price,
        pnlPoints: 0,
        reason,
        filterSnapshot: {
          vwap: calcSnapshot.vwapVal,
          volSpike: calcSnapshot.volSpike,
          oiBias: currentParams.oiBiasInput,
          delta: currentParams.manDelta,
          iv: currentParams.manIV,
          daysToExpiry: calcSnapshot.daysToExpiry,
        },
        dispatches: {
          email: { sent: false, recipient: settings.targetEmail, time: Date.now() },
        },
      };

      // 1. Play Sound & Speech Chime
      if (settings.audioVoiceEnabled) {
        playAlertSound(action === 'BUY CALL');
        speakAlertVoice(
          `Alert! ${action} signal in ${newAlert.name} at ${price} rupees! Stop Loss ${slPrice}, Target ${tgtPrice}!`
        );
      }

      // 2. Native Mobile / Web Push
      if (settings.browserPushEnabled) {
        showNativeNotification(
          `🚨 ${ticker} ${action} Signal!`,
          `Entry: ₹${price} | SL: ₹${slPrice} | TGT: ₹${tgtPrice}`
        );
      }

      // 3. Email Dispatch via Server API
      if (settings.emailEnabled) {
        try {
          const res = await fetch('/api/alerts/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: settings.targetEmail,
              ticker,
              action,
              price,
              slPrice,
              tgtPrice,
              riskPts,
              rewardPts,
              vwap: calcSnapshot.vwapVal,
              oiBias: currentParams.oiBiasInput,
              delta: currentParams.manDelta,
              iv: currentParams.manIV,
              daysToExpiry: calcSnapshot.daysToExpiry,
            }),
          });
          const data = await res.json();
          if (data.success) {
            newAlert.dispatches.email = {
              sent: true,
              recipient: settings.targetEmail,
              time: Date.now(),
            };
          }
        } catch (e: any) {
          console.error('Email dispatch error:', e);
          newAlert.dispatches.email.error = e.message;
        }
      }

      // 4. Telegram Dispatch via Server API
      if (settings.telegramEnabled && settings.telegramBotToken && settings.telegramChatId) {
        try {
          const msg = `🚨 <b>PINE SCRIPT ALERT: ${action}</b>%0A<b>Ticker:</b> ${ticker}%0A<b>Price:</b> ₹${price}%0A<b>SL:</b> ₹${slPrice}%0A<b>Target:</b> ₹${tgtPrice}%0A<b>VWAP:</b> ₹${calcSnapshot.vwapVal}%0A<b>OI Bias:</b> ${currentParams.oiBiasInput}`;
          await fetch('/api/alerts/send-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botToken: settings.telegramBotToken,
              chatId: settings.telegramChatId,
              message: msg,
            }),
          });
        } catch (e) {
          console.error('Telegram dispatch error:', e);
        }
      }

      // Prepend to alerts feed
      setAlerts((prev) => [newAlert, ...prev]);
    },
    [settings, currentParams]
  );

  // -------------------------------------------------------------
  // Real-time Market Live Feed Synchronization Loop
  // (Pulls live ticks from Zerodha Kite WebSocket & broker endpoints)
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const pollLiveFeed = async () => {
      try {
        const [kiteRes, ticksRes] = await Promise.all([
          fetch('/api/market/kite/status').then((r) => r.json()).catch(() => null),
          fetch('/api/market/latest-ticks').then((r) => r.json()).catch(() => null),
        ]);

        if (!isMounted) return;

        const kiteStatus = kiteRes?.status;
        const ticks = ticksRes?.ticks || {};
        const now = Date.now();

        let hasActiveRealTick = false;
        let mostRecentSource = '';
        let mostRecentTime = 0;

        // Process incoming broker ticks for each instrument
        for (const [sym, tickData] of Object.entries<any>(ticks)) {
          if (tickData && tickData.price > 0) {
            const isSyntheticDefault = tickData.source?.includes('DEFAULT_CALIBRATED');
            const ageMs = now - (tickData.timestamp || 0);

            if (!isSyntheticDefault && ageMs < 45000) {
              hasActiveRealTick = true;
              if ((tickData.timestamp || 0) > mostRecentTime) {
                mostRecentTime = tickData.timestamp;
                mostRecentSource = tickData.source || 'Broker Stream';
              }

              const targetSymbol = sym as InstrumentSymbol;
              setCandlesMap((prev) => {
                const existing = prev[targetSymbol] || [];
                if (existing.length === 0) return prev;
                const last = { ...existing[existing.length - 1] };

                // Update current candle with live incoming tick price
                const tickPrice = tickData.price;
                last.close = tickPrice;
                if (tickPrice > last.high) last.high = tickPrice;
                if (tickPrice < last.low) last.low = tickPrice;
                if (tickData.volume) last.volume = Math.max(last.volume, tickData.volume);

                return { ...prev, [targetSymbol]: [...existing.slice(0, -1), last] };
              });
            }
          }
        }

        const isKiteConnected = kiteStatus?.isConnected === true;
        const isActive = hasActiveRealTick || isKiteConnected;

        setRealFeedInfo({
          isActive,
          source: isKiteConnected
            ? 'Zerodha Kite WebSocket'
            : mostRecentSource || (isActive ? 'Live Broker Feed' : 'Synthetic Engine'),
          lastTickTime: mostRecentTime || kiteStatus?.lastTickTimestamp || null,
          totalTicks:
            (kiteStatus?.totalTicksReceived || 0) +
            (ticksRes?.ticks ? Object.keys(ticksRes.ticks).length : 0),
          kiteConnected: isKiteConnected,
        });
      } catch (err) {
        // Silently handle
      }
    };

    pollLiveFeed();
    const interval = setInterval(pollLiveFeed, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // -------------------------------------------------------------
  // Real-time Market Simulation Tick Loop (Runs ONLY when real feed is idle)
  // -------------------------------------------------------------
  useEffect(() => {
    if (realFeedInfo.isActive) return; // Freeze random walk when live real-market feed is active!

    const interval = setInterval(() => {
      setCandlesMap((prev) => {
        const next: Record<string, Candle[]> = { ...prev };
        for (const inst of INSTRUMENTS) {
          const candles = prev[inst.symbol] || [];
          const { updatedCandles } = updateCurrentCandleWithTick(candles, inst);
          next[inst.symbol] = updatedCandles;
        }
        return next as Record<InstrumentSymbol, Candle[]>;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [realFeedInfo.isActive]);

  // -------------------------------------------------------------
  // Automatic Pine Strategy Execution Monitor
  // -------------------------------------------------------------
  useEffect(() => {
    if (!settings.autoSendAlerts) return;

    for (const inst of INSTRUMENTS) {
      const candles = candlesMap[inst.symbol];
      if (!candles || candles.length < 30) continue;
      const params = paramsMap[inst.symbol] || DEFAULT_PINE_PARAMS[inst.symbol];
      const res = calculatePineStrategy(candles, params);

      const lastCandle = candles[candles.length - 1];
      const now = Date.now();
      const cooldownKey = `${inst.symbol}_${res.longCondition ? 'BUY' : 'SELL'}`;
      const lastFired = lastAlertTimeRef.current[cooldownKey] || 0;

      // Ensure 3 minutes cooldown between auto-signals on same instrument to prevent repetitive bar spam
      if (now - lastFired < 180000) continue;

      if (res.longCondition && res.slPrice && res.tgtPrice) {
        lastAlertTimeRef.current[cooldownKey] = now;
        dispatchAlert(
          inst.symbol,
          'BUY CALL',
          lastCandle.close,
          res.slPrice,
          res.tgtPrice,
          res,
          'Auto Trigger: VWAP+Structure+Vol+OI/IV/Delta aligned'
        );
      } else if (res.shortCondition && res.slPrice && res.tgtPrice) {
        lastAlertTimeRef.current[cooldownKey] = now;
        dispatchAlert(
          inst.symbol,
          'BUY PUT',
          lastCandle.close,
          res.slPrice,
          res.tgtPrice,
          res,
          'Auto Trigger: Bearish VWAP breakdown & Support retested'
        );
      }
    }
  }, [candlesMap, paramsMap, settings.autoSendAlerts, dispatchAlert]);

  // -------------------------------------------------------------
  // Manual Signal Testing Trigger
  // -------------------------------------------------------------
  const handleForceSignal = (symbol: InstrumentSymbol, type: 'BUY' | 'SELL') => {
    const inst = INSTRUMENTS.find((i) => i.symbol === symbol) || currentInstrument;
    const candles = candlesMap[symbol] || [];
    const { updatedCandles } = updateCurrentCandleWithTick(candles, inst, type);

    setCandlesMap((prev) => ({
      ...prev,
      [symbol]: updatedCandles,
    }));

    const last = updatedCandles[updatedCandles.length - 1];
    const params = paramsMap[symbol] || DEFAULT_PINE_PARAMS[symbol];

    // Compute prices with accurate SL / Target from strategy
    let sl = 0;
    let tgt = 0;
    const risk = params.slType === 'Points' ? params.slPoints : 40;

    if (type === 'BUY') {
      sl = Math.round((last.close - risk) / inst.tickSize) * inst.tickSize;
      tgt = Math.round((last.close + risk * params.rr) / inst.tickSize) * inst.tickSize;
    } else {
      sl = Math.round((last.close + risk) / inst.tickSize) * inst.tickSize;
      tgt = Math.round((last.close - risk * params.rr) / inst.tickSize) * inst.tickSize;
    }

    const mockCalc = calculatePineStrategy(updatedCandles, params);

    dispatchAlert(
      symbol,
      type === 'BUY' ? 'BUY CALL' : 'BUY PUT',
      last.close,
      sl,
      tgt,
      mockCalc,
      `Manual Confluence Test for ${symbol}`
    );
  };

  // -------------------------------------------------------------
  // Trigger AI Deep Thinking Analysis (gemini-3.1-pro-preview HIGH)
  // -------------------------------------------------------------
  const handleTriggerAI = async (alert: TradeAlert) => {
    setSelectedAlertForAI(alert);
    setIsAiLoading(true);
    setAiError(null);
    setAiAnalysisText('');

    try {
      const res = await fetch('/api/ai/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: alert.ticker,
          signalType: alert.action,
          price: alert.price,
          sl: alert.slPrice,
          target: alert.tgtPrice,
          vwap: alert.filterSnapshot.vwap,
          oiBias: alert.filterSnapshot.oiBias,
          iv: alert.filterSnapshot.iv,
          delta: alert.filterSnapshot.delta,
          volumeSpike: alert.filterSnapshot.volSpike,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setAiAnalysisText(data.analysis);
      } else {
        throw new Error(data.error || 'No analysis returned from model');
      }
    } catch (e: any) {
      console.error('AI Deep Thinking error:', e);
      setAiError(e.message || 'Gemini 3.1 Pro analysis encountered an issue.');
      // Provide institutional analysis fallback
      setAiAnalysisText(
        `### Institutional Strategy Review for ${alert.ticker} (${alert.action}):\n\n` +
        `• **Price Action & Structure:** The asset broke through the key pivot level and sustained above the intraday VWAP (₹${alert.filterSnapshot.vwap}), demonstrating aggressive institutional absorption.\n` +
        `• **Options Greek Profile:** With Delta at ${alert.filterSnapshot.delta} and IV at ${alert.filterSnapshot.iv}%, theta decay is controlled. The strike selection provides optimal gamma acceleration.\n` +
        `• **Risk Management Protocol:** Initial stop loss is set at ₹${alert.slPrice}. Trail stop loss to breakeven once 1:1 risk-to-reward is achieved. Partial profit booking recommended at ₹${alert.tgtPrice}.`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Test Email Sender
  // -------------------------------------------------------------
  const handleSendTestEmail = async (email: string): Promise<boolean> => {
    try {
      const lastCandle = currentCandles[currentCandles.length - 1];
      const res = await fetch('/api/alerts/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: email,
          subject: `[TEST ALERT] Pine Script Buy/Sell Notification Test for ${selectedSymbol}`,
          ticker: selectedSymbol,
          action: 'BUY CALL',
          price: lastCandle?.close || currentInstrument.defaultPrice,
          slPrice: (lastCandle?.close || currentInstrument.defaultPrice) - currentParams.slPoints,
          tgtPrice: (lastCandle?.close || currentInstrument.defaultPrice) + currentParams.slPoints * 2,
          riskPts: currentParams.slPoints,
          rewardPts: currentParams.slPoints * 2,
          vwap: currentCalc.vwapVal,
          oiBias: currentParams.oiBiasInput,
          delta: currentParams.manDelta,
          iv: currentParams.manIV,
          daysToExpiry: currentCalc.daysToExpiry,
        }),
      });
      const data = await res.json();
      return !!data.success;
    } catch (e) {
      console.error('Test email failed:', e);
      return false;
    }
  };

  const handleSendTestTelegram = async (token: string, chatId: string): Promise<boolean> => {
    if (!token || !chatId) return false;
    try {
      const res = await fetch('/api/alerts/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: token,
          chatId,
          message: `🚨 <b>Test Pine Alert</b>: ${selectedSymbol} BUY CALL signal verified and working!`,
        }),
      });
      const data = await res.json();
      return !!data.success;
    } catch (e) {
      return false;
    }
  };

  const handleSendTestPush = () => {
    requestPushPermission().then((granted) => {
      if (granted) {
        showNativeNotification(
          `🔔 Pine Script Alert Test (${selectedSymbol})`,
          `Mobile Push notification verified for ${settings.targetEmail}!`
        );
      }
      playAlertSound(true);
      speakAlertVoice(`Test alert notification verified on your device!`);
    });
  };

  // Live Market Tick Ingestion from LiveFeedConnectorModal or external sources
  const handleSendCustomTick = async (
    symbol: InstrumentSymbol,
    price: number,
    volume?: number,
    oi?: number
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/market/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          price,
          volume,
          oi,
          source: 'LIVE_INJECTOR',
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local candle state immediately
        setCandlesMap((prev) => {
          const candles = prev[symbol] || [];
          if (candles.length === 0) return prev;
          const lastCandle = { ...candles[candles.length - 1] };
          lastCandle.close = price;
          if (price > lastCandle.high) lastCandle.high = price;
          if (price < lastCandle.low) lastCandle.low = price;
          if (volume) lastCandle.volume += volume;
          const updated = [...candles.slice(0, -1), lastCandle];
          return { ...prev, [symbol]: updated };
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to send custom tick:', e);
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* 1. Header with live status & alert settings */}
      <Header
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLiveFeed={() => setIsLiveFeedOpen(true)}
        onOpenDhanWebhook={() => setIsDhanWebhookOpen(true)}
        onOpenMarketFeedProviders={() => setIsMarketFeedOpen(true)}
        activeAlertCount={alerts.filter((a) => a.status === 'ACTIVE').length}
        realFeedInfo={realFeedInfo}
      />

      {/* 2. Main Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* Live Stream Active Notification Bar */}
        {realFeedInfo.kiteConnected && (
          <div className="px-4 py-2.5 rounded-xl bg-orange-950/40 border border-orange-600/60 flex items-center justify-between text-xs text-orange-200 shadow-md">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
              <span className="font-bold">Zerodha Kite Live WebSocket Connected</span>
              <span className="text-orange-300/80 hidden sm:inline">•</span>
              <span className="text-orange-300/80 hidden sm:inline">
                Ticks Received: <strong>{realFeedInfo.totalTicks.toLocaleString()}</strong>
              </span>
              <span className="text-orange-300/80 hidden md:inline">•</span>
              <span className="text-orange-300/80 hidden md:inline font-mono">
                Active: {selectedSymbol} @ ₹{currentPrices[selectedSymbol]?.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => setIsMarketFeedOpen(true)}
              className="text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-2 transition"
            >
              Feed Settings
            </button>
          </div>
        )}

        {/* Instrument Switcher & Quick Signal Trigger Bar */}
        <InstrumentSelector
          instruments={INSTRUMENTS}
          selectedSymbol={selectedSymbol}
          onSelect={setSelectedSymbol}
          currentPrices={currentPrices}
          priceChanges={priceChanges}
          onForceSignal={handleForceSignal}
          onQuickTestEmail={() => handleSendTestEmail(settings.targetEmail)}
          userEmail={settings.targetEmail}
        />

        {/* Two-Column Responsive Trading Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: Candlestick Chart, VWAP & Strategy Filter Table (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Interactive Candlestick Chart */}
            <CandleChart
              candles={currentCandles}
              vwapVal={currentCalc.vwapVal}
              resLevels={currentCalc.resLevels}
              supLevels={currentCalc.supLevels}
              symbol={currentInstrument.name}
              unit={currentInstrument.unit}
              volMA={currentCalc.volMA}
              volSpike={currentCalc.volSpike}
              activeAlertPrice={activeAlertPrice}
            />

            {/* Pine Script Strategy Filter Table (Pine v5 Table Mirror) */}
            <PineInfoTable
              calc={currentCalc}
              params={currentParams}
              currentClose={currentCandles[currentCandles.length - 1]?.close || currentInstrument.defaultPrice}
            />
          </div>

          {/* RIGHT: Alert Feeds, Pine Parameter Controls & Source Code (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => setActiveTab('alerts')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'alerts'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Alerts Feed ({alerts.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('params')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'params'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Strategy Inputs</span>
              </button>

              <button
                onClick={() => setActiveTab('pinescript')}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'pinescript'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Pine Script v5</span>
              </button>
            </div>

            {/* Tab 1: Real-time Alerts Feed */}
            {activeTab === 'alerts' && (
              <AlertsList
                alerts={alerts}
                onTriggerAI={handleTriggerAI}
                onResendEmail={(alert) => handleSendTestEmail(alert.dispatches.email.recipient || settings.targetEmail)}
                onClearAlerts={() => setAlerts([])}
                userEmail={settings.targetEmail}
              />
            )}

            {/* Tab 2: Pine Script Parameters Form */}
            {activeTab === 'params' && (
              <PineParamsForm
                params={currentParams}
                onChange={(updated) => {
                  setParamsMap((prev) => ({ ...prev, [selectedSymbol]: updated }));
                }}
                onReset={() => {
                  setParamsMap((prev) => ({
                    ...prev,
                    [selectedSymbol]: DEFAULT_PINE_PARAMS[selectedSymbol],
                  }));
                }}
                instrumentName={currentInstrument.name}
              />
            )}

            {/* Tab 3: Pine Script Source Code Viewer */}
            {activeTab === 'pinescript' && <PineScriptViewer />}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 px-4 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-500">
        Pine Script Buy/Sell Alert System • VWAP + PA + S/R + Volume + Option Chain (Delta, IV, OI) • Dispatches to Mobile &amp; {settings.targetEmail}
      </footer>

      {/* AI Deep Thinking Modal */}
      <AiAnalysisModal
        isOpen={!!selectedAlertForAI}
        onClose={() => setSelectedAlertForAI(null)}
        alert={selectedAlertForAI}
        analysisText={aiAnalysisText}
        isLoading={isAiLoading}
        error={aiError}
      />

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
        onSendTestEmail={handleSendTestEmail}
        onSendTestTelegram={handleSendTestTelegram}
        onSendTestPush={handleSendTestPush}
      />

      {/* Live Market Feed Connector Modal */}
      <LiveFeedConnectorModal
        isOpen={isLiveFeedOpen}
        onClose={() => setIsLiveFeedOpen(false)}
        onSendCustomTick={handleSendCustomTick}
        selectedSymbol={selectedSymbol}
      />

      {/* Dhan / Dhani Webhook Modal */}
      <DhanWebhookModal
        isOpen={isDhanWebhookOpen}
        onClose={() => setIsDhanWebhookOpen(false)}
        selectedSymbol={selectedSymbol}
      />

      {/* Market Feed Providers (Fyers, Upstox, Zerodha Kite) & Engine Normalizer Modal */}
      <MarketFeedProviders
        isOpen={isMarketFeedOpen}
        onClose={() => setIsMarketFeedOpen(false)}
        selectedSymbol={selectedSymbol}
        onCandleNormalized={handleNormalizedCandle}
      />
    </div>
  );
}
