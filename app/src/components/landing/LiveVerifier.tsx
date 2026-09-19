"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RecordFields, SAMPLE_RECORD, hashRecord } from "@/lib/sampleRecord";

const field =
  "w-full rounded-lg bg-deep/70 border border-edge px-3 py-2 text-sm text-bone placeholder:text-mute/60 transition-colors focus:outline-none focus:border-brass";

function HashGrid({
  hex,
  flags,
  matched,
  label,
}: {
  hex: string | null;
  flags?: boolean[];
  matched?: boolean;
  label: string;
}) {
  const chars = hex ? [...hex] : Array.from({ length: 64 }, () => "·");
  return (
    <div>
      <p className="text-xs text-mute mb-2">{label}</p>
      <span className="sr-only">{hex ?? "calculating"}</span>
      <div
        aria-hidden="true"
        className="addr grid grid-cols-8 gap-px rounded-lg overflow-hidden border border-edge bg-edge text-[13px] sm:text-sm"
      >
        {chars.map((c, i) => {
          const changed = flags?.[i];
          return (
            <span
              key={i}
              className={`py-1.5 text-center transition-colors duration-200 ${
                changed
                  ? "bg-flare/25 text-flare"
                  : matched
                    ? "bg-verdict/10 text-verdict"
                    : "bg-surface text-signal"
              }`}
            >
              {c}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function LiveVerifier() {
  const [rec, setRec] = useState<RecordFields>(SAMPLE_RECORD);
  const [recorded, setRecorded] = useState<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let alive = true;
    hashRecord(SAMPLE_RECORD)
      .then((h) => alive && setRecorded(h))
      .catch(() => alive && setBlocked(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const id = ++seq.current;
    hashRecord(rec)
      .then((h) => id === seq.current && setLive(h))
      .catch(() => setBlocked(true));
  }, [rec]);

  const diff = useMemo(() => {
    if (!recorded || !live) return null;
    const flags = [...live].map((c, i) => c !== recorded[i]);
    return { flags, count: flags.filter(Boolean).length };
  }, [recorded, live]);

  const matched = diff?.count === 0;
  const edited = JSON.stringify(rec) !== JSON.stringify(SAMPLE_RECORD);

  const set = <K extends keyof RecordFields>(k: K, v: RecordFields[K]) =>
    setRec((r) => ({ ...r, [k]: v }));

  return (
    <div className="rounded-2xl border border-edge bg-surface overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-2xl leading-tight">Try to change the ruling</p>
            <p className="text-sm text-mute mt-1">
              This is an example record. Edit anything; nothing is sent anywhere.
            </p>
          </div>
          {edited && (
            <button
              type="button"
              onClick={() => setRec(SAMPLE_RECORD)}
              className="btn-ghost text-xs px-3 py-1.5 shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className="text-xs text-mute">Agreed work</span>
            <input
              className={`${field} mt-1.5`}
              value={rec.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-mute">Client filed</span>
            <textarea
              rows={3}
              className={`${field} mt-1.5 resize-none`}
              value={rec.client_evidence}
              onChange={(e) => set("client_evidence", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-mute">Expert filed</span>
            <textarea
              rows={3}
              className={`${field} mt-1.5 resize-none`}
              value={rec.expert_evidence}
              onChange={(e) => set("expert_evidence", e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-mute">The arbitrator&apos;s reasoning</span>
            <textarea
              rows={3}
              className={`${field} mt-1.5 resize-none`}
              value={rec.reasoning}
              onChange={(e) => set("reasoning", e.target.value)}
            />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-xs text-mute">Ruled for</legend>
            <div className="mt-1.5 inline-flex rounded-lg border border-edge p-0.5 bg-deep/70">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={rec.favor_expert === v}
                  onClick={() => set("favor_expert", v)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    rec.favor_expert === v ? "bg-brass text-night font-medium" : "text-mute hover:text-bone"
                  }`}
                >
                  {v ? "The expert" : "The client"}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="border-t border-edge p-5 sm:p-6 bg-deep/40">
        {blocked ? (
          <p className="text-sm text-flare">
            Your browser blocked hashing here. It needs a secure (https) page.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            <HashGrid hex={recorded} matched label="Fingerprint written when the ruling was made" />
            <HashGrid
              hex={live}
              flags={diff?.flags}
              matched={matched}
              label="Recomputed from what's on screen now"
            />
          </div>
        )}
      </div>

      <div
        aria-live="polite"
        className={`px-5 sm:px-6 py-4 transition-colors duration-300 ${
          !diff ? "bg-raised text-mute" : matched ? "bg-verdict text-night" : "bg-flare text-night"
        }`}
      >
        {!diff ? (
          <p className="text-sm">Calculating…</p>
        ) : matched ? (
          <p className="font-display text-2xl">The values match</p>
        ) : (
          <>
            <p className="font-display text-2xl">
              {diff.count} of 64 characters changed
            </p>
            <p className="text-sm mt-0.5">
              This is not the record that was ruled on. Change a single letter and roughly half the
              fingerprint changes with it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
