import { useMemo, useState } from "react";
import { useStore } from "../data/store";
import { getPipelineStatus, formatInferenceLabel } from "fieldscout-ai-pipeline/pipeline-status";
import { Observations } from "../screens/Observations";
import { Recommendations } from "../screens/Recommendations";
import { Playbooks } from "../screens/Playbooks";
import { Trace } from "../screens/Trace";
import { AuditTimeline } from "../screens/AuditTimeline";
import { ShareArtifact } from "../screens/ShareArtifact";

const NAV_MAIN = [
  { id: "observations", label: "Observations" },
  { id: "recommendations", label: "Recommendations" },
  { id: "playbooks", label: "Playbooks" },
  { id: "trace", label: "Trace" },
] as const;

const NAV_EXTRA = [
  { id: "audit", label: "Audit Log" },
  { id: "share", label: "Share" },
] as const;

type Screen = (typeof NAV_MAIN)[number]["id"] | (typeof NAV_EXTRA)[number]["id"];

export function Layout() {
  const [screen, setScreen] = useState<Screen>("observations");
  const { state } = useStore();
  const pipelineStatus = useMemo(
    () =>
      getPipelineStatus({
        weatherMode: state.weatherMode,
        dataMode: state.liveMode ? "live" : "fixture",
        activePlaybookVersion: state.activePlaybookVersion,
      }),
    [state.weatherMode, state.liveMode, state.activePlaybookVersion],
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <nav className="w-52 shrink-0 bg-slate-900 text-slate-300 flex flex-col">
        <div className="px-4 py-5 border-b border-slate-700">
          <h1 className="text-sm font-semibold text-white tracking-wide">
            FieldScout Copilot
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
            dev_ios_001
          </p>
        </div>

        <div className="flex-1 py-3 flex flex-col">
          {NAV_MAIN.map((item) => (
            <NavBtn key={item.id} active={screen === item.id} onClick={() => setScreen(item.id)}>
              {item.label}
            </NavBtn>
          ))}
          <div className="mt-3 mb-1 px-4">
            <div className="border-t border-slate-700" />
          </div>
          {NAV_EXTRA.map((item) => (
            <NavBtn key={item.id} active={screen === item.id} onClick={() => setScreen(item.id)}>
              {item.label}
            </NavBtn>
          ))}
        </div>

        {/* Status badges */}
        <div className="px-4 py-3 border-t border-slate-700 space-y-1.5 text-[11px]">
          <StatusRow label="Data" value={pipelineStatus.dataMode} />
          <StatusRow label="Weather">
            <ModeBadge mode={pipelineStatus.weatherMode} />
          </StatusRow>
          <StatusRow label="Playbook" value={`v${pipelineStatus.activePlaybookVersion}`} />
          <StatusRow label="Offline" value={pipelineStatus.offlineMode ? "true" : "false"} />
          <StatusRow label="Inference">
            <span className="inline-flex items-center gap-1 font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              {formatInferenceLabel(pipelineStatus.inferenceMode)} (trace)
            </span>
          </StatusRow>
          <StatusRow label="Device" value={pipelineStatus.deviceId} />
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {screen === "observations" && <Observations />}
        {screen === "recommendations" && <Recommendations />}
        {screen === "playbooks" && <Playbooks />}
        {screen === "trace" && <Trace />}
        {screen === "audit" && <AuditTimeline />}
        {screen === "share" && <ShareArtifact />}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
        active ? "bg-slate-800 text-white font-medium" : "hover:bg-slate-800/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function StatusRow({ label, value, children }: {
  label: string; value?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      {children ?? <span className="font-mono text-slate-400">{value}</span>}
    </div>
  );
}

function ModeBadge({ mode, label }: { mode: "demo" | "live"; label?: string }) {
  const isDemo = mode === "demo";
  return (
    <span className={`inline-flex items-center gap-1 font-mono ${isDemo ? "text-amber-400" : "text-emerald-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? "bg-amber-400" : "bg-emerald-400"}`} />
      {label ?? mode}
    </span>
  );
}
