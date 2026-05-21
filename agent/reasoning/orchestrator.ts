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
} from "../../src/types";

const SYSTEM_TODAY = "2026-05-21";

// ================================================
// INTENT EXTRACTION ENGINE
// ================================================

interface ExtractedIntent {
  intent: "booking" | "cancellation" | "reschedule" | "doctor_inquiry" | "symptom_discussion" | "general" | "none";
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
function parseDate(dateText: string, referenceDate: Date = new Date()): string | undefined {
  const today = new Date(referenceDate);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const lower = dateText.toLowerCase();
  
  if (lower.includes("today")) {
    return today.toISOString().split("T")[0];
  }
  if (lower.includes("tomorrow")) {
    return tomorrow.toISOString().split("T")[0];
  }
  
  // Match date patterns like "May 22", "22nd May", "2026-05-22"
  const dateMatch = dateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  }
  
  const monthMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2})/);
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

// Time parsing helpers
function parseTime(timeText: string): string | undefined {
  const lower = timeText.toLowerCase();
  
  // Standard times
  const times = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", 
                 "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
                 "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM"];
  
  for (const time of times) {
    const timeNum = time.replace(" AM", "").replace(" PM", "");
    if (lower.includes(timeNum) || lower.includes(time.toLowerCase())) {
      return time;
    }
  }
  
  // Human readable parsing
  if (lower.includes("morning")) return "10:00 AM";
  if (lower.includes("afternoon")) return "02:00 PM";
  if (lower.includes("evening")) return "04:00 PM";
  
  return undefined;
}

// Main intent extraction function
function extractIntent(userMessage: string, session: SessionData): ExtractedIntent {
  const lower = userMessage.toLowerCase();
  const result: ExtractedIntent = {
    intent: "general",
    entities: {}
  };
  
  // Check if in booking flow
  if (session.pendingConfirmation && session.bookingState?.doctorId) {
    // User is likely selecting a slot
    const extractedTime = parseTime(userMessage);
    const extractedDate = parseDate(userMessage);
    
    if (extractedTime) {
      result.intent = "booking";
      result.entities.time = extractedTime;
      if (extractedDate) result.entities.date = extractedDate;
      else result.entities.date = session.bookingState.date || SYSTEM_TODAY;
      result.entities.doctorId = session.bookingState.doctorId;
      result.entities.doctorName = session.bookingState.doctorName;
      result.entities.specialty = session.bookingState.specialty;
      return result;
    }
    
    if (extractedDate) {
      result.intent = "booking";
      result.entities.date = extractedDate;
      result.entities.doctorId = session.bookingState.doctorId;
      result.entities.doctorName = session.bookingState.doctorName;
      result.entities.specialty = session.bookingState.specialty;
      return result;
    }
  }
  
  // Cancellation keywords
  if (lower.includes("cancel") || lower.includes("रद्द") || lower.includes("ரத்து") || 
      lower.includes("विठुल") || lower.includes("delete") || lower.includes("remove")) {
    result.intent = "cancellation";
    return result;
  }
  
  // Reschedule keywords
  if (lower.includes("reschedule") || lower.includes("पुनर्निर्धारित") || lower.includes("மாற்ற") ||
      lower.includes("बदल") || lower.includes("change") || lower.includes("different time")) {
    result.intent = "reschedule";
    return result;
  }
  
  // Doctor availability inquiry
  if (lower.includes("available") || lower.includes("slot") || lower.includes("timing") || 
      lower.includes("appointment") || lower.includes("book") || lower.includes("schedule") ||
      lower.includes("घर") || lower.includes("நேரம்") || lower.includes("समय")) {
    result.intent = "doctor_inquiry";
    
    // Extract specialty from symptoms
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
    
    // Check for date
    const extractedDate = parseDate(userMessage);
    if (extractedDate) {
      result.entities.date = extractedDate;
    }
    
    return result;
  }
  
  // Default to general conversation
  result.intent = "general";
  return result;
}

