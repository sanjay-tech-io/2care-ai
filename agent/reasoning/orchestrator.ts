import { GoogleGenerativeAI } from "@google/generative-ai";
import { redisStore } from "../../database/redis/redis_service";
import { schedulerService } from "../../scheduler/appointment_engine/scheduler_service";
import { languageService } from "../../services/language_detection/language_service";
import { ttsService } from "../../services/text_to_speech/tts_service";
import { sessionService } from "../../memory/session_memory/session_service";
import { patientCache } from "../../memory/redis_memory/patient_cache";
import { getSystemInstructions } from "../prompts/system_instructions";

import {
  Language,
  TraceStep,
  SessionData,
  Doctor,
  ConversationStep,
} from "../../src/types";

// ================================================
// DATE FORMATTING UTILITY
// ================================================
function formatDateLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', month: 'long', day: 'numeric' 
  };
  const formatted = target.toLocaleDateString('en-IN', options);
  if (diffDays === 0) return `${formatted} (Today)`;
  if (diffDays === 1) return `${formatted} (Tomorrow)`;
  return formatted;
}

// Dynamic SYSTEM_TODAY - always computed at runtime
function getSystemToday(): string {
  return new Date().toISOString().split('T')[0];
}

const SYSTEM_TODAY = getSystemToday();

// ================================================
// INTENT EXTRACTION ENGINE
// ================================================

interface ExtractedIntent {
  intent: "booking" | "cancellation" | "reschedule" | "doctor_inquiry" | "symptom_discussion" | "general" | "confirm_slot" | "none";
  entities: {
    specialty?: string;
    doctorId?: string;
    doctorName?: string;
    date?: string;
    time?: string;
    symptoms?: string;
    appointmentId?: string;
  };
}

// Symptom to Specialty Mapping
const SYMPTOM_SPECIALTY_MAP: Record<string, string> = {
  // English
  "chest pain": "Cardiology",
  "heart": "Cardiology",
  "cardiac": "Cardiology",
  "skin": "Dermatology",
  "rash": "Dermatology",
  "fever": "General Medicine",
  "cold": "General Medicine",
  "cough": "General Medicine",
  "headache": "Neurology",
  "migraine": "Neurology",
  "nerve": "Neurology",
  "bone": "Orthopedics",
  "joint": "Orthopedics",
  "fall": "Orthopedics",
  "child": "Pediatrics",
  "baby": "Pediatrics",
  "infant": "Pediatrics",
  "pregnancy": "Gynecology",
  "women": "Gynecology",
  "eye": "Ophthalmology",
  "vision": "Ophthalmology",
  "dental": "Dental",
  "teeth": "Dental",
  // Tamil
  "இடுப்பு": "Orthopedics",
  "மார்பு வலி": "Cardiology",
  "சரும": "Dermatology",
  "காய்ச்சல்": "General Medicine",
  "தலைவலி": "Neurology",
  "குழந்தை": "Pediatrics",
  // Hindi
  "छाती दर्द": "Cardiology",
  "त्वचा": "Dermatology",
  "बुखार": "General Medicine",
  "सिरदर्द": "Neurology",
  "बच्चा": "Pediatrics",
  // Specialist names
  "dermatologist": "Dermatology",
  "dermatology": "Dermatology",
  "cardiologist": "Cardiology",
  "cardiology": "Cardiology",
  "pediatrician": "Pediatrics",
  "pediatrics": "Pediatrics",
  "neurologist": "Neurology",
  "neurology": "Neurology",
  "orthopedic": "Orthopedics",
  "orthopedics": "Orthopedics",
  // Tamil doctor types
  "தோல்": "Dermatology",
  "தோல் மருத்துவர்": "Dermatology",
  "தோல் மருத்துவம்": "Dermatology",
  "இதய": "Cardiology",
  "இதய மருத்துவர்": "Cardiology",
  "இதய நோய்": "Cardiology",
  "நரம்பியல்": "Neurology",
  "நரம்பியல் மருத்துவர்": "Neurology",
  "குழந்தை மருத்துவர்": "Pediatrics",
};

function mapSymptomToSpecialty(symptomText: string): string | undefined {
  const lower = symptomText.toLowerCase();
  for (const [keyword, specialty] of Object.entries(SYMPTOM_SPECIALTY_MAP)) {
    if (lower.includes(keyword)) {
      return specialty;
    }
  }
  return undefined;
}

// Date parsing helpers
function parseDate(dateText: string): string | undefined {
  const today = new Date(SYSTEM_TODAY);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const lower = dateText.toLowerCase();
  
  if (lower.includes("today") || lower.includes("இன்று") || lower.includes("आज")) {
    return today.toISOString().split("T")[0];
  }
  if (lower.includes("tomorrow") || lower.includes("நாளை") || lower.includes("कल")) {
    return tomorrow.toISOString().split("T")[0];
  }
  
  // Match date patterns like "May 22", "22nd May", "2026-05-22"
  const dateMatch = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  }
  
  const monthMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if (monthMatch) {
    const months: Record<string, string> = {
      "january": "01", "february": "02", "march": "03", "april": "04",
      "may": "05", "june": "06", "july": "07", "august": "08",
      "september": "09", "october": "10", "november": "11", "december": "12"
    };
    const month = months[monthMatch[1].toLowerCase()];
    if (month) {
      const day = monthMatch[2].padStart(2, "0");
      return `2026-${month}-${day}`;
    }
  }
  
  return undefined;
}

