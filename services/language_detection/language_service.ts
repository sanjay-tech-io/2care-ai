import { Language } from "../../src/types";

export class LanguageService {
  /**
   * Detect spoken language from text
   * Supports:
   * - English
   * - Hindi
   * - Tamil
   */

  public detectLanguage(
    text: string,
    currentPreferred: Language = Language.ENGLISH
  ): Language {

    if (!text || text.trim().length === 0) {
      return currentPreferred;
    }

    // ORIGINAL TEXT
    const originalText = text.trim();

    // LOWERCASE VERSION
    const textSample = originalText.toLowerCase();

    // -----------------------------
    // DIRECT SCRIPT DETECTION
    // -----------------------------

    // Tamil Unicode Range
    if (/[\u0B80-\u0BFF]/.test(originalText)) {
      return Language.TAMIL;
    }

    // Hindi / Devanagari Unicode Range
    if (/[\u0900-\u097F]/.test(originalText)) {
      return Language.HINDI;
    }

    // -----------------------------
    // ROMANIZED HINDI KEYWORDS
    // -----------------------------

    const hindiTriggers = [
      "namaste",
      "mujhe",
      "appointment",
      "doctor",
      "kal",
      "aaj",
      "baje",
      "samay",
      "dhanyawad",
      "shukriya",
      "samasya",
      "kaise",
      "theek",
      "khana",
      "dawa",
      "madad",
      "kijiye",
      "bataiye",
      "hai",
      "hindi",
      "clinic",
      "hospital",
      "book",
      "karna",
      "milna"
    ];

    // -----------------------------
    // ROMANIZED TAMIL KEYWORDS
    // -----------------------------

    const tamilTriggers = [
      "vanakkam",
      "yenakku",
      "enakku",
      "doctor",
      "appointment",
      "vendum",
      "nalaiku",
      "indru",
      "mani",
      "neram",
      "nanri",
      "booking",
      "panna",
      "tamil",
      "udavi",
      "pesunga",
      "maruthuvam",
      "veedu",
      "sari",
      "enna",
      "pudhu",
      "ungal",
      "neenga",
      "thirumba",
      "nanri",
      "suthi",
      "urimai",
      "kaasu"
    ];

    let tamilCount = 0;
    let hindiCount = 0;

    const tokens = textSample.split(/[^a-z0-9]+/i).filter(Boolean);

    tokens.forEach((token) => {
      tamilTriggers.forEach((word) => {
        if (token.includes(word)) {
          tamilCount++;
        }
      });
      hindiTriggers.forEach((word) => {
        if (token.includes(word)) {
          hindiCount++;
        }
      });
    });

    // -----------------------------
    // FINAL DECISION
    // -----------------------------

    if (tamilCount > hindiCount && tamilCount > 0) {
      return Language.TAMIL;
    }

    if (hindiCount > tamilCount && hindiCount > 0) {
      return Language.HINDI;
    }

    // DEFAULT
    return Language.ENGLISH;
  }
}

export const languageService =
  new LanguageService();