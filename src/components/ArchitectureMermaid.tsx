import { 
  FileText, 
  Cpu, 
  Server, 
  Shield, 
  Database, 
  Layout,
  Globe,
  Mic,
  Volume2,
  Workflow,
  Zap,
  BrainCircuit,
  HardDrive,
  Clock3,
  ArrowRight,
  Layers
} from "lucide-react";

export default function ArchitectureMermaid() {
  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] p-6 space-y-6">
      
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-500" />
          System Architecture
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">Real-time Voice AI Pipeline Architecture</p>
      </div>

      {/* Interactive Pipeline Visualization */}
      <div className="border border-cyan-900/20 bg-[#050816]/50 rounded-xl p-5">
        <h4 className="text-xs font-semibold text-cyan-400 mb-4 flex items-center gap-2">
          <Workflow className="w-4 h-4" />
          Voice Processing Pipeline
        </h4>

        {/* Vertical Flow */}
        <div className="relative">
          {/* Client Layer */}
          <div className="flex justify-center">
            <div className="flex items-center gap-4 bg-[#101827] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Mic className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-medium text-white">Client Input</div>
                <div className="text-[10px] text-slate-500">Browser Speech API</div>
              </div>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center py-2">
            <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
          </div>

          {/* WebSocket Layer */}
          <div className="flex justify-center">
            <div className="flex items-center gap-4 bg-[#101827] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Server className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-xs font-medium text-white">WebSocket Broker</div>
                <div className="text-[10px] text-slate-500">Express /api/voice</div>
              </div>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center py-2">
            <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
          </div>

          {/* LLM Orchestrator */}
          <div className="flex justify-center">
            <div className="flex items-center gap-4 bg-[#0c4a6e]/30 border border-cyan-500/30 rounded-xl px-4 py-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <BrainCircuit className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-medium text-white">Gemini Orchestrator</div>
                <div className="text-[10px] text-cyan-400">Tool-Calling Engine</div>
              </div>
            </div>
          </div>

          {/* Split Arrows */}
          <div className="flex justify-center py-2">
            <div className="flex gap-8">
              <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
              <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
            </div>
          </div>

          {/* Bottom Row: Redis + Tools */}
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-4 bg-[#1e1b4b]/30 border border-indigo-500/30 rounded-xl px-4 py-3">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="text-xs font-medium text-white">Redis Context</div>
                <div className="text-[10px] text-indigo-400">Session Memory (TTL: 30m)</div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-amber-900/20 border border-amber-500/30 rounded-xl px-4 py-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-xs font-medium text-white">Tools</div>
                <div className="text-[10px] text-amber-400">Booking Engine</div>
              </div>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center py-2">
            <ArrowRight className="w-4 h-4 text-slate-600 rotate-90" />
          </div>

          {/* TTS Output */}
          <div className="flex justify-center">
            <div className="flex items-center gap-4 bg-[#101827] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Volume2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-medium text-white">Audio Output</div>
                <div className="text-[10px] text-slate-500">TTS Synthesis</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Specs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Redis Specs */}
        <div className="border border-white/[0.06] p-4 rounded-xl bg-[#101827]/50">
          <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
            Redis Context Engine
          </h4>
          <p className="text-[11px] leading-relaxed mt-2 text-slate-400">
            Ephemeral session storage with automatic 30-minute TTL. Holds active intent, 
            pending confirmations, patient context, and booking state. Reduces LLM 
            token overhead and enables sub-450ms response cycles.
          </p>
        </div>

        {/* LLM Specs */}
        <div className="border border-white/[0.06] p-4 rounded-xl bg-[#101827]/50">
          <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-2 uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span>
            Gemini 2.5 Flash
          </h4>
          <p className="text-[11px] leading-relaxed mt-2 text-slate-400">
            Dynamic tool-calling model with multi-turn conversation memory. 
            Supports Hindi, Tamil, and English with automatic language detection 
            and cultural context awareness.
          </p>
        </div>

      </div>

      {/* Tool Calls */}
      <div className="border border-white/[0.06] p-4 rounded-xl bg-[#101827]/50">
        <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider mb-3">
          <Zap className="w-4 h-4" />
          Available Tool Functions
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          {["check_availability", "book_appointment", "reschedule_appointment", "cancel_appointment"].map(tool => (
            <div key={tool} className="bg-slate-900/50 border border-white/[0.06] px-2 py-1.5 rounded text-slate-400 font-mono">
              {tool}()
            </div>
          ))}
        </div>
      </div>

      {/* Additional Pipeline Components */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Multilingual Pipeline */}
        <div className="border border-white/[0.06] p-4 rounded-xl bg-[#101827]/50">
          <h4 className="text-xs font-bold text-purple-400 flex items-center gap-2 uppercase tracking-wider mb-2">
            <Globe className="w-4 h-4" />
            Multilingual Engine
          </h4>
          <div className="text-[10px] space-y-1 text-slate-400">
            <div className="flex justify-between">
              <span>English</span>
              <span className="text-emerald-400">en-US</span>
            </div>
            <div className="flex justify-between">
              <span>Hindi</span>
              <span className="text-emerald-400">hi-IN</span>
            </div>
            <div className="flex justify-between">
              <span>Tamil</span>
              <span className="text-emerald-400">ta-IN</span>
            </div>
          </div>
        </div>

        {/* Outbound Campaign Engine */}
        <div className="border border-white/[0.06] p-4 rounded-xl bg-[#101827]/50">
          <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-2 uppercase tracking-wider mb-2">
            <Workflow className="w-4 h-4" />
            Outbound Engine
          </h4>
          <div className="text-[10px] space-y-1 text-slate-400">
            <div className="flex justify-between">
              <span>Campaign Queue</span>
              <span className="text-cyan-400">Active</span>
            </div>
            <div className="flex justify-between">
              <span>Reminder Triggers</span>
              <span className="text-cyan-400">Automated</span>
            </div>
            <div className="flex justify-between">
              <span>Status Tracking</span>
              <span className="text-cyan-400">Real-time</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="border border-white/[0.06] p-4 rounded-xl bg-[#101827]/50">
          <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider mb-2">
            <Clock3 className="w-4 h-4" />
            Latency Targets
          </h4>
          <div className="text-[10px] space-y-1 text-slate-400">
            <div className="flex justify-between">
              <span>STT</span>
              <span className="text-emerald-400">{"<150ms"}</span>
            </div>
            <div className="flex justify-between">
              <span>LLM</span>
              <span className="text-emerald-400">{"<250ms"}</span>
            </div>
            <div className="flex justify-between">
              <span>TTS</span>
              <span className="text-emerald-400">{"<100ms"}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
