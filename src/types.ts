/**
 * Domain Types for Clinical Appointment Booking System
 */

export enum Language {
  ENGLISH = "English",
  HINDI = "Hindi",
  TAMIL = "Tamil"
}

export enum ConversationStep {
  GREETING = "GREETING",
  SPECIALIST_SELECTION = "SPECIALIST_SELECTION",
  DOCTOR_SELECTION = "DOCTOR_SELECTION",
  DATE_SELECTION = "DATE_SELECTION",
  SLOT_SELECTION = "SLOT_SELECTION",
  BOOKING_CONFIRMATION = "BOOKING_CONFIRMATION",
  COMPLETED = "COMPLETED",
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferredLanguage: Language;
  preferredDoctorId?: string;
  age: number;
  gender: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  languages: Language[];
  slots: string[]; // Available times e.g., "09:00 AM", "10:30 AM", etc.
}

export interface Appointment {
  id: string;
  patientPhone: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: "scheduled" | "cancelled" | "completed";
  createdAt: string;
}

export interface BookingState {
  doctorId?: string;
  doctorName?: string;
  specialty?: string;
  date?: string;
  time?: string;
  availableSlots?: string[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  lang?: Language;
  timestamp: string;
}

export interface SessionData {
  patientPhone?: string;
  patientName?: string;
  currentStep: ConversationStep;
  activeIntent?: string; // "book" | "reschedule" | "cancel" | "history" | "none"
  pendingConfirmation?: boolean;
  bookingState: BookingState;
  rescheduleAppointmentId?: string;
  rescheduleBookingState?: BookingState;
  preferredLanguage: Language;
  chatHistory?: ChatMessage[]; // Persisted chat messages for Redis session
}

export interface LatencyLog {
  id: string;
  timestamp: string;
  stt: number;  // milliseconds
  llm: number;  // milliseconds
  tts: number;  // milliseconds
  total: number; // milliseconds
  textLength: number;
}

export interface TraceStep {
  id: string;
  timestamp: string;
  detectedIntent: string;
  retrievedMemory: string;
  selectedTool: string;
  toolResults: string;
  finalResponse: string;
  languageDetected: string;
}

export interface Campaign {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  date: string;
  time: string;
  type: "reminder" | "follow-up" | "vaccination";
  details?: string;
  status: "pending" | "called" | "failed";
}