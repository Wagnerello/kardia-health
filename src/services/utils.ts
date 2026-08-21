import { Timestamp } from 'firebase/firestore';

/**
 * Converte qualquer formato de data (Firestore Timestamp, Date, ISO string,
 * epoch timestamp em ms/s, ou objeto {seconds, nanoseconds}) em um objeto Date válido.
 */
export function parseFirestoreDate(val: any): Date {
  if (!val) return new Date();

  // 1. Instância do Timestamp do Firestore (ou duck typing)
  if (val instanceof Timestamp || (typeof val === 'object' && typeof val.toDate === 'function')) {
    try {
      const d = val.toDate();
      if (d && !isNaN(d.getTime())) return d;
    } catch {
      // fallback
    }
  }

  // 2. Instância de Date
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : val;
  }

  // 3. Objeto com formato Timestamp { seconds, nanoseconds }
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. String ou Número (epoch)
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}
