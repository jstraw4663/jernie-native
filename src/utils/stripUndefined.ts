// Removes undefined-valued keys from an object. Preserves null (RTDB's delete signal)
// and all other falsy-but-defined values (0, '', false). Used before Firebase writes.
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
