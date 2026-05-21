import { redisStore } from "../../database/redis/redis_service";
import { SessionData, Language, ChatMessage, ConversationStep } from "../../src/types";

export class SessionService {
  private static SESSION_PREFIX = "cliSession:";
  private static SESSION_TTL_SECONDS = 1800; // 30 minutes
  private static HISTORY_KEY = "chatHistory";

  public async getSession(phoneNumber: string, defaultLanguage: Language = Language.ENGLISH): Promise<SessionData> {
    const key = `${SessionService.SESSION_PREFIX}${phoneNumber}`;
    const value = await redisStore.get(key);
    
    if (value) {
      try {
        const parsed = JSON.parse(value);
        // Ensure currentStep is present (backward compat)
        if (!parsed.currentStep) {
          parsed.currentStep = ConversationStep.GREETING;
        }
        return parsed;
      } catch (err) {
        console.error("Failed to parse Redis booking session, restarting session:", err);
      }
    }

    // Default clean fallback state session
    const patientObj = await redisStore.findPatientByPhone(phoneNumber);
    return {
      patientPhone: phoneNumber,
      patientName: patientObj?.name,
      currentStep: ConversationStep.GREETING,
      activeIntent: "none",
      pendingConfirmation: false,
      bookingState: {},
      preferredLanguage: patientObj?.preferredLanguage || defaultLanguage,
      chatHistory: []
    };
  }

  public async saveSession(phoneNumber: string, session: SessionData): Promise<void> {
    const key = `${SessionService.SESSION_PREFIX}${phoneNumber}`;
    await redisStore.setex(key, SessionService.SESSION_TTL_SECONDS, JSON.stringify(session));
  }

  public async addChatMessage(phoneNumber: string, message: ChatMessage): Promise<void> {
    const session = await this.getSession(phoneNumber);
    const chatHistory = session.chatHistory || [];
    chatHistory.push(message);
    // Keep only last 50 messages for performance
    if (chatHistory.length > 50) {
      chatHistory.shift();
    }
    session.chatHistory = chatHistory;
    await this.saveSession(phoneNumber, session);
  }

  public async getChatHistory(phoneNumber: string): Promise<ChatMessage[]> {
    const session = await this.getSession(phoneNumber);
    return session.chatHistory || [];
  }

  public async clearSession(phoneNumber: string): Promise<void> {
    const key = `${SessionService.SESSION_PREFIX}${phoneNumber}`;
    await redisStore.del(key);
  }
}

export const sessionService = new SessionService();