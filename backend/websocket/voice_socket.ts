import { WebSocket } from "ws";
import { clinicalAgentOrchestrator } from "../../agent/reasoning/orchestrator";
import { latencyLogger } from "../../logs/latency_logs/latency_logger";
import { Language } from "../../src/types";

export class VoiceSocketBroker {
  /**
   * Orchestrate events upon WebSocket client connection
   */
  public handleConnection(ws: WebSocket): void {
    console.log("Patient dialer online: clinical WebSocket channel booted.");
    let phoneAssociated = "";
    let preferredLang = Language.ENGLISH;

    ws.on("message", async (messageStr: string) => {
      try {
        const payload = JSON.parse(messageStr);

        if (payload.type === "call_start" || payload.type === "greeting") {
          phoneAssociated = payload.phone || payload.phoneAssociated || "9876543210";
          preferredLang = (payload.language as Language) || preferredLang || Language.ENGLISH;

          // On first contact, show specialists list
          const welcomeQueryStr = preferredLang === Language.HINDI
            ? "नमस्ते, मैं आपकी कैसे सहायता कर सकता हूँ? कृपया मुझे बताएं आपको किस प्रकार की दवा चाहिए"
            : preferredLang === Language.TAMIL
            ? "வணக்கம், நான் உங்களுக்கு எப்படி உதவ முடியும்? தயவுசெய்து உங்களுக்கு எந்த மருத்துவ வல்லுநர் தேவை என்று சொல்லுங்கள்"
            : "Hello! I am Aarogi, your healthcare assistant. Which specialist would you like to consult? We have Dermatologist, Cardiologist, Neurologist, Pediatrician, and more available.";

          const welcomeResult = await clinicalAgentOrchestrator.handleRequest({
            phone: phoneAssociated,
            userInput: welcomeQueryStr,
            presetLanguage: preferredLang,
            overrideName: payload.name
          });

          ws.send(JSON.stringify({
            type: "voice_response",
            text: welcomeResult.textResponse,
            language: welcomeResult.detectedLanguage,
            trace: welcomeResult.trace,
            latencies: welcomeResult.latencies,
            audio: welcomeResult.speakAudio?.hasAudio ? welcomeResult.speakAudio.audioData : undefined
          }));
        }

        if (payload.type === "user_transcription") {
          const userText = payload.text || "";
          const phoneAssociatedVal = payload.phone || phoneAssociated || "9876543210";
          const clientLang = (payload.language as Language) || preferredLang || Language.ENGLISH;
          const overrideName = payload.name;

          // Push thinking status
          ws.send(JSON.stringify({ type: "processing_audio" }));

          // Invoke orchestrator core processing loops
          const replyResult = await clinicalAgentOrchestrator.handleRequest({
            phone: phoneAssociatedVal,
            userInput: userText,
            presetLanguage: clientLang,
            overrideName
          });

          // Log latency performance statistics safely onto filesystem
          latencyLogger.logLatency({
            stt: replyResult.latencies.stt,
            llm: replyResult.latencies.llm,
            tts: replyResult.latencies.tts,
            total: replyResult.latencies.total,
            textLength: replyResult.textResponse.length,
            language: replyResult.detectedLanguage
          });

          // Send back the model's voice response structures
          ws.send(JSON.stringify({
            type: "voice_response",
            text: replyResult.textResponse,
            language: replyResult.detectedLanguage,
            trace: replyResult.trace,
            latencies: replyResult.latencies,
            audio: replyResult.speakAudio?.hasAudio ? replyResult.speakAudio.audioData : undefined
          }));
        }
      } catch (err: any) {
        console.error("Clinical Voice WebSocket stream exception:", err);
        ws.send(JSON.stringify({
          type: "error",
          message: err.message || "An unexpected error occurred."
        }));
      }
    });

    ws.on("close", () => {
      console.log("Patient dialer offline: clinical WebSocket channel dismantled.");
    });
  }
}

export const voiceSocketBroker = new VoiceSocketBroker();
