import type { LogEntry, LogCategory } from './logTypes'

interface CategoryRule {
  category: LogCategory
  loggerPrefixes?: string[]
  threadPatterns?: RegExp[]
  messagePatterns?: RegExp[]
}

const RULES: CategoryRule[] = [
  {
    category: 'xa',
    loggerPrefixes: ['Sitecore.XA', 'Sitecore.SXA'],
    messagePatterns: [/\bXA\b/, /\bSXA\b/],
  },
  {
    category: 'xconnect',
    loggerPrefixes: ['Sitecore.XConnect', 'Sitecore.Xdb', 'Sitecore.Analytics'],
    messagePatterns: [/xConnect/i, /xDB/i, /analytics/i],
  },
  {
    category: 'publishing',
    loggerPrefixes: ['Sitecore.Publishing'],
    threadPatterns: [/publish/i],
    messagePatterns: [/publish/i, /PublishException/i],
  },
  {
    category: 'search',
    loggerPrefixes: ['Sitecore.ContentSearch', 'Sitecore.Search'],
    threadPatterns: [/crawl/i, /index/i, /solr/i],
    messagePatterns: [/solr/i, /lucene/i, /IndexingException/i, /crawl/i, /search index/i],
  },
  {
    category: 'jobs',
    loggerPrefixes: ['Sitecore.Jobs'],
    threadPatterns: [/job/i, /scheduler/i, /housekeeping/i, /agent/i],
    messagePatterns: [/\bjob\b/i, /HouseKeeping/i, /scheduler/i, /\bagent\b/i],
  },
  {
    category: 'cache',
    loggerPrefixes: ['Sitecore.Caching'],
    messagePatterns: [/\bcache\b/i, /CacheManager/i, /evict/i],
  },
  {
    category: 'security',
    loggerPrefixes: ['Sitecore.Security', 'Sitecore.Web.Authentication'],
    messagePatterns: [/AccessDeniedException/i, /\bauth(entication|orization)?\b/i, /\bsecurity\b/i, /\blogin\b/i],
  },
  {
    category: 'media',
    loggerPrefixes: ['Sitecore.Resources.Media'],
    messagePatterns: [/\bmedia\b/i, /MediaManager/i],
  },
  {
    category: 'sync',
    loggerPrefixes: ['Sitecore.Publishing.Service'],
    messagePatterns: [/Publishing\.Service/i, /CD\/CM/i],
  },
  {
    category: 'pipelines',
    loggerPrefixes: ['Sitecore.Pipelines'],
    messagePatterns: [/pipeline/i, /processor/i],
  },
]

export function classifyEntry(entry: LogEntry): LogCategory {
  const logger = entry.logger.toLowerCase()
  const thread = entry.thread.toLowerCase()
  const message = entry.message.toLowerCase()

  for (const rule of RULES) {
    if (rule.loggerPrefixes?.some(p => logger.startsWith(p.toLowerCase()))) return rule.category
    if (rule.threadPatterns?.some(r => r.test(thread))) return rule.category
    if (rule.messagePatterns?.some(r => r.test(message) || r.test(entry.message))) return rule.category
  }

  return 'general'
}

export function classifyEntries(entries: LogEntry[]): LogEntry[] {
  return entries.map(e => ({ ...e, category: classifyEntry(e) }))
}
