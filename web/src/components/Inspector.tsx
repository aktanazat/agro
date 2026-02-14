import { useState } from "react";

interface Props {
  title: string;
  data: unknown;
  fields?: { label: string; value: string | number | boolean | null | undefined }[];
}

export function Inspector({ title, data, fields }: Props) {
  const [tab, setTab] = useState<"fields" | "json">(fields ? "fields" : "json");

  return (
    <div className="h-full flex flex-col border-l border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {title}
        </h3>
        {fields && (
          <div className="flex gap-1">
            <TabBtn active={tab === "fields"} onClick={() => setTab("fields")}>
              Fields
            </TabBtn>
            <TabBtn active={tab === "json"} onClick={() => setTab("json")}>
              JSON
            </TabBtn>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "fields" && fields ? (
          <div className="p-4 space-y-3">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-[10px] text-slate-400 uppercase tracking-wide">
                  {f.label}
                </dt>
                <dd className="text-sm text-slate-800 font-mono mt-0.5 break-all">
                  {String(f.value ?? "—")}
                </dd>
              </div>
            ))}
          </div>
        ) : (
          <pre className="inspector-json p-4 text-xs font-mono text-slate-600 whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
        active
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}
