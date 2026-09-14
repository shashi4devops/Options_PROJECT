import { resolveInstrumentSymbol, BROKER_SYMBOL_MAPPINGS } from './feedNormalizer';
import { InstrumentSymbol, NormalizedTick } from '../types';

export interface KiteCredentials {
  apiKey?: string;
  accessToken?: string;
  enctoken?: string;
  uid?: string;
}

export interface KiteStreamerStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  isConnected: boolean;
  connectionType: 'kite_connect_api' | 'kite_web_enctoken' | 'none';
  totalTicksReceived: number;
  lastTickTimestamp: number | null;
  lastError: string | null;
  activeTokens: number[];
  subscribedSymbols: string[];
}

export class KiteStreamer {
  private ws: any = null;
  private status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private connectionType: 'kite_connect_api' | 'kite_web_enctoken' | 'none' = 'none';
  private totalTicksReceived = 0;
  private lastTickTimestamp: number | null = null;
  private lastError: string | null = null;
  private credentials: KiteCredentials | null = null;
  private reconnectTimer: any = null;
  private shouldReconnect = false;
  private onTickCallback?: (tick: NormalizedTick) => void;

  // Standard token list for Indian market instruments
  private readonly defaultTokens = [
    256265, // NIFTY 50
    260105, // NIFTY BANK
    265,    // SENSEX
    53490951, // GOLD FUT
    53491463, // SILVER FUT
    53491719, // CRUDE OIL FUT
  ];

  constructor(onTick?: (tick: NormalizedTick) => void) {
    this.onTickCallback = onTick;
  }

  public setOnTick(callback: (tick: NormalizedTick) => void) {
    this.onTickCallback = callback;
  }

  public getStatus(): KiteStreamerStatus {
    const symbols = this.defaultTokens.map((tok) => resolveInstrumentSymbol(tok, 'kite'));
    return {
      status: this.status,
      isConnected: this.status === 'connected',
      connectionType: this.connectionType,
      totalTicksReceived: this.totalTicksReceived,
      lastTickTimestamp: this.lastTickTimestamp,
      lastError: this.lastError,
      activeTokens: this.defaultTokens,
      subscribedSymbols: symbols,
    };
  }

