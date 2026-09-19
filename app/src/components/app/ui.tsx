"use client";

import { useEffect, useMemo, useState } from "react";

export const explorerAddress = (a: string) =>
  `https://explorer.solana.com/address/${a}?cluster=devnet`;
export const explorerTx = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;

export function shorten(address: string, n = 4) {
  return `${address.slice(0, n)}…${address.slice(-n)}`;
}

export function formatSol(x: number) {
  return x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Class strings shared across the app so every control looks like one product. */
export const btn = {
  primary: "btn-brass px-4 py-2.5 text-sm disabled:opacity-40 disabled:pointer-events-none",
  quiet: "btn-ghost px-4 py-2.5 text-sm disabled:opacity-40 disabled:pointer-events-none",
  danger:
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-flare/60 text-flare px-4 py-2.5 text-sm font-medium transition-colors hover:bg-flare hover:text-night disabled:opacity-40 disabled:pointer-events-none",
};

export const inputClass =
  "w-full rounded-lg bg-deep/70 border border-edge px-3 py-2.5 text-sm text-bone placeholder:text-mute/60 transition-colors focus:outline-none focus:border-brass";

/** 0 empty, 1 brass, 2 flare, 3 verdict */
export const STATUS: Record<
  string,
  { label: string; pill: string; track: [number, number, number] }
> = {
  awaitingAcceptance: { label: "Awaiting acceptance", pill: "bg-brass text-night", track: [1, 0, 0] },
  active: { label: "Active", pill: "border border-brass text-brass bg-brass/10", track: [1, 1, 0] },
  disputed: { label: "Disputed", pill: "bg-flare text-night", track: [1, 2, 0] },
  completed: { label: "Completed", pill: "bg-verdict text-night", track: [3, 3, 3] },
  refunded: { label: "Refunded", pill: "border border-edge bg-raised text-mute", track: [3, 3, 3] },
};

const TRACK_COLOR = ["bg-edge", "bg-brass", "bg-flare", "bg-verdict"];

export function Track({ status }: { status: string }) {
  const t = STATUS[status]?.track ?? [0, 0, 0];
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {t.map((v, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${TRACK_COLOR[v]}`} />
      ))}
    </div>
  );
}

export function nextStep(status: string, isClient: boolean): string {
  switch (status) {
    case "awaitingAcceptance":
      return isClient
        ? "Waiting for the expert to accept. You can still cancel and get every SOL back."
        : "The client's SOL is already locked. Accept the job to start.";
    case "active":
      return isClient
        ? "The SOL is locked. Release it when you're happy with the work, or raise a dispute."
        : "The SOL is locked. If the client doesn't release it, you can raise a dispute.";
    case "disputed":
      return "The SOL is frozen. Both sides file evidence, then press Resolve with AI.";
    case "completed":
      return "Settled. The SOL went to the expert.";
    case "refunded":
      return "Settled. The SOL went back to the client.";
    default:
      return "";
  }
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true))}
      className="text-xs text-mute hover:text-brass transition-colors px-1.5 py-0.5 rounded"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** File picker with an image preview. Same accepted types as before. */
export function AttachmentPicker({
  file,
  onChange,
  disabled,
  tone = "brass",
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
  tone?: "brass" | "flare";
}) {
  const preview = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file]
  );
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const hover = tone === "flare" ? "hover:border-flare" : "hover:border-brass";

  return (
    <div>
      <p className="text-xs text-mute mb-1.5">Attach a screenshot or file (optional)</p>
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-edge bg-deep/70 p-2.5">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-12 rounded object-cover border border-edge" />
          ) : (
            <span className="size-12 grid place-items-center rounded border border-edge text-xs text-mute">
              File
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate">{file.name}</p>
            <p className="text-xs text-mute">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="text-xs text-mute hover:text-flare transition-colors px-2 py-1"
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-edge bg-deep/40 px-3 py-4 text-sm text-mute transition-colors ${hover} hover:text-bone`}
        >
          Choose an image or PDF
          <input
            type="file"
            accept="image/*,.pdf"
            disabled={disabled}
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
      )}
    </div>
  );
}
