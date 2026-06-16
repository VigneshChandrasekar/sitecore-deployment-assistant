import type {
  LogEntry,
  LogAnalysis,
  ExceptionGroup,
  TimelineBucket,
  SpikeWindow,
  AlertRule,
  AlertTrigger,
  ParsedLogFile,
  LogLevel,
  LogCategory,
} from "./logTypes";

function chooseBucketMs(spanMs: number): number {
  if (spanMs <= 0) return 60_000; // 1m
  if (spanMs <= 3_600_000) return 60_000; // ≤ 1h   → 1m  (~60 bars)
  if (spanMs <= 12 * 3_600_000) return 300_000; // ≤ 12h  → 5m  (~72 bars)
  if (spanMs <= 48 * 3_600_000) return 1_800_000; // ≤ 48h  → 30m (~96 bars)
  return 3_600_000; // > 48h  → 1h
}

function buildTimeline(
  entries: LogEntry[],
  bucketMs: number,
  earliest: Date,
  latest: Date,
): TimelineBucket[] {
  const start = Math.floor(earliest.getTime() / bucketMs) * bucketMs;
  const end = Math.ceil((latest.getTime() + 1) / bucketMs) * bucketMs;
  const buckets = new Map<number, TimelineBucket>();

  for (let t = start; t < end; t += bucketMs) {
    buckets.set(t, {
      start: new Date(t),
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
    });
  }

  for (const e of entries) {
    if (!e.timestamp) continue;
    const t = Math.floor(e.timestamp.getTime() / bucketMs) * bucketMs;
    const bucket = buckets.get(t);
    if (!bucket) continue;
    if (e.level === "FATAL" || e.level === "ERROR") bucket.error++;
    else if (e.level === "WARN") bucket.warn++;
    else if (e.level === "INFO") bucket.info++;
    else bucket.debug++;
  }

  return Array.from(buckets.values()).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

function detectSpikes(
  timeline: TimelineBucket[],
  bucketMs: number,
): SpikeWindow[] {
  if (timeline.length < 3) return [];

  // Use error+warn so spikes are detected even in warn-heavy logs with zero errors
  const totals = timeline.map((b) => b.error + b.warn);
  const avg = totals.reduce((s, n) => s + n, 0) / totals.length;
  const threshold = Math.max(avg * 2, 3);
  const spikes: SpikeWindow[] = [];

  for (let i = 0; i < timeline.length; i++) {
    if (totals[i] >= threshold) {
      spikes.push({
        start: timeline[i].start,
        end: new Date(timeline[i].start.getTime() + bucketMs),
        errorCount: totals[i],
        dominantException: null,
      });
    }
  }

  return spikes;
}

function groupExceptions(entries: LogEntry[]): ExceptionGroup[] {
  const map = new Map<string, ExceptionGroup>();

  for (const e of entries) {
    if (!e.exceptionType) continue;
    const topFrame = e.stackTrace[0] ?? "";
    const key = `${e.exceptionType}::${topFrame}`;

    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.entries.push(e);
      if (e.timestamp) {
        if (!existing.firstSeen || e.timestamp < existing.firstSeen)
          existing.firstSeen = e.timestamp;
        if (!existing.lastSeen || e.timestamp > existing.lastSeen)
          existing.lastSeen = e.timestamp;
      }
    } else {
      map.set(key, {
        key,
        exceptionType: e.exceptionType,
        count: 1,
        firstSeen: e.timestamp,
        lastSeen: e.timestamp,
        representativeEntry: e,
        entries: [e],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function hotThreads(entries: LogEntry[]) {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!e.thread || (e.level !== "ERROR" && e.level !== "FATAL")) continue;
    counts.set(e.thread, (counts.get(e.thread) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([thread, errorCount]) => ({ thread, errorCount }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 10);
}

function checkAlerts(entries: LogEntry[], rules: AlertRule[]): AlertTrigger[] {
  const triggers: AlertTrigger[] = [];
  const withTime = entries.filter((e) => e.timestamp);

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const windowMs = rule.windowMinutes * 60_000;
    const matching = withTime.filter(
      (e) =>
        e.level === rule.level ||
        (e.level === "FATAL" && rule.level === "ERROR"),
    );

    if (matching.length === 0) continue;

    let i = 0;
    while (i < matching.length) {
      const windowStart = matching[i].timestamp!;
      const windowEnd = new Date(windowStart.getTime() + windowMs);
      const inWindow = matching.filter(
        (e) => e.timestamp! >= windowStart && e.timestamp! <= windowEnd,
      );

      if (inWindow.length >= rule.thresholdCount) {
        triggers.push({ rule, windowStart, windowEnd, count: inWindow.length });
        i += inWindow.length;
      } else {
        i++;
      }
    }
  }

  return triggers;
}

export function analyzeLogFiles(
  files: ParsedLogFile[],
  alertRules: AlertRule[] = [],
): LogAnalysis {
  // Most recent first — descending by timestamp
  const allEntries = files
    .flatMap((f) => f.entries)
    .sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

  const withTime = allEntries.filter((e) => e.timestamp);
  // allEntries is desc; earliest = last, latest = first
  const earliest = withTime.length
    ? withTime[withTime.length - 1].timestamp!
    : null;
  const latest = withTime.length ? withTime[0].timestamp! : null;

  const spanMs = earliest && latest ? latest.getTime() - earliest.getTime() : 0;
  const bucketMs = chooseBucketMs(spanMs);

  const timeline =
    earliest && latest
      ? buildTimeline(allEntries, bucketMs, earliest, latest)
      : [];

  const spikes = detectSpikes(timeline, bucketMs);
  const peakBucket =
    timeline.length > 0
      ? timeline.reduce((a, b) => (b.error + b.warn > a.error + a.warn ? b : a))
      : null;

  // Enrich spikes with dominant exception
  for (const spike of spikes) {
    const inSpike = allEntries.filter(
      (e) =>
        e.timestamp &&
        e.timestamp >= spike.start &&
        e.timestamp <= spike.end &&
        e.exceptionType,
    );
    if (inSpike.length) {
      const counts = new Map<string, number>();
      for (const e of inSpike)
        counts.set(e.exceptionType!, (counts.get(e.exceptionType!) ?? 0) + 1);
      spike.dominantException = [...counts.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0][0];
    }
  }

  const exceptionGroups = groupExceptions(allEntries);

  const categoryBreakdown: Partial<Record<LogCategory, number>> = {};
  const levelBreakdown: Partial<Record<LogLevel, number>> = {};

  for (const e of allEntries) {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] ?? 0) + 1;
    levelBreakdown[e.level] = (levelBreakdown[e.level] ?? 0) + 1;
  }

  return {
    files,
    allEntries,
    exceptionGroups,
    categoryBreakdown,
    levelBreakdown,
    timeline,
    bucketMs,
    spikes,
    peakBucket,
    hotThreads: hotThreads(allEntries),
    alertTriggers: checkAlerts(allEntries, alertRules),
    earliestEntry: earliest,
    latestEntry: latest,
  };
}
