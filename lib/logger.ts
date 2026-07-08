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
