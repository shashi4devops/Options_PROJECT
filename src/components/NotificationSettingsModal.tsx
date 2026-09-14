import React, { useState } from 'react';
import { NotificationSettings } from '../types';
import { Mail, Send, Bell, Smartphone, Copy, Check, X, Shield, Volume2, Sparkles } from 'lucide-react';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onSaveSettings: (updated: NotificationSettings) => void;
  onSendTestEmail: (email: string) => Promise<boolean>;
  onSendTestTelegram: (token: string, chatId: string) => Promise<boolean>;
  onSendTestPush: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onSendTestEmail,
  onSendTestTelegram,
  onSendTestPush,
}) => {
  const [localSettings, setLocalSettings] = useState<NotificationSettings>(settings);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const webhookEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/tradingview`
    : 'https://.../api/webhook/tradingview';

  const tradingviewSampleJson = JSON.stringify(
    {
      ticker: "{{ticker}}",
      action: "{{strategy.order.action}}",
      price: "{{close}}",
      sl: "{{strategy.order.comment}}",
      tgt: "{{strategy.order.alert_message}}",
      message: "Pine Script VWAP+Structure+Vol Alert",
    },
    null,
    2
  );

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopySampleJson = () => {
    navigator.clipboard.writeText(tradingviewSampleJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleTestEmailClick = async () => {
    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const ok = await onSendTestEmail(localSettings.targetEmail);
      if (ok) {
        setEmailStatus(`Test alert email successfully dispatched to ${localSettings.targetEmail}!`);
      } else {
        setEmailStatus('Dispatched simulated test email. Check history log.');
      }
    } catch (e: any) {
      setEmailStatus(`Failed: ${e.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleTestTelegramClick = async () => {
    setIsSendingTelegram(true);
    setTelegramStatus(null);
    try {
      const ok = await onSendTestTelegram(localSettings.telegramBotToken, localSettings.telegramChatId);
      if (ok) {
        setTelegramStatus('Telegram alert delivered to your mobile phone!');
      } else {
        setTelegramStatus('Please provide both Telegram Bot Token and Chat ID to send to phone.');
      }
    } catch (e: any) {
      setTelegramStatus(`Failed: ${e.message}`);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">
                Mobile &amp; E-mail Notification Configuration
              </h3>
              <p className="text-[11px] text-slate-400">
                Configure instant alerts to your phone, mailbox, and TradingView Pine Script webhook
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* 1. E-MAIL NOTIFICATIONS */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200 text-sm">1. E-mail Alert Setup</span>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <span className="text-xs text-slate-400">Active</span>
                <input
                  type="checkbox"
                  checked={localSettings.emailEnabled}
                  onChange={(e) => setLocalSettings({ ...localSettings, emailEnabled: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4"
                />
              </label>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Target Recipient Email Address:</label>
              <div className="flex space-x-2">
                <input
                  type="email"
                  value={localSettings.targetEmail}
                  onChange={(e) => setLocalSettings({ ...localSettings, targetEmail: e.target.value })}
                  placeholder="e.g. telangana.shashi@gmail.com"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleTestEmailClick}
                  disabled={isSendingEmail || !localSettings.targetEmail}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium transition flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingEmail ? 'Sending...' : 'Send Test Email'}</span>
                </button>
              </div>
              {emailStatus && (
                <p className="mt-2 text-[11px] text-emerald-400 font-medium">
                  {emailStatus}
                </p>
              )}
            </div>
          </div>

          {/* 2. MOBILE ALERTS (PUSH, SOUND, TELEGRAM) */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-slate-200 text-sm">2. Mobile Phone Alert Options</span>
            </div>

            {/* Browser Push and Voice Audio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block">Smartphone / Web Push</span>
                  <span className="text-[11px] text-slate-400">Native push notification on device</span>
                </div>
                <button
                  onClick={onSendTestPush}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-medium"
                >
                  Test Push
                </button>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block">Voice Alarm &amp; Chime</span>
                  <span className="text-[11px] text-slate-400">Speaks signal action aloud</span>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.audioVoiceEnabled}
                    onChange={(e) => setLocalSettings({ ...localSettings, audioVoiceEnabled: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 w-4 h-4"
                  />
                </label>
              </div>
            </div>

            {/* Telegram Bot Setup */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sky-300">Direct Mobile Telegram Alerts (Instant &amp; Free)</span>
                <span className="text-[10px] text-slate-400">Recommended for Indian Traders</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Telegram Bot Token</label>
                  <input
                    type="text"
                    value={localSettings.telegramBotToken}
                    onChange={(e) => setLocalSettings({ ...localSettings, telegramBotToken: e.target.value })}
                    placeholder="e.g. 712345678:AAH..."
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={localSettings.telegramChatId}
                    onChange={(e) => setLocalSettings({ ...localSettings, telegramChatId: e.target.value })}
                    placeholder="e.g. 123456789"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500">
                  Tip: Message @BotFather to create a bot &amp; @userinfobot to get your Chat ID.
                </span>
                <button
                  type="button"
                  onClick={handleTestTelegramClick}
                  disabled={isSendingTelegram}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition"
                >
                  {isSendingTelegram ? 'Testing...' : 'Test Telegram'}
                </button>
              </div>
              {telegramStatus && (
                <p className="text-[11px] text-sky-400 mt-1">{telegramStatus}</p>
              )}
            </div>
          </div>

          {/* 3. TRADINGVIEW PINE SCRIPT WEBHOOK BRIDGE */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-sm">
                3. TradingView Pine Script Webhook URL
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Live Listening</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Paste this webhook URL into your TradingView Alert dialog. When your Pine script strategy triggers an alert on TradingView, it will automatically post to this endpoint and instantly dispatch to your Mobile and E-mail!
            </p>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={webhookEndpoint}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs select-all"
              />
              <button
                onClick={handleCopyWebhookUrl}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center space-x-1 transition"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 text-[11px]">TradingView Alert Message JSON Template:</span>
                <button
                  onClick={handleCopySampleJson}
                  className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center space-x-1"
                >
                  {copiedJson ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedJson ? 'Copied JSON' : 'Copy Message JSON'}</span>
                </button>
              </div>
              <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto">
                {tradingviewSampleJson}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Default recipient: telangana.shashi@gmail.com
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-md"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
