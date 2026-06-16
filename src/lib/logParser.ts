import type { LogEntry, LogFormat, ParsedLogFile, LogLevel } from "./logTypes";
import { classifyEntry } from "./logClassifier";

// ── Shared helpers ────────────────────────────────────────────────────────────

const EXCEPTION_RE = /\b([A-Z][a-zA-Z0-9]*(?:Exception|Error))\b/;
const LOGGER_RE =
  /^((?:Sitecore|Microsoft|System|log4net)\.[A-Za-z0-9_.]+)\s*(?:—|--)?\s*(.*)/;

let nextId = 0;

function normaliseLevel(raw: string): LogLevel {
  const s = raw.trim().toUpperCase();
  if (s === "FATAL") return "FATAL";
  if (s === "ERROR" || s === "ERR") return "ERROR";
  if (s === "WARN" || s === "WRN" || s === "WARNING") return "WARN";
  if (s === "INFO" || s === "INF" || s === "INFORMATION") return "INFO";
  if (s === "DEBUG" || s === "DBG") return "DEBUG";
  if (s === "VERBOSE" || s === "VRB") return "VERBOSE";
  return "INFO";
}

function extractException(text: string): string | null {
  return EXCEPTION_RE.exec(text)?.[1] ?? null;
}

function extractLogger(message: string): {
  logger: string;
  cleanMessage: string;
} {
  const m = LOGGER_RE.exec(message);
  return m
    ? { logger: m[1], cleanMessage: m[2] }
    : { logger: "", cleanMessage: message };
}

function dateFromFilename(fileName: string): string | null {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(fileName);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return /(\d{4}-\d{2}-\d{2})/.exec(fileName)?.[1] ?? null;
}

function parseTimestamp(dateStr: string | null, timeStr: string): Date | null {
  try {
    const base = dateStr ?? new Date().toISOString().slice(0, 10);
    if (timeStr.includes("T") || timeStr.length > 8) {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? null : d;
    }
    return new Date(`${base}T${timeStr}`);
  } catch {
    return null;
  }
}

// ── Format detection ──────────────────────────────────────────────────────────

const LOG4NET_ANCHOR = /\d{2}:\d{2}:\d{2}\s+(FATAL|ERROR|WARN|INFO|DEBUG)/;
const SERILOG_TEXT_ANCHOR =
  /\[(FATAL|ERR(?:OR)?|WRN|WARN|INF(?:O)?|DBG|DEBUG|VRB|VERBOSE)\]/i;

function detectFormat(lines: string[]): LogFormat {
  const sample = lines.slice(0, 60);
  if (sample.filter((l) => l.trim().startsWith("{")).length >= 3)
    return "serilog-json";
  if (
    sample.some(
      (l) => SERILOG_TEXT_ANCHOR.test(l) && /^\d{4}-\d{2}-\d{2}/.test(l),
    )
  )
    return "serilog-text";
  if (sample.some((l) => LOG4NET_ANCHOR.test(l))) return "log4net";
  return "unknown";
}

// ── Log4Net parser (anchor strategy) ─────────────────────────────────────────
// Anchor on HH:mm:ss + LEVEL. Thread = everything before the timestamp.
// All lines between two anchors are continuation (stack trace, XML, nested exception, preamble).

const LOG4NET_HEADER =
  /(\d{2}:\d{2}:\d{2})\s+(FATAL|ERROR|WARN|INFO|DEBUG)\s+(.*)/;

interface RawLog4NetEntry {
  thread: string;
  time: string;
  level: LogLevel;
  firstLine: string;
  extra: string[];
}

function parseLog4Net(lines: string[], fileName: string): LogEntry[] {
  const datePart = dateFromFilename(fileName);
  const entries: LogEntry[] = [];
  let current: RawLog4NetEntry | null = null;

  function flush() {
    if (!current) return;
    const fullText = [current.firstLine, ...current.extra].join("\n");
    const { logger, cleanMessage } = extractLogger(current.firstLine);
    const entry: LogEntry = {
      id: nextId++,
      timestamp: parseTimestamp(datePart, current.time),
      level: current.level,
      thread: current.thread,
      logger,
      message: cleanMessage,
      exceptionType: extractException(fullText),
      stackTrace: current.extra.map((l) => l.trim()).filter(Boolean),
      category: "general",
      sourceFile: fileName,
      raw: current.firstLine,
    };
    entries.push(
      classifyEntry(entry)
        ? { ...entry, category: classifyEntry(entry) }
        : entry,
    );
    current = null;
  }

  for (const line of lines) {
    const m = LOG4NET_HEADER.exec(line);
    if (m) {
      flush();
      const tsIdx = line.indexOf(m[1]);
      const thread = line.slice(0, tsIdx).trim();
      current = {
        thread,
        time: m[1],
        level: normaliseLevel(m[2]),
        firstLine: m[3].trim(),
        extra: [],
      };
    } else if (current) {
      current.extra.push(line); // continuation: stack trace, XML, blank lines
    }
    // else: preamble before first parseable line — skip
  }
  flush();
  return entries;
}

