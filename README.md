# Voice AI Clinical Booking Agent

An elite, full-stack, real-time multilingual (English, Hindi, and Tamil) Voice AI clinical booking receptionist and clinic coordinator named **Aarogi AI**.

Powered by **Gemini 3.5**, standard **TypeScript**, and a robust **Redis Database** abstraction, it coordinates seamless scheduling operations directly from telephone simulations.

---

## 🏗️ Refactored Production Architecture

The project has been refactored from a monolithic sandbox into a professional modular structure:

```text
voice-ai-agent/
│
├── frontend/                          # React client entry viewport (served using Vite SPA middlewares)
│   └── src/                           # Visual HUD pages, metrics, voice dials, and consoles
│
├── backend/                           # Express HTTP endpoints and routing middlewares
│   ├── api/                           # Endpoint controller interfaces
│   ├── controllers/                   # Clinical action processors
│   ├── routes/                        # Express API route registrations
│   └── websocket/                     # SIP Call WebSocket Broker holding real-time conversational channels
│
├── agent/                             # LLM Reasoning coordinator
│   ├── prompts/                       # Aarogi AI system prompt templates (holding regional Hindi/Tamil phonologies)
│   ├── reasoning/                     # Gemini two-stage function-calling orchestrator (highly robust message alignments)
│   └── tools/                         # Typed Gemini function declarations and schemas
│
├── memory/                            # Active state systems
│   ├── session_memory/                # Redis-backed session data tracking temporary slots (30 mins TTL)
│   └── redis_memory/                  # Patient preferred languages and demographic caches
│
├── services/                          # External core pipeline modules
│   ├── speech_to_text/                # Simulated latency STT processing wrappers
│   ├── text_to_speech/                # Dual-mode multilingual voice generator (Gemini TTS + Browser Speech fallback)
│   └── language_detection/            # Auto language detector supporting instant transition cues
│
├── scheduler/                         # Roster & scheduling engine
│   └── appointment_engine/            # Slots, roster, conflict prevention, past-date screening, and suggestions
│
├── database/                          # Datastore abstractions
│   └── redis/                         # RedisService storing doctors, profiles, logs, and conversation history keys
│
├── logs/                              # Audit modules
│   └── latency_logs/                  # Write roundtrip latencies directly to clinical log files
│
├── docs/                              # Medical system configuration assets and guides
│
├── README.md                          # Production instructions guide
└── docker-compose.yml                 # Service containers setup orchestrator
```

---

## 🌟 Highly-Polished Implementation Details

1. **Perfect Turn ordering alignment**:
   By using standard `Content` lists mapping `user` -> `model` with `functionCall` -> `tool` with `functionResponse` -> `model` with response `text`, the compiler perfectly satisfies Gemini function calling, eradicating the `turn comes immediately after...` runtime error completely.
2. **No MongoDB**:
   MongoDB references have been safely deleted. All registries (Doctors roster, patients accounts, reservations, logs, and trace steps) are stored in individual high-performance key-value namespaces (`doctor:*`, `patient:*`, `appointment:*`, `campaign:*`) managed under `RedisService`.
3. **True Multilingual TTS**:
   Audio output supports English, Hindi, and Tamil natively:
   - Integrates state-of-the-art server-side **Gemini Voice Generation** (using `gemini-3.1-flash-tts-preview`) returning high-quality PCM audio buffers.
   - Includes custom, asynchronous frontend speech synthesis filters identifying localized voices (like *"Google हिन्दी"* or *"Google தமிழ்"*) so fallback vocalizations fit localized accents seamlessly.
4. **Sophisticated Scheduling Validation**:
   - Blocks scheduling appointments on dates earlier than the current operational date (`2026-05-21`).
   - Automatically detects slot double-bookings and updates session memory, prompting patients with alternate roster times.

---

## 🚀 Launching & Deploying the System

### Standard Local Exec
Initialize packages and launch the developer pipeline:
```bash
npm install
npm run dev
```

### Docker Containers (Compose)
Lauch the composite services (Voice AI server and persistence Redis stores) inside Docker:
```bash
docker-compose up --build
```
The full application runs live on target port **`3000`**.
