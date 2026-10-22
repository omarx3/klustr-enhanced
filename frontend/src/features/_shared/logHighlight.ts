// ANSI palette tuned for both light and dark xterm themes.
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const UNDIM = '\x1b[22m'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const MAGENTA = '\x1b[35m'
const CYAN = '\x1b[36m'

const METHOD_COLOR: Record<string, string> = {
  GET: GREEN,
  HEAD: GREEN,
  OPTIONS: MAGENTA,
  POST: BLUE,
  PUT: YELLOW,
  PATCH: YELLOW,
  DELETE: RED,
}

// Regexes are evaluated in order; later passes operate on output that already
// contains escape sequences, so each pattern is anchored on substrings the
// previous passes won't touch (quotes, brackets, dotted IP form, etc.).
const SUBS: Array<[RegExp, (...args: string[]) => string]> = [
  // Bracketed log levels: [error] [warn] [info] [debug]
  [
    /\[(ERROR|ERR|FATAL|PANIC|CRITICAL|error|err|fatal|panic|critical)\]/g,
    (_m, lvl: string) => `[${RED}${lvl}${RESET}]`,
  ],
  [
    /\[(WARN|WARNING|warn|warning)\]/g,
    (_m, lvl: string) => `[${YELLOW}${lvl}${RESET}]`,
  ],
  [
    /\[(INFO|DEBUG|TRACE|info|debug|trace)\]/g,
    (_m, lvl: string) => `[${DIM}${lvl}${UNDIM}]`,
  ],
  // Bare level: level=error  ·  level=warn  ·  level=info
  [
    /\blevel=(error|err|fatal|panic|critical)\b/g,
    (_m, lvl: string) => `level=${RED}${lvl}${RESET}`,
  ],
  [
    /\blevel=(warn|warning)\b/g,
    (_m, lvl: string) => `level=${YELLOW}${lvl}${RESET}`,
  ],
  [
    /\blevel=(info|debug|trace)\b/g,
    (_m, lvl: string) => `level=${DIM}${lvl}${UNDIM}`,
  ],
  // Apache/CLF timestamp: [16/May/2026:17:50:35 +0000]
  [
    /\[(\d{1,2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})\]/g,
    (_m, ts: string) => `[${DIM}${ts}${UNDIM}]`,
  ],
  // ISO timestamps: 2026-05-16T17:50:33.123Z  or  2026-05-16 17:50:33
  [
    /\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?Z?)\b/g,
    (_m, ts: string) => `${DIM}${ts}${UNDIM}`,
  ],
  // nginx-style timestamp: 2026/05/16 17:50:33
  [
    /\b(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})\b/g,
    (_m, ts: string) => `${DIM}${ts}${UNDIM}`,
  ],
  // HTTP method inside CLF-style quoted request: "GET /path HTTP/1.1"
  [
    /"(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS) /g,
    (_m, method: string) => `"${METHOD_COLOR[method] ?? ''}${method}${RESET} `,
  ],
  // HTTP method at request start: GET /path or POST /path (logfmt / structured)
  [
    /\b(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS) (\/[^\s"]*)/g,
    (_m, method: string, path: string) =>
      `${METHOD_COLOR[method] ?? ''}${method}${RESET} ${path}`,
  ],
  // HTTP status code after HTTP/x.y" — colour by class
  [
    /HTTP\/(\d\.\d)" (\d{3})/g,
    (_m, ver: string, code: string) => {
      const n = Number.parseInt(code, 10)
      const color = n >= 500 ? RED : n >= 400 ? YELLOW : n >= 300 ? CYAN : GREEN
      return `HTTP/${ver}" ${color}${code}${RESET}`
    },
  ],
  // status=N / code=N / http_status=N
  [
    /\b(status|code|http_status)=(\d{3})\b/g,
    (_m, key: string, code: string) => {
      const n = Number.parseInt(code, 10)
      const color = n >= 500 ? RED : n >= 400 ? YELLOW : n >= 300 ? CYAN : GREEN
      return `${key}=${color}${code}${RESET}`
    },
  ],
  // IPv4 — match conservatively (avoid hitting "2.0" parts of versions)
  [
    /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
    (_m, ip: string) => `${CYAN}${ip}${RESET}`,
  ],
]

export function highlightLogContent(line: string): string {
  let out = line
  for (const [re, fn] of SUBS) {
    out = out.replace(re, fn as (...args: string[]) => string)
  }
  return out
}
