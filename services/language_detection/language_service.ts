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
      "book",
      "karna",
      "milna",
      "hai",
      "hindi",
      "clinic",
      "hospital",
      "madad",
      "kijiye",
      "bataiye"
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
      "maruthuvam"
    ];

    let tamilCount = 0;
    let hindiCount = 0;

    tamilTriggers.forEach((word) => {
      if (textSample.includes(word)) {
        tamilCount++;
      }
    });

    hindiTriggers.forEach((word) => {
      if (textSample.includes(word)) {
        hindiCount++;
      }
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