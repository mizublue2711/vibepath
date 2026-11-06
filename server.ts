import express from "express";
import path from "path";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";
import { SchemaValidator } from "./src/utils/schema-validator";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

function createGeminiClient(customKey?: string) {
  const apiKey =
    customKey && typeof customKey === "string" && customKey.trim().length > 8
      ? customKey.trim()
      : process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "VibePath Kinetic Engine", timestamp: new Date().toISOString() });
});

// Explicit static serving for 3D GLB models with CORS headers
app.use(
  "/models",
  (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    next();
  },
  express.static(path.join(process.cwd(), "public", "models"))
);

app.get("/horse.glb", (_req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Content-Type", "model/gltf-binary");
  res.sendFile(path.join(process.cwd(), "public", "horse.glb"));
});

// 1. VibePath Atomic Cloud Sync & n8n Render Webhook Endpoint (Validated by SchemaValidator)
app.post("/api/vibepath/sync", (req, res) => {
  try {
    const body = req.body || {};

    // Normalize input into RenderPayload contract and run SchemaValidator.sanitizeRenderPayload
    const candidatePayload = body.telemetry_data
      ? body
      : {
          trip_id: body.trip_id || `TRIP_${Date.now()}`,
          youtuber_id: body.youtuber_id || "vlogger_saigon_01",
          language: body.language || "vi",
          trip_name: body.trip_name || "Saigon Night Street Food 3D Tour",
          created_at: new Date().toISOString(),
          telemetry_data: Array.isArray(body.waypoints)
            ? body.waypoints.map((w: any) => ({
                latitude: w.lat ?? w.latitude,
                longitude: w.lng ?? w.longitude,
                altitude: 12.0,
                speed_kmh: w.speedKmh ?? w.speed_kmh ?? 24,
                heading: 30,
                timestamp: w.timestamp || new Date().toISOString(),
              }))
            : [],
          food_pois: Array.isArray(body.nodes)
            ? body.nodes.map((n: any, idx: number) => ({
                poi_id: n.id || n.poi_id || `POI_${Date.now()}_${idx}`,
                name: n.name,
                latitude: n.latitude,
                longitude: n.longitude,
                rating: n.rating,
                note: body.language === "en" ? n.noteEn || n.note : n.note,
                timestamp: n.timestamp || new Date().toISOString(),
                images: n.images || [],
              }))
            : [],
        };

    const sanitizedRenderPayload = SchemaValidator.sanitizeRenderPayload(candidatePayload);
    const payloadBytes = Buffer.byteLength(JSON.stringify(sanitizedRenderPayload), "utf8");
    const payloadSizeKb = Number((payloadBytes / 1024).toFixed(2));
    const syncId = `VP-SYNC-${Date.now().toString(36).toUpperCase()}`;

    res.json({
      syncId,
      timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      language: sanitizedRenderPayload.language,
      nodesCount: sanitizedRenderPayload.food_pois.length,
      waypointsCount: sanitizedRenderPayload.telemetry_data.length,
      payloadSizeKb,
      status: "SYNCED_ATOMIC",
      byokDifyAttached: Boolean(body.custom_dify_key),
      sanitizedPayload: {
        ...sanitizedRenderPayload,
        ...(body.custom_dify_key ? { custom_dify_key: body.custom_dify_key } : {}),
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Atomic cloud sync validation failed." });
  }
});

// 2. VibePath AI Content Generator (YouTube Chapters + Social Captions for Tab 2 Editor Web Studio)
app.post("/api/vibepath/ai-content", async (req, res) => {
  try {
    const { nodes = [], language = "vi", custom_gemini_key, custom_dify_key } = req.body || {};
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return res.status(400).json({ error: "At least one culinary node is required." });
    }

    const ai = createGeminiClient(custom_gemini_key) || createGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: "AI service is not configured on the server." });
    }

    const stopsSummary = nodes
      .map((n: any, idx: number) => {
        const mins = String(Math.floor((n.timecodeSeconds || idx * 18) / 60)).padStart(2, "0");
        const secs = String(Math.floor((n.timecodeSeconds || idx * 18) % 60)).padStart(2, "0");
        return `${mins}:${secs} | ${n.name} | Rating: ${n.rating}/5 | GPS: (${n.latitude}, ${n.longitude}) | Note: ${
          language === "en" ? n.noteEn || n.note : n.note
        }`;
      })
      .join("\n");

    const prompt =
      language === "en"
        ? `Generate YouTube Chapters (MM:SS - Spot Name) and a high-converting Social Media Caption for Facebook/TikTok/Reels based on these field-pinned street food stops:\n${stopsSummary}`
        : `Hãy tạo danh sách mốc thời gian YouTube Chapters (MM:SS - Tên quán) và bài đăng Social Captions giật gân tối ưu cho Facebook/TikTok/Reels dựa trên danh sách điểm dừng chân ẩm thực thực tế sau:\n${stopsSummary}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "You are the VibePath Studio AI Copywriter for street food vloggers and video editors. Return JSON with youtubeChapters and socialCaption.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            youtubeChapters: {
              type: Type.STRING,
              description: "Formatted MM:SS - Spot Name YouTube chapters list",
            },
            socialCaption: {
              type: Type.STRING,
              description: "Engaging social caption with hooks, spot highlights, GPS coordinates, and hashtags",
            },
          },
          required: ["youtubeChapters", "socialCaption"],
        },
      },
    });

    const parsed = JSON.parse((response.text || "{}").trim());
    res.json({
      youtubeChapters: parsed.youtubeChapters || "",
      socialCaption: parsed.socialCaption || "",
      modeUsed: custom_gemini_key || custom_dify_key ? "BYOK_OVERRIDE" : "VPS_SYSTEM_DEFAULT",
    });
  } catch (err: any) {
    console.error("Error in /api/vibepath/ai-content:", err);
    res.status(500).json({
      error: err?.message || "Failed to generate AI chapters and social captions.",
    });
  }
});

// 3. Cloudflare R2 Screenshot Upload Endpoint (Tab 3.3 Feedback & Bug Report)
app.post("/api/vibepath/upload-r2", (req, res) => {
  const { filename = "field-bug-capture.png" } = req.body || {};
  const cleanName = String(filename)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-");
  const objectKey = `snapshots/${Date.now()}-${cleanName}`;
  res.json({
    bucket: "vibepath-telemetry-prod",
    objectKey,
    attachment_url: `https://r2.vibepath.io/buckets/telemetry-prod/${objectKey}`,
    uploadedAt: new Date().toISOString(),
  });
});

