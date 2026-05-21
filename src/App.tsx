import { useState, useEffect } from "react";
import { Doctor, Patient, Appointment, LatencyLog, TraceStep, Campaign, Language } from "./types";
import DoctorAvailability from "./components/DoctorAvailability";
import ActiveReservations from "./components/ActiveReservations";
import VoiceConsole from "./components/VoiceConsole";
import OutboundCampaigns from "./components/OutboundCampaigns";
import ReasoningTrace from "./components/ReasoningTrace";
import LatencyMonitor from "./components/LatencyMonitor";
import ArchitectureMermaid from "./components/ArchitectureMermaid";
import ActiveConversations from "./components/ActiveConversations";
import { 
  Sparkles, 
  CalendarCheck, 
  Cpu, 
  Database, 
  Mic,
  LineChart,
  GitBranch
} from "lucide-react";

export default function App() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [latencyLogs, setLatencyLogs] = useState<LatencyLog[]>([]);
  const [traces, setTraces] = useState<TraceStep[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeConversations, setActiveConversations] = useState<Array<{
    phone: string;
    patientName: string;
    language: Language;
    intent: string;
    startTime: number;
    messageCount: number;
    lastActivity: number;
  }>>([]);
  const [activeTab, setActiveTab] = useState<"console" | "dashboard" | "latency" | "architecture">("console");
  const [activeLanguage, setActiveLanguage] = useState<Language>(Language.ENGLISH);
  const [systemDate] = useState<string>("2026-05-21");

  // Session state for chat persistence
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [currentPatientName, setCurrentPatientName] = useState<string>("");
  const [currentPatientPhone, setCurrentPatientPhone] = useState<string>("");
  const [sessionId] = useState<string>(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Fetch all core databases
  const refreshAllSystemData = async () => {
    try {
      const [docRes, patRes, apptRes, logRes, traceRes, campRes] = await Promise.all([
        fetch("/api/doctors"),
        fetch("/api/patients"),
        fetch("/api/appointments"),
        fetch("/api/logs"),
        fetch("/api/traces"),
        fetch("/api/campaigns")
      ]);

      if (docRes.ok) setDoctors(await docRes.json());
      if (patRes.ok) setPatients(await patRes.json());
      if (apptRes.ok) setAppointments(await apptRes.json());
      if (logRes.ok) setLatencyLogs(await logRes.json());
      if (traceRes.ok) setTraces(await traceRes.json());
      if (campRes.ok) setCampaigns(await campRes.json());
    } catch (exp) {
      console.error("Failed fetching clinical caches:", exp);
    }
  };

  useEffect(() => {
    refreshAllSystemData();
  }, []);

  // Update lists upon new trace/latencies from socket
  const handleNewBookingResult = (newTrace: Omit<TraceStep, "id" | "timestamp">, latencies: any) => {
    const timestampStr = new Date().toISOString();
    setLatencyLogs(prev => [
      {
        id: `local-log-${Date.now()}`,
        timestamp: timestampStr,
        stt: latencies.stt,
        llm: latencies.llm,
        tts: latencies.tts,
        total: latencies.total,
        textLength: newTrace.finalResponse.length
      },
      ...prev
    ]);

    setTraces(prev => [
      {
        id: `local-trace-${Date.now()}`,
        timestamp: timestampStr,
        ...newTrace
      },
      ...prev
    ]);
  };

  // Handle patient onboarding
  const handleOnboard = (name: string, phone: string, language: Language) => {
    setCurrentPatientName(name);
    setCurrentPatientPhone(phone);
    setActiveLanguage(language);
    setIsOnboarded(true);

    // Store in localStorage for persistence
    localStorage.setItem('patient_session', JSON.stringify({
      name,
      phone,
      language,
      sessionId,
      timestamp: Date.now()
    }));
  };

  // Load existing session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('patient_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Check if session is less than 30 minutes old
        if (Date.now() - session.timestamp < 30 * 60 * 1000) {
          setCurrentPatientName(session.name);
          setCurrentPatientPhone(session.phone);
          setActiveLanguage(session.language);
          setIsOnboarded(true);
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
      }
    }
  }, []);

  // Trigger Outbound VoIP campaigns
  const handleTriggerCampaign = async (id: string, status: "called" | "failed") => {
    try {
      const res = await fetch("/api/campaigns/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (res.ok) {
        refreshAllSystemData();
      }
    } catch (err) {
      console.error("VoIP trigger error:", err);
    }
  };

  // Simulate an voice input injected from other components
  const handleSimulateOutboundVoice = async (phoneNumber: string, phrase: string) => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber,
          text: phrase,
          language: Language.ENGLISH
        })
      });
      if (response.ok) {
        const details = await response.json();
        handleNewBookingResult(details.trace, details.latencies);
        refreshAllSystemData();
      }
    } catch (err) {
      console.error("Failed triggering simulated backend voice process:", err);
    }
  };

  // Tab definitions with icons
  const tabs = [
    { id: "console", label: "Voice Console", icon: Mic },
    { id: "dashboard", label: "Operations", icon: CalendarCheck },
    { id: "latency", label: "Performance", icon: LineChart },
    { id: "architecture", label: "Architecture", icon: GitBranch },
  ] as const;

  return (
    <div className="min-h-screen bg-[#050816] flex flex-col">
      
      {/* Premium Fixed Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/[0.06]">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            
            {/* Left: Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 rounded-xl blur-xl"></div>
                <div className="relative bg-gradient-to-br from-cyan-500/30 to-teal-500/30 p-2.5 rounded-xl border border-cyan-500/40">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  Aarogi Clinical Assistant
                  <span className="text-[9px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 px-2 py-0.5 rounded-full font-mono font-medium">
                    v1.2
                  </span>
                </h1>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Real-time Multilingual Clinical Voice Orchestrator</p>
              </div>
            </div>

            {/* Center: Navigation Tabs */}
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                      isActive 
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Right: System Status Pills */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 font-mono">LIVE</span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Database className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-semibold text-cyan-400 font-mono">Redis</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-white/[0.06]">
                <Cpu className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-300 font-mono">450ms</span>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-[72px] pb-8">
        <div className="max-w-[1600px] mx-auto px-6">
          
          {/* Voice Console Tab - ALWAYS MOUNTED for state persistence */}
          <div className={activeTab === "console" ? "block animate-fade-in-up" : "hidden"}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Primary Voice Console - 65% */}
              <div className="lg:col-span-3">
                <VoiceConsole
                  patients={patients}
                  onNewResult={handleNewBookingResult}
                  onRefreshData={refreshAllSystemData}
                  activeLanguage={activeLanguage}
                  setActiveLanguage={setActiveLanguage}
                  isOnboarded={isOnboarded}
                  onOnboard={handleOnboard}
                  sessionId={sessionId}
                />
              </div>
              
              {/* AI Orchestration Panel - 35% */}
              <div className="lg:col-span-2">
                <ReasoningTrace traces={traces} />
              </div>
            </div>
          </div>

          {/* Operations Tab - ALWAYS MOUNTED */}
          <div className={activeTab === "dashboard" ? "block space-y-6 animate-fade-in-up" : "hidden"}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <DoctorAvailability
                doctors={doctors}
                appointments={appointments}
                selectedDate={systemDate}
              />
              <ActiveReservations
                appointments={appointments}
                patients={patients}
                onRefresh={refreshAllSystemData}
              />
              <ActiveConversations activeConversations={activeConversations} />
            </div>
            
            <OutboundCampaigns
              campaigns={campaigns}
              onTriggerCampaign={handleTriggerCampaign}
              onRefreshData={refreshAllSystemData}
              onSimulateOutboundVoice={handleSimulateOutboundVoice}
            />
          </div>

          {/* Performance Tab - ALWAYS MOUNTED */}
          <div className={activeTab === "latency" ? "block max-w-4xl mx-auto animate-fade-in-up" : "hidden"}>
            <LatencyMonitor logs={latencyLogs} />
          </div>

          {/* Architecture Tab - ALWAYS MOUNTED */}
          <div className={activeTab === "architecture" ? "block animate-fade-in-up" : "hidden"}>
            <ArchitectureMermaid />
          </div>

        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-white/[0.06] py-4 px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <p className="text-[11px] text-slate-600 font-mono">2026 Aarogi Clinical Systems</p>
          <div className="flex items-center gap-4 text-[10px] text-slate-600 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-cyan-500"></span>
              Gemini 3.5
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-purple-500"></span>
              Redis Session
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-teal-500"></span>
              Live Context
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}