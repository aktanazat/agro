import { createContext, useContext } from "react";
import type {
  Observation,
  Recommendation,
  Playbook,
  WeatherFeatures,
  PlaybookPatch,
  TraceData,
  PatchApplyResult,
} from "./types";
import type { DataSource } from "./datasource";

export interface AppState {
  source: DataSource;
  liveMode: boolean;
  weatherMode: "demo" | "live";
  observations: Observation[];
  recommendations: Recommendation[];
  playbook: Playbook | null;
  weather: WeatherFeatures | null;
  patches: PlaybookPatch[];
  trace: TraceData | null;
  activePlaybookVersion: number;
  patchResult: PatchApplyResult | null;
  selectedId: string | null;
}

export type Action =
  | { type: "SET_DATA"; observations: Observation[]; recommendations: Recommendation[]; playbook: Playbook; weather: WeatherFeatures; patches: PlaybookPatch[]; trace: TraceData }
  | { type: "SET_LIVE_MODE"; enabled: boolean }
  | { type: "SET_SOURCE"; source: DataSource; liveMode: boolean }
  | { type: "SELECT"; id: string | null }
  | { type: "PATCH_APPLIED"; result: PatchApplyResult; patchedPlaybook: Playbook; recommendations: Recommendation[] }
  | { type: "SWAP_RECOMMENDATION"; from: string; to: string };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_DATA":
      return {
        ...state,
        observations: action.observations,
        recommendations: action.recommendations,
        playbook: action.playbook,
        weather: action.weather,
        patches: action.patches,
        trace: action.trace,
        activePlaybookVersion: action.playbook.version,
      };
    case "SET_LIVE_MODE":
      return { ...state, liveMode: action.enabled, weatherMode: action.enabled ? "live" : "demo" };
    case "SET_SOURCE":
      return {
        ...state,
        source: action.source,
        liveMode: action.liveMode,
        weatherMode: action.liveMode ? "live" : "demo",
      };
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "PATCH_APPLIED":
      return {
        ...state,
        patchResult: action.result,
        playbook: action.patchedPlaybook,
        recommendations: action.recommendations,
        activePlaybookVersion: action.result.newVersion,
      };
    case "SWAP_RECOMMENDATION": {
      const active = state.recommendations.map((r) =>
        r.recommendationId === action.to ? { ...r, status: "pending_confirmation" } : r
      );
      return { ...state, recommendations: active };
    }
    default:
      return state;
  }
}

export const StoreContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreContext.Provider");
  return ctx;
}
