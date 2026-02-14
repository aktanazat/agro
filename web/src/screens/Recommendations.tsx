import { useState } from "react";
import { useStore } from "../data/store";
import { Inspector } from "../components/Inspector";
import type { Recommendation } from "../data/types";

// Canonical wind constraints per playbook version
const WIND_BY_VERSION: Record<number, number> = { 3: 12, 4: 10 };

function windLimit(rec: Recommendation): string {
  const driver = rec.timingWindow.drivers.find((d) => d.startsWith("maxWindKph="));
  if (driver) return driver.split("=")[1] + " kph";
  const v = WIND_BY_VERSION[rec.playbookVersion];
  return v != null ? `${v} kph` : "—";
}

export function Recommendations() {
  const { state } = useStore();
  const [selected, setSelected] = useState<Recommendation | null>(
    state.recommendations[0] ?? null,
  );

  // Derive weather features used from the loaded weather fixture
  const wx = state.weather;

  return (
    <div className="h-full flex">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Recommendations</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {state.recommendations.length} record{state.recommendations.length !== 1 && "s"}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
              <th className="px-6 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Observation</th>
              <th className="px-3 py-2 font-medium">Window Start</th>
              <th className="px-3 py-2 font-medium">Window End</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
              <th className="px-3 py-2 font-medium">Playbook</th>
              <th className="px-3 py-2 font-medium">Wind Limit</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {state.recommendations.map((rec) => (
              <tr
                key={rec.recommendationId}
                onClick={() => setSelected(rec)}
                className={`border-b border-slate-100 cursor-pointer transition-colors ${
                  selected?.recommendationId === rec.recommendationId
                    ? "bg-slate-100"
                    : "hover:bg-slate-50"
                }`}
              >
                <td className="px-6 py-2.5 font-mono text-xs text-slate-600">
                  {rec.recommendationId}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-400">
                  {rec.observationId}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                  {rec.timingWindow.startAt}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                  {rec.timingWindow.endAt}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                  {Math.round(rec.timingWindow.confidence * 100)}%
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                  v{rec.playbookVersion}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-amber-600">
                  {windLimit(rec)}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                      rec.status === "confirmed"
                        ? "bg-emerald-50 text-emerald-700"
                        : rec.status === "pending_confirmation"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {rec.status.replace(/_/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inspector */}
      {selected && (
        <div className="w-96 shrink-0">
          <Inspector
            title={selected.recommendationId}
            data={selected}
            fields={[
              { label: "Recommendation ID", value: selected.recommendationId },
              { label: "Observation ID", value: selected.observationId },
              { label: "Playbook", value: `${selected.playbookId} v${selected.playbookVersion}` },
              { label: "Weather Features", value: selected.weatherFeaturesId },
              { label: "Generated At", value: selected.generatedAt },
              { label: "Issue", value: selected.issue },
              { label: "Severity", value: selected.severity },
              { label: "Action", value: selected.action },
              { label: "Window Start", value: selected.timingWindow.startAt },
              { label: "Window End", value: selected.timingWindow.endAt },
              { label: "Timezone", value: selected.timingWindow.localTimezone },
              { label: "Confidence", value: selected.timingWindow.confidence },
              { label: "Wind Limit", value: windLimit(selected) },
              { label: "Drivers", value: selected.timingWindow.drivers.join(", ") },
              { label: "Rationale", value: selected.rationale.join(", ") },
              { label: "Risk Flags", value: selected.riskFlags.length ? selected.riskFlags.join(", ") : "none" },
              { label: "Status", value: selected.status },
              // Derived weather features used by rules engine
              ...(wx ? [
                { label: "─── Derived Weather Features ───", value: "" },
                { label: "Source", value: `${wx.weatherFeaturesId} (${wx.sourceMode})` },
                { label: "inversionPresent", value: wx.inversionPresent },
                { label: "humidityLayering", value: wx.humidityLayering },
                { label: "windShearProxy", value: wx.windShearProxy },
                { label: "─── Computed Metrics ───", value: "" },
                { label: "sprayWindowScore", value: `${wx.sprayWindowScore} (from inversion + humidity + wind)` },
                { label: "diseaseRiskScore", value: `${wx.diseaseRiskScore} (from humidity + temperature gradient)` },
              ] : []),
            ]}
          />
        </div>
      )}
    </div>
  );
}
