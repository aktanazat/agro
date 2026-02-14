import { useEffect, useReducer, useState } from "react";
import { FixtureSource } from "./data/fixture-source";
import { StoreContext, reducer, type AppState } from "./data/store";
import type { DataSource } from "./data/datasource";
import { Layout } from "./components/Layout";

const fixtureSource = new FixtureSource();

const initialState: AppState = {
  source: fixtureSource,
  liveMode: false,
  weatherMode: "demo",
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
    loadFixtures(fixtureSource).then((data) => {
      dispatch({ type: "SET_DATA", ...data });
      setLoading(false);
    });
  }, []);

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
  const [observations, recommendations, playbook, weather, patch, trace] =
    await Promise.all([
      source.listObservations(),
      source.listRecommendations(),
      source.getPlaybook("pbk_yolo_grape"),
      source.getWeatherFeatures("wxf_20260211_demo_01"),
      source.getPatch("pch_20260211_0001"),
      source.getTrace("obs_20260211_0001"),
    ]);
  return { observations, recommendations, playbook, weather, patches: [patch], trace };
}
