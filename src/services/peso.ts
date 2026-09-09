import { logger } from '../services/logger';
// Serviço de histórico e controle de peso
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { parseFirestoreDate } from './utils';

// Salvar registro de peso no histórico
export const salvarHistoricoPeso = async (
  uid: string,
  peso: number,
  data: Date = new Date(),
  id?: string
): Promise<void> => {
  const docRef = id ? doc(db, 'weight_history', id) : doc(collection(db, 'weight_history'));
  await setDoc(docRef, {
    user_id: uid,
    peso,
    data: Timestamp.fromDate(data)
  }, { merge: true });
};

// Excluir registro de peso
export const excluirPeso = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'weight_history', id));
};

// Buscar histórico de peso ordenado por data
export const buscarHistoricoPeso = async (
  uid: string
): Promise<Array<{ id: string; peso: number; data: Date }>> => {
  try {
    const q = query(
      collection(db, 'weight_history'),
      where('user_id', '==', uid),
      orderBy('data', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      peso: Number(d.data().peso) || 0,
      data: parseFirestoreDate(d.data().data)
    }));
  } catch (err) {
    logger.warn('[peso] buscarHistoricoPeso indexada falhou. Usando fallback local...', err);
    try {
      const fallbackQuery = query(
        collection(db, 'weight_history'),
        where('user_id', '==', uid)
      );
      const snap = await getDocs(fallbackQuery);
      const items = snap.docs.map(d => ({
        id: d.id,
        peso: Number(d.data().peso) || 0,
        data: parseFirestoreDate(d.data().data)
      }));
      return items.sort((a, b) => a.data.getTime() - b.data.getTime());
    } catch (err2) {
      logger.error('[peso] Falha total ao buscar histórico de peso', err2);
      return [];
    }
  }
};