// Find matching doctor by specialty
async function findDoctorBySpecialty(specialty: string): Promise<Doctor | null> {
  const doctors = await redisStore.getDoctors();
  const match = doctors.find(d => 
    d.specialty.toLowerCase().includes(specialty.toLowerCase())
  );
  return match || null;
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
    const sttLatency =
      80 + Math.floor(Math.random() * 60);

    // ------------------------------------------------
    // PATIENT LOOKUP
    // ------------------------------------------------

    let patientObj =
      await redisStore.findPatientByPhone(phone);

    if (!patientObj && overrideName) {
      patientObj =
        await patientCache.syncPatientProfile(phone, {
          name: overrideName,
          preferredLanguage:
            presetLanguage || Language.ENGLISH,
        });
    }

    const currentPrefLanguage =
      patientObj?.preferredLanguage ||
      presetLanguage ||
      Language.ENGLISH;

    // ------------------------------------------------
    // SESSION - Load session for context
    // ------------------------------------------------

    const session =
      await sessionService.getSession(
        phone,
        currentPrefLanguage
      );

    // ------------------------------------------------
    // DYNAMIC LANGUAGE DETECTION - Detect per message
    // ------------------------------------------------
    
    // CRITICAL: Detect language for EVERY user message
    // This enables true multilingual switching behavior
    // If user speaks Tamil, respond in Tamil. If Hindi, respond in Hindi.
    const detectedLang =
      languageService.detectLanguage(
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

    const intent = extractIntent(userInput, session);
    detectedIntent = intent.intent;

    // Handle different intents by executing tools
    if (intent.intent === "doctor_inquiry" || intent.intent === "symptom_discussion") {
      selectedTool = "find_doctor";
      
      let targetDoctor: Doctor | null = null;
      
      // Find doctor by specialty if provided
      if (intent.entities.specialty) {
        targetDoctor = await findDoctorBySpecialty(intent.entities.specialty);
      }
      
      // Get available slots if doctor found
      if (targetDoctor) {
        const targetDate = intent.entities.date || SYSTEM_TODAY;
        const slotsResult = await schedulerService.getAvailableSlots(targetDoctor.id, targetDate);
        
        // Format response based on language
        if (detectedLang === Language.TAMIL) {
          finalResponseText = `${targetDoctor.name} அவர்களுக்கு ${targetDate} அன்று ${slotsResult.slots.length > 0 ? `${slotsResult.slots.join(", ")}என்று நேரங்கள் கிடைக்கின்றன. நீங்கள் ஒரு நேரத்தை தேர்வு செய்யலாமா?` : "நேரம் இல்லை"}`;
        } else if (detectedLang === Language.HINDI) {
          finalResponseText = `${targetDoctor.name} के पास ${targetDate} को ${slotsResult.slots.length > 0 ? `${slotsResult.slots.join(", ")} बजे स्लॉट उपलब्ध हैं। कृपया एक समय चुनें?` : "कोई स्लॉट उपलब्ध नहीं है"}`;
        } else {
          finalResponseText = slotsResult.success && slotsResult.slots.length > 0
            ? `Dr. ${targetDoctor.name} has availability on ${targetDate}: ${slotsResult.slots.join(", ")}. Which time would you prefer?`
            : `Dr. ${targetDoctor.name} has no available slots on ${targetDate}. Would you like a different date?`;
        }
        
        // Save booking state
        const updatedSession: SessionData = {
          ...session,
          activeIntent: "book",
          pendingConfirmation: true,
          bookingState: {
            doctorId: targetDoctor.id,
            doctorName: targetDoctor.name,
            specialty: targetDoctor.specialty,
            date: targetDate
          }
        };
        await sessionService.saveSession(phone, updatedSession);
        
        toolResults = JSON.stringify(slotsResult);
      } else {
        // No specific doctor requested - list available doctors
        const doctors = await redisStore.getDoctors();
        
        if (detectedLang === Language.TAMIL) {
          finalResponseText = `எந்த மருத்துவர் வகையை நீங்கள் தேடுகிறீர்கள்? ${doctors.map(d => `${d.name} - ${d.specialty}`).join(", ")}`;
        } else if (detectedLang === Language.HINDI) {
          finalResponseText = `आप किस प्रकार के डॉक्टर की तलाश कर रहे हैं? ${doctors.map(d => `${d.name} - ${d.specialty}`).join(", ")}`;
        } else {
          finalResponseText = `We have the following specialists available: ${doctors.map(d => `${d.name} (${d.specialty})`).join(", ")}. Which specialist do you need?`;
        }
        
        toolResults = JSON.stringify(doctors);
      }
    } 
    else if (intent.intent === "booking" && intent.entities.doctorId && intent.entities.time) {
      selectedTool = "book_appointment";
      
      const bookResult = await schedulerService.bookAppointment({
        patientPhone: phone,
        patientName: patientObj?.name || overrideName || "Patient",
        doctorId: intent.entities.doctorId,
        date: intent.entities.date || SYSTEM_TODAY,
        time: intent.entities.time
      });
      
      finalResponseText = bookResult.message;
      
      if (bookResult.success) {
        // Clear session
        await sessionService.clearSession(phone);
      } else if (bookResult.suggestedSlots) {
        // Suggest alternatives
        finalResponseText += ` Available alternatives: ${bookResult.suggestedSlots.join(", ")}`;
      }
      
      toolResults = JSON.stringify(bookResult);
    }
    else if (intent.intent === "cancellation") {
      selectedTool = "cancel_appointment";
      
      // Find patient's appointment
      const patientAppts = await redisStore.findAppointmentsByPhone(phone);
      if (patientAppts.length > 0) {
        const latestAppt = patientAppts[0];
        const cancelResult = await schedulerService.cancelAppointment(latestAppt.id);
        finalResponseText = cancelResult.message;
        
        // Broadcast cancellation to operations dashboard
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
        // Save reschedule state
        const updatedSession: SessionData = {
          ...session,
          activeIntent: "reschedule",
          pendingConfirmation: true,
          rescheduleAppointmentId: patientAppts[0].id
        };
        await sessionService.saveSession(phone, updatedSession);
        
        finalResponseText = detectedLang === Language.TAMIL
          ? `உங்க் ந்திப்பு ${patientAppts[0].date} அன்று ${patientAppts[0].time}இல் பதிவு செய்யப்பட்டுள்ளது. புதிய திகதி மற்றும் நேரத்தை கூறுங்கள்.`
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
        // STRICT LANGUAGE CONTROL
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

        // SAFETY CLEANUP
        finalResponseText = finalResponseText.replace(/\*\*/g, "");
      } catch (exp: any) {
        console.error("Gemini orchestration failure:", exp);

        // Multilingual fallback
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
    // TTS
    // ------------------------------------------------

    const voiceStart = Date.now();

    const voiceResult =
      await ttsService.generateSpeech(
        finalResponseText,
        detectedLang
      );

    const ttsLatency =
      Date.now() - voiceStart;

    // ------------------------------------------------
    // LATENCY
    // ------------------------------------------------

    const totalLatency =
      Date.now() - globalStart;

    const latencyLogs = {
      stt: sttLatency,
      llm: llmLatency,
      tts: ttsLatency,
      total: totalLatency,
      textLength:
        finalResponseText.length,
    };

    await redisStore.addLatencyLog(
      latencyLogs
    );

    // ------------------------------------------------
    // TRACE
    // ------------------------------------------------

    const trace = {
      detectedIntent:
        session.activeIntent ||
        "conversation",

      retrievedMemory: JSON.stringify(
        {
          phone,
          patientName:
            patientObj?.name || "Guest",
          detectedLanguage:
            detectedLang,
        },
        null,
        2
      ),

      selectedTool,

      toolResults:
        toolResults ||
        "No tool executed",

      finalResponse:
        finalResponseText,

      languageDetected:
        detectedLang,
    };

    await redisStore.addTraceStep(
      trace
    );

    // ------------------------------------------------
    // RESPONSE
    // ------------------------------------------------

    return {
      textResponse:
        finalResponseText,

      speakAudio:
        voiceResult.hasAudio
          ? {
              hasAudio: true,
              audioData:
                voiceResult.audioData,
            }
          : undefined,

      detectedLanguage:
        detectedLang,

      trace,

      latencies:
        latencyLogs,
    };
  }

  // ------------------------------------------------
  // TOOL EXECUTION
  // ------------------------------------------------

  private async executeClinicalTool(
    name: string,
    args: any,
    session: SessionData,
    phone: string,
    lang: Language
  ): Promise<{
    outputStr: string;
    rawPayload: any;
  }> {
    try {
      // LIST DOCTORS
      if (name === "list_doctors") {
        const docs =
          await redisStore.getDoctors();

        return {
          outputStr:
            docs
              .map(
                (d: Doctor) =>
                  `${d.name} (${d.specialty})`
              )
              .join(", "),

          rawPayload: docs,
        };
      }

      // CHECK AVAILABILITY
      if (
        name ===
        "check_availability"
      ) {
        const result =
          await schedulerService.getAvailableSlots(
            args.doctorId,
            args.date
          );

        return {
          outputStr:
            result.message,

          rawPayload: result,
        };
      }

      // BOOK
      if (
        name ===
        "book_appointment"
      ) {
        const result =
          await schedulerService.bookAppointment(
            {
              patientPhone:
                args.patientPhone ||
                phone,

              patientName:
                args.patientName ||
                "Patient",

              doctorId:
                args.doctorId,

              date: args.date,

              time: args.time,
            }
          );

        return {
          outputStr:
            result.message,

          rawPayload: result,
        };
      }

      // RESCHEDULE
      if (
        name ===
        "reschedule_appointment"
      ) {
        const result =
          await schedulerService.rescheduleAppointment(
            {
              appointmentId:
                args.appointmentId,

              newDate:
                args.newDate,

              newTime:
                args.newTime,
            }
          );

        return {
          outputStr:
            result.message,

          rawPayload: result,
        };
      }

      // CANCEL
      if (
        name ===
        "cancel_appointment"
      ) {
        const result =
          await schedulerService.cancelAppointment(
            args.appointmentId
          );

        return {
          outputStr:
            result.message,

          rawPayload: result,
        };
      }

      return {
        outputStr:
          "Unknown tool",

        rawPayload: {},
      };
    } catch (err: any) {
      return {
        outputStr:
          err.message,

        rawPayload: {
          error: err.message,
        },
      };
    }
  }
}

export const clinicalAgentOrchestrator =
  new ClinicalAgentOrchestrator();