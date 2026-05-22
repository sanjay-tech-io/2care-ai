import { Patient, Doctor, Appointment, SessionData, LatencyLog, TraceStep, Campaign, Language } from "../../src/types";

// ----------------- Domain Namespaces -----------------
// We represent all data as Redis Keys:
// - Ephemeral Session: "cliSession:{phone}"
// - Patient Hash: "patient:{phone}"
// - Doctor Hash: "doctor:{id}"
// - Appointment Hash: "appointment:{id}"
// - Campaign Hash: "campaign:{id}"
// - Latency Log List: "logs:latency"
// - Trace Step List: "logs:traces"
// - Conversation History: "history:{phone}"

// ----------------- Initial Seeds -----------------

const initialDoctors: Doctor[] = [
  {
    id: "doc-1",
    name: "Dr. Priya Sharma",
    specialty: "General Medicine",
    languages: [Language.ENGLISH, Language.HINDI, Language.TAMIL],
    slots: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"]
  },
  {
    id: "doc-2",
    name: "Dr. Rajesh Patel",
    specialty: "Pediatrics",
    languages: [Language.ENGLISH, Language.HINDI, Language.TAMIL],
    slots: ["09:30 AM", "10:30 AM", "11:30 AM", "01:30 PM", "02:30 PM", "03:30 PM"]
  },
  {
    id: "doc-3",
    name: "Dr. Anita Desai",
    specialty: "Cardiology",
    languages: [Language.ENGLISH, Language.HINDI, Language.TAMIL],
    slots: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"]
  },
  {
    id: "doc-4",
    name: "Dr. Vikram Naidu",
    specialty: "Orthopedics",
    languages: [Language.ENGLISH, Language.HINDI, Language.TAMIL],
    slots: ["10:00 AM", "11:00 AM", "12:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"]
  },
  {
    id: "doc-5",
    name: "Dr. Meena Reddy",
    specialty: "Dermatology",
    languages: [Language.ENGLISH, Language.HINDI, Language.TAMIL],
    slots: ["09:00 AM", "10:30 AM", "11:30 AM", "02:00 PM", "03:30 PM", "04:30 PM"]
  },
  {
    id: "doc-6",
    name: "Dr. Anil Kumar",
    specialty: "Neurology",
    languages: [Language.ENGLISH, Language.HINDI, Language.TAMIL],
    slots: ["09:30 AM", "10:30 AM", "11:00 AM", "01:30 PM", "03:00 PM", "04:30 PM"]
  }
];

// ----------------- Redis Abstraction Engine -----------------

export class RedisService {
  private static instance: RedisService;
  private dbStore = new Map<string, { value: string; expiresAt?: number }>();

