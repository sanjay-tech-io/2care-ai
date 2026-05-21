import { GoogleGenAI } from "@google/genai";
import { Language } from "../../src/types";

export class TTSService {
  private ai: GoogleGenAI | null = null;

  // Speech cache
  private ttsCache = new Map<string, string>();

  constructor() {
    const key = process.env.GEMINI_API_KEY;

    if (key) {
      this.ai = new GoogleGenAI({
        apiKey: key,
      });
    }
  }

  /**
   * Generate multilingual speech
   * Supports:
   * - English
   * - Hindi
   * - Tamil
   */
  public async generateSpeech(
    text: string,
    lang: Language
  ): Promise<{
    hasAudio: boolean;
    audioData?: string;
    durationMs?: number;
    latencyMs: number;
    fallbackConfig: {
      langCode: string;
      voiceQuery: string;
      pitch: number;
      rate: number;
    };
  }> {
    const startTime = Date.now();

    let audioData: string | undefined;
    let hasAudio = false;

    // Default fallback config
    let langCode = "en-US";
    let voiceQuery = "Google US English";
    let pitch = 1.0;
    let rate = 1.0;

    // Language mapping
    switch (lang) {
      case Language.HINDI:
        langCode = "hi-IN";
        voiceQuery = "Google हिन्दी";
        break;

      case Language.TAMIL:
        langCode = "ta-IN";
        voiceQuery = "Google தமிழ்";
        break;

      case Language.ENGLISH:
      default:
        langCode = "en-US";
        voiceQuery = "Google US English";
        break;
    }

    // Clean text
    const cleanSpeechText = text
      .replace(/[*#_`~\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const cacheKey = `${lang}:${cleanSpeechText}`;

    // CACHE HIT
    if (this.ttsCache.has(cacheKey)) {
      const cached =
        this.ttsCache.get(cacheKey);

      if (cached) {
        return {
          hasAudio: true,
          audioData: cached,
          durationMs:
            cleanSpeechText.length * 60,
          latencyMs:
            Date.now() - startTime,
          fallbackConfig: {
            langCode,
            voiceQuery,
            pitch,
            rate,
          },
        };
      }
    }

    try {
      // Gemini TTS
      if (
        this.ai &&
        cleanSpeechText.length > 0
      ) {
        let speechPrompt = "";

        // Proper multilingual prompting
        if (lang === Language.HINDI) {
          speechPrompt = `
निम्नलिखित वाक्य को स्पष्ट, प्राकृतिक और प्रोफेशनल हिन्दी आवाज़ में बोलें:

"${cleanSpeechText}"
`;
        } else if (
          lang === Language.TAMIL
        ) {
          speechPrompt = `
பின்வரும் வாக்கியத்தை தெளிவான, இயல்பான மற்றும் தொழில்முறை தமிழ் குரலில் பேசுங்கள்:

"${cleanSpeechText}"
`;
        } else {
          speechPrompt = `
Speak the following in a warm, professional healthcare assistant voice:

"${cleanSpeechText}"
`;
        }

        const ttsResult =
          await this.ai.models.generateContent(
            {
              model:
                "gemini-2.5-flash-preview-tts",
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: speechPrompt,
                    },
                  ],
                },
              ],
              config: {
                responseModalities: [
                  "AUDIO",
                ],

                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig:
                      {
                        voiceName:
                          lang ===
                          Language.ENGLISH
                            ? "Zephyr"
                            : "Kore",
                      },
                  },
                },
              },
            }
          );

        const part =
          ttsResult.candidates?.[0]
            ?.content?.parts?.[0];

        const base64Audio =
          part?.inlineData?.data;

        // SUCCESS
        if (base64Audio) {
          audioData = base64Audio;
          hasAudio = true;

          // Cache audio
          this.ttsCache.set(
            cacheKey,
            base64Audio
          );
        }
      }
    } catch (err: any) {
      const errMsg =
        err?.message || String(err);

      if (
        errMsg.includes("429") ||
        errMsg.includes("quota") ||
        errMsg.includes(
          "RESOURCE_EXHAUSTED"
        )
      ) {
        console.info(
          `[TTS Service] Gemini quota exceeded. Falling back to browser speech synthesis (${langCode})`
        );
      } else {
        console.warn(
          "[TTS Service] Gemini TTS failed:",
          errMsg
        );
      }
    }

    return {
      hasAudio,
      audioData,
      durationMs:
        cleanSpeechText.length * 60,
      latencyMs:
        Date.now() - startTime,

      fallbackConfig: {
        langCode,
        voiceQuery,
        pitch,
        rate,
      },
    };
  }
}

export const ttsService =
  new TTSService();