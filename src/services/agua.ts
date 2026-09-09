import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { DailyWaterLog } from '../types';

/**
 * Busca o registro de água do usuário para uma data específica (YYYY-MM-DD).
 */
export async function buscarAguaDoDia(uid: string, dateString: string): Promise<DailyWaterLog | null> {
  const q = query(
    collection(db, 'water_logs'),
    where('user_id', '==', uid),
    where('date_string', '==', dateString)
  );

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as DailyWaterLog;
}

/**
 * Salva ou atualiza a água consumida pelo usuário na data especificada.
 * Cria o documento com um ID baseado no UID e na Data para evitar duplicidade facilmente.
 */
export async function salvarAguaDoDia(uid: string, dateString: string, amount_ml: number, meta_ml: number = 2000): Promise<void> {
  const docId = `${uid}_${dateString}`;
  const docRef = doc(db, 'water_logs', docId);

  const log: DailyWaterLog = {
    user_id: uid,
    date_string: dateString,
    amount_ml,
    meta_ml
  };

  await setDoc(docRef, log, { merge: true });
}

/**
 * Busca o histórico de logs de água do usuário para N dias a partir de um offset (0 = hoje, 7 = 7 dias atrás).
 * Dias sem registro são preenchidos com amount_ml: 0.
 */
export async function buscarHistoricoAgua(uid: string, limitDays: number = 7, offsetDays: number = 0): Promise<DailyWaterLog[]> {
  const q = query(
    collection(db, 'water_logs'),
    where('user_id', '==', uid)
  );

  const querySnapshot = await getDocs(q);
  const logsMap = new Map<string, DailyWaterLog>();
  querySnapshot.docs.forEach(doc => {
    const data = doc.data() as DailyWaterLog;
    logsMap.set(data.date_string, { id: doc.id, ...data });
  });

  const result: DailyWaterLog[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - offsetDays);

  for (let i = 0; i < limitDays; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    
    // Formatar YYYY-MM-DD considerando o fuso local
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const existingLog = logsMap.get(dateStr);
    if (existingLog) {
      result.push(existingLog);
    } else {
      result.push({
        id: `${uid}_${dateStr}`,
        user_id: uid,
        date_string: dateStr,
        amount_ml: 0,
        meta_ml: 2000
      });
    }
  }

  // Já retorna ordenado por date_string decrescente (mais recente primeiro na janela)
  return result;
}

