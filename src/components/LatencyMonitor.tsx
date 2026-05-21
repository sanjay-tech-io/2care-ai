import { LatencyLog } from "../types";
import { Zap, Clock, TrendingUp, BarChart2, ShieldAlert } from "lucide-react";

interface Props {
  logs: LatencyLog[];
}

export default function LatencyMonitor({ logs }: Props) {
  // Compute average latencies
  const totals = logs.reduce((acc, log) => {
    acc.stt += log.stt;
    acc.llm += log.llm;
    acc.tts += log.tts;
    acc.total += log.total;
    return acc;
  }, { stt: 0, llm: 0, tts: 0, total: 0 });

  const count = logs.length || 1;
  const avgStt = Math.round(totals.stt / count);
  const avgLlm = Math.round(totals.llm / count);
  const avgTts = Math.round(totals.tts / count);
  const avgTotal = Math.round(totals.total / count);

  // SVG Chart Dimensions & Coordinates
  const chartHeight = 120;
  const chartWidth = 500;

  // Render SVG Line logic for last 10 logs
  const displayLogs = [...logs].reverse().slice(-10); // get last 10 chronologically
  const maxVal = Math.max(...displayLogs.map(l => l.total), 1000); // at least scale to 1s

  const getPoints = () => {
    if (displayLogs.length === 0) return "";
    return displayLogs.map((log, index) => {
      const x = (index / (displayLogs.length - 1 || 1)) * (chartWidth - 40) + 20;
      const y = chartHeight - ((log.total / maxVal) * (chartHeight - 20) + 10);
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <div className="bg-[#121214] rounded-2xl shadow-xl border border-slate-800 p-6 flex flex-col gap-6">
      
      {/* Average KPI grid */}
      <div>
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-550 animate-pulse" />
              SLA Pipeline Latency Monitor
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">Live benchmarking of individual AI audio call pipeline stages</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/45">
            <span className="text-[10px] uppercase font-bold text-slate-500">STT Stage</span>
            <div className="text-lg font-bold font-mono text-slate-200 mt-1">{avgStt} ms</div>
            <p className="text-[9px] text-slate-500 mt-0.5">Whisper-V3 Emulation</p>
          </div>

          <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/45">
            <span className="text-[10px] uppercase font-bold text-slate-500">LLM Processing</span>
            <div className="text-lg font-bold font-mono text-slate-200 mt-1">{avgLlm} ms</div>
            <p className="text-[9px] text-slate-500 mt-0.5">Gemini 2.5 Flash</p>
          </div>

          <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/45">
            <span className="text-[10px] uppercase font-bold text-slate-500">TTS Rendering</span>
            <div className="text-lg font-bold font-mono text-slate-200 mt-1">{avgTts} ms</div>
            <p className="text-[9px] text-slate-500 mt-0.5">Vocalis Core Synth</p>
          </div>

          <div className="border border-cyan-900 rounded-xl p-3 bg-cyan-950/20">
            <span className="text-[10px] uppercase font-bold text-cyan-400">Total Latency</span>
            <div className="text-lg font-bold font-mono text-cyan-300 mt-1">{avgTotal} ms</div>
            <p className="text-[9px] text-cyan-500 mt-0.5">Roundtrip SLA</p>
          </div>

        </div>
      </div>

      {/* SVG Historical line chart */}
      <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/45">
        <h4 className="text-xs font-semibold text-slate-350 mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-cyan-500" />
          Outbound Roundtrip Latency SLA Trend (Last {displayLogs.length} responses)
        </h4>

        {displayLogs.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-slate-600 text-xs font-mono italic">
            waiting to capture call metrics...
          </div>
        ) : (
          <div className="relative">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-[120px] overflow-visible"
            >
              {/* grid lines */}
              <line x1="10" y1={chartHeight/2} x2={chartWidth-10} y2={chartHeight/2} stroke="#334155" strokeDasharray="4 4" />
              <line x1="10" y1={chartHeight - 10} x2={chartWidth-10} y2={chartHeight - 10} stroke="#1e293b" />

              {/* Data line */}
              <polyline
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2.5"
                points={getPoints()}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Circles on Nodes */}
              {displayLogs.map((log, index) => {
                const x = (index / (displayLogs.length - 1 || 1)) * (chartWidth - 40) + 20;
                const y = chartHeight - ((log.total / maxVal) * (chartHeight - 20) + 10);
                return (
                  <g key={log.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#06b6d4"
                      stroke="#121214"
                      strokeWidth="1.5"
                    />
                    <text
                      x={x}
                      y={y - 8}
                      fontSize="7"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fill="#a1a1aa"
                      fontWeight="bold"
                    >
                      {log.total}ms
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Latency Log records table */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-cyan-600" />
          Raw Verification Execution Log Entries
        </h4>

        <div className="max-h-36 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/20 text-xs">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-slate-650 text-xs font-mono">No telemetry metrics entries captured currently.</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-[#121214] text-[10px] text-slate-500 uppercase font-mono">
                  <th className="p-2 pl-3">No.</th>
                  <th className="p-2 font-mono">STT</th>
                  <th className="p-2 font-mono">LLM</th>
                  <th className="p-2 font-mono">TTS</th>
                  <th className="p-2 font-mono text-cyan-500">Total</th>
                  <th className="p-2 pr-3 text-right">Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-[10px] text-slate-400 bg-slate-950/45">
                {logs.map((l, idx) => (
                  <tr key={l.id} className="hover:bg-slate-900/50">
                    <td className="p-2 pl-3 text-slate-600">#{logs.length - idx}</td>
                    <td className="p-2">{l.stt}ms</td>
                    <td className="p-2">{l.llm}ms</td>
                    <td className="p-2">{l.tts}ms</td>
                    <td className="p-2 font-bold text-cyan-400">{l.total}ms</td>
                    <td className="p-2 pr-3 text-right">{l.textLength} chars</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
