import { useEffect, useReducer, useState } from "react";
import { createExtractionAdapter } from "fieldscout-ai-pipeline/pipeline";
import { FixtureSource } from "./data/fixture-source";
import { LiveSource } from "./data/live-source";
import { StoreContext, reducer, type AppState } from "./data/store";
import type { DataSource } from "./data/datasource";
import type { Observation } from "./data/types";
import { Layout } from "./components/Layout";

const fixtureSource = new FixtureSource();
const liveSource = new LiveSource();
const prefersLive = import.meta.env.VITE_USE_LIVE_SOURCE === "true";
const initialSource: DataSource = prefersLive ? liveSource : fixtureSource;

const initialState: AppState = {
  source: initialSource,
  liveMode: prefersLive,
  weatherMode: prefersLive ? "live" : "demo",
  observations: [],
  recommendations: [],
  playbook: null,
  weather: null,
  patches: [],
  trace: null,
  activePlaybookVersion: 3,
  patchResult: null,
  selectedId: null,
};

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadFixtures(initialSource)
      .then((data) => {
        if (cancelled) {
          return;
        }
        dispatch({ type: "SET_DATA", ...data });
        setLoading(false);
      })
      .catch(() => {
        loadFixtures(fixtureSource).then((data) => {
          if (cancelled) {
            return;
          }
          dispatch({ type: "SET_SOURCE", source: fixtureSource, liveMode: false });
          dispatch({ type: "SET_DATA", ...data });
          setLoading(false);
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.source.kind !== "live") {
      return;
    }
    const intervalId = window.setInterval(() => {
      loadFixtures(state.source)
        .then((data) => {
          dispatch({ type: "SET_DATA", ...data });
        })
        .catch(() => {});
    }, 3000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.source]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-slate-400">
        Loading fixtures...
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      <Layout />
    </StoreContext.Provider>
  );
}

async function loadFixtures(source: DataSource) {
  const [fixtureObservations, recommendations, playbook, weather] =
    await Promise.all([
      source.listObservations(),
      source.listRecommendations(),
      source.getPlaybook("pbk_yolo_grape"),
      source.getWeatherFeatures("wxf_20260211_demo_01"),
    ]);
  const traceObservationId = fixtureObservations[0]?.observationId ?? "obs_20260211_0001";
  const [patch, trace] = await Promise.all([
    source
      .getPatch("pch_20260211_0001")
      .catch(() => fixtureSource.getPatch("pch_20260211_0001")),
    source.getTrace(traceObservationId).catch(() => fixtureSource.getTrace("obs_20260211_0001")),
  ]);
  const observations = await Promise.all(
    fixtureObservations.map((observation) => hydrateObservationWithPipeline(observation)),
  );
  return { observations, recommendations, playbook, weather, patches: [patch], trace };
}

async function hydrateObservationWithPipeline(observation: Observation): Promise<Observation> {
  const adapter = createExtractionAdapter({
    deviceId: observation.deviceId,
    location: observation.location,
  });
  const source = observation.transcription.source;
  const transcriptionSource =
    source === "on_device_asr" || source === "manual_typed" || source === "none"
      ? source
      : "none";

  const result = await adapter.extract({
    observationId: observation.observationId,
    captureMode: observation.captureMode,
    rawNoteText: observation.rawNoteText,
    transcription: {
      text: observation.transcription.text,
      source: transcriptionSource,
      confidence: observation.transcription.confidence,
    },
  });

  if (!result.ok) {
    return observation;
  }

  return {
    ...observation,
    extraction: {
      ...result.observation.extraction,
      variety: result.observation.extraction.variety ?? null,
    },
    normalization: result.observation.normalization,
    status: result.observation.status,
    schemaVersion: result.observation.schemaVersion,
    deterministicChecksum: result.observation.deterministicChecksum,
  };
}
