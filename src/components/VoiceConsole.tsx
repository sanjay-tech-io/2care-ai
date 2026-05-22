import { useState, useEffect, useRef, useCallback } from "react";
import { Language, Patient, TraceStep } from "../types";
import { 
  Mic, 
  Phone, 
  VolumeX,
  Send, 
  Wifi, 
  Activity, 
  Square,
  Loader2,
  Orbit,
  UserPlus,
  MessageCircle,
  AudioWaveform,
  Plus,
  X
} from "lucide-react";

interface NewChatDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function NewChatDialog({ isOpen, onConfirm, onCancel }: NewChatDialogProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative bg-[#101827] border border-white/[0.06] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Plus className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-white text-center mb-2">Start a new chat?</h3>
        <p className="text-xs text-slate-400 text-center mb-6">This will end the current session.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/[0.06] text-slate-300 text-xs font-medium hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition-all"
          >
            Yes, New Chat
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  patients: Patient[];
  onNewResult: (trace: Omit<TraceStep, "id" | "timestamp">, latencies: any) => void;
  onRefreshData: () => void;
  activeLanguage: Language;
  setActiveLanguage: (lang: Language) => void;
  isOnboarded: boolean;
  onOnboard: (name: string, phone: string, age: number, language: Language) => void;
  sessionId: string;
  // PART D: Viewing history from Live Conversations
  viewingHistory?: {
    phone: string;
    patientName: string;
    messages: Array<{ role: string; text: string; timestamp: string }>;
  } | null;
  onCloseHistory?: () => void;
}

interface Message {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  lang?: Language;
  timestamp: string;
}

// ================================================
// TAMIL SPEECH SANITIZER - STRICT VERSION
// Converts ALL English/Latin words to Tamil 
// phonetic equivalents BEFORE browser TTS.
// DOES NOT modify UI chat text - only speech.
// ================================================

// Comprehensive English-to-Tamil word map
const tamilWordMap: Record<string, string> = {
  // Common words
  "aarogi": "ஆரோகி",
  "ai": "ஏ ஐ",
  "hello": "வணக்கம்",
  "welcome": "வரவேற்கிறோம்",
  "thank": "நன்றி",
  "thanks": "நன்றி",
  "please": "தயவுசெய்து",
  "sorry": "மன்னிக்கவும்",
  // People names
  "sanjay": "சஞ்சய்",
  "priya": "பிரியா",
  "rajesh": "ராஜேஷ்",
  "vikram": "விக்ரம்",
  "anita": "அனிதா",
  "meena": "மீனா",
  "anil": "அனில்",
  "sharma": "சர்மா",
  "patel": "படேல்",
  "desai": "தேசாய்",
  "naidu": "நாயுடு",
  "reddy": "ரெட்டி",
  "kumar": "குமார்",
  "khanna": "கண்ணா",
  "smith": "ஸ்மித்",
  "alicia": "அலிசியா",
  "joseph": "ஜோசப்",
  // Medical titles
  "dr.": "டாக்டர்",
  "dr": "டாக்டர்",
  "doctor": "டாக்டர்",
  "mr.": "திரு",
  "mrs.": "திருமதி",
  "ms.": "திருமதி",
  // Time markers
  "am": "ஏ.எம்",
  "pm": "பி.எம்",
  "o'clock": "மணிக்கு",
  "oclock": "மணிக்கு",
  // Medical terms
  "appointment": "சந்திப்பு",
  "booking": "முன்பதிவு",
  "book": "முன்பதிவு",
  "cancel": "ரத்து",
  "confirm": "உறுதி",
  "confirmed": "உறுதி செய்யப்பட்டது",
  "available": "கிடைக்கும்",
  "slot": "நேரம்",
  "slots": "நேரங்கள்",
  "reschedule": "மாற்றம்",
  "specialist": "நிபுணர்",
  "specialty": "நிபுணத்துவம்",
  "consultation": "ஆலோசனை",
  "schedule": "திட்டமிடு",
  "availability": "கிடைக்கும் தன்மை",
  // Specialties
  "dermatology": "தோல் மருத்துவம்",
  "dermatologist": "தோல் மருத்துவர்",
  "cardiology": "இதய நோய்",
  "cardiologist": "இதய மருத்துவர்",
  "neurology": "நரம்பு மருத்துவம்",
  "neurologist": "நரம்பு மருத்துவர்",
  "pediatrics": "குழந்தை நலம்",
  "pediatrician": "குழந்தை மருத்துவர்",
  "orthopedics": "எலும்பு மருத்துவம்",
  "orthopedic": "எலும்பு மருத்துவம்",
  "gynecology": "மகளிர் மருத்துவம்",
  "ophthalmology": "கண் மருத்துவம்",
  "general medicine": "பொது மருத்துவம்",
  "dental": "பற் மருத்துவம்",
  // Time of day
  "morning": "காலை",
  "afternoon": "மதியம்",
  "evening": "மாலை",
  "night": "இரவு",
  // Days
  "today": "இன்று",
  "tomorrow": "நாளை",
  "yesterday": "நேற்று",
  "monday": "திங்கள்",
  "tuesday": "செவ்வாய்",
  "wednesday": "புதன்",
  "thursday": "வியாழன்",
  "friday": "வெள்ளி",
  "saturday": "சனி",
  "sunday": "ஞாயிறு",
  // Responses
  "yes": "ஆம்",
  "no": "இல்லை",
  "ok": "சரி",
  "okay": "சரி",
  "sure": "நிச்சயமாக",
  "fine": "சரி",
  "great": "நல்லது",
  "good": "நல்லது",
};

// CRITICAL: Aggressive Tamil sanitizer that removes ALL English words
function sanitizeForTamilSpeech(text: string): string {
  if (!text) return text;
  
  // Step 1: Normalize - replace common punctuation that breaks word boundaries
  let sanitized = text
    .replace(/\./g, " . ")    // Periods get spaces
    .replace(/,/g, " , ")     // Commas get spaces
    .replace(/!/g, " ! ")
    .replace(/\?/g, " ? ")
    .replace(/:/g, " : ")
    .replace(/;/g, " ; ")
    .replace(/-/g, " - ")     // Hyphens get spaces (critical for "AI-க்கு" -> "AI க்கு")
    .replace(/\s+/g, " ")     // Collapse spaces
    .trim();
  
  // Step 2: Wrap with spaces for boundary matching
  sanitized = " " + sanitized + " ";
  
  // Step 3: Replace known English words with Tamil equivalents
  // Sort by length (longest first) to match compound words before single words
  const sortedEntries = Object.entries(tamilWordMap).sort(([a], [b]) => b.length - a.length);
  
  for (const [eng, tamil] of sortedEntries) {
    // Match word boundaries: preceded/followed by space, start/end of string, or punctuation
    const escapedEng = eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Match with word boundaries on both sides - this ensures " AI " matches but "AI" in "TAIL" doesn't
    const regex = new RegExp(`(?<=^|[\\s.,!?;:()\\-])${escapedEng}(?=$|[\\s.,!?;:()\\-])`, 'gi');
    sanitized = sanitized.replace(regex, (match: string) => {
      // Preserve the case of original match for proper nouns, but use Tamil replacement
      return tamil;
    });
  }
  
  // Step 4: Replace REMAINING Latin/English words with letter-by-letter Tamil
  // This catches ANY word not in the dictionary
  sanitized = sanitized.replace(/(?<=^|[^a-zA-Z])[a-zA-Z]+(?=$|[^a-zA-Z])/g, (match) => {
    const lower = match.toLowerCase();
    
    // Check dictionary again (for words that might have been missed due to case/special chars)
    if (tamilWordMap[lower]) return tamilWordMap[lower];
    
    // Letter-by-letter transliteration for anything remaining
    const letterMap: Record<string, string> = {
      a: "ஏ", b: "பீ", c: "சி", d: "டி", e: "ஈ", f: "எஃப்",
      g: "ஜீ", h: "எச்", i: "ஐ", j: "ஜே", k: "கே", l: "எல்",
      m: "எம்", n: "என்", o: "ஓ", p: "பீ", q: "க்யூ", r: "ஆர்",
      s: "எஸ்", t: "டி", u: "யூ", v: "வீ", w: "டபிள்யூ",
      x: "எக்ஸ்", y: "வை", z: "ஜெட்",
    };
    
    return lower.split("").map((ch) => letterMap[ch] || ch).join(" ");
  });
  
  // Step 5: Restore punctuation by removing extra spaces
  sanitized = sanitized
    .replace(/\s+\.\s+/g, ". ")   // period space
    .replace(/\s+,\s+/g, ", ")    // comma space
    .replace(/\s+!\s+/g, "! ")
    .replace(/\s+\?\s+/g, "? ")
    .replace(/\s+-\s+/g, "")      // re-join hyphens (AI க்கு -> AIக்கு for Tamil)
    .replace(/\s{2,}/g, " ")      // collapse multiple spaces
    .trim();
  
  return sanitized;
}

// ================================================
// TAMIL VOICE FINDER
// ================================================
const findTamilVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
  return voices.find(v => v.lang === "ta-IN")
    || voices.find(v => v.lang.startsWith("ta-"))
    || voices.find(v => v.name.toLowerCase().includes("tamil"))
    || null; // Remove the Indian fallback — it causes Hindi voice to speak Tamil
};