  private constructor() {
    this.seedDatabase();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private seedDatabase() {
    // Seed ONLY Doctors - they must always be available on startup
    initialDoctors.forEach(d => {
      this.hset(`doctor:${d.id}`, "data", JSON.stringify(d));
    });
  }

  // Raw Redis Command Simulation
  public async get(key: string): Promise<string | null> {
    const record = this.dbStore.get(key);
    if (!record) return null;
    if (record.expiresAt && Date.now() > record.expiresAt) {
      this.dbStore.delete(key);
      return null;
    }
    return record.value;
  }

  public async set(key: string, value: string): Promise<void> {
    this.dbStore.set(key, { value });
  }

  public async setex(key: string, seconds: number, value: string): Promise<void> {
    const expiresAt = Date.now() + seconds * 1000;
    this.dbStore.set(key, { value, expiresAt });
  }

  public async del(key: string): Promise<void> {
    this.dbStore.delete(key);
  }

  public async keys(pattern: string): Promise<string[]> {
    const rx = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    const activeKeys: string[] = [];
    for (const [k, record] of this.dbStore.entries()) {
      if (record.expiresAt && Date.now() > record.expiresAt) {
        this.dbStore.delete(k); // lazy cleanup
        continue;
      }
      if (rx.test(k)) {
        activeKeys.push(k);
      }
    }
    return activeKeys;
  }

  // Redis Hashes Sim
  public async hset(key: string, field: string, value: string): Promise<void> {
    const hashKey = `${key}#field#${field}`;
    this.dbStore.set(hashKey, { value });
  }

  public async hget(key: string, field: string): Promise<string | null> {
    const hashKey = `${key}#field#${field}`;
    return this.get(hashKey);
  }

  public async hgetall(key: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const prefix = `${key}#field#`;
    for (const [k, record] of this.dbStore.entries()) {
      if (record.expiresAt && Date.now() > record.expiresAt) {
        this.dbStore.delete(k);
        continue;
      }
      if (k.startsWith(prefix)) {
        const fieldName = k.substring(prefix.length);
        result[fieldName] = record.value;
      }
    }
    return result;
  }

  public async hdel(key: string, field: string): Promise<void> {
    const hashKey = `${key}#field#${field}`;
    this.dbStore.delete(hashKey);
  }

  // Redis Lists Sim
  public async lpush(key: string, value: string): Promise<void> {
    const listJson = await this.get(key) || "[]";
    const list: string[] = JSON.parse(listJson);
    list.unshift(value); // left push
    await this.set(key, JSON.stringify(list));
  }

  public async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const listJson = await this.get(key) || "[]";
    const list: string[] = JSON.parse(listJson);
    const end = stop < 0 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  public async ttl(key: string): Promise<number> {
    const record = this.dbStore.get(key);
    if (!record) return -2;
    if (record.expiresAt) {
      const diff = record.expiresAt - Date.now();
      if (diff <= 0) {
        this.dbStore.delete(key);
        return -2;
      }
      return Math.round(diff / 1000);
    }
    return -1;
  }

  public async expire(key: string, seconds: number): Promise<void> {
    const record = this.dbStore.get(key);
    if (record) {
      record.expiresAt = Date.now() + seconds * 1000;
    }
  }

  // ----------------- High-Level Storage API -----------------

  async getDoctors(): Promise<Doctor[]> {
     console.log("[DEBUG] dbStore keys:", Array.from(this.dbStore.keys()).slice(0, 10));
    const doctors: Doctor[] = [];
    for (const [k] of this.dbStore.entries()) {
      if (k.startsWith("doctor:") && k.endsWith("#field#data")) {
        const record = this.dbStore.get(k);
        if (record) doctors.push(JSON.parse(record.value));
      }
    }
    return doctors.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getPatients(): Promise<Patient[]> {
    const patients: Patient[] = [];
    for (const [k] of this.dbStore.entries()) {
      if (k.startsWith("patient:") && k.endsWith("#field#data")) {
        const record = this.dbStore.get(k);
        if (record) patients.push(JSON.parse(record.value));
      }
    }
    return patients.sort((a, b) => a.id.localeCompare(b.id));
  }

async getAppointments(): Promise<Appointment[]> {
    const appts: Appointment[] = [];
    for (const [k] of this.dbStore.entries()) {
      if (k.startsWith("appointment:") && k.endsWith("#field#data")) {
        const record = this.dbStore.get(k);
        if (record) appts.push(JSON.parse(record.value));
      }
    }
    return appts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

async getCampaigns(): Promise<Campaign[]> {
    const campaigns: Campaign[] = [];
    for (const [k] of this.dbStore.entries()) {
      if (k.startsWith("campaign:") && k.endsWith("#field#data")) {
        const record = this.dbStore.get(k);
        if (record) campaigns.push(JSON.parse(record.value));
      }
    }
    return campaigns.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getLogs(): Promise<LatencyLog[]> {
    const list = await this.lrange("logs:latency", 0, 50);
    return list.map(item => JSON.parse(item));
  }

  async getTraces(): Promise<TraceStep[]> {
    const list = await this.lrange("logs:traces", 0, 50);
    return list.map(item => JSON.parse(item));
  }

  // Query API
  async findPatientByPhone(phone: string): Promise<Patient | null> {
    const data = await this.hget(`patient:${phone}`, "data");
    return data ? JSON.parse(data) : null;
  }

  async savePatient(patient: Patient): Promise<Patient> {
    let finalPatient = { ...patient };
    if (!finalPatient.id) {
      finalPatient.id = `pat-${Date.now()}`;
    }
    await this.hset(`patient:${finalPatient.phone}`, "data", JSON.stringify(finalPatient));

    // BUG 2 FIX: Removed auto-creation of follow-up campaign
    // Only the appointment reminder campaign should be created (in createAppointment)

    return finalPatient;
  }

  async findDoctorById(id: string): Promise<Doctor | null> {
    const data = await this.hget(`doctor:${id}`, "data");
    return data ? JSON.parse(data) : null;
  }

  async findAppointmentsByPhone(phone: string): Promise<Appointment[]> {
    const appts = await this.getAppointments();
    return appts.filter(x => x.patientPhone === phone && x.status === "scheduled");
  }

  async createAppointment(appt: Omit<Appointment, "id" | "createdAt">): Promise<Appointment> {
    const id = `appt-${Math.floor(100 + Math.random() * 900)}`;
    const newAppt: Appointment = {
      ...appt,
      id,
      createdAt: new Date().toISOString()
    };
    await this.hset(`appointment:${id}`, "data", JSON.stringify(newAppt));

    // BUG 2 FIX PART D: Check if campaign already exists before creating
    const existingCampaigns = await this.getCampaigns();
    const existing = existingCampaigns.find(c => 
      c.patientPhone === newAppt.patientPhone && 
      c.date === newAppt.date &&
      c.doctorName === newAppt.doctorName
    );
    
    if (!existing) {
      // Only create campaign if one doesn't already exist for this booking
      const reminderCampaign: Campaign = {
        id: `camp-${Date.now()}`,
        patientName: newAppt.patientName,
        patientPhone: newAppt.patientPhone,
        doctorName: newAppt.doctorName,
        date: newAppt.date,
        time: newAppt.time,
        type: "reminder",
        details: `Appointment confirmed with ${newAppt.doctorName} on ${newAppt.date} at ${newAppt.time}.`,
        status: "pending"
      };
      await this.hset(`campaign:${reminderCampaign.id}`, "data", JSON.stringify(reminderCampaign));
    }

    return newAppt;
  }

  async updateAppointmentStatus(id: string, status: "scheduled" | "cancelled" | "completed"): Promise<boolean> {
    const data = await this.hget(`appointment:${id}`, "data");
    if (data) {
      const appt: Appointment = JSON.parse(data);
      appt.status = status;
      await this.hset(`appointment:${id}`, "data", JSON.stringify(appt));
      return true;
    }
    return false;
  }

  async rescheduleAppointment(id: string, date: string, time: string): Promise<Appointment | null> {
    const data = await this.hget(`appointment:${id}`, "data");
    if (data) {
      const appt: Appointment = JSON.parse(data);
      appt.date = date;
      appt.time = time;
      appt.status = "scheduled";
      await this.hset(`appointment:${id}`, "data", JSON.stringify(appt));
      return appt;
    }
    return null;
  }

  // Logging API
  async addLatencyLog(log: Omit<LatencyLog, "id" | "timestamp">): Promise<LatencyLog> {
    const newLog: LatencyLog = {
      ...log,
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    await this.lpush("logs:latency", JSON.stringify(newLog));
    return newLog;
  }

  async addTraceStep(trace: Omit<TraceStep, "id" | "timestamp">): Promise<TraceStep> {
    const newTrace: TraceStep = {
      ...trace,
      id: `trace-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    await this.lpush("logs:traces", JSON.stringify(newTrace));
    return newTrace;
  }

  async triggerCampaignCall(id: string, status: "called" | "failed"): Promise<Campaign | null> {
    const data = await this.hget(`campaign:${id}`, "data");
    if (data) {
      const camp: Campaign = JSON.parse(data);
      camp.status = status;
      await this.hset(`campaign:${id}`, "data", JSON.stringify(camp));
      return camp;
    }
    return null;
  }
}

export const redisStore = RedisService.getInstance();
