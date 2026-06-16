// Web Worker — parses log files off the main thread
// Self-contained: no imports.

// ── Shared helpers ────────────────────────────────────────────────────────────

function normaliseLevel(raw) {
  const s = raw.trim().toUpperCase();
  if (s === "FATAL") return "FATAL";
  if (s === "ERROR" || s === "ERR") return "ERROR";
  if (s === "WARN" || s === "WRN" || s === "WARNING") return "WARN";
  if (s === "INFO" || s === "INF" || s === "INFORMATION") return "INFO";
  if (s === "DEBUG" || s === "DBG") return "DEBUG";
  if (s === "VERBOSE" || s === "VRB") return "VERBOSE";
  return "INFO";
}

const EXCEPTION_RE = /\b([A-Z][a-zA-Z0-9]*(?:Exception|Error))\b/;
const LOGGER_RE =
  /^((?:Sitecore|Microsoft|System|log4net)\.[A-Za-z0-9_.]+)\s*(?:—|--)?\s*(.*)/;

function extractException(text) {
  const m = EXCEPTION_RE.exec(text);
  return m ? m[1] : null;
}

function extractLogger(message) {
  const m = LOGGER_RE.exec(message);
  return m
    ? { logger: m[1], cleanMessage: m[2] }
    : { logger: "", cleanMessage: message };
}

function dateFromFilename(fileName) {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(fileName);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const iso = /(\d{4}-\d{2}-\d{2})/.exec(fileName);
  return iso ? iso[1] : null;
}

