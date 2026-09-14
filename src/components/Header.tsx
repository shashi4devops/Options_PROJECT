import React from 'react';
import { Bell, Mail, Smartphone, Volume2, Settings, ShieldCheck, Activity, Radio } from 'lucide-react';
import { NotificationSettings } from '../types';

interface HeaderProps {
  settings: NotificationSettings;
  onOpenSettings: () => void;
  onOpenLiveFeed: () => void;
  onOpenDhanWebhook: () => void;
  onOpenMarketFeedProviders: () => void;
  activeAlertCount: number;
  realFeedInfo?: {
    isActive: boolean;
    source: string;
    kiteConnected: boolean;
    totalTicks: number;
  };
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onOpenSettings,
  onOpenLiveFeed,
  onOpenDhanWebhook,
  onOpenMarketFeedProviders,
  activeAlertCount,
  realFeedInfo,
}) => {
  return (
    <header id="main-app-header" className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & App Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                Pine Script Buy/Sell Alert System
              </h1>
              {realFeedInfo?.kiteConnected ? (
                <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-950 text-orange-300 border border-orange-700 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  <span>KITE LIVE STREAMING</span>
                </span>
              ) : realFeedInfo?.isActive ? (
                <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>LIVE FEED ACTIVE</span>
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                  <span>STANDBY</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              NIFTY • BANK NIFTY • SENSEX • GOLD • SILVER • CRUDE OIL
            </p>
          </div>
        </div>

        {/* Live Channel Badges & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Zerodha Kite & Market Feed Providers Button */}
          <button
            onClick={onOpenMarketFeedProviders}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ${
              realFeedInfo?.kiteConnected
                ? 'bg-orange-950/80 hover:bg-orange-900/90 text-orange-200 border border-orange-500 ring-1 ring-orange-500/50'
                : realFeedInfo?.isActive
                ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600'
                : 'bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-700/80 hover:border-cyan-400'
            }`}
            title="Connect Zerodha Kite Live WebSocket or Fyers / Upstox Feeds"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                realFeedInfo?.kiteConnected
                  ? 'bg-orange-400 animate-ping'
                  : realFeedInfo?.isActive
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-cyan-400'
              }`}
            ></span>
            <span>{realFeedInfo?.kiteConnected ? 'Kite Connected 🟢' : 'Zerodha Kite & Feeds'}</span>
          </button>

          {/* Dhan Webhook Button */}
          <button
            onClick={onOpenDhanWebhook}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-orange-950/40 hover:bg-orange-900/50 text-orange-300 border border-orange-700/60 text-xs font-semibold shadow-sm transition hover:border-orange-500"
            title="Get Webhook URL for Dhan / Dhani App and TradingView"
          >
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
            <span>Dhan Webhook</span>
          </button>

          {/* Live Feed Connector Button */}
          <button
            onClick={onOpenLiveFeed}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition hover:border-emerald-500"
            title="Connect Live NSE, BSE & MCX Market Feeds (TradingView / Broker WebSockets / API)"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="hidden xs:inline">Feed Live Market</span>
            <span className="xs:hidden">Live Feed</span>
          </button>

          {/* Email Badge */}
          <div
            className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
            title={`Alerts routed to ${settings.targetEmail}`}
          >
            <Mail className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] text-emerald-300">
              {settings.targetEmail.split('@')[0]}@...
            </span>
          </div>

          {/* Mobile Telegram / Push Badge */}
          <div
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
            title="Mobile phone notifications"
          >
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] text-sky-300">Mobile Alerts</span>
          </div>

          {/* Audio Voice Alert Badge */}
          <div
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
            title={settings.audioVoiceEnabled ? "Voice speech alerts active" : "Audio muted"}
          >
            <Volume2 className={`w-3.5 h-3.5 ${settings.audioVoiceEnabled ? 'text-amber-400' : 'text-slate-600'}`} />
            <span className="text-[11px] hidden sm:inline">
              {settings.audioVoiceEnabled ? 'Voice Alarm' : 'Muted'}
            </span>
          </div>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
            title="Configure Mobile & Email Alert Settings"
          >
            <Settings className="w-4 h-4" />
            <span>Alert Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
