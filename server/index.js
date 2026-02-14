const { createServer } = require("node:http");
const { createHash, randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const API_VERSION = "1.0.0";
const DEFAULT_PORT = 8787;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_PATH = process.env.FIELD_SCOUT_DB_PATH ?? path.join(PROJECT_ROOT, ".data", "fieldscout.sqlite");
const SQLITECLOUD_URL = process.env.FIELD_SCOUT_SQLITECLOUD_URL ?? "";
const SQLITECLOUD_PYTHON =
  process.env.FIELD_SCOUT_SQLITECLOUD_PYTHON ?? path.join(PROJECT_ROOT, ".venv_sqlitecloud", "bin", "python");
const SQLITECLOUD_BRIDGE = path.join(__dirname, "sqlitecloud_bridge.py");
const PORT = Number(process.env.PORT ?? DEFAULT_PORT);
const REQUIRE_AUTH = process.env.FIELD_SCOUT_REQUIRE_AUTH === "true";
const API_KEY = process.env.FIELD_SCOUT_API_KEY ?? "";
const API_KEY_HEADER = (process.env.FIELD_SCOUT_API_KEY_HEADER ?? "x-api-key").toLowerCase();
const API_KEY_PREFIX = process.env.FIELD_SCOUT_API_KEY_PREFIX ?? "";

const db = createDatabaseAdapter();

initializeSchema();
seedFixtures();

const server = createServer(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (!assertAuth(req, res)) {
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    const method = req.method ?? "GET";

    if (method === "GET" && pathname === "/v1/health") {
      sendJson(res, 200, {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: API_VERSION,
      });
      return;
    }

    if (method === "GET" && pathname === "/v1/observations") {
      sendJson(res, 200, listObservations());
      return;
    }

    if (method === "POST" && pathname === "/v1/observations") {
      const body = await readJsonBody(req, res);
      if (body === null) {
        return;
      }
      await withIdempotency(req, res, "observations:create", body, 201, () => {
        if (!body || typeof body !== "object" || typeof body.observationId !== "string") {
          return errorPayload(400, "VALIDATION_ERROR", "Invalid observation payload.");
        }
        upsertObservation(body);
        return { status: 201, body };
      });
      return;
    }

    const observationMatch = pathname.match(/^\/v1\/observations\/([^/]+)$/);
    if (method === "GET" && observationMatch) {
      const observationId = decodeURIComponent(observationMatch[1]);
      const observation = getObservation(observationId);
      if (!observation) {
        sendJson(res, 404, buildErrorEnvelope("NOT_FOUND", `Observation ${observationId} not found.`, false));
        return;
      }
      sendJson(res, 200, observation);
      return;
    }

    if (method === "GET" && pathname === "/v1/recommendations") {
      const observationId = url.searchParams.get("observationId");
      if (observationId) {
        sendJson(res, 200, listRecommendationsForObservation(observationId));
        return;
      }
      sendJson(res, 200, listActiveRecommendations());
      return;
    }

    if (method === "POST" && pathname === "/v1/recommendations:generate") {
      const body = await readJsonBody(req, res);
      if (body === null) {
        return;
      }
      await withIdempotency(req, res, "recommendations:generate", body, 200, () => {
        if (!body || typeof body !== "object" || typeof body.observationId !== "string") {
          return errorPayload(400, "VALIDATION_ERROR", "Invalid generate request payload.");
        }
        const observation = getObservation(body.observationId);
        if (!observation) {
          return errorPayload(404, "NOT_FOUND", `Observation ${body.observationId} not found.`);
        }
        const recommendation = buildRecommendationFromSeed({
          observationId: body.observationId,
          playbookId: typeof body.playbookId === "string" ? body.playbookId : "pbk_yolo_grape",
          playbookVersion: typeof body.playbookVersion === "number" ? body.playbookVersion : 3,
          weatherFeaturesId:
            typeof body.weatherFeaturesId === "string" ? body.weatherFeaturesId : "wxf_20260211_demo_01",
        });
        upsertRecommendation(recommendation);
        appendActiveRecommendation(recommendation.recommendationId);
        return { status: 200, body: recommendation };
      });
      return;
    }

    const recommendationMatch = pathname.match(/^\/v1\/recommendations\/([^/]+)$/);
    if (method === "GET" && recommendationMatch) {
      const recommendationId = decodeURIComponent(recommendationMatch[1]);
      const recommendation = getRecommendation(recommendationId);
      if (!recommendation) {
        sendJson(res, 404, buildErrorEnvelope("NOT_FOUND", `Recommendation ${recommendationId} not found.`, false));
        return;
      }
      sendJson(res, 200, recommendation);
      return;
    }

    const playbookMatch = pathname.match(/^\/v1\/playbooks\/([^/:]+)$/);
    if (method === "GET" && playbookMatch) {
      const playbookId = decodeURIComponent(playbookMatch[1]);
      const requestedVersion = url.searchParams.get("version");
      const playbook =
        requestedVersion != null
          ? getPlaybook(playbookId, Number(requestedVersion))
          : getActivePlaybook(playbookId);
      if (!playbook) {
        sendJson(res, 404, buildErrorEnvelope("NOT_FOUND", `Playbook ${playbookId} not found.`, false));
        return;
      }
      sendJson(res, 200, playbook);
      return;
    }

    const patchApplyMatch = pathname.match(/^\/v1\/playbooks\/([^/]+)\/patches(?::apply)?$/);
    if (method === "POST" && patchApplyMatch) {
      const playbookId = decodeURIComponent(patchApplyMatch[1]);
      const body = await readJsonBody(req, res);
      if (body === null) {
        return;
      }
      await withIdempotency(req, res, `playbooks:${playbookId}:patches`, body, 200, () => {
        const currentPlaybook = getActivePlaybook(playbookId);
        if (!currentPlaybook) {
          return errorPayload(404, "NOT_FOUND", `Playbook ${playbookId} not found.`);
        }
        const patchResult = applyPatchToPlaybook(body, currentPlaybook);
        if (patchResult.error) {
          return patchResult.error;
        }
        return { status: 200, body: patchResult.result };
      });
      return;
    }

    const weatherMatch = pathname.match(/^\/v1\/weather\/([^/]+)$/);
    if (method === "GET" && weatherMatch) {
      const weatherFeaturesId = decodeURIComponent(weatherMatch[1]);
      const weather = getWeatherFeatures(weatherFeaturesId);
      if (!weather) {
        sendJson(res, 404, buildErrorEnvelope("NOT_FOUND", `Weather features ${weatherFeaturesId} not found.`, false));
        return;
      }
      sendJson(res, 200, weather);
      return;
    }

    const patchMatch = pathname.match(/^\/v1\/patches\/([^/]+)$/);
    if (method === "GET" && patchMatch) {
      const patchId = decodeURIComponent(patchMatch[1]);
      const patch = getPatch(patchId);
      if (!patch) {
        sendJson(res, 404, buildErrorEnvelope("NOT_FOUND", `Patch ${patchId} not found.`, false));
        return;
      }
      sendJson(res, 200, patch);
      return;
    }

    const traceMatch = pathname.match(/^\/v1\/traces\/([^/]+)$/);
    if (method === "GET" && traceMatch) {
      const observationId = decodeURIComponent(traceMatch[1]);
      const trace = getTrace(observationId);
      if (!trace) {
        sendJson(res, 404, buildErrorEnvelope("NOT_FOUND", `Trace for ${observationId} not found.`, false));
        return;
      }
      sendJson(res, 200, trace);
      return;
    }

    if (method === "POST" && pathname === "/v1/sync/batch") {
      const body = await readJsonBody(req, res);
      if (body === null) {
        return;
      }
      const syncScope = "sync:batch";
      await withIdempotency(req, res, syncScope, body, 200, () => {
        if (!body || typeof body !== "object" || typeof body.syncId !== "string") {
          return errorPayload(400, "VALIDATION_ERROR", "Invalid sync payload.");
        }

        const existing = db
          .prepare("SELECT request_hash, response_json FROM sync_events WHERE sync_id = ?")
          .get(body.syncId);
        const requestHash = hashPayload(body);
        if (existing && existing.request_hash !== requestHash) {
          return errorPayload(
            409,
            "IDEMPOTENCY_CONFLICT",
            `syncId ${body.syncId} already exists with a different payload.`,
          );
        }
        if (existing && existing.request_hash === requestHash) {
          return { status: 200, body: JSON.parse(existing.response_json) };
        }

        const upserts = body.upserts ?? {};
        const observations = Array.isArray(upserts.observations) ? upserts.observations : [];
        const recommendations = Array.isArray(upserts.recommendations) ? upserts.recommendations : [];
        const playbookPatches = Array.isArray(upserts.playbookPatches) ? upserts.playbookPatches : [];

        for (const observation of observations) {
          if (observation && typeof observation.observationId === "string") {
            upsertObservation(observation);
          }
        }
        for (const recommendation of recommendations) {
          if (recommendation && typeof recommendation.recommendationId === "string") {
            upsertRecommendation(recommendation);
            appendActiveRecommendation(recommendation.recommendationId);
          }
        }
        for (const patch of playbookPatches) {
          if (patch && typeof patch.patchId === "string") {
            upsertPatch(patch, nowIso());
          }
        }

        const playbook = getActivePlaybook("pbk_yolo_grape");
        const responseBody = {
          syncId: body.syncId,
          acceptedAt: nowIso(),
          serverCursor: nextCursorId(),
          acceptedCounts: {
            observations: observations.length,
            recommendations: recommendations.length,
            playbookPatches: playbookPatches.length,
          },
          conflicts: [],
          downstream: {
            playbook: playbook
              ? {
                  playbookId: playbook.playbookId,
                  version: playbook.version,
                  updatedAt: playbook.updatedAt,
                }
              : {
                  playbookId: "pbk_yolo_grape",
                  version: 0,
                  updatedAt: nowIso(),
                },
            observations: [],
            recommendations: [],
          },
        };

        db.prepare(
          `
          INSERT INTO sync_events (sync_id, request_hash, response_json, created_at)
          VALUES (?, ?, ?, ?)
          `,
        ).run(body.syncId, requestHash, JSON.stringify(responseBody), nowIso());

        return { status: 200, body: responseBody };
      });
      return;
    }

    sendJson(res, 404, buildErrorEnvelope("NOT_FOUND", `Route ${method} ${pathname} not found.`, false));
  } catch (error) {
    console.error(error);
    sendJson(res, 500, buildErrorEnvelope("INTERNAL_ERROR", "Unexpected server error.", true));
  }
});

