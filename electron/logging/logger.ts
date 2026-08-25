/**
 * Structured logging — pino when available, console fallback.
 */
// @ts-nocheck

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFn {
  (obj: Record<string, unknown>, msg?: string): void;
  (msg: string): void;
  (obj: unknown, msg?: string): void;
}

export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  child: (bindings: Record<string, unknown>) => Logger;
}

let pinoLogger: Logger | null = null;

function tryLoadPino(): Logger | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pino = require('pino') as (opts?: Record<string, unknown>) => Logger;
    return pino({ level: process.env.JARVIS_LOG_LEVEL ?? 'info', name: 'jarvis' });
  } catch {
    return null;
  }
}

function consoleLogger(name: string): Logger {
  const log = (level: LogLevel, a: unknown, b?: string) => {
    const ts = new Date().toISOString();
    if (typeof a === 'string') console[level](`[${ts}] [${name}] ${a}`);
    else console[level](`[${ts}] [${name}]`, b ?? '', a);
  };
  return {
    debug: (a: unknown, b?: string) => log('debug', a, b),
    info: (a: unknown, b?: string) => log('info', a, b),
    warn: (a: unknown, b?: string) => log('warn', a, b),
    error: (a: unknown, b?: string) => log('error', a, b),
    child: (bindings) => consoleLogger(`${name}:${JSON.stringify(bindings)}`),
  };
}

export function getLogger(name = 'jarvis'): Logger {
  if (!pinoLogger) pinoLogger = tryLoadPino();
  const base = pinoLogger ?? consoleLogger('jarvis');
  return base.child({ module: name });
}