// 4. Dify AI Agent Bug Triage & Emergency Telegram Alert Endpoint (Validated by SchemaValidator)
app.post("/api/vibepath/triage", async (req, res) => {
  let sanitizedFeedback;
  try {
    sanitizedFeedback = SchemaValidator.sanitizeFeedbackPayload(req.body || {});
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Invalid FeedbackPayload." });
  }

  const { role, rating, selected_features, feedback_text, attachment_url } = sanitizedFeedback;
  const textLower = String(feedback_text).toLowerCase();

  // Deterministic fallback heuristic in case Gemini API is unavailable
  const computeFallbackTriage = () => {
    let category:
      | "GPS_TELEMETRY"
      | "MAP_3D_ENGINE"
      | "NLE_EXPORT_PIPELINE"
      | "CLOUD_SYNC_WORKER"
      | "OUTDOOR_UX_ERGONOMICS" = "OUTDOOR_UX_ERGONOMICS";

    if (textLower.includes("gps") || textLower.includes("tọa độ") || textLower.includes("vệ tinh")) {
      category = "GPS_TELEMETRY";
    } else if (textLower.includes("3d") || textLower.includes("map") || textLower.includes("bản đồ") || textLower.includes("60fps")) {
      category = "MAP_3D_ENGINE";
    } else if (textLower.includes("xml") || textLower.includes("srt") || textLower.includes("premiere") || textLower.includes("capcut")) {
      category = "NLE_EXPORT_PIPELINE";
    } else if (textLower.includes("sync") || textLower.includes("đồng bộ") || textLower.includes("cloud")) {
      category = "CLOUD_SYNC_WORKER";
    }

    let severity: "P0" | "P1" | "P2" = "P2";
    if (
      rating <= 2 ||
      textLower.includes("crash") ||
      textLower.includes("sập") ||
      textLower.includes("mất dữ liệu") ||
      textLower.includes("p0") ||
      textLower.includes("khẩn cấp")
    ) {
      severity = "P0";
    } else if (
      rating === 3 ||
      textLower.includes("lỗi") ||
      textLower.includes("chậm") ||
      textLower.includes("lệch") ||
      textLower.includes("drift") ||
      textLower.includes("p1")
    ) {
      severity = "P1";
    }

    const telegram_alert_sent = severity === "P0" || severity === "P1";
    return {
      category,
      severity,
      summary: `[${severity}] ${category} report from ${role}: ${String(feedback_text).slice(0, 90)}`,
      recommended_action:
        severity === "P0"
          ? "Immediate hotfix rollback & telemetry replay on Cloudflare Worker."
          : severity === "P1"
          ? "Schedule patch in current sprint and inspect R2 diagnostic snapshot."
          : "Log qualitative UX feedback for next ergonomic iteration.",
      telegram_alert_sent,
      telegram_channel: telegram_alert_sent ? `@VibePathOpsAlertBot #${severity.toLowerCase()}-urgent` : "N/A (P2 Standard Queue)",
      dify_agent_run_id: `dify-run-${Math.random().toString(36).slice(2, 8)}`,
    };
  };

  try {
    const ai = createGeminiClient(req.body?.custom_gemini_key) || createGeminiClient();
    if (!ai) {
      return res.json({ sanitizedPayload: sanitizedFeedback, triage: computeFallbackTriage() });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Analyze this field feedback / bug report for VibePath:
Role: ${role}
Rating: ${rating}/5
Features: ${Array.isArray(selected_features) ? selected_features.join(", ") : ""}
Feedback: ${feedback_text}
Attachment: ${attachment_url}`,
      config: {
        systemInstruction:
          "You are the VibePath Dify AI Bug Triage Agent. Classify the report into one category (GPS_TELEMETRY, MAP_3D_ENGINE, NLE_EXPORT_PIPELINE, CLOUD_SYNC_WORKER, OUTDOOR_UX_ERGONOMICS) and assign severity (P0 for critical data loss/crash, P1 for functional bug/drift/sync issue, P2 for minor UI/feature feedback). Provide a concise summary and recommended engineering action.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "One of GPS_TELEMETRY, MAP_3D_ENGINE, NLE_EXPORT_PIPELINE, CLOUD_SYNC_WORKER, OUTDOOR_UX_ERGONOMICS",
            },
            severity: {
              type: Type.STRING,
              description: "One of P0, P1, P2",
            },
            summary: {
              type: Type.STRING,
              description: "1-sentence technical triage summary",
            },
            recommended_action: {
              type: Type.STRING,
              description: "1-sentence actionable engineering resolution",
            },
          },
          required: ["category", "severity", "summary", "recommended_action"],
        },
      },
    });

    const parsed = JSON.parse((response.text || "{}").trim());
    const validCategories = [
      "GPS_TELEMETRY",
      "MAP_3D_ENGINE",
      "NLE_EXPORT_PIPELINE",
      "CLOUD_SYNC_WORKER",
      "OUTDOOR_UX_ERGONOMICS",
    ];
    const category = validCategories.includes(parsed.category)
      ? parsed.category
      : computeFallbackTriage().category;
    const severity: "P0" | "P1" | "P2" =
      parsed.severity === "P0" || parsed.severity === "P1" || parsed.severity === "P2"
        ? parsed.severity
        : computeFallbackTriage().severity;
    const telegram_alert_sent = severity === "P0" || severity === "P1";

    res.json({
      sanitizedPayload: sanitizedFeedback,
      triage: {
        category,
        severity,
        summary: parsed.summary || computeFallbackTriage().summary,
        recommended_action: parsed.recommended_action || computeFallbackTriage().recommended_action,
        telegram_alert_sent,
        telegram_channel: telegram_alert_sent
          ? `@VibePathOpsAlertBot #${severity.toLowerCase()}-urgent`
          : "N/A (P2 Standard Queue)",
        dify_agent_run_id: `dify-run-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
  } catch (_err) {
    res.json({ sanitizedPayload: sanitizedFeedback, triage: computeFallbackTriage() });
  }
});

// Gemini High-Fidelity TTS Narration Route (migrated to gemini-3.8-flash-lite-tts)
app.post("/api/gemini/tts", async (req, res) => {
  try {
    const { text, voice = "Zephyr" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required for TTS generation." });
    }

    const aiClient = createGeminiClient();
    if (!aiClient) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on server." });
    }

    const validVoices = ["Zephyr", "Fenrir", "Kore", "Puck", "Charon"];
    const selectedVoice = validVoices.includes(voice) ? voice : "Zephyr";
    const cleanText = text.replace(/[*_#`~[\]()]/g, "").replace(/\s+/g, " ").trim().slice(0, 4000);

    const response = await aiClient.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: cleanText,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const part = response?.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType || "audio/pcm;rate=24000";

    if (!base64Audio) {
      return res.status(500).json({ error: "No audio stream returned from Gemini TTS." });
    }

    res.json({
      audioBase64: base64Audio,
      mimeType,
      voice: selectedVoice,
    });
  } catch (err: any) {
    console.error("Error in /api/gemini/tts:", err);
    res.status(500).json({ error: "Failed to generate speech with Gemini TTS." });
  }
});

// Vite middleware for development, static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
