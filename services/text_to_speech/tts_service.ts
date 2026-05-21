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

  public sanitizeTamilSpeechText(text: string): string {
    const replacements: Record<string, string> = {
      "Aarogi": "ஆரோகி",
      "AI": "ஏ ஐ",
      "Dr.": "டாக்டர்",
      "Dr": "டாக்டர்",
      "AM": "ஏ.எம்",
      "PM": "பி.எம்",
      "Dermatology": "தோல் மருத்துவம்",
      "Cardiology": "இதய நோய்",
      "Neurology": "நரம்பு மருத்துவம்",
      "Pediatrics": "குழந்தை நலம்",
      "Orthopedics": "எலும்பு மருத்துவம்",
      "Gynecology": "மகளிர் மருத்துவம்",
      "Ophthalmology": "கண் மருத்துவம்",
      "General Medicine": "பொது மருத்துவம்",
      "Dental": "பற் மருத்துவம்",
      "appointment": "சந்திப்பு",
      "booking": "முன்பதிவு",
      "cancel": "ரத்து",
      "confirm": "உறுதி",
      "available": "கிடைக்கும்",
      "slot": "நேரம்",
      "morning": "காலை",
      "afternoon": "மதியம்",
      "evening": "மாலை",
      "today": "இன்று",
      "tomorrow": "நாளை",
      "yes": "ஆம்",
      "no": "இல்லை"
    };

    const transliterateLatinWordToTamil = (word: string) => {
      const dictionary: Record<string, string> = {
        "aarogi": "ஆரோகி",
        "ai": "ஏ ஐ",
        "sanjay": "சஞ்சய்",
        "doctor": "டாக்டர்",
        "dr": "டாக்டர்",
        "am": "ஏ.எம்",
        "pm": "பி.எம்",
        "appointment": "சந்திப்பு",
        "booking": "முன்பதிவு",
        "cancel": "ரத்து",
        "confirm": "உறுதி",
        "available": "கிடைக்கும்",
        "slot": "நேரம்",
        "morning": "காலை",
        "afternoon": "மதியம்",
        "evening": "மாலை",
        "today": "இன்று",
        "tomorrow": "நாளை",
        "yes": "ஆம்",
        "no": "இல்லை"
      };

      const normalized = word.toLowerCase();
      if (dictionary[normalized]) {
        return dictionary[normalized];
      }

      const letterMap: Record<string, string> = {
        a: "ஏ",
        b: "பீ",
        c: "சி",
        d: "டி",
        e: "ஈ",
        f: "எஃப்",
        g: "ஜீ",
        h: "எச்",
        i: "ஐ",
        j: "ஜே",
        k: "கே",
        l: "எல்",
        m: "எம்",
        n: "என்",
        o: "ஓ",
        p: "பீ",
        q: "க்யூ",
        r: "ஆர்",
        s: "எஸ்",
        t: "டி",
        u: "யூ",
        v: "வீ",
        w: "டபிள்யூ",
        x: "எக்ஸ்",
        y: "வை",
        z: "ஜெட்"
      };

      return normalized
        .split("")
        .map((ch) => letterMap[ch] || ch)
        .join(" ");
    };

    let sanitized = text;
    // First pass: replace known full words - sort by length descending to match longer phrases first
    const sortedReplacements = Object.entries(replacements)
      .sort(([a], [b]) => b.length - a.length);
    for (const [eng, tamil] of sortedReplacements) {
      sanitized = sanitized.replace(new RegExp(eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"), tamil);
    }

    // Second pass: transliterate remaining Latin words
    sanitized = sanitized.replace(/\b[A-Za-z]{2,}\b/g, (match) => {
      return transliterateLatinWordToTamil(match);
    });

    return sanitized;
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
    console.log("[TTS] Generating speech for lang:", lang, "| text length:", cleanSpeechText.length);
    console.log("[TTS] Text preview:", cleanSpeechText.substring(0, 80));

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
        const ttsText =
          lang === Language.TAMIL
            ? this.sanitizeTamilSpeechText(cleanSpeechText)
            : cleanSpeechText;

        let speechPrompt = "";

        // Proper multilingual prompting
        if (lang === Language.HINDI) {
          speechPrompt = `
निम्नलिखित वाक्य को स्पष्ट, प्राकृतिक और प्रोफेशनल हिन्दी आवाज़ में बोलें:

"${ttsText}"
`;
        } else if (
          lang === Language.TAMIL
        ) {
          speechPrompt = `
பின்வரும் வாக்கியத்தை தெளிவான, இயல்பான மற்றும் தொழில்முறை தமிழ் குரலில் பேசுங்கள்:

"${ttsText}"
`;
        } else {
          speechPrompt = `
Speak the following in a warm, professional healthcare assistant voice:

"${ttsText}"
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
                          lang === Language.ENGLISH
                          ? "Zephyr"
                          : lang === Language.HINDI
                          ? "Kore"
                          : "Sulafat",
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
        console.log("[TTS] base64Audio received:", !!base64Audio, "| length:", base64Audio?.length);

        // SUCCESS
        // PCM to WAV converter
const pcmToWav = (pcmBase64: string): string => {
  const pcmData = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => 
    s.split('').forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true); writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcmData);
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

// SUCCESS
if (base64Audio) {
  audioData = pcmToWav(base64Audio); // wrap PCM → WAV
  hasAudio = true;

  // Cache audio
  this.ttsCache.set(cacheKey, audioData);
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