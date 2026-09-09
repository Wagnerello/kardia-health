import { Timestamp } from 'firebase/firestore';

function parseTimestampDuck(val: object): Date | null {
  if ('toDate' in val && typeof (val as { toDate: () => unknown }).toDate === 'function') {
    try {
      const d = (val as { toDate: () => unknown }).toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {
      return null;
    }
  }
  if ('seconds' in val && typeof (val as { seconds: unknown }).seconds === 'number') {
    const d = new Date((val as { seconds: number }).seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Converte qualquer formato de data (Firestore Timestamp, Date, ISO string,
 * epoch timestamp em ms/s, ou objeto {seconds, nanoseconds}) em um objeto Date válido.
 */
export function parseFirestoreDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'object') {
    const parsed = parseTimestampDuck(val as object);
    if (parsed) return parsed;
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}
