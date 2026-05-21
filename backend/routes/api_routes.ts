import { Router } from "express";
import { apiController } from "../controllers/api_controller";
import { sessionService } from "../../memory/session_memory/session_service";

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
    const session = await sessionService.getSession(phone, (req.query.lang as any) || "English");
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/campaigns/trigger", (req, res) => apiController.triggerCampaign(req, res));
router.post("/chat", (req, res) => apiController.handleChatRequest(req, res));

export const apiRouter = router;
export default apiRouter;
