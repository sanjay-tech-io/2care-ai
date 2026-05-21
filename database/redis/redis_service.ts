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

const initialPatients: Patient[] = [
  {
    id: "pat-1",
    name: "Sanjay Kumar",
    phone: "9876543210",
    email: "sanjay@gmail.com",
    preferredLanguage: Language.TAMIL,
    preferredDoctorId: "doc-1",
    age: 34,
    gender: "Male"
  },
  {
    id: "pat-2",
    name: "Rajesh Khanna",
    phone: "8765432109",
    email: "rajesh@yahoo.com",
    preferredLanguage: Language.HINDI,
    preferredDoctorId: "doc-2",
    age: 45,
    gender: "Male"
  },
  {
    id: "pat-3",
    name: "Alicia Smith",
    phone: "7654321098",
    email: "alicia@outlook.com",
    preferredLanguage: Language.ENGLISH,
    preferredDoctorId: "doc-3",
    age: 28,
    gender: "Female"
  }
];

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
    languages: [Language.ENGLISH, Language.HINDI],
    slots: ["09:30 AM", "10:30 AM", "11:30 AM", "01:30 PM", "02:30 PM", "03:30 PM"]
  },
  {
    id: "doc-3",
    name: "Dr. Anita Desai",
    specialty: "Cardiology",
    languages: [Language.ENGLISH, Language.TAMIL],
    slots: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"]
  },
  {
    id: "doc-4",
    name: "Dr. Vikram Naidu",
    specialty: "Orthopedics",
    languages: [Language.ENGLISH, Language.HINDI, Language.TAMIL],
    slots: ["10:00 AM", "11:00 AM", "12:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"]
  }
];

const initialAppointments: Appointment[] = [
  {
    id: "appt-101",
    patientPhone: "9876543210",
    patientName: "Sanjay Kumar",
    doctorId: "doc-1",
    doctorName: "Dr. Priya Sharma",
    specialty: "General Medicine",
    date: "2026-05-22",
    time: "10:00 AM",
    status: "scheduled",
    createdAt: new Date().toISOString()
  },
  {
    id: "appt-102",
    patientPhone: "8765432109",
    patientName: "Rajesh Khanna",
    doctorId: "doc-2",
    doctorName: "Dr. Rajesh Patel",
    specialty: "Pediatrics",
    date: "2026-05-23",
    time: "10:30 AM",
    status: "scheduled",
    createdAt: new Date().toISOString()
  }
];

const initialCampaigns: Campaign[] = [
  {
    id: "camp-101",
    patientName: "Sanjay Kumar",
    patientPhone: "9876543210",
    doctorName: "Dr. Priya Sharma",
    date: "2026-05-22",
    time: "10:00 AM",
    type: "reminder",
    details: "Appointment Reminder: Tomorrow at 10:00 AM.",
    status: "pending"
  },
  {
    id: "camp-102",
    patientName: "Rajesh Khanna",
    patientPhone: "8765432109",
    doctorName: "Dr. Rajesh Patel",
    date: "2026-05-23",
    time: "10:30 AM",
    type: "reminder",
    details: "Vaccination Slot: DPT Pfizer available.",
    status: "pending"
  },
  {
    id: "camp-103",
    patientName: "Alicia Smith",
    patientPhone: "7654321098",
    doctorName: "Dr. Anita Desai",
    date: "2026-05-25",
    time: "02:00 PM",
    type: "follow-up",
    details: "Cardiac screening checkup reminder.",
    status: "pending"
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
    // Seed Patients
    initialPatients.forEach(p => {
      this.hset(`patient:${p.phone}`, "data", JSON.stringify(p));
    });

    // Seed Doctors
    initialDoctors.forEach(d => {
      this.hset(`doctor:${d.id}`, "data", JSON.stringify(d));
    });

    // Seed Appointments
    initialAppointments.forEach(a => {
      this.hset(`appointment:${a.id}`, "data", JSON.stringify(a));
    });

    // Seed Campaigns
    initialCampaigns.forEach(c => {
      this.hset(`campaign:${c.id}`, "data", JSON.stringify(c));
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
    const docKeys = await this.keys("doctor:*");
    const doctors: Doctor[] = [];
    for (const k of docKeys) {
      const data = await this.hget(k, "data");
      if (data) doctors.push(JSON.parse(data));
    }
    return doctors.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getPatients(): Promise<Patient[]> {
    const patKeys = await this.keys("patient:*");
    const patients: Patient[] = [];
    for (const k of patKeys) {
      const data = await this.hget(k, "data");
      if (data) patients.push(JSON.parse(data));
    }
    return patients.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getAppointments(): Promise<Appointment[]> {
    const apptKeys = await this.keys("appointment:*");
    const appts: Appointment[] = [];
    for (const k of apptKeys) {
      const data = await this.hget(k, "data");
      if (data) appts.push(JSON.parse(data));
    }
    return appts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCampaigns(): Promise<Campaign[]> {
    const campKeys = await this.keys("campaign:*");
    const campaigns: Campaign[] = [];
    for (const k of campKeys) {
      const data = await this.hget(k, "data");
      if (data) campaigns.push(JSON.parse(data));
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
