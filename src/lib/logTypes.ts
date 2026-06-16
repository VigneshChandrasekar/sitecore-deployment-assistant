export type LogLevel =
  | "FATAL"
  | "ERROR"
  | "WARN"
  | "INFO"
  | "DEBUG"
  | "VERBOSE";

export type LogFormat = "log4net" | "serilog-text" | "serilog-json" | "unknown";

export type LogCategory =
  | "publishing"
  | "search"
  | "jobs"
  | "cache"
  | "security"
  | "pipelines"
  | "media"
  | "xa"
  | "xconnect"
  | "sync"
  | "general";

export interface LogEntry {
  id: number;
  timestamp: Date | null;
  level: LogLevel;
  thread: string;
  logger: string;
  message: string;
  exceptionType: string | null;
  stackTrace: string[];
  category: LogCategory;
  sourceFile: string;
  raw: string;
}

export interface ExceptionGroup {
  key: string;
  exceptionType: string;
  count: number;
  firstSeen: Date | null;
  lastSeen: Date | null;
  representativeEntry: LogEntry;
  entries: LogEntry[];
}

export interface ParsedLogFile {
  fileName: string;
  format: LogFormat;
  entries: LogEntry[];
  parseErrors: string[];
  totalLines: number;
}

export interface AlertRule {
  id: string;
  label: string;
  level: LogLevel;
  thresholdCount: number;
  windowMinutes: number;
  enabled: boolean;
}

export interface AlertTrigger {
  rule: AlertRule;
  windowStart: Date;
  windowEnd: Date;
  count: number;
}

export interface SpikeWindow {
  start: Date;
  end: Date;
  errorCount: number;
  dominantException: string | null;
}

export interface TimelineBucket {
  start: Date;
  error: number;
  warn: number;
  info: number;
  debug: number;
}

export interface LogAnalysis {
  files: ParsedLogFile[];
  allEntries: LogEntry[];
  exceptionGroups: ExceptionGroup[];
  categoryBreakdown: Partial<Record<LogCategory, number>>;
  levelBreakdown: Partial<Record<LogLevel, number>>;
  timeline: TimelineBucket[];
  bucketMs: number;
  spikes: SpikeWindow[];
  peakBucket: TimelineBucket | null;
  hotThreads: { thread: string; errorCount: number }[];
  alertTriggers: AlertTrigger[];
  earliestEntry: Date | null;
  latestEntry: Date | null;
}