server.listen(PORT, () => {
  console.log(`FieldScout API listening on http://localhost:${PORT}`);
  if (db.type === "sqlitecloud") {
    console.log(`SQLiteCloud database: ${redactApiKey(SQLITECLOUD_URL)}`);
  } else {
    console.log(`SQLite database: ${DB_PATH}`);
  }
});

function createDatabaseAdapter() {
  if (!SQLITECLOUD_URL) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const localDb = new DatabaseSync(DB_PATH);
    localDb.exec("PRAGMA journal_mode = WAL;");
    return {
      type: "local",
      exec(sql) {
        return localDb.exec(sql);
      },
      prepare(sql) {
        return localDb.prepare(sql);
      },
    };
  }

  if (!existsSync(SQLITECLOUD_PYTHON)) {
    throw new Error(
      `SQLiteCloud mode enabled but Python runtime not found at ${SQLITECLOUD_PYTHON}.`,
    );
  }
  if (!existsSync(SQLITECLOUD_BRIDGE)) {
    throw new Error(
      `SQLiteCloud mode enabled but bridge script not found at ${SQLITECLOUD_BRIDGE}.`,
    );
  }

  function callBridge(payload) {
    const proc = spawnSync(SQLITECLOUD_PYTHON, [SQLITECLOUD_BRIDGE], {
      input: JSON.stringify({ ...payload, url: SQLITECLOUD_URL }),
      encoding: "utf8",
    });
    if (proc.error) {
      throw proc.error;
    }
    if (proc.status !== 0) {
      const stderr = (proc.stderr ?? "").trim();
      const stdout = (proc.stdout ?? "").trim();
      throw new Error(`SQLiteCloud bridge failed: ${stderr || stdout || "unknown error"}`);
    }

    const response = JSON.parse((proc.stdout ?? "").trim() || "{}");
    if (!response.ok) {
      throw new Error(response.error ?? "SQLiteCloud bridge returned error.");
    }
    return response;
  }

  return {
    type: "sqlitecloud",
    exec(sql) {
      callBridge({ op: "exec", sql });
      return undefined;
    },
    prepare(sql) {
      return {
        run(...params) {
          const result = callBridge({ op: "run", sql, params });
          return { changes: result.rowcount ?? 0 };
        },
        get(...params) {
          const result = callBridge({ op: "get", sql, params });
          return result.row ?? undefined;
        },
        all(...params) {
          const result = callBridge({ op: "all", sql, params });
          return result.rows ?? [];
        },
      };
    },
  };
}

