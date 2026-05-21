import { useState, useEffect } from "react";
import { Campaign, Language } from "../types";
import { 
  Megaphone, 
  PhoneCall, 
  CheckCircle, 
  Clock, 
  Video, 
  XCircle, 
  Volume2, 
  UserCheck, 
  Play,
  Phone,
  PhoneIncoming
} from "lucide-react";

interface Props {
  campaigns: Campaign[];
  onTriggerCampaign: (id: string, status: "called" | "failed") => void;
  onRefreshData: () => void;
  onSimulateOutboundVoice: (phone: string, text: string) => void;
}

export default function OutboundCampaigns({ campaigns, onTriggerCampaign, onRefreshData, onSimulateOutboundVoice }: Props) {
  const [activeCallItem, setActiveCallItem] = useState<Campaign | null>(null);
  const [callState, setCallState] = useState<"connecting" | "ringing" | "answered" | "no_answer" | "ended">("ended");
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [botVoiceTranscript, setBotVoiceTranscript] = useState("");

  const triggerCallSimulation = async (camp: Campaign) => {
    setActiveCallItem(camp);
    setCallState("connecting");
    setTranscriptLines(["[SYSTEM] Initiating outbound SIP connection..."]);

    setTimeout(() => {
      setCallState("ringing");
      setTranscriptLines(prev => [...prev, "[RINGING] Calling " + camp.patientPhone]);
    }, 1200);
  };

  const answerCallSimulation = () => {
    setCallState("answered");
    const docIntro = "Hello, this is Aarogi Clinic calling for " + activeCallItem?.patientName + ". We have a pending " + activeCallItem?.type + " alert. " + activeCallItem?.details + ". Can we confirm this slot?";
    
    setBotVoiceTranscript(docIntro);
    const botLine = "[BOT]: " + docIntro;
    setTranscriptLines(prev => [
      ...prev,
      "[CONNECTED] Line answered",
      botLine
    ]);

    speakUtterance(docIntro);
  };

  const endCallSimulation = (wasSuccessful: boolean) => {
    if (activeCallItem) {
      onTriggerCampaign(activeCallItem.id, wasSuccessful ? "called" : "failed");
    }
    setCallState("ended");
    setActiveCallItem(null);
    setTranscriptLines([]);
    setBotVoiceTranscript("");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const handlePatientConfirmOption = () => {
    const confirmationText = "Thank you for confirming your appointment slot.";
    setBotVoiceTranscript(confirmationText);
    setTranscriptLines(prev => [
      ...prev,
      "[PATIENT]: Yes, I confirm.",
      "[BOT]: " + confirmationText,
      "[SYSTEM] Reservation confirmed"
    ]);
    speakUtterance(confirmationText);

    setTimeout(() => {
      endCallSimulation(true);
    }, 4500);
  };

  const handlePatientRescheduleRedirect = () => {
    setTranscriptLines(prev => [
      ...prev,
      "[PATIENT]: I need to reschedule.",
      "[SYSTEM] Bridging to booking agent..."
    ]);

    if (activeCallItem) {
      onSimulateOutboundVoice(activeCallItem.patientPhone, "Please reschedule my appointment");
    }

    setCallState("ended");
    setActiveCallItem(null);
  };

  const speakUtterance = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`~]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
            <Megaphone className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Outbound Campaigns</h3>
            <p className="text-[10px] text-slate-500">Automated clinical outreach</p>
          </div>
        </div>
      </div>

      {callState !== "ended" && activeCallItem && (
        <div className="mb-5 bg-[#101827] border border-cyan-500/30 rounded-xl p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-[9px] tracking-wider uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded font-mono font-medium">
                Outbound Call
              </span>
              <h4 className="font-semibold text-sm mt-1.5 text-white">{activeCallItem.patientName}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">{activeCallItem.details}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-xs text-slate-300 font-mono capitalize">{callState}</span>
            </div>
          </div>

          <div className="bg-[#050816] rounded-lg p-3 h-28 overflow-y-auto font-mono text-[10px] space-y-1 border border-white/[0.04]">
            {transcriptLines.map((line, idx) => (
              <div 
                key={idx} 
                className={
                  line.startsWith("[BOT]") 
                    ? "text-cyan-400" 
                    : line.startsWith("[PATIENT]") 
                    ? "text-amber-400" 
                    : "text-slate-500"
                }
              >
                {line}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/[0.06]">
            <div className="flex gap-2">
              {callState === "ringing" && (
                <button
                  onClick={answerCallSimulation}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-medium text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <PhoneIncoming className="w-3.5 h-3.5" />
                  Answer
                </button>
              )}

              {callState === "answered" && (
                <>
                  <button
                    onClick={handlePatientConfirmOption}
                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-medium text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={handlePatientRescheduleRedirect}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all"
                  >
                    Reschedule
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => endCallSimulation(false)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-medium text-xs px-4 py-2 rounded-xl transition-all"
            >
              End Call
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {campaigns.map(camp => (
          <div 
            key={camp.id}
            className={`border rounded-xl p-4 flex flex-col justify-between ${
              camp.status === "called"
                ? "bg-slate-900/30 border-white/[0.04] text-slate-500 opacity-60"
                : "bg-[#101827] border-white/[0.06] hover:border-white/[0.1] transition-all text-slate-300"
            }`}
          >
            <div>
              <div className="flex justify-between items-start">
                <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold tracking-tight ${
                  camp.type === "reminder" 
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30" 
                    : camp.type === "follow-up" 
                    ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" 
                    : "bg-red-500/15 text-red-400 border-red-500/30"
                }`}>
                  {camp.type}
                </span>
                <span className="text-[9px] font-mono text-slate-600">{camp.id.substring(0, 6)}</span>
              </div>

              <h4 className="font-semibold text-slate-200 text-xs mt-3">{camp.patientName}</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{camp.details}</p>
              
              <div className="text-[9px] font-mono text-cyan-400 mt-2.5 flex items-center gap-1 bg-slate-900/50 border border-white/[0.04] px-2 py-1 rounded w-fit">
                <Clock className="w-3 h-3 text-slate-500" />
                {camp.date} - {camp.time}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
              <span className={`text-[10px] font-medium ${
                camp.status === "called" ? "text-cyan-400 font-semibold" : "text-slate-500"
              }`}>
                {camp.status === "called" ? "Completed" : "Pending"}
              </span>

              {camp.status !== "called" && (
                <button
                  disabled={callState !== "ended"}
                  onClick={() => triggerCallSimulation(camp)}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-semibold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:pointer-events-none transition-all"
                >
                  <Play className="w-3 h-3" />
                  Dial
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}