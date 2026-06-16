"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { TimelineBucket, SpikeWindow } from "@/lib/logTypes";

interface Props {
  timeline: TimelineBucket[];
  spikes: SpikeWindow[];
  bucketMs: number;
  timeRange: { start: Date; end: Date } | null;
  onBarClick: (start: Date, end: Date) => void;
}

const BAR_HEIGHT = 90;
const LABEL_HEIGHT = 18;
const TOTAL_HEIGHT = BAR_HEIGHT + LABEL_HEIGHT;
const LABEL_MIN_PX = 52;
const GAP = 2;

const COLORS = {
  error: "#ef4444",
  warn: "#f59e0b",
  info: "#93c5fd",
  debug: "#e2e8f0",
};

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function LogTimeline({
  timeline,
  spikes,
  bucketMs,
  timeRange,
  onBarClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const maxCount = useMemo(
    () =>
      Math.max(1, ...timeline.map((b) => b.error + b.warn + b.info + b.debug)),
    [timeline],
  );

  const spikeSet = useMemo(() => {
    const set = new Set<number>();
    spikes.forEach((s) => {
      timeline.forEach((b, i) => {
        if (b.start >= s.start && b.start <= s.end) set.add(i);
      });
    });
    return set;
  }, [spikes, timeline]);

  if (timeline.length === 0) return null;

  const n = timeline.length;
  const BAR_W = Math.max(2, Math.floor((containerWidth - n * GAP) / n));
  const svgWidth = n * (BAR_W + GAP);
  const xFor = (i: number) => i * (BAR_W + GAP);
  const labelStep = Math.max(1, Math.ceil(LABEL_MIN_PX / (BAR_W + GAP)));

  return (
    <div className="shrink-0 bg-white border-b border-slate-200 px-3 pt-2 pb-1">
      <div ref={containerRef} className="w-full">
        <svg
          width={svgWidth}
          height={TOTAL_HEIGHT}
          style={{ width: "100%", display: "block", cursor: "pointer" }}
          viewBox={`0 0 ${svgWidth} ${TOTAL_HEIGHT}`}
          preserveAspectRatio="none"
        >
          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <line
              key={pct}
              x1={0}
              y1={BAR_HEIGHT * (1 - pct)}
              x2={svgWidth}
              y2={BAR_HEIGHT * (1 - pct)}
              stroke={pct === 1 ? "#cbd5e1" : "#f1f5f9"}
              strokeWidth={1}
            />
          ))}

          {/* Bars */}
          {timeline.map((bucket, i) => {
            const scale = BAR_HEIGHT / maxCount;
            const inRange =
              timeRange &&
              bucket.start >= timeRange.start &&
              bucket.start < timeRange.end;
            const spike = spikeSet.has(i);
            const x = xFor(i);

            // selection / spike overlay
            if (inRange || spike) {
              // drawn below bars via g ordering
            }

            // stack from bottom: debug → info → warn → error (error on top)
            let y = BAR_HEIGHT;
            const segments = [
              { h: bucket.debug * scale, color: COLORS.debug },
              { h: bucket.info * scale, color: COLORS.info },
              { h: bucket.warn * scale, color: COLORS.warn },
              { h: bucket.error * scale, color: COLORS.error },
            ];

            return (
              <g
                key={i}
                onClick={() =>
                  onBarClick(
                    bucket.start,
                    new Date(bucket.start.getTime() + bucketMs),
                  )
                }
              >
                {/* background highlight */}
                {(inRange || spike) && (
                  <rect
                    x={x}
                    y={0}
                    width={BAR_W}
                    height={BAR_HEIGHT}
                    fill={
                      inRange
                        ? "rgba(59,130,246,0.12)"
                        : "rgba(251,191,36,0.18)"
                    }
                  />
                )}
                {segments.map(({ h, color }, si) => {
                  const ph = Math.max(0, h);
                  if (ph < 0.5) return null;
                  y -= ph;
                  return (
                    <rect
                      key={si}
                      x={x}
                      y={y}
                      width={BAR_W}
                      height={ph}
                      fill={color}
                      opacity={inRange ? 1 : 0.85}
                    />
                  );
                })}
                {/* Error emphasis dot at top if error > 0 */}
                {bucket.error > 0 &&
                  (() => {
                    const errorH = bucket.error * scale;
                    const errorY =
                      BAR_HEIGHT -
                      segments.reduce(
                        (acc, s, si) =>
                          si >= 3 ? acc + Math.max(0, s.h) : acc,
                        0,
                      ) -
                      Math.max(0, errorH);
                    return (
                      <rect
                        x={x}
                        y={errorY}
                        width={BAR_W}
                        height={Math.max(2, Math.min(errorH, 3))}
                        fill="#dc2626"
                      />
                    );
                  })()}
              </g>
            );
          })}

          {/* X-axis labels */}
          {timeline.map((b, i) => {
            if (i % labelStep !== 0 && i !== timeline.length - 1) return null;
            if (i === timeline.length - 1 && i % labelStep !== 0) {
              const prev = Math.floor((i - 1) / labelStep) * labelStep;
              if ((i - prev) * (BAR_W + GAP) < LABEL_MIN_PX) return null;
            }
            return (
              <text
                key={i}
                x={xFor(i) + BAR_W / 2}
                y={TOTAL_HEIGHT - 3}
                textAnchor="middle"
                fontSize={9}
                fill="#94a3b8"
              >
                {fmtTime(b.start)}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-0.5">
        {(["error", "warn", "info", "debug"] as const).map((k) => (
          <span
            key={k}
            className="flex items-center gap-1 text-[11px] text-slate-400"
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: COLORS[k] }}
            />
            {k.charAt(0).toUpperCase() + k.slice(1)}
          </span>
        ))}
        {spikes.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" />
            Spike ({spikes.length})
          </span>
        )}
      </div>
    </div>
  );
}
