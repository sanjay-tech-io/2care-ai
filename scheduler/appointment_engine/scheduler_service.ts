import { redisStore } from "../../database/redis/redis_service";
import { Appointment, Language } from "../../src/types";

const SYSTEM_TODAY = "2026-05-21";

export class SchedulerService {
  /**
   * Validate if doctor exists and has availability on the given date/time slot
   */
  public async getAvailableSlots(doctorId: string, date: string): Promise<{
    success: boolean;
    doctorName?: string;
    specialty?: string;
    slots: string[];
    message: string;
  }> {
    if (date < SYSTEM_TODAY) {
      return {
        success: false,
        slots: [],
        message: `Validation Error: The requested date (${date}) is in the past. Current clinical system date is ${SYSTEM_TODAY}.`
      };
    }

    const doctor = await redisStore.findDoctorById(doctorId);
    if (!doctor) {
      return {
        success: false,
        slots: [],
        message: `Error: Doctor with ID '${doctorId}' does not exist.`
      };
    }

    const appts = await redisStore.getAppointments();
    const bookedSlots = appts
      .filter(x => x.doctorId === doctorId && x.date === date && x.status === "scheduled")
      .map(x => x.time);

    const freeSlots = doctor.slots.filter(slot => !bookedSlots.includes(slot));

    return {
      success: true,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      slots: freeSlots,
      message: freeSlots.length > 0
        ? `Doctor '${doctor.name}' has these slots available on ${date}: ${freeSlots.join(", ")}`
        : `Doctor '${doctor.name}' is fully occupied on ${date}.`
    };
  }

  /**
   * Safe schedule handler with strict validations
   */
  public async bookAppointment(params: {
    patientPhone: string;
    patientName: string;
    doctorId: string;
    date: string;
    time: string;
  }): Promise<{
    success: boolean;
    appointment?: Appointment;
    message: string;
    reason?: string;
    suggestedSlots?: string[];
  }> {
    const { patientPhone, patientName, doctorId, date, time } = params;

    // 1. Past dates prevention
    if (date < SYSTEM_TODAY) {
      return {
        success: false,
        message: `Cannot schedule appointment. The date ${date} is in the past. Today's date is ${SYSTEM_TODAY}.`
      };
    }

    const doctor = await redisStore.findDoctorById(doctorId);
    if (!doctor) {
      return {
        success: false,
        message: `Cannot schedule appointment. Doctor with ID '${doctorId}' does not exist.`
      };
    }

    // 2. Doctor slot validation: Is the slot part of the doctor's roster?
    if (!doctor.slots.includes(time)) {
      return {
        success: false,
        message: `Dr. ${doctor.name} does not construct consulting sessions at ${time}. Standard slots: ${doctor.slots.join(", ")}`
      };
    }

    // 3. Redis slot lock check (Issue 3)
    const slotKey = `slot:${doctorId}:${date}:${time}`;
    const existingLock = await redisStore.get(slotKey);
    if (existingLock) {
      const appts = await redisStore.getAppointments();
      const bookedSlots = appts
        .filter(x => x.doctorId === doctorId && x.date === date && x.status === "scheduled")
        .map(x => x.time);
      const freeSlots = doctor.slots.filter(s => !bookedSlots.includes(s));

      return {
        success: false,
        reason: "double_booking",
        message: `Slot Conflict: Dr. ${doctor.name} is already booked at ${time} on ${date}.`,
        suggestedSlots: freeSlots
      };
    }

    // 4. Register patient if they don't exist
    let patient = await redisStore.findPatientByPhone(patientPhone);
    if (!patient) {
      patient = {
        id: "",
        name: patientName,
        phone: patientPhone,
        email: `${patientName.toLowerCase().replace(/\s+/g, "")}@example.com`,
        preferredLanguage: doctor.languages[0] || Language.ENGLISH,
        preferredDoctorId: doctorId,
        age: 30,
        gender: "Unknown"
      };
      await redisStore.savePatient(patient);
    }

    // 5. Lock the slot in Redis
    await redisStore.set(slotKey, patientPhone);

    // 6. Create appointment
    const appointment = await redisStore.createAppointment({
      patientPhone,
      patientName,
      doctorId,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      date,
      time,
      status: "scheduled"
    });

    return {
      success: true,
      appointment,
      message: `Appointment successfully booked with ${doctor.name} for ${date} at ${time}. Appointment ID is ${appointment.id}.`
    };
  }

  /**
   * Reschedule safely with active checks
   */
  public async rescheduleAppointment(params: {
    appointmentId: string;
    newDate: string;
    newTime: string;
  }): Promise<{
    success: boolean;
    appointment?: Appointment;
    message: string;
    reason?: string;
    suggestedSlots?: string[];
  }> {
    const { appointmentId, newDate, newTime } = params;

    if (newDate < SYSTEM_TODAY) {
      return {
        success: false,
        message: `Cannot reschedule. The targeted date (${newDate}) is in the past. Minimum operational system date is ${SYSTEM_TODAY}.`
      };
    }

    const appts = await redisStore.getAppointments();
    const appt = appts.find(x => x.id === appointmentId);
    if (!appt) {
      return {
        success: false,
        message: `Rescheduling error: Appointment with ID '${appointmentId}' could not be found.`
      };
    }

    const doctor = await redisStore.findDoctorById(appt.doctorId);
    if (!doctor) {
      return {
        success: false,
        message: `Scheduling error: Doctor '${appt.doctorName}' (ID: ${appt.doctorId}) is no longer on the clinic registry.`
      };
    }

    // Doctor roster slot validation
    if (!doctor.slots.includes(newTime)) {
      return {
        success: false,
        message: `Dr. ${doctor.name} does not consult at ${newTime}. Available roster hours: ${doctor.slots.join(", ")}`
      };
    }

    // Double booking detection (excluding current appointment being updated!)
    const isConflict = appts.some(x =>
      x.doctorId === appt.doctorId &&
      x.date === newDate &&
      x.time === newTime &&
      x.status === "scheduled" &&
      x.id !== appointmentId
    );

    if (isConflict) {
      const bookedSlots = appts
        .filter(x => x.doctorId === appt.doctorId && x.date === newDate && x.status === "scheduled")
        .map(x => x.time);
      const freeSlots = doctor.slots.filter(s => !bookedSlots.includes(s));

      return {
        success: false,
        reason: "double_booking",
        message: `Conflict Detected: Dr. ${appt.doctorName} has other checkups scheduled at ${newTime} on ${newDate}.`,
        suggestedSlots: freeSlots
      };
    }

    const updatedAppt = await redisStore.rescheduleAppointment(appointmentId, newDate, newTime);
    if (!updatedAppt) {
      return {
        success: false,
        message: `Rescheduling failed inside the data persistence layer.`
      };
    }

    return {
      success: true,
      appointment: updatedAppt,
      message: `Appointment (ID: ${appointmentId}) is successfully rescheduled with ${appt.doctorName} onto ${newDate} at ${newTime}.`
    };
  }

  /**
   * Cancel appointment
   */
  public async cancelAppointment(appointmentId: string): Promise<{ success: boolean; message: string }> {
    const worked = await redisStore.updateAppointmentStatus(appointmentId, "cancelled");
    if (worked) {
      return {
        success: true,
        message: `Appointment ${appointmentId} has been successfully cancelled.`
      };
    }
    return {
      success: false,
      message: `No active appointment found under ID '${appointmentId}'.`
    };
  }
}

export const schedulerService = new SchedulerService();
