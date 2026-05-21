import { FunctionDeclaration, Type } from "@google/genai";

export const listDoctorsDecl: FunctionDeclaration = {
  name: "list_doctors",
  description: "Retrieve a list of all clinical doctors, their specialties, supporting languages, and their standard office duration slots.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: []
  }
};

export const checkAvailabilityDecl: FunctionDeclaration = {
  name: "check_availability",
  description: "Check which time slots are currently open and unassigned for a specific doctor on a targeted day.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      doctorId: {
        type: Type.STRING,
        description: "The unique registration ID of the doctor (e.g. doc-1)."
      },
      date: {
        type: Type.STRING,
        description: "The targeted scheduling date in ISO YYYY-MM-DD convention (must be on or after 2026-05-21)."
      }
    },
    required: ["doctorId", "date"]
  }
};

export const bookAppointmentDecl: FunctionDeclaration = {
  name: "book_appointment",
  description: "Register and book a concrete appointment reservation with a doctor at a chosen date and time.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      patientPhone: {
        type: Type.STRING,
        description: "The mobile phone number of the patient."
      },
      patientName: {
        type: Type.STRING,
        description: "The full legal name of the patient (e.g. Sanjay Kumar)."
      },
      doctorId: {
        type: Type.STRING,
        description: "The unique registration ID of the doctor (e.g. doc-1)."
      },
      date: {
        type: Type.STRING,
        description: "The reservation date in ISO YYYY-MM-DD convention."
      },
      time: {
        type: Type.STRING,
        description: "The selected consultation time slot matching the doctor's roster (e.g. '10:00 AM' or '02:00 PM')."
      }
    },
    required: ["patientPhone", "patientName", "doctorId", "date", "time"]
  }
};

export const rescheduleAppointmentDecl: FunctionDeclaration = {
  name: "reschedule_appointment",
  description: "Reschedule an existing active appointment to a different date and time.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appointmentId: {
        type: Type.STRING,
        description: "The unique identifier of the existing booked appointment (e.g. appt-101)."
      },
      newDate: {
        type: Type.STRING,
        description: "The new requested date in ISO YYYY-MM-DD format."
      },
      newTime: {
        type: Type.STRING,
        description: "The new requested time slot matching the doctor's roster (e.g. '11:00 AM')."
      }
    },
    required: ["appointmentId", "newDate", "newTime"]
  }
};

export const cancelAppointmentDecl: FunctionDeclaration = {
  name: "cancel_appointment",
  description: "Cancel a currently scheduled active appointment using its unique reservation ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appointmentId: {
        type: Type.STRING,
        description: "The unique ID of the scheduled appointment to cancel."
      }
    },
    required: ["appointmentId"]
  }
};

export const fetchPatientHistoryDecl: FunctionDeclaration = {
  name: "fetch_patient_history",
  description: "Look up registration cards, profiles, languages, and previous clinical appointment histories for a patient phone number.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      patientPhone: {
        type: Type.STRING,
        description: "The phone registration number of the Patient."
      }
    },
    required: ["patientPhone"]
  }
};

export const clinicalToolsList = [
  { functionDeclarations: [
    listDoctorsDecl,
    checkAvailabilityDecl,
    bookAppointmentDecl,
    rescheduleAppointmentDecl,
    cancelAppointmentDecl,
    fetchPatientHistoryDecl
  ]}
];
