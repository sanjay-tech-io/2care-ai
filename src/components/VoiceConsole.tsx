import { useState, useEffect, useRef, useCallback } from "react";
import { Language, Patient, TraceStep } from "../types";
import { 
  Mic, 
  MicOff, 
  Phone, 
  Volume2, 
  VolumeX,
  Send, 
  Database, 
  Languages, 
  Wifi, 
  CircleDot, 
  Activity, 
  Smartphone,
  Play,
  Square,
  MessageSquare,
  Loader2,
  Orbit,
  User,
  UserPlus,
  MessageCircle
} from "lucide-react";

interface Props {
  patients: Patient[];
  onNewResult: (trace: Omit<TraceStep, "id" | "timestamp">, latencies: any) => void;
  onRefreshData: () => void;
  activeLanguage: Language;
  setActiveLanguage: (lang: Language) => void;
  isOnboarded: boolean;
  onOnboard: (name: string, phone: string, language: Language) => void;
  sessionId: string;
}

interface Message {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  lang?: Language;
  timestamp: string;
}

// Multilingual greeting templates
const GREETINGS: Record<Language, { voice: string; text: string }> = {
  [Language.ENGLISH]: {
    voice: "Hi {name}, welcome to Aarogi AI. How may I assist you today?",
    text: "Hi {name}, welcome to Aarogi AI. How may I assist you today?"
  },
  [Language.HINDI]: {
    voice: "नमस्ते {name}, Aarogi AI में आपका स्वागत है। मैं आपकी कैसे सहायता कर सकता हूँ?",
    text: "नमस्ते {name}, Aarogi AI में आपका स्वागत है। मैं आपकी कैसे सहायता कर सकता हूँ?"
  },
  [Language.TAMIL]: {
    voice: "வணக்கம் {name}, Aarogi AI-க்கு வரவேற்கிறோம். நான் எப்படி உதவலாம்?",
    text: "வணக்கம் {name}, Aarogi AI-க்கு வரவேற்கிறோம். நான் எப்படி உதவலாம்?"
  }
};

