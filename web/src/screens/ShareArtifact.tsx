import { useState } from "react";
import { useStore } from "../data/store";
import { buildSharePayload, buildShareSummary } from "fieldscout-ai-pipeline/share-payload";

export function ShareArtifact() {
  const { state } = useStore();
  const [copied, setCopied] = useState(false);

  const obs = state.observations[0];
  const rec = state.recommendations.find((r) => r.recommendationId === "rec_20260211_0001");

  if (!obs || !rec) {
    return <div className="p-6 text-sm text-slate-400">No data to share.</div>;
  }

  const weatherMode = state.weather?.sourceMode ?? "demo";
  const summary = buildShareSummary(obs, rec, weatherMode);
  const sharePayload = buildSharePayload(obs, rec, weatherMode);
  const consoleUrl = `${window.location.origin}/#obs=${obs.observationId}`;

  function handleCopy() {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Share</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Visit summary for field team handoff
          </p>
        </div>

        {/* Visit Summary Card */}
        <div className="px-6 py-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="bg-slate-900 px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">FieldScout Copilot</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Visit Summary</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                offline
              </span>
            </div>

            {/* Card body */}
            <div className="px-6 py-5 space-y-5 text-sm">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {obs.extraction.fieldBlock} {obs.extraction.variety ?? obs.extraction.crop}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {obs.createdAt} &middot; {obs.captureMode} capture
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                <Field label="Issue" value={obs.extraction.issue.replace(/_/g, " ")} />
                <Field label="Severity" value={obs.extraction.severity} />
                <Field label="Leaf Wetness" value={obs.normalization.leafWetness} />
                <Field label="Wind" value={`${obs.normalization.windEstimateKph} kph`} />
              </div>

              <div className="text-xs text-slate-500">
                <span className="text-slate-400">Symptoms: </span>
                {obs.extraction.symptoms.join(", ")}
              </div>

              <hr className="border-slate-100" />

              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">Recommendation</p>
                <p className="text-sm text-slate-800 font-medium leading-relaxed">{rec.action}</p>
              </div>

              <div className="bg-emerald-50 rounded-lg px-4 py-4">
                <p className="text-[10px] text-emerald-700 uppercase tracking-wide mb-2">Spray Window</p>
                <p className="text-sm font-mono font-semibold text-emerald-800">
                  {rec.timingWindow.startAt}
                </p>
                <p className="text-sm font-mono text-emerald-700 mt-1">
                  to {rec.timingWindow.endAt}
                </p>
                <p className="text-[11px] text-emerald-600 mt-2">
                  Confidence: {Math.round(rec.timingWindow.confidence * 100)}%
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-mono text-slate-500 pt-1">
                <p>obs: {obs.observationId}</p>
                <p>rec: {rec.recommendationId}</p>
                <p>playbook: v{rec.playbookVersion}</p>
                <p>device: {obs.deviceId}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              {copied ? "Copied!" : "Copy as Text"}
            </button>
            <a
              href={`sms:?body=${encodeURIComponent(summary)}`}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Send via SMS
            </a>
          </div>

          {/* Plain text preview */}
          <div className="mt-8">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">
              Plain Text Preview
            </p>
            <pre className="text-[13px] leading-relaxed font-mono text-slate-600 bg-slate-100 rounded-lg p-5 whitespace-pre-wrap">
              {summary}
            </pre>
          </div>

          {/* Console link */}
          <div className="mt-5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Console Link</p>
            <p className="text-xs font-mono text-blue-600 break-all">{consoleUrl}</p>
          </div>
        </div>
      </div>

      {/* JSON inspector */}
      <div className="w-96 shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Share Payload
          </h3>
        </div>
        <pre className="inspector-json flex-1 overflow-auto p-4 text-xs font-mono text-slate-600 whitespace-pre-wrap break-all">
          {JSON.stringify(sharePayload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-700 font-medium">{value}</span>
    </div>
  );
}