// ── Serilog text parser ───────────────────────────────────────────────────────

const SERILOG_HEADER_FULL =
  /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\s*[+-]\d{2}:\d{2}|Z)?)\s+\[(FATAL|ERR(?:OR)?|WRN|WARN|INF(?:O)?|DBG|DEBUG|VRB|VERBOSE)\]\s*(.*)/i;
const SERILOG_HEADER_SHORT =
  /^\[(\d{2}:\d{2}:\d{2})\s+(FATAL|ERR(?:OR)?|WRN|WARN|INF(?:O)?|DBG|DEBUG|VRB|VERBOSE)\]\s*(.*)/i;

interface RawSerilogEntry {
  ts: Date | null;
  level: LogLevel;
  firstLine: string;
  extra: string[];
}

function parseSerilogText(lines: string[], fileName: string): LogEntry[] {
  const datePart = dateFromFilename(fileName);
  const entries: LogEntry[] = [];
  let current: RawSerilogEntry | null = null;

  function flush() {
    if (!current) return;
    const fullText = [current.firstLine, ...current.extra].join("\n");
    const entry: LogEntry = {
      id: nextId++,
      timestamp: current.ts,
      level: current.level,
      thread: "",
      logger: "",
      message: current.firstLine,
      exceptionType: extractException(fullText),
      stackTrace: current.extra.map((l) => l.trim()).filter(Boolean),
      category: "general",
      sourceFile: fileName,
      raw: current.firstLine,
    };
    entries.push({ ...entry, category: classifyEntry(entry) });
    current = null;
  }

  for (const line of lines) {
    const mF = SERILOG_HEADER_FULL.exec(line);
    const mS = !mF ? SERILOG_HEADER_SHORT.exec(line) : null;
    if (mF || mS) {
      flush();
      const ts = mF ? mF[1] : mS![1];
      const levelRaw = mF ? mF[2] : mS![2];
      const msg = mF ? mF[3] : mS![3];
      const timestamp =
        ts.length <= 8
          ? parseTimestamp(datePart, ts)
          : parseTimestamp(null, ts);
      current = {
        ts: timestamp,
        level: normaliseLevel(levelRaw),
        firstLine: msg,
        extra: [],
      };
    } else if (current) {
      current.extra.push(line);
    }
  }
  flush();
  return entries;
}

// ── Serilog JSON (CLEF) parser — pure JSON.parse, no regex ──────────────────

function parseSerilogJson(lines: string[], fileName: string): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const tsRaw = String(
        obj["@t"] ?? obj["Timestamp"] ?? obj["timestamp"] ?? "",
      );
      const levelRaw = String(
        obj["@l"] ?? obj["Level"] ?? obj["level"] ?? "INFO",
      );
      const message = String(
        obj["@m"] ?? obj["@mt"] ?? obj["Message"] ?? obj["message"] ?? "",
      );
      const exceptionStr = String(obj["@x"] ?? obj["Exception"] ?? "");
      const stackLines = exceptionStr
        ? exceptionStr
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const logger = String(obj["SourceContext"] ?? obj["Logger"] ?? "");
      const thread = String(obj["ThreadId"] ?? obj["threadId"] ?? "");
      const entry: LogEntry = {
        id: nextId++,
        timestamp: tsRaw ? new Date(tsRaw) : null,
        level: normaliseLevel(levelRaw),
        thread,
        logger,
        message,
        exceptionType: extractException(exceptionStr || message),
        stackTrace: stackLines,
        category: "general",
        sourceFile: fileName,
        raw: trimmed,
      };
      entries.push({ ...entry, category: classifyEntry(entry) });
    } catch {
      /* skip malformed lines */
    }
  }
  return entries;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseLogFile(content: string, fileName: string): ParsedLogFile {
  nextId = 0;
  const lines = content.split(/\r?\n/);
  const format = detectFormat(lines);
  const parseErrors: string[] = [];
  let entries: LogEntry[] = [];

  try {
    if (format === "log4net") entries = parseLog4Net(lines, fileName);
    else if (format === "serilog-text")
      entries = parseSerilogText(lines, fileName);
    else if (format === "serilog-json")
      entries = parseSerilogJson(lines, fileName);
    else {
      entries = parseLog4Net(lines, fileName);
      if (entries.length === 0) entries = parseSerilogText(lines, fileName);
      if (entries.length === 0) parseErrors.push("Could not detect log format");
    }
  } catch (e) {
    parseErrors.push(`Parse error: ${e}`);
  }

  return { fileName, format, entries, parseErrors, totalLines: lines.length };
}
