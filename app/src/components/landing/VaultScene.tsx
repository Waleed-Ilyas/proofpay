"use client";

import dynamic from "next/dynamic";
import { Component, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "@/lib/useInView";

/** Shown only when WebGL is unavailable or the scene throws. Never while loading. */
function VaultFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
      <div
        className="aspect-square w-[72%] max-w-[26rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, #0b2027 0 36%, transparent 37%), conic-gradient(from 210deg, #ddb04a, #5d7076, #ddb04a, #26363b, #ddb04a)",
          boxShadow: "0 0 90px 10px rgba(221,176,74,0.22), inset 0 0 40px rgba(0,0,0,0.6)",
          border: "10px solid #26363b",
        }}
      />
    </div>
  );
}

const VaultCanvas = dynamic(() => import("./VaultCanvas"), {
  ssr: false,
  loading: () => null,
});

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }> {
  static getDerivedStateFromError() {
    return {};
  }
  componentDidCatch(error: unknown) {
    console.error("Vault scene failed, showing static fallback:", error);
    this.props.onFail();
  }
  render() {
    return this.props.children;
  }
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Fills its (positioned, sized) parent. `stage` is 0-4:
 * awaiting, active, disputed, ruled, settled.
 *
 * The canvas stays invisible until the scene reports it is lit, framed and has
 * drawn a few frames, then fades in already settled. That removes the flash of
 * an oversized, unlit vault on first paint.
 */
export function VaultScene({ stage }: { stage: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL());
  }, []);

  // Safety net: never leave the vault invisible if the ready signal doesn't arrive.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      role="img"
      aria-label="A 3D vault door that changes with each stage of the escrow"
    >
      {webgl === false || failed ? (
        <VaultFallback />
      ) : webgl === true ? (
        <div
          className={`absolute inset-0 transition-[opacity,transform] duration-[900ms] ease-out motion-reduce:transition-none ${
            ready ? "opacity-100 scale-100" : "opacity-0 scale-[0.97]"
          }`}
        >
          <SceneBoundary onFail={onFail}>
            <VaultCanvas stage={stage} active={inView} onReady={onReady} />
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}
