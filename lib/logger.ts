type LogContext = Record<string, unknown>;

export function logError(event: string, error: unknown, context: LogContext = {}) {
  const details =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error(
    JSON.stringify({
      level: "error",
      event,
      at: new Date().toISOString(),
      ...context,
      error: details
    })
  );
}

export function logInfo(event: string, context: LogContext = {}) {
  console.info(
    JSON.stringify({
      level: "info",
      event,
      at: new Date().toISOString(),
      ...context
    })
  );
}

export function logWarn(event: string, context: LogContext = {}) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event,
      at: new Date().toISOString(),
      ...context
    })
  );
}

export function logPerformance(
  event: string,
  durationMs: number,
  context: LogContext = {}
) {
  console.info(
    JSON.stringify({
      level: durationMs > 2_500 ? "warn" : "info",
      event,
      durationMs,
      at: new Date().toISOString(),
      ...context
    })
  );
}
