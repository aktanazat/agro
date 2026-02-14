import { useState } from "react";
import { useStore } from "../data/store";
import { FixtureSource } from "../data/fixture-source";
import type { PatchApplyResult } from "../data/types";

export function Playbooks() {
  const { state, dispatch } = useStore();
  const { playbook, patches, patchResult } = state;
  const patch = patches[0]; // canonical patch pch_20260211_0001
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PatchApplyResult | null>(patchResult);
  const [showJson, setShowJson] = useState(false);

  if (!playbook || !patch) return null;

  const rule = playbook.rules["rule_pm_moderate"];
  const currentWind = rule?.constraints?.maxWindKph as number;

  async function handleApply() {
    setApplying(true);
    setError(null);
    const source = state.source as FixtureSource;
    const res = await source.applyPatch(patch);
    if (res.status === "rejected") {
      setError(res.validationErrors.join("; "));
      setApplying(false);
      return;
    }
    setResult(res);
    const patched = await source.getPlaybook(res.playbookId, res.newVersion);
    dispatch({ type: "PATCH_APPLIED", result: res, patchedPlaybook: patched });
    setApplying(false);
  }

  const applied = result?.status === "applied";

  return (
    <div className="h-full flex">
      {/* Left: playbook + patch panel */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Playbooks</h2>
        </div>

        {/* Playbook header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-slate-700">{playbook.playbookId}</span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-mono font-medium rounded">
              v{playbook.version}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {playbook.region.replace(/_/g, " ")} &middot; {playbook.crop} &middot; updated {playbook.updatedAt}
          </p>
        </div>

        {/* Version history */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Version History</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="pb-1.5 font-medium">Version</th>
                <th className="pb-1.5 font-medium">Wind Limit</th>
                <th className="pb-1.5 font-medium">Change</th>
                <th className="pb-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-600">
              <tr className="border-t border-slate-100">
                <td className="py-2">v3</td>
                <td className="py-2">12 kph</td>
                <td className="py-2 text-slate-400">baseline</td>
                <td className="py-2">
                  {!applied ? (
                    <span className="text-emerald-600">active</span>
                  ) : (
                    <span className="text-slate-400">superseded</span>
                  )}
                </td>
              </tr>
              {applied && (
                <tr className="border-t border-slate-100 bg-emerald-50/50">
                  <td className="py-2">v4</td>
                  <td className="py-2">10 kph</td>
                  <td className="py-2 text-amber-600">pch_20260211_0001</td>
                  <td className="py-2 text-emerald-600">active</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Patch panel */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Patch: {patch.patchId}
          </h3>

          {/* Before/After diff */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">Before (v3)</p>
              <div className="font-mono text-xs space-y-1">
                <Row label="maxWindKph" value="12" highlight={!applied} color="red" />
                <Row label="avoidInversion" value="true" />
                <Row label="maxRelativeHumidityPct" value="85" />
                <Row label="minHoursWithoutRain" value="4" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">After (v4)</p>
              <div className="font-mono text-xs space-y-1">
                <Row label="maxWindKph" value={String(applied ? 10 : "?")} highlight color="green" />
                <Row label="avoidInversion" value="true" />
                <Row label="maxRelativeHumidityPct" value="85" />
                <Row label="minHoursWithoutRain" value="4" />
              </div>
            </div>
          </div>

          {/* Operation detail */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs font-mono">
            <p className="text-slate-400 mb-1">Operation:</p>
            <p className="text-slate-700">
              <span className="text-blue-600">{patch.operations[0].op}</span>{" "}
              {patch.operations[0].path} &rarr;{" "}
              <span className="text-amber-600">{String(patch.operations[0].value)}</span>
            </p>
            <p className="text-slate-400 mt-1">Reason: {patch.reason}</p>
          </div>

          {/* Allowlist info */}
          <div className="mb-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">Editable Paths (allowlist)</p>
            <div className="space-y-0.5">
              {rule?.editablePaths.map((p) => (
                <p key={p} className="text-[11px] font-mono text-slate-500">{p}</p>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-mono">
              {error}
            </div>
          )}

          {!applied ? (
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              {applying ? "Applying..." : "Apply Patch"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Patch applied &mdash; v{result!.oldVersion} &rarr; v{result!.newVersion}
              </div>
              {result!.recomputedRecommendationId && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                  <p className="font-medium text-amber-800 mb-1">Recomputed Recommendation</p>
                  <p className="font-mono text-amber-700">
                    rec_20260211_0001 &rarr; {result!.recomputedRecommendationId}
                  </p>
                  <p className="text-amber-600 mt-1">
                    Timing window tightened: 21:15:00 &ndash; 23:30:00 (was 21:00:00 &ndash; 00:30:00)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audit event */}
        {applied && (
          <div className="px-6 py-4">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Audit Trail</h3>
            <div className="text-xs font-mono text-slate-600 space-y-1">
              <p>{result!.appliedAt} &mdash; patch {result!.patchId} applied by {patch.requestedByDeviceId}</p>
              <p>version {result!.oldVersion} &rarr; {result!.newVersion} &mdash; recomputed {result!.recomputedRecommendationId}</p>
            </div>
          </div>
        )}
      </div>

      {/* Inspector */}
      <div className="w-96 shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {showJson ? "Patch JSON" : "Playbook JSON"}
          </h3>
          <div className="flex gap-1">
            <TabBtn active={!showJson} onClick={() => setShowJson(false)}>Playbook</TabBtn>
            <TabBtn active={showJson} onClick={() => setShowJson(true)}>Patch</TabBtn>
          </div>
        </div>
        <pre className="inspector-json flex-1 overflow-auto p-4 text-xs font-mono text-slate-600 whitespace-pre-wrap break-all">
          {JSON.stringify(showJson ? patch : playbook, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, color }: {
  label: string; value: string; highlight?: boolean; color?: "red" | "green";
}) {
  const cls = highlight
    ? color === "red"
      ? "text-red-600 line-through"
      : "text-emerald-700 font-semibold"
    : "text-slate-600";
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
        active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}
