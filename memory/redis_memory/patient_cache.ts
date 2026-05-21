import { redisStore } from "../../database/redis/redis_service";
import { Patient, Language } from "../../src/types";

export class PatientCache {
  /**
   * Persists customer preferred attributes in Redis
   */
  public async syncPatientProfile(phone: string, updates: Partial<Patient>): Promise<Patient> {
    let patient = await redisStore.findPatientByPhone(phone);
    if (!patient) {
      // Build a standard record
      patient = {
        id: `pat-${Date.now()}`,
        name: updates.name || "New Clinic Patient",
        phone,
        email: `${(updates.name || "patient").toLowerCase().replace(/\s+/g, "")}@example.com`,
        preferredLanguage: updates.preferredLanguage || Language.ENGLISH,
        preferredDoctorId: updates.preferredDoctorId,
        age: updates.age || 30,
        gender: updates.gender || "Unknown"
      };
    } else {
      // update fields
      patient = {
        ...patient,
        ...updates
      };
    }

    await redisStore.savePatient(patient);
    return patient;
  }

  public async getPatientLanguage(phone: string, defaultLanguage: Language = Language.ENGLISH): Promise<Language> {
    const p = await redisStore.findPatientByPhone(phone);
    return p ? p.preferredLanguage : defaultLanguage;
  }
}

export const patientCache = new PatientCache();