function redactApiKey(url) {
  return url.replace(/(apikey=)[^&]+/i, "$1***");
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      observation_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      recommendation_id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playbooks (
      playbook_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playbook_id, version)
    );

    CREATE TABLE IF NOT EXISTS patches (
      patch_id TEXT PRIMARY KEY,
      playbook_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weather_features (
      weather_features_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS traces (
      observation_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency (
      scope TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (scope, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS sync_events (
      sync_id TEXT PRIMARY KEY,
      request_hash TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state (
      state_key TEXT PRIMARY KEY,
      state_value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recommendations_observation
      ON recommendations(observation_id);
  `);
}

function seedFixtures() {
  const observation = readFixture("observation_obs_20260211_0001.json");
  const recommendation1 = readFixture("recommendation_rec_20260211_0001.json");
  const recommendation2 = readFixture("recommendation_rec_20260211_0002.json");
  const playbook = readFixture("playbook_pbk_yolo_grape_v3.json");
  const patch = readFixture("playbookpatch_pch_20260211_0001.json");
  const weather = readFixture("weatherfeatures_wxf_20260211_demo_01.json");
  const trace = readFixture("trace_obs_20260211_0001.json");

  if (!getObservation(observation.observationId)) {
    upsertObservation(observation);
  }
  if (!getRecommendation(recommendation1.recommendationId)) {
    upsertRecommendation(recommendation1);
  }
  if (!getRecommendation(recommendation2.recommendationId)) {
    upsertRecommendation(recommendation2);
  }
  if (!getPlaybook(playbook.playbookId, playbook.version)) {
    setPlaybookActive(playbook);
  }
  if (!getPatch(patch.patchId)) {
    upsertPatch(patch, patch.requestedAt ?? nowIso());
  }
  if (!getWeatherFeatures(weather.weatherFeaturesId)) {
    db.prepare(
      "INSERT INTO weather_features (weather_features_id, payload_json) VALUES (?, ?)",
    ).run(weather.weatherFeaturesId, JSON.stringify(weather));
  }
  if (!getTrace(trace.observationId)) {
    db.prepare("INSERT INTO traces (observation_id, payload_json) VALUES (?, ?)").run(
      trace.observationId,
      JSON.stringify(trace),
    );
  }
  if (!getState("active_recommendation_ids")) {
    setState("active_recommendation_ids", JSON.stringify([recommendation1.recommendationId]));
  }
  if (!getState("recommendation_counter")) {
    setState("recommendation_counter", "2");
  }
  if (!getState("cursor_counter")) {
    setState("cursor_counter", "1");
  }
}

function readFixture(fileName) {
  const fixturePath = path.join(PROJECT_ROOT, "web", "fixtures", fileName);
  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture missing: ${fixturePath}`);
  }
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Idempotency-Key, X-Device-Token, x-api-key, Authorization",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function assertAuth(req, res) {
  if (!REQUIRE_AUTH) {
    return true;
  }
  const headers = req.headers;
  const hasDeviceToken = typeof headers["x-device-token"] === "string" && headers["x-device-token"].length > 0;

  let hasApiKey = false;
  if (API_KEY) {
    const raw = headers[API_KEY_HEADER];
    const apiKeyHeader = Array.isArray(raw) ? raw[0] : raw;
    const expected = API_KEY_PREFIX ? `${API_KEY_PREFIX} ${API_KEY}` : API_KEY;
    hasApiKey = typeof apiKeyHeader === "string" && apiKeyHeader === expected;
  }

  const hasBearer = typeof headers.authorization === "string" && headers.authorization.length > 0;
  if (hasDeviceToken || hasApiKey || hasBearer) {
    return true;
  }

  sendJson(res, 401, buildErrorEnvelope("AUTH_REQUIRED", "Missing device token or API key.", false));
  return false;
}

async function withIdempotency(req, res, scope, body, expectedSuccessCode, handler) {
  const key = getIdempotencyKey(req);
  const requestHash = hashPayload(body);
  if (key) {
    const existing = db
      .prepare(
        "SELECT request_hash, status_code, response_json FROM idempotency WHERE scope = ? AND idempotency_key = ?",
      )
      .get(scope, key);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        sendJson(
          res,
          409,
          buildErrorEnvelope(
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key already used with a different request body.",
            false,
          ),
        );
        return;
      }
      sendJson(res, existing.status_code, JSON.parse(existing.response_json));
      return;
    }
  }

  const result = handler();
  if (result.status >= 400) {
    sendJson(res, result.status, result.body);
    return;
  }

  if (key) {
    db.prepare(
      `
      INSERT INTO idempotency (scope, idempotency_key, request_hash, status_code, response_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(scope, key, requestHash, expectedSuccessCode, JSON.stringify(result.body), nowIso());
  }
  sendJson(res, expectedSuccessCode, result.body);
}

function getIdempotencyKey(req) {
  const raw = req.headers["idempotency-key"];
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function hashPayload(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function errorPayload(status, code, message, retryable = false, details = {}) {
  return { status, body: buildErrorEnvelope(code, message, retryable, details) };
}

function buildErrorEnvelope(code, message, retryable, details = {}) {
  return {
    requestId: `req_${Date.now()}_${randomUUID().slice(0, 8)}`,
    timestamp: nowIso(),
    error: {
      code,
      message,
      retryable,
      traceId: `trace_${Date.now()}`,
      details,
    },
  };
}

async function readJsonBody(req, res) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    sendJson(res, 400, buildErrorEnvelope("VALIDATION_ERROR", "Malformed JSON body.", false));
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function upsertObservation(observation) {
  db.prepare(
    `
    INSERT INTO observations (observation_id, payload_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(observation_id) DO UPDATE SET
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
    `,
  ).run(observation.observationId, JSON.stringify(observation), nowIso());
}

function getObservation(observationId) {
  const row = db
    .prepare("SELECT payload_json FROM observations WHERE observation_id = ?")
    .get(observationId);
  return row ? JSON.parse(row.payload_json) : null;
}

function listObservations() {
  return db
    .prepare("SELECT payload_json FROM observations ORDER BY updated_at DESC")
    .all()
    .map((row) => JSON.parse(row.payload_json));
}

function upsertRecommendation(recommendation) {
  db.prepare(
    `
    INSERT INTO recommendations (recommendation_id, observation_id, payload_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(recommendation_id) DO UPDATE SET
      observation_id = excluded.observation_id,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
    `,
  ).run(
    recommendation.recommendationId,
    recommendation.observationId,
    JSON.stringify(recommendation),
    nowIso(),
  );
}

function getRecommendation(recommendationId) {
  const row = db
    .prepare("SELECT payload_json FROM recommendations WHERE recommendation_id = ?")
    .get(recommendationId);
  return row ? JSON.parse(row.payload_json) : null;
}

function listRecommendationsForObservation(observationId) {
  return db
    .prepare(
      `
      SELECT payload_json
      FROM recommendations
      WHERE observation_id = ?
      ORDER BY updated_at DESC
      `,
    )
    .all(observationId)
    .map((row) => JSON.parse(row.payload_json));
}

function listActiveRecommendations() {
  const activeIdsRaw = getState("active_recommendation_ids");
  if (!activeIdsRaw) {
    return db
      .prepare("SELECT payload_json FROM recommendations ORDER BY updated_at DESC")
      .all()
      .map((row) => JSON.parse(row.payload_json));
  }
  const activeIds = JSON.parse(activeIdsRaw);
  if (!Array.isArray(activeIds) || activeIds.length === 0) {
    return [];
  }
  const results = [];
  for (const recommendationId of activeIds) {
    if (typeof recommendationId !== "string") {
      continue;
    }
    const recommendation = getRecommendation(recommendationId);
    if (recommendation) {
      results.push(recommendation);
    }
  }
  return results;
}

function appendActiveRecommendation(recommendationId) {
  const activeIdsRaw = getState("active_recommendation_ids");
  const activeIds = activeIdsRaw ? JSON.parse(activeIdsRaw) : [];
  if (!Array.isArray(activeIds)) {
    setState("active_recommendation_ids", JSON.stringify([recommendationId]));
    return;
  }
  if (!activeIds.includes(recommendationId)) {
    activeIds.push(recommendationId);
    setState("active_recommendation_ids", JSON.stringify(activeIds));
  }
}

function setPlaybookActive(playbook) {
  db.prepare("UPDATE playbooks SET active = 0 WHERE playbook_id = ?").run(playbook.playbookId);
  db.prepare(
    `
    INSERT OR REPLACE INTO playbooks (playbook_id, version, payload_json, updated_at, active)
    VALUES (?, ?, ?, ?, 1)
    `,
  ).run(playbook.playbookId, playbook.version, JSON.stringify(playbook), playbook.updatedAt ?? nowIso());
}

function getPlaybook(playbookId, version) {
  const row = db
    .prepare("SELECT payload_json FROM playbooks WHERE playbook_id = ? AND version = ?")
    .get(playbookId, version);
  return row ? JSON.parse(row.payload_json) : null;
}

function getActivePlaybook(playbookId) {
  const row = db
    .prepare("SELECT payload_json FROM playbooks WHERE playbook_id = ? AND active = 1")
    .get(playbookId);
  if (row) {
    return JSON.parse(row.payload_json);
  }
  const fallback = db
    .prepare("SELECT payload_json FROM playbooks WHERE playbook_id = ? ORDER BY version DESC LIMIT 1")
    .get(playbookId);
  return fallback ? JSON.parse(fallback.payload_json) : null;
}

function upsertPatch(patch, appliedAt) {
  db.prepare(
    `
    INSERT INTO patches (patch_id, playbook_id, payload_json, applied_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(patch_id) DO UPDATE SET
      playbook_id = excluded.playbook_id,
      payload_json = excluded.payload_json,
      applied_at = excluded.applied_at
    `,
  ).run(patch.patchId, patch.playbookId, JSON.stringify(patch), appliedAt);
}

function getPatch(patchId) {
  const row = db.prepare("SELECT payload_json FROM patches WHERE patch_id = ?").get(patchId);
  return row ? JSON.parse(row.payload_json) : null;
}

function getWeatherFeatures(weatherFeaturesId) {
  const row = db
    .prepare("SELECT payload_json FROM weather_features WHERE weather_features_id = ?")
    .get(weatherFeaturesId);
  return row ? JSON.parse(row.payload_json) : null;
}

function getTrace(observationId) {
  const row = db.prepare("SELECT payload_json FROM traces WHERE observation_id = ?").get(observationId);
  return row ? JSON.parse(row.payload_json) : null;
}

function applyPatchToPlaybook(patch, playbook) {
  if (!patch || typeof patch !== "object") {
    return { error: errorPayload(400, "VALIDATION_ERROR", "Invalid patch payload.") };
  }
  if (patch.playbookId !== playbook.playbookId) {
    return {
      error: errorPayload(
        400,
        "VALIDATION_ERROR",
        `Patch playbookId ${patch.playbookId} does not match path ${playbook.playbookId}.`,
      ),
    };
  }
  if (patch.baseVersion !== playbook.version) {
    const body = {
      patchId: patch.patchId,
      playbookId: patch.playbookId,
      oldVersion: playbook.version,
      newVersion: playbook.version,
      status: "rejected",
      validationErrors: [
        `PLAYBOOK_VERSION_MISMATCH: baseVersion=${patch.baseVersion} activeVersion=${playbook.version}`,
      ],
      recomputedRecommendationId: null,
      appliedAt: nowIso(),
    };
    return { result: body };
  }

  const editablePaths = collectEditablePaths(playbook);
  const validationErrors = [];
  for (const operation of patch.operations ?? []) {
    if (!isAllowedPath(operation.path, editablePaths)) {
      validationErrors.push(`PLAYBOOK_PATCH_PATH_NOT_ALLOWED: ${operation.path}`);
    }
  }
  if (validationErrors.length > 0) {
    return {
      result: {
        patchId: patch.patchId,
        playbookId: patch.playbookId,
        oldVersion: playbook.version,
        newVersion: playbook.version,
        status: "rejected",
        validationErrors,
        recomputedRecommendationId: null,
        appliedAt: nowIso(),
      },
    };
  }

  let updatedPlaybook;
  try {
    updatedPlaybook = applyPatchOperations(playbook, patch.operations ?? []);
  } catch (error) {
    return { error: errorPayload(400, "VALIDATION_ERROR", error.message) };
  }

  const appliedAt = nowIso();
  updatedPlaybook.version = playbook.version + 1;
  updatedPlaybook.updatedAt = appliedAt;
  setPlaybookActive(updatedPlaybook);
  upsertPatch(patch, appliedAt);

  const observationId = resolvePrimaryObservationId();
  const weatherFeatures = getWeatherFeatures("wxf_20260211_demo_01");
  const recommendation = buildRecommendationFromSeed({
    observationId,
    playbookId: updatedPlaybook.playbookId,
    playbookVersion: updatedPlaybook.version,
    weatherFeaturesId: weatherFeatures?.weatherFeaturesId ?? "wxf_20260211_demo_01",
  });
  upsertRecommendation(recommendation);
  appendActiveRecommendation(recommendation.recommendationId);

  return {
    result: {
      patchId: patch.patchId,
      playbookId: patch.playbookId,
      oldVersion: playbook.version,
      newVersion: updatedPlaybook.version,
      status: "applied",
      validationErrors: [],
      recomputedRecommendationId: recommendation.recommendationId,
      appliedAt,
    },
  };
}

function resolvePrimaryObservationId() {
  const row = db.prepare("SELECT observation_id FROM observations ORDER BY updated_at DESC LIMIT 1").get();
  if (!row || typeof row.observation_id !== "string") {
    return "obs_20260211_0001";
  }
  return row.observation_id;
}

function collectEditablePaths(playbook) {
  const paths = [];
  const rules = playbook?.rules ?? {};
  for (const rule of Object.values(rules)) {
    if (Array.isArray(rule?.editablePaths)) {
      paths.push(...rule.editablePaths);
    }
  }
  return paths;
}

function isAllowedPath(pathValue, editablePaths) {
  if (typeof pathValue !== "string") {
    return false;
  }
  return editablePaths.some(
    (editablePath) => pathValue === editablePath || pathValue.startsWith(`${editablePath}/`),
  );
}

function applyPatchOperations(playbook, operations) {
  const updated = JSON.parse(JSON.stringify(playbook));
  for (const operation of operations) {
    const pointer = operation?.path;
    if (typeof pointer !== "string" || !pointer.startsWith("/")) {
      throw new Error(`Invalid patch path: ${pointer}`);
    }
    const segments = pointer.replace(/^\//, "").split("/");
    if (segments.length === 0) {
      throw new Error(`Invalid patch path: ${pointer}`);
    }

    let target = updated;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const key = segments[index];
      if (target[key] == null || typeof target[key] !== "object") {
        throw new Error(`Invalid patch path segment: ${pointer}`);
      }
      target = target[key];
    }

    const leaf = segments[segments.length - 1];
    if (operation.op === "remove") {
      delete target[leaf];
      continue;
    }
    target[leaf] = operation.value;
  }
  return updated;
}

function buildRecommendationFromSeed({
  observationId,
  playbookId,
  playbookVersion,
  weatherFeaturesId,
}) {
  const canonicalRecommendation = getRecommendation("rec_20260211_0002") ?? getRecommendation("rec_20260211_0001");
  if (!canonicalRecommendation) {
    return {
      recommendationId: nextRecommendationId(),
      observationId,
      playbookId,
      playbookVersion,
      weatherFeaturesId,
      generatedAt: nowIso(),
      issue: "powdery_mildew",
      severity: "moderate",
      action: "Apply sulfur-based contact spray in affected block.",
      rationale: ["standard_timing"],
      timingWindow: {
        startAt: nowIso(),
        endAt: nowIso(),
        localTimezone: "America/Los_Angeles",
        confidence: 0.75,
        drivers: ["seeded=false"],
      },
      riskFlags: [],
      requiredConfirmation: true,
      status: "pending_confirmation",
    };
  }

  return {
    ...canonicalRecommendation,
    recommendationId: nextRecommendationId(),
    observationId,
    playbookId,
    playbookVersion,
    weatherFeaturesId,
    generatedAt: nowIso(),
    status: "pending_confirmation",
  };
}

function nextRecommendationId() {
  const previous = Number(getState("recommendation_counter") ?? "2");
  const next = previous + 1;
  setState("recommendation_counter", String(next));
  const now = new Date();
  const date =
    String(now.getUTCFullYear()) +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");
  return `rec_${date}_${String(next).padStart(4, "0")}`;
}

function nextCursorId() {
  const previous = Number(getState("cursor_counter") ?? "1");
  const next = previous + 1;
  setState("cursor_counter", String(next));
  const now = new Date();
  const date =
    String(now.getUTCFullYear()) +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");
  return `cur_${date}_${String(next).padStart(4, "0")}`;
}

function getState(key) {
  const row = db.prepare("SELECT state_value FROM state WHERE state_key = ?").get(key);
  return row ? row.state_value : null;
}

function setState(key, value) {
  db.prepare(
    `
    INSERT INTO state (state_key, state_value)
    VALUES (?, ?)
    ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value
    `,
  ).run(key, value);
}
