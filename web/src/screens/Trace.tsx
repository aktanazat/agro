import { useStore } from "../data/store";
import { evaluateThresholds, deriveOverallStatus, type OverallStatus } from "fieldscout-ai-pipeline/thresholds";

const STATUS_COLOR: Record<OverallStatus, "emerald" | "amber" | "red"> = {
  PASS: "emerald", WARN: "amber", FAIL: "red",
};

export function Trace() {
  const { state } = useStore();
  const trace = state.trace;

  if (!trace) {
    return (
      <div className="p-6 text-sm text-slate-400">No trace data loaded.</div>
    );
  }

  const stageTimings: Record<string, number> = {};
  for (const s of trace.stages) stageTimings[s.stage] = s.durationMs;
  const thresholdResults = evaluateThresholds(stageTimings, trace.totalDurationMs);
  const status = deriveOverallStatus(trace.totalDurationMs, thresholdResults);
  const statusColor = STATUS_COLOR[status];
  const warnings = thresholdResults.filter((t) => !t.pass);
  const statusSub = warnings.length > 0 ? `${warnings.length} threshold warning${warnings.length > 1 ? "s" : ""}` : undefined;

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Trace</h2>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            {trace.traceId}
          </p>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Summary
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Total Duration" value={`${trace.totalDurationMs} ms`} sub={formatDuration(trace.totalDurationMs)} />
            <SummaryCard label="Status" value={status} color={statusColor} sub={statusSub} />
            <SummaryCard label="Stages" value={String(trace.stages.length)} sub="completed" />
          </div>
        </div>

        {/* Stage breakdown */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Stage Breakdown
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="pb-2 font-medium">Stage</th>
                <th className="pb-2 font-medium">Start</th>
                <th className="pb-2 font-medium">End</th>
                <th className="pb-2 font-medium text-right">Duration</th>
                <th className="pb-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-600">
              {trace.stages.map((s) => (
                <tr key={s.stage} className="border-t border-slate-100">
                  <td className="py-2 text-slate-800 font-medium">{s.stage}</td>
                  <td className="py-2 text-slate-500">{formatIsoTime(s.startedAt)}</td>
                  <td className="py-2 text-slate-500">{formatIsoTime(s.endedAt)}</td>
                  <td className="py-2 text-right">{s.durationMs} ms</td>
                  <td className="py-2 text-right">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                      s.status === "completed" ? "bg-emerald-500" : "bg-red-500"
                    }`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Timeline bar */}
          <div className="mt-4">
            <div className="flex h-6 rounded overflow-hidden">
              {trace.stages.map((s, i) => {
                const pct = (s.durationMs / trace.totalDurationMs) * 100;
                return (
                  <div
                    key={s.stage}
                    className={`h-full flex items-center justify-center text-[9px] text-white font-medium ${STAGE_COLORS[i % STAGE_COLORS.length]}`}
                    style={{ width: `${pct}%` }}
                    title={`${s.stage}: ${s.durationMs}ms`}
                  >
                    {pct > 8 ? s.stage.replace(/_/g, " ") : ""}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-mono">
              <span>0s</span>
              <span>{(trace.totalDurationMs / 1000).toFixed(0)}s</span>
            </div>
          </div>
        </div>

        {/* Thresholds */}
        <div className="px-6 py-4">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Thresholds
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="pb-2 font-medium">Check</th>
                <th className="pb-2 font-medium text-right">Limit</th>
                <th className="pb-2 font-medium text-right">Actual</th>
                <th className="pb-2 font-medium text-right">Result</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-600">
              {thresholdResults.map((t) => (
                  <tr key={t.label} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">{t.label}</td>
                    <td className="py-2 text-right text-slate-400">{t.maxMs} ms</td>
                    <td className={`py-2 text-right ${t.pass ? "text-slate-600" : "text-red-600"}`}>
                      {t.actualMs} ms
                    </td>
                    <td className="py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                        t.pass ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}>
                        {t.pass ? "pass" : "fail"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON inspector */}
      <div className="w-96 shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Trace JSON
          </h3>
        </div>
        <pre className="inspector-json flex-1 overflow-auto p-4 text-xs font-mono text-slate-600 whitespace-pre-wrap break-all">
          {JSON.stringify(trace, null, 2)}
        </pre>
      </div>
    </div>
  );
}

const STAGE_COLORS = [
  "bg-slate-500", "bg-slate-600", "bg-slate-700", "bg-blue-500",
  "bg-blue-600", "bg-indigo-500", "bg-indigo-600", "bg-violet-500", "bg-violet-600",
];

function formatIsoTime(iso: string) {
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : iso;
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function SummaryCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: "emerald" | "amber" | "red";
}) {
  const valClass = color === "emerald"
    ? "text-emerald-600"
    : color === "amber"
      ? "text-amber-600"
      : color === "red"
        ? "text-red-600"
        : "text-slate-900";
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold font-mono mt-1 ${valClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