  public connect(creds: KiteCredentials): { success: boolean; message: string } {
    this.disconnect();
    this.credentials = creds;
    this.shouldReconnect = true;
    this.lastError = null;

    let wsUrl = '';
    if (creds.enctoken && creds.enctoken.trim().length > 10) {
      // Zerodha Web enctoken endpoint (Free - No API subscription required!)
      const uid = creds.uid || 'kitefront';
      const cleanToken = creds.enctoken.trim();
      wsUrl = `wss://ws.zerodha.com/?api_key=kitefront&enctoken=${encodeURIComponent(cleanToken)}&uid=${encodeURIComponent(uid)}`;
      this.connectionType = 'kite_web_enctoken';
    } else if (creds.apiKey && (creds.accessToken || creds.enctoken)) {
      // Official Kite Connect API WebSocket endpoint
      const token = creds.accessToken || creds.enctoken;
      wsUrl = `wss://ws.kite.trade?api_key=${encodeURIComponent(creds.apiKey.trim())}&access_token=${encodeURIComponent(token!.trim())}`;
      this.connectionType = 'kite_connect_api';
    } else {
      this.status = 'error';
      this.lastError = 'Please provide either an Enctoken or an API Key + Daily Access Token.';
      return { success: false, message: this.lastError };
    }

    try {
      this.status = 'connecting';
      console.log(`[KiteStreamer] Connecting to Zerodha WebSocket (${this.connectionType})...`);

      // Use native Node 22 WebSocket
      // @ts-ignore
      this.ws = new WebSocket(wsUrl);

      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[KiteStreamer] WebSocket connection established successfully.');
        this.status = 'connected';
        this.lastError = null;

        // 1. Subscribe to instruments
        const subscribeMsg = JSON.stringify({
          a: 'subscribe',
          v: this.defaultTokens,
        });
        this.ws.send(subscribeMsg);

        // 2. Set mode to FULL (LTP + OHLC + Volume + OI)
        const modeMsg = JSON.stringify({
          a: 'mode',
          v: ['full', this.defaultTokens],
        });
        this.ws.send(modeMsg);
        console.log(`[KiteStreamer] Subscribed to ${this.defaultTokens.length} instruments in FULL mode.`);
      };

      this.ws.onmessage = async (event: any) => {
        try {
          const raw = event.data;
          let buf: Buffer;

          if (typeof raw === 'string') {
            // Text frame - could be error message or heartbeat
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'error') {
                console.error('[KiteStreamer] Server error:', parsed.data);
                this.lastError = `Kite Server Error: ${parsed.data || 'Invalid session/token'}`;
              }
            } catch {}
            return;
          }

          if (raw instanceof ArrayBuffer) {
            buf = Buffer.from(raw);
          } else if (Buffer.isBuffer(raw)) {
            buf = raw;
          } else if (raw && raw.arrayBuffer) {
            const arr = await raw.arrayBuffer();
            buf = Buffer.from(arr);
          } else {
            return;
          }

          this.parseBinaryPackets(buf);
        } catch (err: any) {
          console.error('[KiteStreamer] Packet processing error:', err.message);
        }
      };

      this.ws.onerror = (err: any) => {
        console.error('[KiteStreamer] WebSocket error:', err.message || err);
        this.status = 'error';
        this.lastError = err.message || 'Connection error. Check your API Key/Enctoken.';
      };

      this.ws.onclose = (event: any) => {
        console.log(`[KiteStreamer] WebSocket closed (code: ${event.code}, reason: ${event.reason || 'None'}).`);
        if (this.status !== 'error') {
          this.status = 'disconnected';
        }
        if (event.reason) {
          this.lastError = `Closed by Zerodha: ${event.reason}`;
        }

        // Auto-reconnect if not explicitly stopped
        if (this.shouldReconnect) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (this.shouldReconnect && this.credentials) {
              console.log('[KiteStreamer] Auto-reconnecting...');
              this.connect(this.credentials);
            }
          }, 5000);
        }
      };

      return {
        success: true,
        message: `Connecting to Zerodha Kite WebSocket (${this.connectionType === 'kite_web_enctoken' ? 'Web Enctoken Session' : 'Kite Connect API'})...`,
      };
    } catch (err: any) {
      this.status = 'error';
      this.lastError = err.message;
      return { success: false, message: `Failed to initialize connection: ${err.message}` };
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.status = 'disconnected';
    this.connectionType = 'none';
    console.log('[KiteStreamer] Disconnected from Zerodha Kite WebSocket.');
  }

  /**
   * Parse Zerodha binary packets format:
   * 2 bytes header: number of packets
   * Loop packets:
   *   2 bytes: packet length
   *   8 bytes: LTP mode
   *   28 or 32 bytes: Quote mode
   *   44 or 184 bytes: Full mode
   */
  private parseBinaryPackets(buf: Buffer) {
    if (buf.length < 2) return;

    const numPackets = buf.readUInt16BE(0);
    let offset = 2;
    const now = Date.now();

    for (let i = 0; i < numPackets && offset < buf.length; i++) {
      if (offset + 2 > buf.length) break;
      const packetLength = buf.readUInt16BE(offset);
      offset += 2;

      if (offset + packetLength > buf.length) break;

      const token = buf.readUInt32BE(offset);
      const symbol = resolveInstrumentSymbol(token, 'kite');
      const divisor = (token >= 50000000 && token < 60000000) ? 10000000 : 100; // MCX / CDS check

      let ltp = 0;
      let volume = 0;
      let open: number | undefined;
      let high: number | undefined;
      let low: number | undefined;
      let close: number | undefined;
      let oi: number | undefined;

      if (packetLength === 8) {
        // LTP Mode
        ltp = buf.readUInt32BE(offset + 4) / divisor;
      } else if (packetLength >= 28) {
        // Quote or Full Mode
        ltp = buf.readUInt32BE(offset + 4) / divisor;
        // last_traded_qty at offset + 8
        // atp at offset + 12
        volume = buf.readUInt32BE(offset + 16);
        // buy_qty at offset + 20
        // sell_qty at offset + 24

        if (packetLength >= 44) {
          open = buf.readUInt32BE(offset + 28) / divisor;
          high = buf.readUInt32BE(offset + 32) / divisor;
          low = buf.readUInt32BE(offset + 36) / divisor;
          close = buf.readUInt32BE(offset + 40) / divisor;

          if (packetLength >= 184) {
            // Full Depth mode with OI
            oi = buf.readUInt32BE(offset + 160);
          } else if (packetLength === 44) {
            // Mini full mode
            oi = buf.readUInt32BE(offset + 40);
          }
        }
      }

      offset += packetLength;

      if (ltp > 0) {
        this.totalTicksReceived++;
        this.lastTickTimestamp = now;

        const normalizedTick: NormalizedTick = {
          symbol,
          price: ltp,
          open,
          high,
          low,
          volume,
          oi,
          provider: 'kite',
          timestamp: now,
        };

        if (this.onTickCallback) {
          this.onTickCallback(normalizedTick);
        }
      }
    }
  }
}
