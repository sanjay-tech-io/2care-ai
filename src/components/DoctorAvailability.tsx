import { useState, useEffect } from "react";
import { Doctor, Appointment } from "../types";
import { 
  Sparkles, 
  Languages, 
  Check, 
  CalendarDays,
  Stethoscope,
  Clock,
  UserRound
} from "lucide-react";

interface Props {
  doctors: Doctor[];
  appointments: Appointment[];
  selectedDate: string;
}

export default function DoctorAvailability({ doctors, appointments, selectedDate }: Props) {
  // Compute how many actual slots are booked per doctor on selectedDate
  const getBookedSlots = (doctorId: string) => {
    return appointments
      .filter(a => a.doctorId === doctorId && a.date === selectedDate && a.status === "scheduled")
      .map(a => a.time);
  };

  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
            <Stethoscope className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Doctor Rotations</h3>
            <p className="text-[10px] text-slate-500">Active diagnostic rosters</p>
          </div>
        </div>
        <span className="text-xs bg-slate-900/50 border border-white/[0.06] text-slate-400 px-3 py-1 rounded-full font-mono font-medium">
          {selectedDate}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {doctors.map(doc => {
          const booked = getBookedSlots(doc.id);
          // BUG 1 FIX: Only show available slots, not all slots
          const availableSlots = doc.slots.filter(slot => !booked.includes(slot));
          return (
            <div 
              key={doc.id} 
              className="border border-white/[0.06] rounded-xl p-4 bg-[#101827]/50 hover:bg-[#101827]/70 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm tracking-tight">{doc.name}</h4>
                  <span className="text-[10px] font-medium text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded mt-1 inline-block uppercase tracking-wider">
                    {doc.specialty}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-600">ID: {doc.id}</span>
              </div>

              {/* BUG 3 FIX: Removed language display - all doctors support all languages by default */}

              {/* Slots List - BUG 1 FIX: Show only available slots */}
              <div className="mt-4">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">
                  Available Slots ({availableSlots.length})
                </span>
                <div className="flex flex-wrap gap-1.5 font-sans">
                  {availableSlots.length > 0 ? (
                    availableSlots.map(slot => (
                      <span
                        key={slot}
                        className="text-[9px] px-2 py-1 rounded border font-mono bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-medium"
                      >
                        {slot}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-red-400 font-medium">No slots available</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}