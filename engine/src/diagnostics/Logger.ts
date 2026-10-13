export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  level: Exclude<LogLevel, 'silent'>;
  scope: string;
  message: string;
  timestamp: number;
  /** Serialised detail, when the caller supplied one. */
  detail?: string;
}

export type LogSink = (entry: LogEntry) => void;

const LEVEL_ORDER: Record<LogLevel, number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

export interface LoggerOptions {
  level?: LogLevel;
  /** Default scope for entries written through this logger. */
  scope?: string;
  /** Additional sinks, e.g. the portal's runtime console. */
  sinks?: LogSink[];
  /** Number of entries kept in memory for inspection by tools. */
  historyLimit?: number;
  /** Mirror entries to the host console. Defaults to true outside production builds. */
  mirrorToConsole?: boolean;
}

/**
 * Small structured logger.
 *
 * A bounded ring buffer of recent entries is always kept: the Electron shell and the in-portal
 * runtime console read it, so a game's log output is inspectable without a devtools window.
 */
export class Logger {
  private levelValue: LogLevel;
  private readonly scopeValue: string;
  private readonly sinks: LogSink[] = [];
  private readonly mirror: boolean;
  private readonly historyLimit: number;
  private readonly history: LogEntry[] = [];

  constructor(options: LoggerOptions = {}) {
    this.levelValue = options.level ?? 'info';
    this.scopeValue = options.scope ?? 'gameforge';
    this.mirror = options.mirrorToConsole ?? true;
    this.historyLimit = Math.max(0, options.historyLimit ?? 200);
    if (options.sinks) this.sinks.push(...options.sinks);
  }

  setLevel(level: LogLevel): void {
    this.levelValue = level;
  }

  get level(): LogLevel {
    return this.levelValue;
  }

  addSink(sink: LogSink): () => void {
    this.sinks.push(sink);
    return () => {
      const index = this.sinks.indexOf(sink);
      if (index !== -1) this.sinks.splice(index, 1);
    };
  }

  /** Derive a logger that prefixes a scope, sharing level, sinks and history. */
  child(scope: string): Logger {
    const child = new Logger({ level: this.levelValue, scope, mirrorToConsole: this.mirror, historyLimit: this.historyLimit });
    this.sinks.push((entry) => child.record(entry));
    return child;
  }

  /** Write a pre-formed entry; used by `child` and by external bridges. */
  record(entry: LogEntry): void {
    if (LEVEL_ORDER[entry.level] > LEVEL_ORDER[this.levelValue]) return;
    if (this.historyLimit > 0) {
      this.history.push(entry);
      if (this.history.length > this.historyLimit) this.history.shift();
    }
    for (const sink of this.sinks) sink(entry);
  }

  error(message: string, detail?: unknown): void { this.write('error', message, detail); }
  warn(message: string, detail?: unknown): void { this.write('warn', message, detail); }
  info(message: string, detail?: unknown): void { this.write('info', message, detail); }
  debug(message: string, detail?: unknown): void { this.write('debug', message, detail); }

  private write(level: Exclude<LogLevel, 'silent'>, message: string, detail?: unknown): void {
    if (LEVEL_ORDER[level] > LEVEL_ORDER[this.levelValue]) return;

    let serialisedDetail: string | undefined;
    if (detail !== undefined) {
      try {
        serialisedDetail = typeof detail === 'string' ? detail : JSON.stringify(detail);
      } catch {
        serialisedDetail = String(detail);
      }
    }

    const entry: LogEntry = {
      level,
      scope: this.scopeValue,
      message,
      timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      detail: serialisedDetail,
    };

    this.record(entry);
    if (this.mirror) this.mirrorEntry(entry);
  }

  private mirrorEntry(entry: LogEntry): void {
    if (typeof console === 'undefined') return;
    const prefix = `[${entry.scope}]`;
    const text = entry.detail ? `${entry.message} ${entry.detail}` : entry.message;
    switch (entry.level) {
      case 'error': console.error(prefix, text); break;
      case 'warn': console.warn(prefix, text); break;
      case 'debug': console.debug(prefix, text); break;
      default: console.log(prefix, text);
    }
  }

  /** Recent entries, oldest first. */
  get entries(): readonly LogEntry[] {
    return this.history;
  }

  /** Recent entries filtered by level, for the runtime console. */
  entriesAt(level: Exclude<LogLevel, 'silent'>): LogEntry[] {
    return this.history.filter((entry) => entry.level === level);
  }

  clearHistory(): void {
    this.history.length = 0;
  }
}

export function isLogEnabled(level: LogLevel, threshold: LogLevel): boolean {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[threshold];
}
