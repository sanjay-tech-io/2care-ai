import { Request, Response } from "express";
import { redisStore } from "../../database/redis/redis_service";
import { clinicalAgentOrchestrator } from "../../agent/reasoning/orchestrator";
import { latencyLogger } from "../../logs/latency_logs/latency_logger";
import { Language } from "../../src/types";

export class ApiController {
  public async getDoctors(req: Request, res: Response): Promise<void> {
    try {
      const doctors = await redisStore.getDoctors();
      res.json(doctors);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public async getPatients(req: Request, res: Response): Promise<void> {
    try {
      const patients = await redisStore.getPatients();
      res.json(patients);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public async getAppointments(req: Request, res: Response): Promise<void> {
    try {
      const appointments = await redisStore.getAppointments();
      res.json(appointments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const logs = await redisStore.getLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public async getTraces(req: Request, res: Response): Promise<void> {
    try {
      const traces = await redisStore.getTraces();
      res.json(traces);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public async getCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const campaigns = await redisStore.getCampaigns();
      res.json(campaigns);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public async triggerCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id, status } = req.body;
      if (!id || !status) {
        res.status(400).json({ error: "Campaign identifier and call outcome status are required." });
        return;
      }
      const updated = await redisStore.triggerCampaignCall(id, status);
      if (updated) {
        res.json({ success: true, campaign: updated });
      } else {
        res.status(404).json({ error: `Campaign with registration ID '${id}' was not found.` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public async handleChatRequest(req: Request, res: Response): Promise<void> {
    try {
      const { phone, text, language, name } = req.body;
      if (!phone || !text) {
        res.status(400).json({ error: "Patient calling phone number and speech transcription text are required parameters." });
        return;
      }

      const result = await clinicalAgentOrchestrator.handleRequest({
        phone,
        userInput: text,
        overrideName: name,
        presetLanguage: language as Language
      });

      // Log latency onto local filesystem in background
      latencyLogger.logLatency({
        stt: result.latencies.stt,
        llm: result.latencies.llm,
        tts: result.latencies.tts,
        total: result.latencies.total,
        textLength: result.textResponse.length,
        language: result.detectedLanguage
      });

      res.json({
        textResponse: result.textResponse,
        speakAudio: result.speakAudio,
        detectedLanguage: result.detectedLanguage,
        trace: result.trace,
        latencies: result.latencies
      });
    } catch (err: any) {
      console.error("Clinical Controller HTTP API Exception:", err);
      res.status(500).json({ error: err.message });
    }
  }
}

export const apiController = new ApiController();
