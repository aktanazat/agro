import { useState } from "react";
import { useStore } from "../data/store";
import { Inspector } from "../components/Inspector";
import type { Observation } from "../data/types";

export function Observations() {
  const { state } = useStore();
  const [selected, setSelected] = useState<Observation | null>(
    state.observations[0] ?? null,
  );

  return (
    <div className="h-full flex">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Observations</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {state.observations.length} record{state.observations.length !== 1 && "s"}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
              <th className="px-6 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Issue</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium">Block</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Mode</th>
            </tr>
          </thead>
          <tbody>
            {state.observations.map((obs) => (
              <tr
                key={obs.observationId}
                onClick={() => setSelected(obs)}
                className={`border-b border-slate-100 cursor-pointer transition-colors ${
                  selected?.observationId === obs.observationId
                    ? "bg-slate-100"
                    : "hover:bg-slate-50"
                }`}
              >
                <td className="px-6 py-2.5 font-mono text-xs text-slate-600">
                  {obs.observationId}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                  {obs.createdAt}
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill color="purple">
                    {obs.extraction.issue.replace(/_/g, " ")}
                  </StatusPill>
                </td>
                <td className="px-3 py-2.5">
                  <SeverityPill severity={obs.extraction.severity} />
                </td>
                <td className="px-3 py-2.5 text-slate-700">
                  {obs.extraction.fieldBlock}
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill color={obs.status === "confirmed" ? "green" : "amber"}>
                    {obs.status}
                  </StatusPill>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">
                  {obs.captureMode}
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
            title={selected.observationId}
            data={selected}
            fields={[
              { label: "Observation ID", value: selected.observationId },
              { label: "Device", value: selected.deviceId },
              { label: "Created", value: selected.createdAt },
              { label: "Capture Mode", value: selected.captureMode },
              { label: "Crop", value: selected.extraction.crop },
              { label: "Variety", value: selected.extraction.variety },
              { label: "Field Block", value: selected.extraction.fieldBlock },
              { label: "Issue", value: selected.extraction.issue },
              { label: "Severity", value: selected.extraction.severity },
              { label: "Symptoms", value: selected.extraction.symptoms.join("; ") },
              { label: "Leaf Wetness", value: selected.normalization.leafWetness },
              { label: "Wind (kph)", value: selected.normalization.windEstimateKph },
              { label: "ASR Confidence", value: selected.transcription.confidence },
              { label: "Location", value: `${selected.location.lat}, ${selected.location.lon}` },
              { label: "Status", value: selected.status },
              { label: "Schema Version", value: selected.schemaVersion },
              { label: "Checksum", value: selected.deterministicChecksum },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function StatusPill({
  color,
  children,
}: {
  color: "green" | "amber" | "red" | "purple" | "blue";
  children: React.ReactNode;
}) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const color = severity === "low" ? "green" : severity === "moderate" ? "amber" : "red";
  return <StatusPill color={color}>{severity}</StatusPill>;
}
