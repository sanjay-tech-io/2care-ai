import { WebSocket } from "ws";
import { clinicalAgentOrchestrator } from "../../agent/reasoning/orchestrator";
import { latencyLogger } from "../../logs/latency_logs/latency_logger";
import { Language } from "../../src/types";
// At the top, import ttsService
import { ttsService } from "../../services/text_to_speech/tts_service";

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
          phoneAssociated =
            payload.phone || payload.phoneAssociated || "9876543210";
          preferredLang =
            (payload.language as Language) || preferredLang || Language.ENGLISH;

          const welcomeText =
            preferredLang === Language.HINDI
              ? "नमस्ते, मैं आपकी कैसे सहायता कर सकता हूँ?"
              : preferredLang === Language.TAMIL
                ? "வணக்கம், நான் உங்களுக்கு எப்படி உதவ முடியும்?"
                : "Hello! I am Aarogi, your healthcare assistant. Which specialist would you like to consult?";

          // ✅ Generate Gemini TTS for welcome too
          const welcomeVoice = await ttsService.generateSpeech(
            welcomeText,
            preferredLang,
          );

          ws.send(
            JSON.stringify({
              type: "voice_response",
              text: welcomeText,
              language: preferredLang,
              audio: welcomeVoice.hasAudio ? welcomeVoice.audioData : undefined,
              trace: {
                detectedIntent: "greeting",
                retrievedMemory: JSON.stringify({
                  phone: phoneAssociated,
                  language: preferredLang,
                }),
                selectedTool: "none",
                toolResults: "Welcome greeting",
                finalResponse: welcomeText,
                languageDetected: preferredLang,
              },
              latencies: { stt: 0, llm: 0, tts: 0, total: 0 },
            }),
          );
          return;
        }

        if (payload.type === "user_transcription") {
          const userText = payload.text || "";
          const phoneAssociatedVal =
            payload.phone || phoneAssociated || "9876543210";
          const clientLang =
            (payload.language as Language) || preferredLang || Language.ENGLISH;
          const overrideName = payload.name;

          // Push thinking status
          ws.send(JSON.stringify({ type: "processing_audio" }));

          // Invoke orchestrator core processing loops
          const replyResult = await clinicalAgentOrchestrator.handleRequest({
            phone: phoneAssociatedVal,
            userInput: userText,
            presetLanguage: clientLang,
            overrideName,
          });

          // Log latency performance statistics safely onto filesystem
          latencyLogger.logLatency({
            stt: replyResult.latencies.stt,
            llm: replyResult.latencies.llm,
            tts: replyResult.latencies.tts,
            total: replyResult.latencies.total,
            textLength: replyResult.textResponse.length,
            language: replyResult.detectedLanguage,
          });

          console.log("[WS] Sending audio:", !!replyResult.speakAudio?.hasAudio, "| lang:", replyResult.detectedLanguage);

          // Send back the model's voice response structures
          ws.send(
            JSON.stringify({
              type: "voice_response",
              text: replyResult.textResponse,
              language: replyResult.detectedLanguage,
              trace: replyResult.trace,
              latencies: replyResult.latencies,
              audio: replyResult.speakAudio?.hasAudio
                ? replyResult.speakAudio.audioData
                : undefined,
            }),
          );
        }
      } catch (err: any) {
        console.error("Clinical Voice WebSocket stream exception:", err);
        ws.send(
          JSON.stringify({
            type: "error",
            message: err.message || "An unexpected error occurred.",
          }),
        );
      }
    });

    ws.on("close", () => {
      console.log(
        "Patient dialer offline: clinical WebSocket channel dismantled.",
      );
    });
  }
}

export const voiceSocketBroker = new VoiceSocketBroker();
