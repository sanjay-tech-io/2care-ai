import { WebSocket } from "ws";
import { clinicalAgentOrchestrator } from "../../agent/reasoning/orchestrator";
import { latencyLogger } from "../../logs/latency_logs/latency_logger";
import { Language } from "../../src/types";
// At the top, import ttsService
import { ttsService } from "../../services/text_to_speech/tts_service";
import { redisStore } from "../../database/redis/redis_service";

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

          // CHANGE 3: Create live session in Redis
          const sessionName = payload.name || payload.patientName || "Guest";
          await redisStore.set(`liveSession:${phoneAssociated}`, JSON.stringify({
            patientName: sessionName,
            phone: phoneAssociated,
            language: preferredLang,
            startTime: Date.now(),
            lastMessage: "Session started"
          }));

          const welcomeText =
            preferredLang === Language.HINDI
              ? `नमस्ते ${sessionName}! मैं आरोगी हूं, आपका स्वास्थ्य सहायक। आप कौन से डॉक्टर से मिलना चाहते हैं या आपको क्या तकलीफ है?`
              : preferredLang === Language.TAMIL
                ? `வணக்கம் ${sessionName}! நான் ஆரோகி, உங்கள் சுகாதார உதவியாளர். நீங்கள் எந்த மருத்துவரை சந்திக்க விரும்புகிறீர்கள்?`
                : `Hello ${sessionName}! I'm Aarogi, your personal healthcare assistant. I'm here to help you book appointments, check doctor availability, and answer your health queries. Could you please tell me your symptoms or which specialist you would like to consult today?`;

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

          // CHANGE 3: Update lastMessage in live session
          const existingSession = await redisStore.get(`liveSession:${phoneAssociatedVal}`);
          if (existingSession) {
            try {
              const sessionData = JSON.parse(existingSession);
              sessionData.lastMessage = userText;
              await redisStore.set(`liveSession:${phoneAssociatedVal}`, JSON.stringify(sessionData));
            } catch (e) {
              // Ignore parse errors
            }
          }

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

    ws.on("close", async () => {
      console.log(
        "Patient dialer offline: clinical WebSocket channel dismantled.",
      );
      // CHANGE 3: Delete live session from Redis
      if (phoneAssociated) {
        await redisStore.del(`liveSession:${phoneAssociated}`);
      }
    });
  }
}

export const voiceSocketBroker = new VoiceSocketBroker();
