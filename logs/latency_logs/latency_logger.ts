import * as fs from "fs";
import * as path from "path";

const LOGS_DIR = path.join(process.cwd(), "logs", "latency_logs");
const LOG_FILE = path.join(LOGS_DIR, "roundtrip.log");

export class LatencyLogger {
  constructor() {
    this.ensureDirectory();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
      }
    } catch (err) {
      console.error("Failed creating clinical latency log directory on local disk:", err);
    }
  }

  /**
   * Appends JSON latency event onto disk log
   */
  public logLatency(event: {
    stt: number;
    llm: number;
    tts: number;
    total: number;
    textLength: number;
    language: string;
  }): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] STT_MS=${event.stt} LLM_MS=${event.llm} TTS_MS=${event.tts} TOTAL_MS=${event.total} CHARS=${event.textLength} LANG=${event.language}\n`;
    
    fs.appendFile(LOG_FILE, line, (err) => {
      if (err) {
        console.error("Disk logger warning: failed appending latency report:", err);
      }
    });
  }
}

export const latencyLogger = new LatencyLogger();
