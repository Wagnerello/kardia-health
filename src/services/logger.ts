import { reportError } from './telemetry';

export const logger = {
  info(msg: string, ...args: unknown[]): void {
    console.info(`[KardIA] ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    console.warn(`[KardIA] ${msg}`, ...args);
  },
  error(errorOrMsg: unknown, errorOrContext?: unknown, maybeContext?: string): void {
    if (typeof errorOrMsg === 'string' && errorOrContext !== undefined && typeof errorOrContext !== 'string') {
      reportError(errorOrContext, maybeContext || errorOrMsg);
    } else if (typeof errorOrMsg === 'string') {
      reportError(new Error(errorOrMsg), typeof errorOrContext === 'string' ? errorOrContext : undefined);
    } else {
      reportError(errorOrMsg, typeof errorOrContext === 'string' ? errorOrContext : undefined);
    }
  },
  debug(msg: string, ...args: unknown[]): void {
    if (import.meta.env?.DEV) {
      console.log(`[KardIA Debug] ${msg}`, ...args);
    }
  }
};