function parseTimestamp(dateStr, timeStr) {
  try {
    const base = dateStr || new Date().toISOString().slice(0, 10);
    if (timeStr && (timeStr.includes("T") || timeStr.length > 8)) {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(`${base}T${timeStr}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// ── Category classifier ───────────────────────────────────────────────────────

const CATEGORY_RULES = [
  {
    cat: "xa",
    loggerPfx: ["sitecore.xa", "sitecore.sxa"],
    msgRe: /\b(XA|SXA)\b/,
  },
  {
    cat: "xconnect",
    loggerPfx: ["sitecore.xconnect", "sitecore.xdb", "sitecore.analytics"],
    msgRe: /xConnect|xDB|analytics/i,
  },
  {
    cat: "publishing",
    loggerPfx: ["sitecore.publishing"],
    threadRe: /publish/i,
    msgRe: /publish/i,
  },
  {
    cat: "search",
    loggerPfx: ["sitecore.contentsearch", "sitecore.search"],
    threadRe: /crawl|index|solr/i,
    msgRe: /solr|lucene|IndexingException|crawl|search index/i,
  },
  {
    cat: "jobs",
    loggerPfx: ["sitecore.jobs"],
    threadRe: /job|scheduler|housekeeping|agent/i,
    msgRe: /\bjob\b|HouseKeeping|scheduler|\bagent\b/i,
  },
  {
    cat: "cache",
    loggerPfx: ["sitecore.caching"],
    msgRe: /\bcache\b|CacheManager|evict/i,
  },
  {
    cat: "security",
    loggerPfx: ["sitecore.security", "sitecore.web.authentication"],
    msgRe:
      /AccessDeniedException|auth(entication|orization)?|\bsecurity\b|\blogin\b/i,
  },
  {
    cat: "media",
    loggerPfx: ["sitecore.resources.media"],
    msgRe: /\bmedia\b|MediaManager/i,
  },
  {
    cat: "sync",
    loggerPfx: ["sitecore.publishing.service"],
    msgRe: /Publishing\.Service|CD.CM/i,
  },
  {
    cat: "pipelines",
    loggerPfx: ["sitecore.pipelines"],
    msgRe: /pipeline|processor/i,
  },
];

function classify(logger, thread, message) {
  const l = logger.toLowerCase();
  const t = thread.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.loggerPfx && rule.loggerPfx.some((p) => l.startsWith(p)))
      return rule.cat;
    if (rule.threadRe && rule.threadRe.test(t)) return rule.cat;
    if (rule.msgRe && rule.msgRe.test(message)) return rule.cat;
  }
  return "general";
}

// ── Format detection ──────────────────────────────────────────────────────────

// Anchors used for detection only — not for parsing
const LOG4NET_ANCHOR = /\d{2}:\d{2}:\d{2}\s+(FATAL|ERROR|WARN|INFO|DEBUG)/;
const SERILOG_TEXT_ANCHOR =
  /\[(FATAL|ERR(?:OR)?|WRN|WARN|INF(?:O)?|DBG|DEBUG|VRB|VERBOSE)\]/i;

function detectFormat(lines) {
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
//
// Conversion pattern: %4t %d{HH:mm:ss} %-5p %m%n
// Strategy: anchor on HH:mm:ss + LEVEL, derive thread by slicing before the timestamp.
// Everything until the next anchor is continuation (stack trace, exception detail, XML, banner).

const LOG4NET_HEADER =
  /(\d{2}:\d{2}:\d{2})\s+(FATAL|ERROR|WARN|INFO|DEBUG)\s+(.*)/;

function parseLog4Net(lines, fileName) {
  const datePart = dateFromFilename(fileName);
  const entries = [];
  let id = 0;
  let current = null; // { thread, time, level, firstLine, extra[] }

  function flush() {
    if (!current) return;
    const fullText = [current.firstLine, ...current.extra].join("\n");
    const { logger, cleanMessage } = extractLogger(current.firstLine);
    entries.push({
      id: id++,
      timestamp: parseTimestamp(datePart, current.time),
      level: current.level,
      thread: current.thread,
      logger,
      message: cleanMessage,
      exceptionType: extractException(fullText),
      stackTrace: current.extra.map((l) => l.trim()).filter(Boolean),
      category: classify(logger, current.thread, fullText),
      sourceFile: fileName,
      raw: current.firstLine,
    });
    current = null;
  }

  for (const line of lines) {
    const m = LOG4NET_HEADER.exec(line);
    if (m) {
      flush();
      // Thread = everything on the line before the timestamp
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
      current.extra.push(line); // continuation: stack trace, XML, nested exception, blank
    }
    // else: preamble before first parseable line — discard
  }
  flush();
  return entries;
}

// ── Serilog text parser ───────────────────────────────────────────────────────
// Anchor: [LEVEL] bracket token after an ISO timestamp.

const SERILOG_HEADER_FULL =
  /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\s*[+-]\d{2}:\d{2}|Z)?)\s+\[(FATAL|ERR(?:OR)?|WRN|WARN|INF(?:O)?|DBG|DEBUG|VRB|VERBOSE)\]\s*(.*)/i;
const SERILOG_HEADER_SHORT =
  /^\[(\d{2}:\d{2}:\d{2})\s+(FATAL|ERR(?:OR)?|WRN|WARN|INF(?:O)?|DBG|DEBUG|VRB|VERBOSE)\]\s*(.*)/i;

function parseSerilogText(lines, fileName) {
  const datePart = dateFromFilename(fileName);
  const entries = [];
  let id = 0;
  let current = null;

  function flush() {
    if (!current) return;
    const fullText = [current.firstLine, ...current.extra].join("\n");
    entries.push({
      id: id++,
      timestamp: current.ts,
      level: current.level,
      thread: "",
      logger: "",
      message: current.firstLine,
      exceptionType: extractException(fullText),
      stackTrace: current.extra.map((l) => l.trim()).filter(Boolean),
      category: classify("", "", fullText),
      sourceFile: fileName,
      raw: current.firstLine,
    });
    current = null;
  }

  for (const line of lines) {
    const mF = SERILOG_HEADER_FULL.exec(line);
    const mS = !mF && SERILOG_HEADER_SHORT.exec(line);
    if (mF || mS) {
      flush();
      const ts = mF ? mF[1] : mS[1];
      const levelRaw = mF ? mF[2] : mS[2];
      const msg = mF ? mF[3] : mS[3];
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

// ── Serilog JSON (CLEF) parser ─────────────────────────────────────────────
// Pure JSON.parse — no regex.

function parseSerilogJson(lines, fileName) {
  const entries = [];
  let id = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const obj = JSON.parse(t);
      const tsRaw = String(
        obj["@t"] || obj["Timestamp"] || obj["timestamp"] || "",
      );
      const levelRaw = String(
        obj["@l"] || obj["Level"] || obj["level"] || "INFO",
      );
      const message = String(
        obj["@m"] || obj["@mt"] || obj["Message"] || obj["message"] || "",
      );
      const exStr = String(obj["@x"] || obj["Exception"] || "");
      const stackLines = exStr
        ? exStr
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const logger = String(obj["SourceContext"] || obj["Logger"] || "");
      const thread = String(obj["ThreadId"] || obj["threadId"] || "");
      entries.push({
        id: id++,
        timestamp: tsRaw ? new Date(tsRaw).toISOString() : null,
        level: normaliseLevel(levelRaw),
        thread,
        logger,
        message,
        exceptionType: extractException(exStr || message),
        stackTrace: stackLines,
        category: classify(logger, thread, message),
        sourceFile: fileName,
        raw: t,
      });
    } catch {
      /* skip malformed lines */
    }
  }
  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────
self.onmessage = function (e) {
  const { id, content, fileName } = e.data;
  try {
    const lines = content.split(/\r?\n/);
    const format = detectFormat(lines);
    let entries = [];

    if (format === "log4net") entries = parseLog4Net(lines, fileName);
    else if (format === "serilog-text")
      entries = parseSerilogText(lines, fileName);
    else if (format === "serilog-json")
      entries = parseSerilogJson(lines, fileName);
    else {
      // Best-effort fallback
      entries = parseLog4Net(lines, fileName);
      if (!entries.length) entries = parseSerilogText(lines, fileName);
    }

    self.postMessage({
      id,
      type: "done",
      result: {
        fileName,
        format,
        entries,
        parseErrors: [],
        totalLines: lines.length,
      },
    });
  } catch (err) {
    self.postMessage({ id, type: "error", error: String(err) });
  }
};