// ================================================
// ROBUST TIME PARSING
// ================================================
function parseTime(timeText: string): string | undefined {
  const lower = timeText.toLowerCase().trim();
  
  const standardTimes = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", 
                 "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
                 "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM"];

  for (const std of standardTimes) {
    if (lower.includes(std.toLowerCase())) {
      return std;
    }
  }

  // Pattern: "10:30 AM" or "10:30am" or "10:30 am"
  const colonMatch = lower.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)?/i);
  if (colonMatch) {
    let hour = parseInt(colonMatch[1], 10);
    const minute = colonMatch[2];
    const ampm = (colonMatch[3] || "").toLowerCase();
    
    let suffix: string;
    if (ampm) {
      suffix = ampm === "am" ? "AM" : "PM";
    } else {
      suffix = hour < 12 ? "AM" : "PM";
    }
    
    if (suffix === "PM" && hour < 12) hour += 12;
    if (suffix === "AM" && hour === 12) hour = 0;
    
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayStr = `${displayHour.toString().padStart(2, "0")}:${minute} ${suffix}`;
    
    for (const std of standardTimes) {
      if (std.toLowerCase() === displayStr.toLowerCase()) return std;
    }
    return displayStr;
  }

  // Pattern: "10 AM" or "10am"
  const hourOnlyMatch = lower.match(/(\d{1,2})\s*(am|pm)/i);
  if (hourOnlyMatch) {
    let hour = parseInt(hourOnlyMatch[1], 10);
    const suffix = hourOnlyMatch[2].toUpperCase() === "AM" ? "AM" : "PM";
    
    if (suffix === "PM" && hour < 12) hour += 12;
    if (suffix === "AM" && hour === 12) hour = 0;
    
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour.toString().padStart(2, "0")}:00 ${suffix}`;
  }

  // Pattern: bare number like "10" or "10:30"
  const bareNumberMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:o['\u2018\u2019]?\s*clock)?\b/);
  if (bareNumberMatch) {
    let hour = parseInt(bareNumberMatch[1], 10);
    const minute = bareNumberMatch[2] || "00";
    const suffix = hour < 12 || hour >= 18 ? "AM" : "PM";
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour.toString().padStart(2, "0")}:${minute} ${suffix}`;
  }

  // Human readable
  if (lower.includes("morning") || lower.includes("காலை") || lower.includes("सुबह")) return "10:00 AM";
  if (lower.includes("afternoon") || lower.includes("मதியம்") || lower.includes("दोपहर")) return "02:00 PM";
  if (lower.includes("evening") || lower.includes("मாலை") || lower.includes("शाम")) return "04:00 PM";
  
  if (lower.includes("first") || lower.includes("earliest") || lower.includes("any") || lower.includes("available")) {
    return "FIRST_AVAILABLE";
  }

  return undefined;
}

// Check if text contains time-related language
function containsTimeReference(text: string): boolean {
  const lower = text.toLowerCase();
  const timeKeywords = [
    "am", "pm", "o'clock", "oclock", "clock",
    ":00", ":15", ":30", ":45",
    "morning", "afternoon", "evening",
    "slot", "time", "timing",
    "first", "earliest", "any time",
    "10", "11", "12", "01", "02", "03", "04", "05",
    "காலை", "मதியம்", "मालை", "नேரம்",
    "सुबह", "दोपहर", "शाम", "समय",
    "first", "any", "prefer", "choose", "select",
    "today", "tomorrow", "next"
  ];
  return timeKeywords.some(kw => lower.includes(kw));
}

// ================================================
// MATCH DOCTOR NAME FROM USER TEXT
// ================================================
function matchDoctorByName(userText: string, doctors: Doctor[]): Doctor | null {
  const lower = userText.toLowerCase();
  for (const doc of doctors) {
    // Match by doctor name parts
    const nameParts = doc.name.toLowerCase().replace("dr.", "").replace("dr", "").trim().split(" ");
    for (const part of nameParts) {
      if (part.length > 2 && lower.includes(part)) {
        return doc;
      }
    }
    // Match by index number e.g. "first", "1", "doctor 1"
    const indexMatch = lower.match(/(?:doctor|dr|#|no|number)?\s*(\d+)/);
    if (indexMatch) {
      const idx = parseInt(indexMatch[1], 10) - 1;
      if (idx >= 0 && idx < doctors.length && doctors[idx].name.toLowerCase() === doc.name.toLowerCase()) {
        return doc;
      }
    }
  }
  return null;
}

// ================================================
// MATCH SPECIALTY FROM USER TEXT (for DOCTOR_SELECTION)
// ================================================
function matchSpecialtyFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [keyword, specialty] of Object.entries(SYMPTOM_SPECIALTY_MAP)) {
    if (lower.includes(keyword)) {
      return specialty;
    }
  }
  return undefined;
}

