import { useState, useEffect } from "react";
import { Language } from "../types";
import { 
  MessageCircle, 
  Phone, 
  Clock, 
  Target,
  Bot,
  Globe,
  Activity
} from "lucide-react";

interface ConversationSession {
  phone: string;
  patientName: string;
  language: Language;
  intent: string;
  startTime: number;
  messageCount: number;
  lastActivity: number;
}

interface Props {
  activeConversations?: ConversationSession[];
  onSelectConversation?: (phone: string, patientName: string) => void;
  selectedPhone?: string;
}

export default function ActiveConversations({ activeConversations = [], onSelectConversation, selectedPhone }: Props) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for live duration tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (startTime: number): string => {
    const seconds = Math.floor((currentTime - startTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getIntentLabel = (intent: string): { label: string; color: string } => {
    switch (intent) {
      case "book":
        return { label: "Booking", color: "text-cyan-400" };
      case "reschedule":
        return { label: "Rescheduling", color: "text-amber-400" };
      case "cancel":
        return { label: "Cancellation", color: "text-red-400" };
      case "doctor_inquiry":
        return { label: "Doctor Inquiry", color: "text-purple-400" };
      case "symptom_discussion":
        return { label: "Symptom Check", color: "text-emerald-400" };
      default:
        return { label: "General Chat", color: "text-slate-400" };
    }
  };

  const getLanguageFlag = (lang: Language): string => {
    switch (lang) {
      case Language.TAMIL:
        return "🇮🇳";
      case Language.HINDI:
        return "🇮🇳";
      case Language.ENGLISH:
        return "🇺🇸";
      default:
        return "🌐";
    }
  };

  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Live Conversations</h3>
            <p className="text-[10px] text-slate-500">Real-time session monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
          </span>
          <span className="text-[10px] font-semibold text-purple-400 font-mono">
            {activeConversations.length} ACTIVE
          </span>
        </div>
      </div>

      {/* Active Conversations List */}
      <div className="space-y-3">
        {activeConversations.length === 0 ? (
          <div className="border border-dashed border-white/[0.06] rounded-xl p-8 text-center text-slate-500 text-xs">
            No active conversations. Start a voice session from the console.
          </div>
        ) : (
          activeConversations.map((session, index) => {
            const intentInfo = getIntentLabel(session.intent);
            return (
              <div 
                key={session.phone + index}
                onClick={() => onSelectConversation?.(session.phone, session.patientName)}
                className={`bg-[#101827] border rounded-xl p-4 hover:border-purple-500/30 transition-all cursor-pointer ${
                  selectedPhone === session.phone 
                    ? "border-purple-500/50 bg-purple-500/5" 
                    : "border-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/15 rounded-lg">
                      <MessageCircle className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 text-xs">
                          {session.patientName || "Guest Patient"}
                        </span>
                        <span className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded font-medium">
                          {getLanguageFlag(session.language)} {session.language}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Phone className="w-3 h-3 text-slate-600" />
                        <span className="text-[10px] text-slate-500 font-mono">{session.phone}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-[10px] font-semibold ${intentInfo.color}`}>
                      {intentInfo.label}
                    </div>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <span className="text-[10px] text-slate-500 font-mono">
                        {formatDuration(session.startTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Session Progress */}
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between text-[9px]">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Bot className="w-3 h-3 text-slate-600" />
                        <span className="text-slate-500">{session.messageCount} messages</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-slate-600" />
                        <span className={intentInfo.color}>{intentInfo.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-500">{session.language}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Session Metrics Summary */}
      {activeConversations.length > 0 && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/[0.06]">
          <div className="bg-[#0B1220] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-purple-400">
              {activeConversations.length}
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Active</div>
          </div>
          <div className="bg-[#0B1220] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-cyan-400">
              {activeConversations.reduce((sum, s) => sum + s.messageCount, 0)}
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Messages</div>
          </div>
          <div className="bg-[#0B1220] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">
              {activeConversations.filter(s => s.intent === "book" || s.intent === "reschedule").length}
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wide">In Booking</div>
          </div>
        </div>
      )}
    </div>
  );
}
