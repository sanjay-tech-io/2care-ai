import { Appointment, Patient } from "../types";
import { 
  Clock, 
  Phone, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Database,
  User,
  Stethoscope,
  Calendar
} from "lucide-react";

interface Props {
  appointments: Appointment[];
  patients: Patient[];
  onRefresh: () => void;
}

export default function ActiveReservations({ appointments, patients, onRefresh }: Props) {
  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] p-5 flex flex-col gap-5">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Appointment Registry</h3>
            <p className="text-[10px] text-slate-500">Live scheduling reservations</p>
          </div>
        </div>
        <button 
          onClick={onRefresh}
          className="text-[10px] text-cyan-400 font-medium hover:border-cyan-500 border border-white/[0.06] bg-slate-900/50 px-3 py-1.5 rounded-lg transition-all"
        >
          Sync
        </button>
      </div>

      {/* Appointments Table */}
      <div className="overflow-x-auto">
        {appointments.length === 0 ? (
          <div className="border border-dashed border-white/[0.06] rounded-xl p-8 text-center text-slate-500 text-xs">
            No active reservations found.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-2 pl-2">ID</th>
                <th className="py-2">Patient</th>
                <th className="py-2">Doctor</th>
                <th className="py-2 font-mono">Date / Time</th>
                <th className="py-2 pr-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs text-slate-300">
              {appointments.map(appt => (
                <tr key={appt.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 font-mono text-[9px] text-slate-600 pl-2">{appt.id.substring(0, 8)}</td>
                  <td className="py-2.5">
                    <div className="font-medium text-slate-200">{appt.patientName}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-600" /> {appt.patientPhone}
                    </div>
                  </td>
                  <td className="py-2.5">
                    <div className="text-slate-300 font-medium">{appt.doctorName}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{appt.specialty}</div>
                  </td>
                  <td className="py-2.5 font-mono text-slate-400">
                    <div>{appt.date}</div>
                    <div className="text-[10px] text-cyan-400 font-semibold">{appt.time}</div>
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold tracking-tight uppercase ${
                      appt.status === "scheduled" 
                        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" 
                        : appt.status === "cancelled"
                        ? "bg-red-500/15 text-red-400 border-red-500/30"
                        : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    }`}>
                      {appt.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Patient Registry */}
      <div className="border-t border-white/[0.06] pt-4">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-500" />
          Patient Registry (Redis)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {patients.map(p => (
            <div key={p.id} className="bg-[#101827] border border-white/[0.06] rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-slate-200 text-xs">{p.name}</span>
                  <span className="text-[9px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded font-medium font-mono uppercase">
                    {p.preferredLanguage}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1.5">Age: {p.age} • {p.gender}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-600" /> {p.phone}
                </div>
              </div>
              <div className="text-[8px] text-slate-700 mt-2 pt-2 border-t border-white/[0.04] font-mono">
                ID: {p.id.substring(0, 8)}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}