// ================================================
// MAIN INTENT EXTRACTION
// ================================================
function extractIntent(userMessage: string, session: SessionData): ExtractedIntent {
  const lower = userMessage.toLowerCase();
  const result: ExtractedIntent = {
    intent: "general",
    entities: {}
  };
  
  // ================================================
  // STEP-BASED ROUTING
  // ================================================
  
  if (session.currentStep === ConversationStep.SLOT_SELECTION || 
      (session.pendingConfirmation && session.bookingState?.doctorId)) {
    const extractedTime = parseTime(userMessage);
    const extractedDate = parseDate(userMessage);
    
    if (extractedTime === "FIRST_AVAILABLE" && session.bookingState?.availableSlots && session.bookingState.availableSlots.length > 0) {
      result.intent = "booking";
      result.entities.time = session.bookingState.availableSlots[0];
      result.entities.date = session.bookingState.date || SYSTEM_TODAY;
      result.entities.doctorId = session.bookingState.doctorId;
      result.entities.doctorName = session.bookingState.doctorName;
      result.entities.specialty = session.bookingState.specialty;
      return result;
    }
    
    if (extractedTime) {
      result.intent = "booking";
      result.entities.time = extractedTime;
      result.entities.date = extractedDate || session.bookingState.date || SYSTEM_TODAY;
      result.entities.doctorId = session.bookingState.doctorId;
      result.entities.doctorName = session.bookingState.doctorName;
      result.entities.specialty = session.bookingState.specialty;
      return result;
    }
    
    // Confirmation keywords with single slot auto-book
    const confirmWords = ["yes", "yeah", "ok", "okay", "sure", "fine", "confirm", "book", 
                          "hmm", "correct", "right", "proceed", "go ahead",
                          "ஆம்", "சரி", "சரிதான்",
                          "हाँ", "ठीक है", "हां"];
    const isConfirm = confirmWords.some(w => lower.includes(w));
    if (isConfirm && session.bookingState?.availableSlots && session.bookingState.availableSlots.length === 1) {
      result.intent = "booking";
      result.entities.time = session.bookingState.availableSlots[0];
      result.entities.date = session.bookingState.date || SYSTEM_TODAY;
      result.entities.doctorId = session.bookingState.doctorId;
      result.entities.doctorName = session.bookingState.doctorName;
      result.entities.specialty = session.bookingState.specialty;
      return result;
    }
    
    // No time extracted, user might be saying no/changing mind
    // Still return booking intent to keep in slot selection
    if (extractedDate) {
      result.intent = "booking";
      result.entities.date = extractedDate;
      result.entities.doctorId = session.bookingState.doctorId;
      result.entities.doctorName = session.bookingState.doctorName;
      result.entities.specialty = session.bookingState.specialty;
      return result;
    }
  }
  
  // DOCTOR_SELECTION: User choosing from a list of doctors
  if (session.currentStep === ConversationStep.DOCTOR_SELECTION) {
    // User might be typing a doctor's name or selecting by number
    // We'll return doctor_inquiry with a hint and let the handler figure it out
    const specialty = session.bookingState?.specialty;
    if (specialty) {
      result.intent = "doctor_inquiry";
      result.entities.specialty = specialty;
      // Check if user is specifying a doctor name directly
      const doctors = redisStore.getDoctors().then(docs => docs.filter(d => 
        d.specialty.toLowerCase().includes(specialty.toLowerCase())
      )).catch(() => []);
      // We return general and let the handler deal with doctor matching
      return result;
    }
  }

  // Cancellation keywords
  if (lower.includes("cancel") || lower.includes("रद्द") || lower.includes("ரத்து") || 
      lower.includes("delete") || lower.includes("remove")) {
    result.intent = "cancellation";
    return result;
  }
  
  // Reschedule keywords
  if (lower.includes("reschedule") || lower.includes("पुनर्निर्धारित") || lower.includes("மாற்ற") ||
      lower.includes("बदल") || lower.includes("change") || lower.includes("different time")) {
    result.intent = "reschedule";
    return result;
  }
  
  // Doctor availability inquiry / booking request
  if (lower.includes("available") || lower.includes("slot") || lower.includes("timing") || 
      lower.includes("appointment") || lower.includes("book") || lower.includes("booking") || 
      lower.includes("schedule") || lower.includes("பதிவு") || lower.includes("மருத்துவர்") || 
      lower.includes("நேரம்") || lower.includes("वேண்டும்") || lower.includes("பார்க்க") ||
      lower.includes("घर") || lower.includes("समय") ||
      lower.includes("need") || lower.includes("want") || lower.includes("see")) {
    result.intent = "doctor_inquiry";
    
    // Extract specialty from symptoms or direct specialist names
    const specialty = mapSymptomToSpecialty(userMessage);
    if (specialty) {
      result.entities.specialty = specialty;
    }
    
    // Try to extract date
    const extractedDate = parseDate(userMessage);
    if (extractedDate) {
      result.entities.date = extractedDate;
    }
    
    return result;
  }
  
  // Symptom discussion -> maps to doctor inquiry
  const specialty = mapSymptomToSpecialty(userMessage);
  if (specialty) {
    result.intent = "symptom_discussion";
    result.entities.symptoms = userMessage;
    result.entities.specialty = specialty;
    
    const extractedDate = parseDate(userMessage);
    if (extractedDate) {
      result.entities.date = extractedDate;
    }
    
    return result;
  }
  
  // If session has active booking state and user mentions time, treat as booking
  if (session.bookingState?.doctorId && containsTimeReference(userMessage)) {
    const extractedTime = parseTime(userMessage);
    if (extractedTime) {
      result.intent = "booking";
      result.entities.time = extractedTime;
      result.entities.date = session.bookingState.date || SYSTEM_TODAY;
      result.entities.doctorId = session.bookingState.doctorId;
      result.entities.doctorName = session.bookingState.doctorName;
      result.entities.specialty = session.bookingState.specialty;
      return result;
    }
  }

  // Default to general conversation
  result.intent = "general";
  return result;
}

// Find ALL matching doctors by specialty (returns array)
async function findDoctorsBySpecialty(specialty: string): Promise<Doctor[]> {
  const doctors = await redisStore.getDoctors();
  return doctors.filter(d => 
    d.specialty.toLowerCase().includes(specialty.toLowerCase())
  );
}

