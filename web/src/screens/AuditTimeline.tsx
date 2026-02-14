import { useState } from "react";
import { useStore } from "../data/store";
import { buildAuditLog, type AuditEvent } from "fieldscout-ai-pipeline/audit-log";

function deriveEvents(state: ReturnType<typeof useStore>["state"]): AuditEvent[] {
  const obs = state.observations[0];
  const rec1 = state.recommendations.find((r) => r.recommendationId === "rec_20260211_0001");
  const rec2 = state.recommendations.find((r) => r.recommendationId === "rec_20260211_0002");
  const patch = state.patches[0];

  const recs = [rec1, rec2].filter((r): r is NonNullable<typeof r> => r != null);

  return buildAuditLog({
    observation: obs ? {
      ...obs,
      captureMode: obs.captureMode as "voice" | "typed",
      status: obs.status as "confirmed",
      deterministicChecksum: obs.deterministicChecksum,
    } : undefined,
    recommendations: recs,
    patch: (patch && state.patchResult) ? patch : undefined,
    patchResult: state.patchResult ?? undefined,
    recomputedRecommendation: (rec2 && state.patchResult) ? rec2 : undefined,
  });
}

const EVENT_COLORS: Record<string, string> = {
  "observation.created": "bg-blue-500",
  "observation.confirmed": "bg-emerald-500",
  "extraction.completed": "bg-cyan-500",
  "extraction.fallback_used": "bg-amber-400",
  "validation.passed": "bg-teal-500",
  "validation.failed": "bg-red-400",
  "recommendation.generated": "bg-violet-500",
  "recommendation.confirmed": "bg-emerald-600",
  "playbook.patch_applied": "bg-amber-500",
  "playbook.patch_rejected": "bg-red-500",
  "recommendation.recomputed": "bg-rose-500",
};

export function AuditTimeline() {
  const { state } = useStore();
  const events = deriveEvents(state);
  const [selected, setSelected] = useState<AuditEvent | null>(events[0] ?? null);

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Audit Log</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable event timeline — {events.length} event{events.length !== 1 && "s"}
          </p>
        </div>

        <div className="px-6 py-4">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-3 bottom-3 w-px bg-slate-200" />

            <div className="space-y-0">
              {events.map((ev, i) => (
                <button
                  key={`${ev.event}-${i}`}
                  onClick={() => setSelected(ev)}
                  className={`relative w-full text-left pl-8 pr-4 py-3 rounded-lg transition-colors ${
                    selected === ev ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  {/* Dot */}
                  <div className={`absolute left-1 top-4 w-3 h-3 rounded-full border-2 border-white ${EVENT_COLORS[ev.event] ?? "bg-slate-400"}`} />

                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {ev.timestamp}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">
                    {ev.event}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {ev.entityId}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{ev.detail}</p>
                  {ev.causedBy && (
                    <p className="text-[10px] text-amber-600 mt-1">
                      triggered by {ev.causedBy}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {events.length === 0 && (
            <p className="text-sm text-slate-400 py-8 text-center">
              No audit events yet. Apply a patch to see the causal chain.
            </p>
          )}
        </div>
      </div>

      {/* JSON inspector */}
      <div className="w-96 shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {selected ? selected.event : "Event JSON"}
          </h3>
          {selected && (
            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{selected.entityId}</p>
          )}
        </div>
        <pre className="inspector-json flex-1 overflow-auto p-4 text-xs font-mono text-slate-600 whitespace-pre-wrap break-all">
          {selected ? JSON.stringify(selected.raw, null, 2) : "Select an event"}
        </pre>
      </div>
    </div>
  );
}
