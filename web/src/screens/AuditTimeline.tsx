import { useState } from "react";
import { useStore } from "../data/store";

interface AuditEvent {
  timestamp: string;
  event: string;
  entityId: string;
  detail: string;
  causedBy?: string;
  raw: unknown;
}

function deriveEvents(state: ReturnType<typeof useStore>["state"]): AuditEvent[] {
  const events: AuditEvent[] = [];
  const obs = state.observations[0];
  const rec1 = state.recommendations.find((r) => r.recommendationId === "rec_20260211_0001");
  const rec2 = state.recommendations.find((r) => r.recommendationId === "rec_20260211_0002");
  const patch = state.patches[0];

  if (obs) {
    events.push({
      timestamp: obs.createdAt,
      event: "observation.created",
      entityId: obs.observationId,
      detail: `${obs.extraction.fieldBlock} ${obs.extraction.crop} — ${obs.extraction.issue} (${obs.extraction.severity})`,
      raw: obs,
    });
    events.push({
      timestamp: obs.createdAt,
      event: "observation.confirmed",
      entityId: obs.observationId,
      detail: `Status → confirmed | checksum ${obs.deterministicChecksum}`,
      raw: { observationId: obs.observationId, status: obs.status, checksum: obs.deterministicChecksum },
    });
  }

  if (rec1) {
    events.push({
      timestamp: rec1.generatedAt,
      event: "recommendation.generated",
      entityId: rec1.recommendationId,
      detail: `${rec1.action} | window ${rec1.timingWindow.startAt} – ${rec1.timingWindow.endAt}`,
      raw: rec1,
    });
  }

  if (patch && state.patchResult) {
    events.push({
      timestamp: patch.requestedAt,
      event: "playbook.patch_applied",
      entityId: patch.patchId,
      detail: `${patch.playbookId} v${patch.baseVersion} → v${patch.baseVersion + 1} | ${patch.operations[0].path}: ${12} → ${patch.operations[0].value}`,
      raw: patch,
    });
  }

  if (rec2 && state.patchResult) {
    events.push({
      timestamp: rec2.generatedAt,
      event: "recommendation.recomputed",
      entityId: rec2.recommendationId,
      detail: `Tightened window ${rec2.timingWindow.startAt} – ${rec2.timingWindow.endAt} (was 21:00:00 – 00:30:00)`,
      causedBy: "pch_20260211_0001",
      raw: rec2,
    });
  }

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

const EVENT_COLORS: Record<string, string> = {
  "observation.created": "bg-blue-500",
  "observation.confirmed": "bg-emerald-500",
  "recommendation.generated": "bg-violet-500",
  "playbook.patch_applied": "bg-amber-500",
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
