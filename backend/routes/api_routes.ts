import { Router } from "express";
import { apiController } from "../controllers/api_controller";
import { sessionService } from "../../memory/session_memory/session_service";
import { redisStore } from "../../database/redis/redis_service";
import { Language, ConversationStep } from "../../src/types";

const router = Router();

router.get("/doctors", (req, res) => apiController.getDoctors(req, res));
router.get("/patients", (req, res) => apiController.getPatients(req, res));
router.get("/appointments", (req, res) => apiController.getAppointments(req, res));
router.get("/logs", (req, res) => apiController.getLogs(req, res));
router.get("/traces", (req, res) => apiController.getTraces(req, res));
router.get("/campaigns", (req, res) => apiController.getCampaigns(req, res));

// Session restoration endpoint
router.get("/session/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const session = await sessionService.getSession(phone, (req.query.lang as any) || Language.ENGLISH);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// LIVE SESSIONS REGISTRY
// ================================================

// Get all active sessions
router.get("/sessions", async (req, res) => {
  try {
    const sessionKeys = await redisStore.keys("cliSession:*");
    const sessions: Array<{
      phone: string;
      patientName: string;
      language: Language;
      intent: string;
      startTime: number;
      messageCount: number;
      lastActivity: number;
      currentStep: string;
    }> = [];
    
    for (const key of sessionKeys) {
      const phone = key.replace("cliSession:", "");
      const data = await redisStore.get(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          sessions.push({
            phone: phone,
            patientName: parsed.patientName || "Guest",
            language: parsed.preferredLanguage || Language.ENGLISH,
            intent: parsed.activeIntent || "general",
            startTime: parsed.startTime || Date.now() - 60000,
            messageCount: (parsed.chatHistory || []).length,
            lastActivity: Date.now(),
            currentStep: parsed.currentStep || ConversationStep.GREETING
          });
        } catch (e) {
          // Skip malformed
        }
      }
    }
    
    // Also check ephemeral session registry
    const registryData = await redisStore.get("sessionRegistry");
    if (registryData) {
      try {
        const registered = JSON.parse(registryData);
        for (const entry of registered) {
          const exists = sessions.some(s => s.phone === entry.phone);
          if (!exists) {
            sessions.push({
              phone: entry.phone,
              patientName: entry.patientName || "Guest",
              language: entry.language || Language.ENGLISH,
              intent: "general",
              startTime: entry.timestamp || Date.now(),
              messageCount: 0,
              lastActivity: Date.now(),
              currentStep: ConversationStep.GREETING
            });
          }
        }
      } catch (e) {}
    }
    
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Register a new session
router.post("/sessions/register", async (req, res) => {
  try {
    const { phone, patientName, language, sessionId } = req.body;
    if (!phone) {
      res.status(400).json({ error: "Phone is required" });
      return;
    }
    
    // Add to session registry
    const registryData = await redisStore.get("sessionRegistry");
    let registry: Array<{
      phone: string;
      patientName: string;
      language: Language;
      sessionId: string;
      timestamp: number;
    }> = [];
    
    if (registryData) {
      try {
        registry = JSON.parse(registryData);
        // Remove existing entry for this phone (prevent duplicates)
        registry = registry.filter((e: any) => e.phone !== phone);
      } catch (e) {}
    }
    
    registry.push({
      phone,
      patientName: patientName || "Guest",
      language: language || Language.ENGLISH,
      sessionId: sessionId || `session-${Date.now()}`,
      timestamp: Date.now()
    });
    
    // Keep only last 50 entries
    if (registry.length > 50) registry = registry.slice(-50);
    
    await redisStore.set("sessionRegistry", JSON.stringify(registry));
    
    res.json({ success: true, registered: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/campaigns/trigger", (req, res) => apiController.triggerCampaign(req, res));
router.post("/chat", (req, res) => apiController.handleChatRequest(req, res));

export const apiRouter = router;
export default apiRouter;