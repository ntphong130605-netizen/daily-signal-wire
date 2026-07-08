export function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const result: unknown = JSON.parse(value);
    return Array.isArray(result)
      ? result.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const result: unknown = JSON.parse(value);
    return Array.isArray(result) ? (result as T[]) : [];
  } catch {
    return [];
  }
}