// Find single doctor by name across all doctors
async function findDoctorByName(nameQuery: string): Promise<Doctor | null> {
  const doctors = await redisStore.getDoctors();
  const lower = nameQuery.toLowerCase();
  return doctors.find(d => 
    d.name.toLowerCase().includes(lower) ||
    lower.includes(d.name.toLowerCase().replace("dr.", "").replace("dr", "").trim())
  ) || null;
}

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY!
);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export class ClinicalAgentOrchestrator {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required."
      );
    }
  }

  // Ensure doctors are seeded into Redis (Bug 1)
  private async ensureDoctorsSeeded(): Promise<void> {
    // No-op: doctors are already seeded in redis_service.ts initialDoctors
    // Do NOT re-seed here to avoid duplicate entries with different IDs
  }

  public async handleRequest(params: {
    phone: string;
    userInput: string;
    overrideName?: string;
    presetLanguage?: Language;
    onToolExecute?: (
      toolName: string,
      args: any,
      result: string
    ) => void;
  }): Promise<{
    textResponse: string;
    speakAudio?: {
      hasAudio: boolean;
      audioData?: string;
    };
    detectedLanguage: Language;
    trace: Omit<TraceStep, "id" | "timestamp">;
    latencies: {
      stt: number;
      llm: number;
      tts: number;
      total: number;
    };
  }> {
    const globalStart = Date.now();

    const {
      phone,
      userInput,
      overrideName,
      presetLanguage,
    } = params;

    // Simulated STT latency
    const sttLatency = 80 + Math.floor(Math.random() * 60);

    // ================================================
    // PART B: Append user message to chat history
    // ================================================
    if (userInput.trim()) {
      const userMsgEntry = { 
        role: 'user', 
        text: userInput, 
        timestamp: new Date().toISOString() 
      };
      try {
        const userHistRaw = await redisStore.hget(`session:${phone}`, 'chatHistory');
        const userHistory = userHistRaw ? JSON.parse(userHistRaw) : [];
        userHistory.push(userMsgEntry);
        const userTrimmed = userHistory.slice(-100);
        await redisStore.hset(`session:${phone}`, 'chatHistory', JSON.stringify(userTrimmed));
      } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------
    // ENSURE DOCTORS ARE SEEDED (Bug 1)
    // ------------------------------------------------
    await this.ensureDoctorsSeeded();

    // ------------------------------------------------
    // PATIENT LOOKUP
    // ------------------------------------------------

    let patientObj = await redisStore.findPatientByPhone(phone);

    if (!patientObj && overrideName) {
      patientObj = await patientCache.syncPatientProfile(phone, {
        name: overrideName,
        preferredLanguage: presetLanguage || Language.ENGLISH,
      });
    }

    const currentPrefLanguage = patientObj?.preferredLanguage || presetLanguage || Language.ENGLISH;

    // ------------------------------------------------
    // SESSION - Load session
    // ------------------------------------------------

    const session = await sessionService.getSession(phone, currentPrefLanguage);

    // ------------------------------------------------
    // REDIS SESSION CONTEXT - Read at start for Bug 1 fix
    // ------------------------------------------------

    const contextRaw = await redisStore.hget(`session:${phone}`, 'context');
    const sessionContext = contextRaw ? JSON.parse(contextRaw) : null;

    // ------------------------------------------------
    // LANGUAGE DETECTION
    // ------------------------------------------------
    
    const detectedLang = presetLanguage || languageService.detectLanguage(
      userInput,
      session.preferredLanguage || currentPrefLanguage
    );

    // ------------------------------------------------
    // INTENT EXTRACTION & TOOL EXECUTION
    // ------------------------------------------------

    let selectedTool = "none";
    let toolResults = "";
    let finalResponseText = "";
    let detectedIntent = "general";
    let nextStep: ConversationStep = session.currentStep;
    let toolWasCalled = false;

    // ================================================
    // BUG 1 FIX: Handle AWAITING_TIME_SELECTION state directly
    // ================================================
    
    if (sessionContext?.state === 'AWAITING_TIME_SELECTION') {
      const availableSlots = sessionContext.availableSlots || [];
      const extractedTime = parseTime(userInput);
      
      if (extractedTime && availableSlots.includes(extractedTime)) {
        // Valid time found - proceed to booking
        selectedTool = "book_appointment";
        toolWasCalled = true;
        
        const bookTool = await this.executeClinicalTool(
          "book_appointment",
          {
            patientPhone: phone,
            patientName: patientObj?.name || overrideName || "Patient",
            doctorId: sessionContext.doctorId,
            date: sessionContext.targetDate,
            time: extractedTime
          },
          phone
        );
        
        const bookResult = bookTool.rawPayload as {
          success: boolean;
          message: string;
        };
        
        if (bookResult.success) {
          // Clear the Redis session context
          await redisStore.hdel(`session:${phone}`, 'context');
          await sessionService.clearSession(phone);
          
          if (detectedLang === Language.TAMIL) {
            finalResponseText = `${sessionContext.doctorName} அவர்களின் சந்திப்பு ${sessionContext.targetDate} அன்று ${extractedTime}க்கு உறுதிப்படுத்தப்பட்டுள்ளது. உங்கள் சந்திப்புக்கு முன் உங்களுக்கு நினைவூட்டல் கிடைக்கும்.`;
          } else if (detectedLang === Language.HINDI) {
            finalResponseText = `${sessionContext.doctorName} की अपॉइंटमेंट ${sessionContext.targetDate} को ${extractedTime} बजे पुष्टि हो गई है। आपको अपनी अपॉइंटमेंट से पहले रिमाइंडर मिलेगा।`;
          } else {
            finalResponseText = `${sessionContext.doctorName}'s appointment is confirmed on ${sessionContext.targetDate} at ${extractedTime}. You will receive a reminder before your appointment. Is there anything else I can help you with?`;
          }
          
          // Notify operations dashboard
          if (params.onToolExecute) {
            params.onToolExecute("book_appointment", 
              { 
                patientPhone: phone, 
                patientName: patientObj?.name || overrideName || "Patient",
                doctorId: sessionContext.doctorId, 
                doctorName: sessionContext.doctorName,
                date: sessionContext.targetDate, 
                time: extractedTime 
              }, 
              bookResult.message
            );
          }
        } else {
          finalResponseText = bookResult.message;
        }
        
        toolResults = JSON.stringify(bookResult);
        
        // Return early since we handled the time selection
        const trace = {
          detectedIntent: "booking",
          retrievedMemory: JSON.stringify({ phone, patientName: patientObj?.name || "Guest", detectedLanguage: detectedLang }, null, 2),
          selectedTool,
          toolResults: toolResults || "No tool executed",
          finalResponse: finalResponseText,
          languageDetected: detectedLang,
        };
        
        const voiceStart = Date.now();
        const ttsLang = finalResponseText.match(/[\u0B80-\u0BFF]/) ? Language.TAMIL : finalResponseText.match(/[\u0900-\u097F]/) ? Language.HINDI : Language.ENGLISH;
        const voiceResult = await ttsService.generateSpeech(finalResponseText, ttsLang);
        const ttsLatency = Date.now() - voiceStart;
        
        const totalLatency = Date.now() - globalStart;
        const latencyLogs = { stt: sttLatency, llm: 0, tts: ttsLatency, total: totalLatency, textLength: finalResponseText.length };
        await redisStore.addLatencyLog(latencyLogs);
        await redisStore.addTraceStep(trace);
        
        return {
          textResponse: finalResponseText,
          speakAudio: voiceResult.hasAudio ? { hasAudio: true, audioData: voiceResult.audioData } : undefined,
          detectedLanguage: detectedLang,
          trace,
          latencies: latencyLogs,
        };
      } else {
        // No valid time found - prompt again with apology for unavailable time
        if (extractedTime && availableSlots.length > 0) {
          // User asked for a specific time that is NOT available
          if (detectedLang === Language.TAMIL) {
            finalResponseText = `மன்னிக்கவும், ${extractedTime} நேரம் கிடைக்கவில்லை. கிடைக்கும் நேரங்கள்: ${availableSlots.join(', ')}. வேறு தேதியை முயல விரும்புகிறீர்கள்?`;
          } else if (detectedLang === Language.HINDI) {
            finalResponseText = `माफ़ कीजिए, ${extractedTime} का समय उपलब्ध नहीं है। कृपया चुनें: ${availableSlots.join(', ')}. क्या आप किसी और दिन बुक करना चाहेंगे?`;
          } else {
            finalResponseText = `Sorry, ${extractedTime} is not available. Please choose from: ${availableSlots.join(', ')}. Or would you like to book on a different day?`;
          }
        } else {
          // Couldn't understand the time at all
          if (detectedLang === Language.TAMIL) {
            finalResponseText = `நேரம் புரிந்து கொள்ளப்படவில்லை. தயவுசெய்து தேர்வு செய்யவும்: ${availableSlots.join(', ')}`;
          } else if (detectedLang === Language.HINDI) {
            finalResponseText = `मुझे समय समझ नहीं आया। कृपया चुनें: ${availableSlots.join(', ')}`;
          } else {
            finalResponseText = `I didn't catch the time. Please choose from: ${availableSlots.join(', ')}`;
          }
        }
        
        // Return early - do NOT reset or show doctor list again
        const trace = {
          detectedIntent: "awaiting_time",
          retrievedMemory: JSON.stringify({ phone, patientName: patientObj?.name || "Guest", detectedLanguage: detectedLang }, null, 2),
          selectedTool: "none",
          toolResults: "No tool executed",
          finalResponse: finalResponseText,
          languageDetected: detectedLang,
        };
        
        const voiceStart = Date.now();
        const ttsLang = finalResponseText.match(/[\u0B80-\u0BFF]/) ? Language.TAMIL : finalResponseText.match(/[\u0900-\u097F]/) ? Language.HINDI : Language.ENGLISH;
        const voiceResult = await ttsService.generateSpeech(finalResponseText, ttsLang);
        const ttsLatency = Date.now() - voiceStart;
        
        const totalLatency = Date.now() - globalStart;
        const latencyLogs = { stt: sttLatency, llm: 0, tts: ttsLatency, total: totalLatency, textLength: finalResponseText.length };
        await redisStore.addLatencyLog(latencyLogs);
        await redisStore.addTraceStep(trace);
        
        return {
          textResponse: finalResponseText,
          speakAudio: voiceResult.hasAudio ? { hasAudio: true, audioData: voiceResult.audioData } : undefined,
          detectedLanguage: detectedLang,
          trace,
          latencies: latencyLogs,
        };
      }
    }

    const intent = extractIntent(userInput, session);
    detectedIntent = intent.intent;

    // ================================================
    // HANDLE DOCTOR/SLOT BOOKING FLOW
    // ================================================
    
    if (intent.intent === "doctor_inquiry" || intent.intent === "symptom_discussion") {
      
      // If in DOCTOR_SELECTION step, try to match what user said to a doctor
      if (session.currentStep === ConversationStep.DOCTOR_SELECTION) {
        const matchingDocs = await findDoctorsBySpecialty(session.bookingState?.specialty || "");
        
        if (matchingDocs.length > 0) {
          // Try to match the user's input to a specific doctor
          const matchedDoc = matchDoctorByName(userInput, matchingDocs);
          
          if (matchedDoc) {
            // Doctor selected! Fetch their slots.
            selectedTool = "check_availability";
            toolWasCalled = true;
            const targetDate = intent.entities.date || SYSTEM_TODAY;
            const availabilityTool = await this.executeClinicalTool(
              "check_availability",
              { doctorId: matchedDoc.id, date: targetDate },
              phone
            );

            const slotsResult = availabilityTool.rawPayload as {
              success: boolean;
              doctorName?: string;
              specialty?: string;
              slots: string[];
              message: string;
            };

            if (slotsResult.success && slotsResult.slots.length > 0) {
              const formattedDate = formatDateLabel(targetDate);
              if (detectedLang === Language.TAMIL) {
                finalResponseText = ` ${matchedDoc.name} அவர்களுக்கு ${formattedDate} அன்று ${slotsResult.slots.join(", ")} என்று நேரங்கள் கிடைக்கின்றன. எந்த நேரத்தை விரும்புகிறீர்கள்?`;
              } else if (detectedLang === Language.HINDI) {
                finalResponseText = ` ${matchedDoc.name} के पास ${formattedDate} को ${slotsResult.slots.join(", ")} बजे स्लॉट उपलब्ध हैं। कृपया एक समय चुनें।`;
              } else {
                finalResponseText = ` ${matchedDoc.name} is available on ${formattedDate} at the following times: ${slotsResult.slots.join(", ")}. Which time would you like?`;
              }
              
              // BUG 1 FIX: Store session context in Redis after successful check_availability
              await redisStore.hset(`session:${phone}`, 'context', JSON.stringify({
                state: 'AWAITING_TIME_SELECTION',
                doctorId: matchedDoc.id,
                doctorName: matchedDoc.name,
                specialty: matchedDoc.specialty,
                targetDate: targetDate,
                availableSlots: slotsResult.slots
              }));
            } else {
              if (detectedLang === Language.TAMIL) {
                finalResponseText = `${matchedDoc.name} அவர்களுக்கு ${targetDate} அன்று நேரங்கள் இல்லை. வித்தியாசமான தேதியை முயற்சிக்கவும்.`;
              } else if (detectedLang === Language.HINDI) {
                finalResponseText = `${matchedDoc.name} के पास ${targetDate} को कोई स्लॉट उपलब्ध नहीं है। कोई दूसरी तारीख चुनें।`;
              } else {
                finalResponseText = `${matchedDoc.name} has no available slots on ${targetDate}. Please try a different date.`;
              }
            }

            nextStep = ConversationStep.SLOT_SELECTION;
            
            const updatedSession: SessionData = {
              ...session,
              currentStep: ConversationStep.SLOT_SELECTION,
              activeIntent: "book",
              pendingConfirmation: true,
              bookingState: {
                doctorId: matchedDoc.id,
                doctorName: matchedDoc.name,
                specialty: matchedDoc.specialty,
                date: targetDate,
                availableSlots: slotsResult.slots || []
              }
            };
            await sessionService.saveSession(phone, updatedSession);
            toolResults = JSON.stringify(slotsResult);
          } else {
            // User didn't specify a doctor name - show them again
            if (detectedLang === Language.TAMIL) {
              finalResponseText = `தயவுசெய்து ஒரு மருத்துவரை தேர்வு செய்யவும்: ${matchingDocs.map((d, i) => `${i + 1}. ${d.name}`).join(", ")}`;
            } else if (detectedLang === Language.HINDI) {
              finalResponseText = `कृपया एक डॉक्टर चुनें: ${matchingDocs.map((d, i) => `${i + 1}. ${d.name}`).join(", ")}`;
            } else {
              finalResponseText = `Please choose a doctor: ${matchingDocs.map((d, i) => `${i + 1}. ${d.name}`).join(", ")}`;
            }
            nextStep = ConversationStep.DOCTOR_SELECTION;
          }
        } else {
          // No doctors found for this specialty
          if (detectedLang === Language.TAMIL) {
            finalResponseText = `மன்னிக்கவும், அந்த வகை மருத்துவர் எங்களிடம் இல்லை. வேறு மருத்துவரை தேர்வு செய்யவும்.`;
          } else if (detectedLang === Language.HINDI) {
            finalResponseText = `क्षमा करें, हमारे पास उस प्रकार का डॉक्टर नहीं है। कोई अन्य विकल्प चुनें।`;
          } else {
            finalResponseText = `Sorry, we don't have that specialist. Please choose from the available options.`;
          }
        }
        toolResults = "doctor selection processed";
      } else {
        // Not in DOCTOR_SELECTION - handle specialist detection
        let matchingDocs: Doctor[] = [];
        
        if (intent.entities.specialty) {
          matchingDocs = await findDoctorsBySpecialty(intent.entities.specialty);
        }
        
        if (matchingDocs.length > 0) {
          if (matchingDocs.length === 1) {
            // Single doctor matches - fetch slots directly
            selectedTool = "check_availability";
            toolWasCalled = true;
            const targetDate = intent.entities.date || SYSTEM_TODAY;
            const availabilityTool = await this.executeClinicalTool(
              "check_availability",
              { doctorId: matchingDocs[0].id, date: targetDate },
              phone
            );

            const slotsResult = availabilityTool.rawPayload as {
              success: boolean;
              doctorName?: string;
              specialty?: string;
              slots: string[];
              message: string;
            };

              if (slotsResult.success && slotsResult.slots.length > 0) {
              const formattedDate2 = formatDateLabel(targetDate);
              if (detectedLang === Language.TAMIL) {
                finalResponseText = ` ${matchingDocs[0].name} அவர்களுக்கு ${formattedDate2} அன்று ${slotsResult.slots.join(", ")} என்று நேரங்கள் கிடைக்கின்றன. எந்த நேரத்தை விரும்புகிறீர்கள்?`;
              } else if (detectedLang === Language.HINDI) {
                finalResponseText = `${matchingDocs[0].name} के पास ${formattedDate2} को ${slotsResult.slots.join(", ")} बजे स्लॉट उपलब्ध हैं। कृपया एक समय चुनें।`;
              } else {
                finalResponseText = `${matchingDocs[0].name} is available on ${formattedDate2} at the following times: ${slotsResult.slots.join(", ")}. Which time would you like?`;
              }
              
              // BUG 1 FIX: Store session context in Redis after successful check_availability
              await redisStore.hset(`session:${phone}`, 'context', JSON.stringify({
                state: 'AWAITING_TIME_SELECTION',
                doctorId: matchingDocs[0].id,
                doctorName: matchingDocs[0].name,
                specialty: matchingDocs[0].specialty,
                targetDate: targetDate,
                availableSlots: slotsResult.slots
              }));
            } else {
              if (detectedLang === Language.TAMIL) {
                finalResponseText = ` ${matchingDocs[0].name} அவர்களுக்கு ${targetDate} அன்று நேரங்கள் இல்லை. வித்தியாசமான தேதியை முயற்சிக்கவும்.`;
              } else if (detectedLang === Language.HINDI) {
                finalResponseText = `${matchingDocs[0].name} के पास ${targetDate} को कोई स्लॉट उपलब्ध नहीं है। कोई दूसरी तारीख चुनें।`;
              } else {
                finalResponseText = ` ${matchingDocs[0].name} has no available slots on ${targetDate}. Would you like to try a different date?`;
              }
            }

            nextStep = ConversationStep.SLOT_SELECTION;
            
            const updatedSession: SessionData = {
              ...session,
              currentStep: ConversationStep.SLOT_SELECTION,
              activeIntent: "book",
              pendingConfirmation: true,
              bookingState: {
                doctorId: matchingDocs[0].id,
                doctorName: matchingDocs[0].name,
                specialty: matchingDocs[0].specialty,
                date: targetDate,
                availableSlots: slotsResult.slots || []
              }
            };
            await sessionService.saveSession(phone, updatedSession);
            toolResults = JSON.stringify(slotsResult);
          } else {
            // Multiple doctors match - show list for user to choose
            nextStep = ConversationStep.DOCTOR_SELECTION;
            
            if (detectedLang === Language.TAMIL) {
              finalResponseText = `இந்த ${matchingDocs[0].specialty} மருத்துவர்கள் உள்ளனர்: ${matchingDocs.map((d, i) => `${i + 1}. ${d.name}`).join(", ")}. யாரை பார்க்க விரும்புகிறீர்கள்?`;
            } else if (detectedLang === Language.HINDI) {
              finalResponseText = `${matchingDocs[0].specialty} के ये डॉक्टर उपलब्ध हैं: ${matchingDocs.map((d, i) => `${i + 1}. ${d.name}`).join(", ")}. किस डॉक्टर से मिलना चाहेंगे?`;
            } else {
              finalResponseText = `We have these ${matchingDocs[0].specialty} specialists: ${matchingDocs.map((d, i) => `${i + 1}. ${d.name}`).join(", ")}. Which doctor would you like to see?`;
            }
            
            const updatedSession: SessionData = {
              ...session,
              currentStep: ConversationStep.DOCTOR_SELECTION,
              activeIntent: "book",
              pendingConfirmation: false,
              bookingState: {
                ...session.bookingState,
                specialty: matchingDocs[0].specialty
              }
            };
            await sessionService.saveSession(phone, updatedSession);
            toolResults = JSON.stringify(matchingDocs);
          }
        } else {
          // No matching doctors or specialty - list all available
          const allDoctors = await redisStore.getDoctors();
          
          if (detectedLang === Language.TAMIL) {
            finalResponseText = `எங்களிடம் உள்ள மருத்துவர்கள்: ${allDoctors.map(d => `${d.name} (${d.specialty})`).join(", ")}. எந்த மருத்துவரை நீங்கள் பார்க்க விரும்புகிறீர்கள்?`;
          } else if (detectedLang === Language.HINDI) {
            finalResponseText = `हमारे डॉक्टर: ${allDoctors.map(d => `${d.name} (${d.specialty})`).join(", ")}. आप किस डॉक्टर से मिलना चाहेंगे?`;
          } else {
            finalResponseText = `We have the following doctors available: ${allDoctors.map(d => `${d.name} (${d.specialty})`).join(", ")}. Which specialist do you need?`;
          }
          
          const updatedSession: SessionData = {
            ...session,
            currentStep: ConversationStep.SPECIALIST_SELECTION,
            activeIntent: "book",
          };
          await sessionService.saveSession(phone, updatedSession);
          toolResults = JSON.stringify(allDoctors);
        }
      }
    } 
    // ================================================
    // BOOKING - Execute the actual booking
    // ================================================
    else if (intent.intent === "booking" && intent.entities.doctorId && intent.entities.time) {
      selectedTool = "book_appointment";
      const bookTool = await this.executeClinicalTool(
        "book_appointment",
        {
          patientPhone: phone,
          patientName: patientObj?.name || overrideName || "Patient",
          doctorId: intent.entities.doctorId,
          date: intent.entities.date || SYSTEM_TODAY,
          time: intent.entities.time
        },
        phone
      );
      const bookResult = bookTool.rawPayload as {
        success: boolean;
        message: string;
        suggestedSlots?: string[];
      };

      finalResponseText = bookResult.message;
      
      if (bookResult.success) {
        nextStep = ConversationStep.COMPLETED;
        await sessionService.clearSession(phone);
      } else if (bookResult.suggestedSlots && bookResult.suggestedSlots.length > 0) {
        // Slot conflict - show alternatives
        nextStep = ConversationStep.SLOT_SELECTION;
        const updatedSession: SessionData = {
          ...session,
          currentStep: ConversationStep.SLOT_SELECTION,
          pendingConfirmation: true,
          bookingState: {
            ...session.bookingState,
            availableSlots: bookResult.suggestedSlots
          }
        };
        await sessionService.saveSession(phone, updatedSession);
        
        if (detectedLang === Language.TAMIL) {
          finalResponseText = `அந்த நேரம் ஏற்கனவே முன்பதிவு செய்யப்பட்டுள்ளது. கிடைக்கும் நேரங்கள்: ${bookResult.suggestedSlots.join(", ")}. வேறு நேரத்தை தேர்வு செய்யவும்.`;
        } else if (detectedLang === Language.HINDI) {
          finalResponseText = `वह समय पहले ही बुक हो चुका है। उपलब्ध स्लॉट: ${bookResult.suggestedSlots.join(", ")}. कृपया कोई अन्य समय चुनें।`;
        } else {
          finalResponseText = `That slot is already booked. Available slots: ${bookResult.suggestedSlots.join(", ")}. Please choose another time.`;
        }
      }
      
      toolResults = JSON.stringify(bookResult);
      
      // Notify operations dashboard via callback
      if (params.onToolExecute) {
        params.onToolExecute("book_appointment", 
          { 
            patientPhone: phone, 
            patientName: patientObj?.name || overrideName || "Patient",
            doctorId: intent.entities.doctorId, 
            doctorName: intent.entities.doctorName,
            date: intent.entities.date, 
            time: intent.entities.time 
          }, 
          bookResult.message
        );
      }
    } else if (intent.intent === "cancellation") {
      selectedTool = "cancel_appointment";
      
      const patientAppts = await redisStore.findAppointmentsByPhone(phone);
      if (patientAppts.length > 0) {
        const latestAppt = patientAppts[0];
        const cancelResult = await schedulerService.cancelAppointment(latestAppt.id);
        finalResponseText = cancelResult.message;
        
        nextStep = ConversationStep.COMPLETED;
        
        if (params.onToolExecute) {
          params.onToolExecute("cancel_appointment", { appointmentId: latestAppt.id }, cancelResult.message);
        }
      } else {
        finalResponseText = detectedLang === Language.TAMIL 
          ? "உங்களிடம் முன்பு பதிவு செய்யப்பட்ட சந்திப்பு இல்லை." 
          : detectedLang === Language.HINDI 
          ? "आपके पास कोई बुकिंग नहीं है." 
          : "You don't have any scheduled appointments.";
      }
      
      toolResults = "cancellation processed";
    }
    else if (intent.intent === "reschedule") {
      selectedTool = "reschedule_appointment";
      
      const patientAppts = await redisStore.findAppointmentsByPhone(phone);
      if (patientAppts.length > 0) {
        nextStep = ConversationStep.DATE_SELECTION;
        const updatedSession: SessionData = {
          ...session,
          currentStep: ConversationStep.DATE_SELECTION,
          activeIntent: "reschedule",
          pendingConfirmation: true,
          rescheduleAppointmentId: patientAppts[0].id
        };
        await sessionService.saveSession(phone, updatedSession);
        
        finalResponseText = detectedLang === Language.TAMIL
          ? `உங்கள் சந்திப்பு ${patientAppts[0].date} அன்று ${patientAppts[0].time}இல் உள்ளது. புதிய தேதி மற்றும் நேரத்தை கூறுங்கள்.`
          : detectedLang === Language.HINDI
          ? `आपकी अपॉइंटमेंट ${patientAppts[0].date} को ${patientAppts[0].time} बजे है। नई तारीख और समय बताएं।`
          : `Your current appointment is on ${patientAppts[0].date} at ${patientAppts[0].time}. What new date and time would you prefer?`;
      } else {
        finalResponseText = detectedLang === Language.TAMIL
          ? "மீண்டும் முதலிருந்து திட்டமிடலாமா?"
          : detectedLang === Language.HINDI
          ? "क्या हम नई बुकिंग शुरू करें?"
          : "Would you like to book a new appointment?";
      }
      
      toolResults = "reschedule flow initiated";
    }
    else {
      // General conversation - fall back to LLM
      detectedIntent = "general";
    }

    // ------------------------------------------------
    // LLM (only for general conversation or as fallback)
    // ------------------------------------------------

    let llmLatency = 0;
    const llmStart = Date.now();

    if (!finalResponseText) {
      const systemPrompt = getSystemInstructions(SYSTEM_TODAY, phone, session);
      
      try {
        const languageInstruction =
          detectedLang === Language.TAMIL
            ? "Reply ONLY in Tamil language. Never use English or Hindi."
            : detectedLang === Language.HINDI
            ? "Reply ONLY in Hindi language. Never use English or Tamil."
            : "Reply ONLY in English language. Never use Hindi or Tamil.";

        const prompt = `
${systemPrompt}

You are Aarogi, a multilingual healthcare appointment voice assistant.

IMPORTANT LANGUAGE RULES:
${languageInstruction}

DO NOT mix languages.
Keep responses:
- short
- conversational
- natural
- voice assistant friendly

Patient Phone:
${phone}

Detected Language:
${detectedLang}

Current Conversation Step: ${session.currentStep}

User Message:
${userInput}

You can help with:
- booking appointments
- rescheduling appointments
- cancelling appointments
- checking doctor availability

Respond professionally like a real hospital AI assistant.
`;

        const result = await model.generateContent(prompt);

        finalResponseText = result.response.text()?.trim() || "Hello, how may I assist you today?";
        finalResponseText = finalResponseText.replace(/\*\*/g, "");
      } catch (exp: any) {
        console.error("Gemini orchestration failure:", exp);

        if (detectedLang === Language.TAMIL) {
          finalResponseText = "மன்னிக்கவும். தற்போது சேவை தற்காலிகமாக கிடைக்கவில்லை.";
        } else if (detectedLang === Language.HINDI) {
          finalResponseText = "क्षमा करें। सेवा अभी अस्थायी रूप से उपलब्ध नहीं है।";
        } else {
          finalResponseText = "I apologize, our scheduling assistant is temporarily unavailable.";
        }
      }
    }

    llmLatency = Date.now() - llmStart;

    // ------------------------------------------------
    // BUG 2 FIX: Only append fallback when no tool was called and intent is 'none'
    // The fallback message must ONLY be used when:
    // - intent === 'none' AND no tool was called AND no session context exists
    // - It must NEVER be appended after a tool call response
    // ------------------------------------------------

    if (!toolWasCalled && detectedIntent === 'none' && !sessionContext && session.currentStep === ConversationStep.GREETING) {
      const followUp =
        detectedLang === Language.TAMIL
          ? " இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்? உங்கள் அறிகுறிகள் அல்லது எந்த நிபுணர் தேவை என்று சொல்லுங்கள்."
          : detectedLang === Language.HINDI
          ? " आज मैं आपकी कैसे मदद कर सकता हूँ? कृपया अपने लक्षण या किस विशेषज्ञ की जरूरत है बताएं।"
          : " How can I help you today? Please tell me your symptoms or which specialist you need.";
      finalResponseText += followUp;
      const updatedSession: SessionData = {
        ...session,
        currentStep: ConversationStep.SPECIALIST_SELECTION,
      };
      await sessionService.saveSession(phone, updatedSession);
    }

    // ------------------------------------------------
    // TTS
    // ------------------------------------------------

    const voiceStart = Date.now();
    const ttsLang = finalResponseText.match(/[\u0B80-\u0BFF]/) 
    ? Language.TAMIL 
    : finalResponseText.match(/[\u0900-\u097F]/) 
    ? Language.HINDI 
    : Language.ENGLISH;

    const voiceResult = await ttsService.generateSpeech(finalResponseText, ttsLang);
    const ttsLatency = Date.now() - voiceStart; 

    // ------------------------------------------------
    // LATENCY
    // ------------------------------------------------

    const totalLatency = Date.now() - globalStart;

    const latencyLogs = {
      stt: sttLatency,
      llm: llmLatency,
      tts: ttsLatency,
      total: totalLatency,
      textLength: finalResponseText.length,
    };

    await redisStore.addLatencyLog(latencyLogs);

    // ------------------------------------------------
    // TRACE
    // ------------------------------------------------

    const trace = {
      detectedIntent: session.activeIntent || "conversation",
      retrievedMemory: JSON.stringify({
        phone,
        patientName: patientObj?.name || "Guest",
        detectedLanguage: detectedLang,
      }, null, 2),
      selectedTool,
      toolResults: toolResults || "No tool executed",
      finalResponse: finalResponseText,
      languageDetected: detectedLang,
    };

    await redisStore.addTraceStep(trace);

    // ================================================
    // PART B: Append AI response to chat history
    // ================================================
    if (finalResponseText.trim()) {
      const aiMsgEntry = { 
        role: 'assistant', 
        text: finalResponseText, 
        timestamp: new Date().toISOString() 
      };
      try {
        const aiHistRaw = await redisStore.hget(`session:${phone}`, 'chatHistory');
        const aiHistory = aiHistRaw ? JSON.parse(aiHistRaw) : [];
        aiHistory.push(aiMsgEntry);
        const aiTrimmed = aiHistory.slice(-100);
        await redisStore.hset(`session:${phone}`, 'chatHistory', JSON.stringify(aiTrimmed));
      } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------
    // RESPONSE
    // ------------------------------------------------

    return {
      textResponse: finalResponseText,
      speakAudio: voiceResult.hasAudio
        ? { hasAudio: true, audioData: voiceResult.audioData }
        : undefined,
      detectedLanguage: detectedLang,
      trace,
      latencies: latencyLogs,
    };
  }

  // ------------------------------------------------
  // TOOL EXECUTION
  // ------------------------------------------------

  private async executeClinicalTool(
    name: string,
    args: any,
    phone: string
  ): Promise<{
    outputStr: string;
    rawPayload: any;
  }> {
    try {
      if (name === "list_doctors") {
        const docs = await redisStore.getDoctors();
        return {
          outputStr: docs.map((d: Doctor) => `${d.name} (${d.specialty})`).join(", "),
          rawPayload: docs,
        };
      }

      if (name === "check_availability") {
        const result = await schedulerService.getAvailableSlots(args.doctorId, args.date);
        return { outputStr: result.message, rawPayload: result };
      }

      if (name === "book_appointment") {
        const result = await schedulerService.bookAppointment({
          patientPhone: args.patientPhone || phone,
          patientName: args.patientName || "Patient",
          doctorId: args.doctorId,
          date: args.date,
          time: args.time,
        });
        return { outputStr: result.message, rawPayload: result };
      }

      if (name === "reschedule_appointment") {
        const result = await schedulerService.rescheduleAppointment({
          appointmentId: args.appointmentId,
          newDate: args.newDate,
          newTime: args.newTime,
        });
        return { outputStr: result.message, rawPayload: result };
      }

      if (name === "cancel_appointment") {
        const result = await schedulerService.cancelAppointment(args.appointmentId);
        return { outputStr: result.message, rawPayload: result };
      }

      return { outputStr: "Unknown tool", rawPayload: {} };
    } catch (err: any) {
      return { outputStr: err.message, rawPayload: { error: err.message } };
    }
  }
}

export const clinicalAgentOrchestrator = new ClinicalAgentOrchestrator();