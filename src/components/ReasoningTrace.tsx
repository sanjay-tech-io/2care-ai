import { useState } from "react";
import { TraceStep } from "../types";
import { 
  Terminal, 
  Box, 
  Cpu, 
  HardDrive, 
  Settings, 
  ActivitySquare, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  BrainCircuit,
  Workflow,
  Database,
  Clock3,
  Sparkles,
  Eye,
  EyeOff
} from "lucide-react";

interface Props {
  traces: TraceStep[];
}

function tryFormatJson(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr || "{}");
    return JSON.stringify(parsed, null, 2);
  } catch (err) {
    return jsonStr || "";
  }
}

interface TraceCardProps {
  trace: TraceStep;
  index: number;
}

function TraceCard({ trace, index }: TraceCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-[#101827] rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${
            trace.selectedTool !== "none" 
              ? "bg-cyan-500/20 border border-cyan-500/30" 
              : "bg-purple-500/20 border border-purple-500/30"
          }`}>
            {trace.selectedTool !== "none" ? (
              <Workflow className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Trace #{index + 1}</span>
              <span className="text-[10px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30">
                {trace.languageDetected}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {new Date(trace.timestamp).toLocaleTimeString()} • {trace.detectedIntent}
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Intent Detection */}
          <div className="pt-2 border-t border-white/[0.05]">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-cyan-500" />
              <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wide">Intent Detection</span>
            </div>
            <p className="text-xs text-slate-300 font-mono bg-slate-900/50 p-2 rounded-lg">
              {trace.detectedIntent}
            </p>
          </div>

          {/* Redis Memory Retrieval */}
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Redis Session Memory</span>
          </div>
          <pre className="text-[10px] text-purple-300 font-mono bg-slate-900/50 p-2 rounded-lg overflow-x-auto max-h-24">
            {tryFormatJson(trace.retrievedMemory)}
          </pre>

          {/* Tool Invocation */}
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">Tool Invocation</span>
          </div>
          <div className="text-xs font-mono bg-slate-900/50 p-2 rounded-lg">
            {trace.selectedTool !== "none" ? (
              <span className="text-amber-400">{trace.selectedTool}()</span>
            ) : (
              <span className="text-slate-500 italic">Pure Dialogue (No Tool)</span>
            )}
          </div>

          {/* Tool Results */}
          {trace.toolResults && trace.toolResults !== "none" && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Box className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">Execution Result</span>
              </div>
              <pre className="text-[10px] text-emerald-300 font-mono bg-slate-900/50 p-2 rounded-lg overflow-x-auto max-h-24">
                {trace.toolResults}
              </pre>
            </>
          )}

          {/* Final Response */}
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Response Payload</span>
          </div>
          <div className="text-xs text-slate-200 bg-slate-900/50 p-2 rounded-lg italic leading-relaxed">
            "{trace.finalResponse}"
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReasoningTrace({ traces }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayedTraces = showAll ? traces : traces.slice(0, 5);

  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] flex flex-col h-[640px]">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/30 rounded-full animate-pulse"></div>
              <div className="relative p-2 bg-purple-500/20 rounded-full border border-purple-500/40">
                <BrainCircuit className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Orchestration Stream</h3>
              <p className="text-[10px] text-slate-500">Live reasoning trace logs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            <span className="text-[10px] font-mono text-purple-400 font-medium">LIVE</span>
          </div>
        </div>
      </div>

      {/* Trace Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {traces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-2xl"></div>
              <Terminal className="w-10 h-10 text-purple-500/60 relative" />
            </div>
            <span className="text-sm font-medium text-slate-400">Awaiting traces</span>
            <span className="text-[11px] text-slate-600 mt-1">Intelligence will appear here after interactions</span>
          </div>
        ) : (
          <>
            {displayedTraces.map((trace, idx) => (
              <TraceCard 
                key={trace.id} 
                trace={trace} 
                index={idx} 
              />
            ))}
            
            {traces.length > 5 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-3 text-xs text-slate-400 hover:text-white border border-white/[0.06] rounded-xl hover:bg-white/[0.02] transition-colors"
              >
                Show {traces.length - 5} more traces
              </button>
            )}
          </>
        )}
      </div>

    </div>
  );
}