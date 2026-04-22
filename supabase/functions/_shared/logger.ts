// supabase/functions/_shared/logger.ts
//
// Structured logging helper. Every log line is JSON, every line carries
// workspace_id + function name so Supabase log explorer becomes searchable.
// Plain console.log still works but prefer logger.info/warn/error for
// anything billing-relevant or debuggable.

type LogLevel = "info" | "warn" | "error";

export interface LoggerContext {
  fn: string;
  workspaceId?: string | null;
  triggeredBy?: string | null;
  runId?: string | null;
}

export class Logger {
  constructor(private ctx: LoggerContext) {}

  child(extra: Partial<LoggerContext>): Logger {
    return new Logger({ ...this.ctx, ...extra });
  }

  private emit(level: LogLevel, msg: string, data?: Record<string, unknown>) {
    const payload = {
      level,
      ts: new Date().toISOString(),
      msg,
      ...this.ctx,
      ...(data ?? {}),
    };
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  info(msg: string, data?: Record<string, unknown>) {
    this.emit("info", msg, data);
  }
  warn(msg: string, data?: Record<string, unknown>) {
    this.emit("warn", msg, data);
  }
  error(msg: string, data?: Record<string, unknown>) {
    this.emit("error", msg, data);
  }
}

export function createLogger(ctx: LoggerContext): Logger {
  return new Logger(ctx);
}
