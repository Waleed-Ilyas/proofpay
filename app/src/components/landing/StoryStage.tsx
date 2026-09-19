"use client";

import { useEffect, useRef, useState } from "react";
import { VaultScene } from "./VaultScene";
import { STAGES, TONE } from "./stages";

/**
 * "Where the SOL is, at every state" as a scroll story. The vault stays pinned
 * while the chapters scroll past; whichever chapter crosses the middle of the
 * screen decides which stage the vault moves to.
 */
export function StoryStage() {
  const [stage, setStage] = useState(0);
  const chapters = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setStage(Number((e.target as HTMLElement).dataset.stage));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    chapters.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="custody" className="relative border-t border-edge vault-atmosphere">
      <div className="max-w-6xl mx-auto w-full px-6 lg:px-10">
        <div className="pt-24 lg:pt-32 max-w-2xl">
          <h2 className="font-display text-4xl lg:text-5xl leading-[1.06]">
            Where the SOL is, at every state
          </h2>
          <p className="mt-5 text-lg text-mute leading-relaxed">
            Escrow normally means a company is holding your money and promising to be fair about it.
            Here a program holds it, and the last row of each step is the reason that matters.
          </p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-x-16">
          <ol className="pb-16 lg:pb-32">
            {STAGES.map((s, i) => {
              const tone = TONE[s.tone];
              return (
                <li
                  key={s.state}
                  data-stage={i}
                  ref={(el) => {
                    chapters.current[i] = el;
                  }}
                  className={`min-h-[62svh] lg:min-h-[78svh] flex flex-col justify-center py-10 transition-opacity duration-500 ${
                    i === stage ? "opacity-100" : "opacity-45"
                  }`}
                >
                  <span className={`inline-flex items-center gap-2 text-sm font-medium ${tone.text}`}>
                    <span className={`size-2 rounded-full ${tone.dot}`} />
                    {s.state}
                  </span>
                  <h3 className="mt-3 font-display text-3xl lg:text-[2.6rem] leading-[1.08]">
                    {s.title}
                  </h3>
                  <p className="mt-4 text-mute leading-relaxed max-w-[34rem]">{s.body}</p>

                  <dl className={`mt-6 border-l-2 ${tone.edge} pl-5 space-y-3 max-w-[34rem]`}>
                    <div>
                      <dt className="text-xs text-mute">Who holds the SOL</dt>
                      <dd className="mt-0.5">{s.holds}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-mute">Who can move it</dt>
                      <dd className="mt-0.5">{s.moves}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ol>

          <div className="order-first lg:order-none self-start sticky top-[57px] lg:top-0 z-10 h-[36svh] lg:h-svh -mx-6 px-6 lg:mx-0 lg:px-0 bg-night/85 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none border-b border-edge lg:border-0">
            <div className="relative h-full">
              <VaultScene stage={stage} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
