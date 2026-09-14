// Audio and speech notification utility for mobile and desktop

export function playAlertSound(isBuyCall: boolean = true) {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Two-tone chime
    const now = audioCtx.currentTime;
    if (isBuyCall) {
      // Ascending pleasant major chord (Bullish)
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    } else {
      // Descending chord (Bearish)
      osc.frequency.setValueAtTime(740, now); // F#5
      osc.frequency.setValueAtTime(493.88, now + 0.12); // B4
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    }

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {
    console.warn("Audio Context not supported or allowed:", e);
  }
}

export function speakAlertVoice(text: string) {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (e) {
      console.warn("Push notification permission error:", e);
      return false;
    }
  }
  return false;
}

export function showNativeNotification(title: string, body: string) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
      });
    } catch (e) {
      console.warn("Failed to show native notification:", e);
    }
  }
}