export default function VoiceConsole({ 
  patients, 
  onNewResult, 
  onRefreshData, 
  activeLanguage, 
  setActiveLanguage,
  isOnboarded,
  onOnboard,
  sessionId
}: Props) {
  // Patient onboarding state
  const [patientName, setPatientName] = useState<string>("");
  const [patientPhone, setPatientPhone] = useState<string>("");
  
  const [wsStatus, setWsStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isModelThinking, setIsModelThinking] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(!isOnboarded);

  const socketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  // Scroll messages to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate unique message ID
  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Connect to WS
  const connectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    setWsStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/voice`;

    console.log("Connecting to voice broker:", wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsStatus("connected");
      // Send handshake call start with session info
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
        } else if (data.type === "voice_response") {
          setIsModelThinking(false);
          addMessage("bot", data.text, data.language || activeLanguage);
          
          if (data.trace && data.latencies) {
            onNewResult(data.trace, data.latencies);
            onRefreshData();
          }
          
          // Play Gemini Voice Output or fallback to browser TTS
          if (isTtsEnabled) {
            if (data.audio) {
              playAudioBase64(data.audio);
            } else {
              speakUtterance(data.text, data.language || activeLanguage);
            }
          }
        } else if (data.type === "greeting") {
          setIsModelThinking(false);
          addMessage("bot", data.text, data.language || activeLanguage);
          if (isTtsEnabled) {
            speakUtterance(data.text, data.language || activeLanguage);
          }
        } else if (data.type === "error") {
          setIsModelThinking(false);
          addMessage("system", `Error: ${data.message}`);
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      setIsRecording(false);
    };

    ws.onerror = (e) => {
      console.error("WS error occurred:", e);
      setWsStatus("disconnected");
    };

    socketRef.current = ws;
  }, [patientPhone, patientName, activeLanguage, sessionId, isTtsEnabled, onNewResult, onRefreshData]);

  // Disconnect WS
  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setWsStatus("disconnected");
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (isOnboarded && !initializedRef.current) {
      connectWebSocket();
      initializedRef.current = true;
    }
    return () => {
      disconnectWebSocket();
      initializedRef.current = false;
    };
  }, [isOnboarded]);

  // Reconnect when language changes
  useEffect(() => {
    if (isOnboarded && initializedRef.current && socketRef.current) {
      disconnectWebSocket();
      setTimeout(() => connectWebSocket(), 100);
    }
  }, [activeLanguage]);

  // Send greeting when onboarded
  useEffect(() => {
    if (isOnboarded && patientName && messages.length === 0 && wsStatus === "connected") {
      const greeting = GREETINGS[activeLanguage];
      const personalizedGreeting = greeting.text.replace("{name}", patientName);
      
      // Send greeting to server for Redis storage
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: "greeting",
          name: patientName,
          phone: patientPhone,
          language: activeLanguage,
          sessionId: sessionId
        }));
      }
      
      // Show greeting locally
      addMessage("bot", personalizedGreeting, activeLanguage);
      if (isTtsEnabled) {
        const voiceGreeting = greeting.voice.replace("{name}", patientName);
        speakUtterance(voiceGreeting, activeLanguage);
      }
    }
  }, [isOnboarded, patientName, messages.length, wsStatus, activeLanguage, patientPhone, sessionId]);

  const addMessage = (sender: "user" | "bot" | "system", text: string, lang?: Language) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMessages(prev => [...prev, { id: generateId(), sender, text, lang, timestamp: timeStr }]);
  };

  // Handle onboarding submission
  const handleOnboarding = () => {
    if (patientName.trim() && patientPhone.trim()) {
      onOnboard(patientName.trim(), patientPhone.trim(), activeLanguage);
      setShowOnboarding(false);
      // Trigger WebSocket connection after onboarding
      setTimeout(() => connectWebSocket(), 100);
    }
  };

  // Web Speech API STT handler
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage("system", "Speech recognition is not supported in this browser. Please type your query.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;

      // Select proper language localization code
      let langCode = "en-US";
      if (activeLanguage === Language.HINDI) langCode = "hi-IN";
      if (activeLanguage === Language.TAMIL) langCode = "ta-IN";
      rec.lang = langCode;

      rec.onstart = () => {
        setIsRecording(true);
        addMessage("system", `Listening in ${activeLanguage}. Speak now...`);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          sendTranscriptionToServer(transcript);
        }
      };

      rec.onerror = (err: any) => {
        console.error("STT recognition error:", err);
        setIsRecording(false);
        addMessage("system", `Voice input error: ${err.error}. Typing fallback is active.`);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (exp: any) {
      console.error("STT initiation failed:", exp);
      setIsRecording(false);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendTranscriptionToServer = (text: string) => {
    if (!text.trim()) return;

    // Add user question to layout
    addMessage("user", text, activeLanguage);

    if (socketRef.current && wsStatus === "connected") {
      socketRef.current.send(JSON.stringify({
        type: "user_transcription",
        text: text,
        phone: patientPhone || "guest",
        name: patientName || "Guest",
        language: activeLanguage,
        sessionId: sessionId
      }));
    } else {
      addMessage("system", "Error: No active connection. Please wait...");
    }
  };

  // Send message via typed input
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const msg = inputText;
    setInputText("");
    sendTranscriptionToServer(msg);
  };

  // Play premium base64 vocalization stream
  const playAudioBase64 = (base64Data: string) => {
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      const raw = window.atob(base64Data);
      const rawLength = raw.length;
      const array = new Uint8Array(new ArrayBuffer(rawLength));
      for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
      }
      const blob = new Blob([array], { type: "audio/wav" });
      const blobUrl = URL.createObjectURL(blob);
      const audio = new Audio(blobUrl);
      audio.play().catch(e => {
        console.warn("Audio playback aborted:", e);
      });
    } catch (err) {
      console.error("Failed to play audio:", err);
    }
  };

  // Tamil speech sanitizer - convert English fragments to Tamil phonetics for better TTS
  const sanitizeForTamilSpeech = (text: string): string => {
    // Replace common English words with Tamil phonetics for better speech synthesis
    const replacements: Record<string, string> = {
      "Aarogi": "ஆரோகி",
      "AI": "ஏ ஐ",
      "Dr.": "டாக்டர்",
      "Dr": "டாக்டர்",
      "AM": "ஏ.எம்",
      "PM": "பி.எம்",
      " Dermatology ": " தோல் மருத்துவம் ",
      "Cardiology": " இதய நோய் ",
      "Neurology": " நரம்பு மருத்துவம் ",
      "Pediatrics": " குழந்தை நலம் ",
      "appointment": " சந்திப்பு ",
      "booking": " முன்பதிவு ",
      "cancel": " ரத்து ",
      "confirm": " உறுதி ",
      "available": " கிடைக்கும் ",
      "slot": " நேரம் ",
      "morning": " காலை ",
      "afternoon": " மதியம் ",
      "evening": " மாலை ",
      "today": "இன்று",
      "tomorrow": "நாளை",
    };
    
    let sanitized = text;
    for (const [eng, tamil] of Object.entries(replacements)) {
      sanitized = sanitized.replace(new RegExp(eng, 'gi'), tamil);
    }
    
    console.log("[TTS] Tamil sanitized:", sanitized);
    return sanitized;
  };

  // Browser Synthesis (TTS) Reader with proper multilingual support
  const speakUtterance = (text: string, lang?: Language) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    let cleanText = text.replace(/[*#_`~\[\]]/g, "");
    
    // Sanitize Tamil text for better speech synthesis
    if (lang === Language.TAMIL) {
      cleanText = sanitizeForTamilSpeech(cleanText);
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Strict language mapping
    let targetLang = "en-US";
    if (lang === Language.HINDI) targetLang = "hi-IN";
    if (lang === Language.TAMIL) targetLang = "ta-IN";
    utterance.lang = targetLang;

    // Load voices
    const voices = window.speechSynthesis.getVoices();
    
    // Try to find matching voice
    let voiceCandidate = voices.find(v => 
      v.lang.startsWith(targetLang.split("-")[0]) || 
      v.lang.toLowerCase().includes(targetLang.split("-")[0].toLowerCase())
    );
    
    // Fallback for regional voices
    if (!voiceCandidate) {
      if (lang === Language.HINDI) {
        voiceCandidate = voices.find(v => 
          v.name.toLowerCase().includes("india") || 
          v.name.toLowerCase().includes("hindi") ||
          v.lang.includes("IN")
        );
      } else if (lang === Language.TAMIL) {
        // Strict Tamil voice search - prioritize Tamil-specific voices
        voiceCandidate = voices.find(v =>
          v.name.toLowerCase().includes("tamil") ||
          (v.lang.startsWith("ta") && v.lang.includes("IN")) ||
          v.name.toLowerCase().includes("india")
        );
        // Fallback: any Tamil-compatible voice
        if (!voiceCandidate) {
          voiceCandidate = voices.find(v =>
            v.lang.startsWith("ta") || v.lang.includes("TA")
          );
        }
        console.log("[TTS] Tamil voice selected:", voiceCandidate?.name || "None - using fallback");
      }
    }

    if (voiceCandidate) {
      utterance.voice = voiceCandidate;
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  };

  // Language display helpers
  const getLanguageDisplay = (lang: Language) => {
    switch(lang) {
      case Language.HINDI: return "हिंदी";
      case Language.TAMIL: return "தமிழ்";
      default: return "EN";
    }
  };

  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] flex flex-col h-[640px] overflow-hidden">
      
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
            {/* Language Selector - Visual Update */}
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

        {/* Status Bar */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-cyan-500"></span>
            {patientName ? `Patient: ${patientName}` : "Not onboarded"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-purple-500"></span>
            Gemini 2.5 Flash
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-teal-500"></span>
            Redis Session
          </span>
        </div>
      </div>

      {/* Onboarding Section */}
      {showOnboarding && (
        <div className="p-5 border-b border-white/[0.06] bg-gradient-to-b from-[#101827] to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Patient Onboarding</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Your name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
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
              disabled={!patientName.trim() || !patientPhone.trim()}
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
        {messages.length === 0 ? (
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
        
        {isModelThinking && (
          <div className="flex items-center gap-2 text-xs text-cyan-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="p-4 bg-[#101827]/80 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          
          {/* TTS Toggle */}
          <button
            onClick={() => {
              setIsTtsEnabled(!isTtsEnabled);
            }}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
              isTtsEnabled 
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30" 
                : "bg-slate-900 text-slate-500 border-white/[0.06] hover:bg-slate-800"
            }`}
            title={isTtsEnabled ? "Disable voice output" : "Enable voice output"}
          >
            {isTtsEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>

          {/* Recording Button */}
          <button
            onClick={isRecording ? stopSpeechRecognition : startSpeechRecognition}
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

    </div>
  );
}