// ================================================
// SPEECH PLAYBACK GATE - single active speech
// ================================================
let activeAudioElement: HTMLAudioElement | null = null;
let isSpeaking = false;

function cancelAllSpeech() {
  if (activeAudioElement) {
    activeAudioElement.pause();
    activeAudioElement = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
}

function playAudioBase64(base64Data: string, onStart?: () => void, onEnd?: () => void) {
  cancelAllSpeech();
  try {
    const raw = window.atob(base64Data);
    const array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
    const blob = new Blob([array], { type: "audio/wav" });
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    activeAudioElement = audio;
    isSpeaking = true;
    onStart?.();
    audio.play().catch(e => {
      console.warn("[TTS] Audio playback aborted:", e);
      isSpeaking = false;
      onEnd?.();
    });
    audio.onended = () => {
      isSpeaking = false;
      onEnd?.();
      activeAudioElement = null;
    };
    audio.onerror = () => {
      isSpeaking = false;
      onEnd?.();
      activeAudioElement = null;
    };
  } catch (err) {
    console.error("[TTS] Failed to play base64 audio:", err);
    isSpeaking = false;
    onEnd?.();
  }
}

function speakUtterance(text: string, lang?: Language, onStart?: () => void, onEnd?: () => void) {
  cancelAllSpeech();
  if (!window.speechSynthesis) {
    onEnd?.();
    return;
  }

  let cleanText = text.replace(/[*#_`~\[\]]/g, "");
  
  // CRITICAL: For Tamil, sanitize ONLY the speech text, NOT the UI message
  if (lang === Language.TAMIL) {
    cleanText = sanitizeForTamilSpeech(cleanText);
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);

  // STRICT language mapping
  if (lang === Language.HINDI) utterance.lang = "hi-IN";
  else if (lang === Language.TAMIL) utterance.lang = "ta-IN";
  else utterance.lang = "en-US";

  const voices = window.speechSynthesis.getVoices();
  
  if (lang === Language.TAMIL) {
    const tamilVoice = findTamilVoice(voices);
    if (tamilVoice) {
      utterance.voice = tamilVoice;
      console.log("[TTS] Tamil voice:", tamilVoice.name, tamilVoice.lang);
    } else {
      console.log("[TTS] No Tamil voice found, using ta-IN lang fallback");
    }
  } else if (lang === Language.HINDI) {
    const hindiVoice = voices.find(v => v.lang.startsWith("hi-") || v.name.toLowerCase().includes("hindi"));
    if (hindiVoice) utterance.voice = hindiVoice;
  } else {
    const engVoice = voices.find(v => v.lang.startsWith("en-US") || v.lang.startsWith("en-GB"));
    if (engVoice) utterance.voice = engVoice;
  }

  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  
  isSpeaking = true;
  onStart?.();
  
  utterance.onstart = () => {
    isSpeaking = true;
    onStart?.();
  };
  utterance.onend = () => {
    isSpeaking = false;
    onEnd?.();
  };
  utterance.onerror = () => {
    isSpeaking = false;
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

export default function VoiceConsole({ 
  patients, 
  onNewResult, 
  onRefreshData, 
  activeLanguage, 
  setActiveLanguage,
  isOnboarded,
  onOnboard,
  sessionId,
  viewingHistory,
  onCloseHistory
}: Props) {
  const [patientName, setPatientName] = useState<string>("");
  const [patientAge, setPatientAge] = useState<string>("");
  const [patientPhone, setPatientPhone] = useState<string>("");
  
  const [wsStatus, setWsStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isModelThinking, setIsModelThinking] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!isOnboarded);

  const socketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const renderedMessageIds = useRef(new Set<string>());

  // FIX: Use useRef to persist transcript buffer across renders
  const transcriptBufferRef = useRef("");

  // Live speaking state
  const [speakingState, setSpeakingState] = useState<"idle" | "speaking" | "processing">("idle");

  // New Chat dialog state
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);

  // New Chat button click handler
  const onNewChatButtonClick = () => {
    // If no session has started yet (no registration), just reset form fields without dialog
    if (!isOnboarded && !patientName && !patientPhone) {
      // Just reset the form fields
      setPatientName('');
      setPatientAge('');
      setPatientPhone('');
      return;
    }
    // Show confirmation dialog
    setShowNewChatDialog(true);
  };

  // Smooth auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, speakingState]);

  // Generate unique message ID
  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Connect to WS
  const connectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    // Clear dedup set on new connection
    renderedMessageIds.current.clear();

    setWsStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/voice`;

    console.log("[WS] Connecting to voice broker:", wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsStatus("connected");
      ws.send(JSON.stringify({
        type: "call_start",
        phone: patientPhone || "guest",
        name: patientName || "Guest",
        language: activeLanguage,
        sessionId: sessionId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "system_status") {
          addMessage("system", data.text);
        } else if (data.type === "processing_audio") {
          setIsModelThinking(true);
          setSpeakingState("processing");
        } else if (data.type === "voice_response") {
          console.log("[DEBUG] audio received:", !!data.audio, "lang:", data.language);
          setIsModelThinking(false);
          const responseLang = [Language.ENGLISH, Language.HINDI, Language.TAMIL].includes(data.language)
            ? (data.language as Language)
            : activeLanguage;

          // Deduplicate by text+lang fingerprint
          const msgKey = `bot:${responseLang}:${data.text}`;
          if (renderedMessageIds.current.has(msgKey)) {
            console.log("[DEDUP] Skipping duplicate:", data.text.substring(0, 40));
            return;
          }
          renderedMessageIds.current.add(msgKey);

          addMessage("bot", data.text, responseLang);
          if (responseLang !== activeLanguage) {
            setActiveLanguage(responseLang);
          }

          if (data.trace && data.latencies) {
            onNewResult(data.trace, data.latencies);
            onRefreshData();
          }

          console.log("[DEBUG] Processing voice response:", !!data.audio, "lang:", data.language);
          // SINGLE SPEECH PLAYBACK PATH - pick ONE
          if (data.audio) {
            playAudioBase64(data.audio, 
              () => setSpeakingState("speaking"),
              () => setSpeakingState("idle")
            );
          } else {
            const voices = window.speechSynthesis.getVoices();
            const hasTamilVoice = voices.some(v => v.lang.startsWith("ta-"));
            
            if (responseLang === Language.TAMIL && !hasTamilVoice) {
              console.warn("[TTS] No Tamil voice in browser. Install Tamil TTS or rely on Gemini audio.");
              setSpeakingState("idle");
              return; // Don't attempt — it will silently fail
            }
            speakUtterance(data.text, responseLang,
              () => setSpeakingState("speaking"),
              () => setSpeakingState("idle")
            );
          }
        } else if (data.type === "error") {
          setIsModelThinking(false);
          setSpeakingState("idle");
          addMessage("system", `Error: ${data.message}`);
        }
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      setIsRecording(false);
      cancelAllSpeech();
      setSpeakingState("idle");
    };

    ws.onerror = (e) => {
      console.error("[WS] Error:", e);
      setWsStatus("disconnected");
    };

    socketRef.current = ws;
  }, [patientPhone, patientName, activeLanguage, sessionId, onNewResult, onRefreshData]);

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setWsStatus("disconnected");
    cancelAllSpeech();
  };

  useEffect(() => {
    if (isOnboarded && !initializedRef.current) {
      connectWebSocket();
      initializedRef.current = true;
    }
    return () => {
      disconnectWebSocket();
      initializedRef.current = false;
      cancelAllSpeech();
    };
  }, [isOnboarded]);

  useEffect(() => {
    if (isOnboarded && initializedRef.current && socketRef.current) {
      disconnectWebSocket();
      setTimeout(() => connectWebSocket(), 100);
    }
  }, [activeLanguage]);

  const addMessage = (sender: "user" | "bot" | "system", text: string, lang?: Language) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMessages(prev => [...prev, { id: generateId(), sender, text, lang, timestamp: timeStr }]);
  };

  const handleOnboarding = () => {
    if (patientName.trim() && patientPhone.trim() && patientAge) {
      onOnboard(patientName.trim(), patientPhone.trim(), parseInt(patientAge, 10), activeLanguage);
      setShowOnboarding(false);
      setTimeout(() => connectWebSocket(), 100);
    }
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage("system", "Speech recognition not supported. Please type.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = activeLanguage === Language.TAMIL ? "ta-IN" : activeLanguage === Language.HINDI ? "hi-IN" : "en-US";

      // Clear the buffer for new recording
      transcriptBufferRef.current = "";

      rec.onstart = () => setIsRecording(true);
      rec.onresult = (event: any) => {
        // Accumulate ALL results (both interim and final) into buffer
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        transcriptBufferRef.current = fullTranscript;
        // Update UI only - do NOT send to backend while speaking
        setInputText(fullTranscript);
      };
      rec.onerror = (err: any) => {
        console.error("[STT] Error:", err);
        setIsRecording(false);
      };
      rec.onend = () => {
        // CHANGED: Don't auto-send on stop. Wait for Stop button click.
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (exp: any) {
      console.error("[STT] Init failed:", exp);
      setIsRecording(false);
    }
  };

  const stopRecordingAndSend = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      // Now send the final accumulated transcript
      if (transcriptBufferRef.current.trim()) {
        sendTranscriptionToServer(transcriptBufferRef.current.trim());
        transcriptBufferRef.current = "";
        setInputText("");
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      // Note: onend handler will send the transcript
    }
  };

  const sendTranscriptionToServer = (text: string) => {
    if (!text.trim()) return;
    addMessage("user", text, activeLanguage);
    if (socketRef.current && wsStatus === "connected") {
      // Cancel any ongoing speech before sending new user message
      cancelAllSpeech();
      setSpeakingState("idle");
      
      socketRef.current.send(JSON.stringify({
        type: "user_transcription",
        text: text,
        phone: patientPhone || "guest",
        name: patientName || "Guest",
        language: activeLanguage,
        sessionId: sessionId
      }));
    } else {
      addMessage("system", "No active connection. Please wait...");
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const msg = inputText;
    setInputText("");
    sendTranscriptionToServer(msg);
  };

  // Speaking indicator text
  const getSpeakingLabel = () => {
    switch (speakingState) {
      case "processing": return "Thinking...";
      case "speaking": return "Speaking...";
      default: return "";
    }
  };

  const getLanguageDisplay = (lang: Language) => {
    switch(lang) {
      case Language.HINDI: return "हिंदी";
      case Language.TAMIL: return "தமிழ்";
      default: return "EN";
    }
  };

  // New Chat handler - resets everything (must be after connectWebSocket definition)
  const handleNewChat = () => {
    // STEP 1 — Close the existing WebSocket connection cleanly
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'disconnect' }));
      socketRef.current.close();
    }
    socketRef.current = null;
    setWsStatus("disconnected");

    // STEP 2 — Stop any ongoing speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);

    // STEP 3 — Stop any ongoing TTS audio playback
    cancelAllSpeech();
    setSpeakingState("idle");

    // STEP 4 — Reset ALL state variables to their initial values
    setMessages([]);
    setInputText('');
    setPatientName('');
    setPatientAge('');
    setPatientPhone('');
    setShowOnboarding(true);
    setIsModelThinking(false);
    transcriptBufferRef.current = "";
    renderedMessageIds.current.clear();

    // STEP 5 — Show the registration form again (already done via setShowOnboarding above)

    // STEP 6 — Establish a fresh WebSocket connection
    // Reset initialization flag so a new connection will be made on next re-onboard
    initializedRef.current = false;
    
    // Reconnect if was previously onboarded
    if (isOnboarded) {
      setTimeout(() => connectWebSocket(), 100);
    }
    
    // Close the dialog
    setShowNewChatDialog(false);
  };

  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] flex flex-col h-[640px] overflow-hidden">
      
      {/* PART D: Viewing History Banner */}
      {viewingHistory && viewingHistory.messages.length > 0 && (
        <div className="px-5 py-3 bg-purple-500/20 border-b border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300 font-medium">
              Viewing chat history for {viewingHistory.patientName} ({viewingHistory.phone})
            </span>
          </div>
          <button
            onClick={onCloseHistory}
            className="px-2 py-1 rounded bg-purple-500/30 text-purple-300 text-[10px] hover:bg-purple-500/40 transition-all"
          >
            Close
          </button>
        </div>
      )}

      {/* Premium Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] bg-[#101827]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`absolute inset-0 rounded-full ${
                wsStatus === "connected" ? "bg-cyan-500/30 animate-pulse" : "bg-slate-700/30"
              }`}></div>
              <div className={`relative p-2 rounded-full border ${
                wsStatus === "connected" 
                  ? "bg-cyan-500/20 border-cyan-500/40" 
                  : "bg-slate-800 border-slate-700"
              }`}>
                <Phone className={`w-4 h-4 ${
                  wsStatus === "connected" ? "text-cyan-400" : "text-slate-500"
                }`} />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Voice Console</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  wsStatus === "connected" 
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                    : wsStatus === "connecting" 
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-red-500/15 text-red-400 border border-red-500/30"
                }`}>
                  <Wifi className={`w-2.5 h-2.5 ${wsStatus === "connected" ? "animate-pulse" : ""}`} />
                  {wsStatus.toUpperCase()}
                </span>
                {patientName && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {patientName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* New Chat Button */}
            <button
              onClick={onNewChatButtonClick}
              className="px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-slate-900/50 text-cyan-400 text-[10px] font-semibold hover:bg-cyan-500/10 transition-all flex items-center gap-1.5"
              title="Start a new chat"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>

            <div className="flex items-center gap-1 bg-slate-900/50 border border-white/[0.06] rounded-lg p-1">
              {([Language.ENGLISH, Language.HINDI, Language.TAMIL] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLanguage(lang)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                    activeLanguage === lang
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {getLanguageDisplay(lang)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status Bar with Live Speaking Indicator */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-cyan-500"></span>
            {patientName ? `Patient: ${patientName}` : "Not onboarded"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-purple-500"></span>
            Gemini 2.5 Flash
          </span>
          
          {/* Live Speaking Indicator */}
          {speakingState !== "idle" && (
            <span className={`flex items-center gap-1.5 ml-2 ${
              speakingState === "speaking" ? "text-emerald-400" : "text-amber-400"
            }`}>
              <AudioWaveform className={`w-3 h-3 ${speakingState === "speaking" ? "animate-pulse" : "animate-spin"}`} />
              <span className="text-[10px] font-semibold">{getSpeakingLabel()}</span>
            </span>
          )}
        </div>
      </div>

      {/* Onboarding Section */}
      {showOnboarding && (
        <div className="p-5 border-b border-white/[0.06] bg-gradient-to-b from-[#101827] to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Patient Onboarding</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Your name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="border border-white/[0.06] rounded-lg bg-slate-900/50 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
            <input
              type="number"
              placeholder="Age"
              min="1"
              max="120"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              className="border border-white/[0.06] rounded-lg bg-slate-900/50 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              className="border border-white/[0.06] rounded-lg bg-slate-900/50 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={handleOnboarding}
              disabled={!patientName.trim() || !patientPhone.trim() || !patientAge}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-xs px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Start Chat
            </button>
          </div>
        </div>
      )}

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#050816]/50">
        {/* PART D: Display history messages if viewingHistory is set */}
        {viewingHistory && viewingHistory.messages.length > 0 ? (
          viewingHistory.messages.map((m, idx) => (
            <div 
              key={idx}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs ${
                m.role === "user"
                  ? "bg-cyan-600 text-white font-medium rounded-br-md"
                  : "bg-[#101827] border border-white/[0.06] text-slate-200 rounded-bl-md"
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                <div className={`text-[9px] mt-2 ${
                  m.role === "user" ? "text-cyan-200" : "text-slate-600"
                }`}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse"></div>
              <Orbit className="w-10 h-10 text-cyan-500/60 relative" />
            </div>
            <span className="text-sm font-medium text-slate-400">
              {isOnboarded ? "Ready for conversation" : "Complete onboarding to begin"}
            </span>
            <span className="text-[11px] text-slate-600 mt-1">
              {isOnboarded ? "Press the microphone or type a message" : "Enter your details above"}
            </span>
          </div>
        ) : (
          messages.map((m) => (
            <div 
              key={m.id}
              className={`flex ${
                m.sender === "user" 
                  ? "justify-end" 
                  : m.sender === "bot" 
                  ? "justify-start" 
                  : "justify-center"
              }`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs ${
                m.sender === "user"
                  ? "bg-cyan-600 text-white font-medium rounded-br-md"
                  : m.sender === "bot"
                  ? "bg-[#101827] border border-white/[0.06] text-slate-200 rounded-bl-md"
                  : "bg-transparent text-slate-500 font-mono text-[10px]"
              }`}>
                {m.sender === "bot" && m.lang && (
                  <div className="flex items-center gap-2 mb-2 border-b border-white/[0.05] pb-2">
                    <Activity className="w-3 h-3 text-cyan-500" />
                    <span className="text-[10px] text-cyan-400 font-medium">{getLanguageDisplay(m.lang)}</span>
                    <span className="text-[9px] text-slate-600 ml-auto">{m.timestamp}</span>
                    {/* Speaking indicator on active message */}
                    {speakingState === "speaking" && (
                      <span className="flex items-center gap-1 text-emerald-400 ml-2">
                        <AudioWaveform className="w-2.5 h-2.5 animate-pulse" />
                      </span>
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                {m.sender !== "system" && (
                  <div className={`text-[9px] mt-2 ${
                    m.sender === "user" ? "text-cyan-200" : "text-slate-600"
                  }`}>
                    {m.timestamp}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Processing / Thinking indicator */}
        {(isModelThinking || speakingState === "processing") && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {speakingState === "speaking" ? "Speaking..." : "Thinking..."}
            </span>
            <span className="flex gap-1 ml-1">
              <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: "0ms"}}></span>
              <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: "150ms"}}></span>
              <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: "300ms"}}></span>
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="p-4 bg-[#101827]/80 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          
          {/* Stop Speech Button */}
          <button
            onClick={() => { cancelAllSpeech(); }}
            className="p-2.5 rounded-xl border bg-slate-900 text-slate-500 border-white/[0.06] hover:bg-slate-800 transition-all flex items-center justify-center"
            title="Stop current speech"
          >
            <VolumeX className="w-5 h-5" />
          </button>

          {/* Recording Button */}
          <button
            onClick={isRecording ? stopRecordingAndSend : startSpeechRecognition}
            disabled={!isOnboarded}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shrink-0 ${
              isRecording 
                ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 animate-pulse" 
                : isOnboarded
                ? "bg-cyan-500 text-black hover:bg-cyan-400"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Speak
              </>
            )}
          </button>

          {/* Text Input */}
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder={isOnboarded ? "Type your message..." : "Complete onboarding first..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={!isOnboarded}
              className="flex-1 border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-cyan-500/50 bg-slate-900/50 text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || !isOnboarded}
              className="bg-cyan-500 text-black p-3 rounded-xl hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* New Chat Confirmation Dialog */}
      <NewChatDialog
        isOpen={showNewChatDialog}
        onConfirm={handleNewChat}
        onCancel={() => setShowNewChatDialog(false)}
      />

    </div>
  );
}
