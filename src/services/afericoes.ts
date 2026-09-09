import { logger } from '../services/logger';
/**
 * Serviço de aferições de pressão arterial.
 * Operações de dados, upload de imagens e consultas no Firestore.
 */
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { BpReading } from '../types';
import { parseFirestoreDate } from './utils';

// Reexportações para compatibilidade pública retroativa total
export * from './laudos';
export * from './afericoes-ai';

// Auxiliar para Base64
const converterArquivoParaBase64DataUrl = (arquivo: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(arquivo);
  });
};

// Upload de imagem da aferição
export const uploadImagemAfericao = async (uid: string, arquivo: File): Promise<string> => {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.startsWith('192.168.'))
  ) {
    logger.info('[Storage] Rodando localmente. Ignorando Firebase Storage (CORS) e gerando Base64 local.');
    return await converterArquivoParaBase64DataUrl(arquivo);
  }

  try {
    const nomeArquivo = `${Date.now()}_${arquivo.name}`;
    const storageRef = ref(storage, `bp_images/${uid}/${nomeArquivo}`);
    const snapshot = await uploadBytes(storageRef, arquivo);
    return await getDownloadURL(snapshot.ref);
  } catch (error: unknown) {
    logger.warn('[Storage] Erro no upload. Usando fallback para Base64 local...', error);
    return await converterArquivoParaBase64DataUrl(arquivo);
  }
};

// Salvar leitura no Firestore
export const salvarAfericao = async (leitura: Omit<BpReading, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'bp_readings'), {
    ...leitura,
    data_hora_afericao: Timestamp.fromDate(leitura.data_hora_afericao),
  });
  return docRef.id;
};

// Atualizar feedback da IA
export const atualizarFeedbackIA = async (id: string, feedback: string): Promise<void> => {
  await updateDoc(doc(db, 'bp_readings', id), {
    ai_feedback: feedback,
  });
};

// Buscar aferições dos últimos N dias
export const buscarAfericoes = async (uid: string, dias: number = 30): Promise<BpReading[]> => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  try {
    const q = query(
      collection(db, 'bp_readings'),
      where('user_id', '==', uid),
      where('data_hora_afericao', '>=', Timestamp.fromDate(dataLimite)),
      orderBy('data_hora_afericao', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        data_hora_afericao: parseFirestoreDate(data.data_hora_afericao || data.data_hora || data.timestamp),
      };
    }) as BpReading[];
  } catch (err) {
    logger.warn('[afericoes] Consulta indexada falhou. Usando fallback local por user_id...', err);
    try {
      const fallbackQuery = query(
        collection(db, 'bp_readings'),
        where('user_id', '==', uid)
      );
      const snap = await getDocs(fallbackQuery);
      const leituras: BpReading[] = [];
      snap.forEach(d => {
        const data = d.data();
        const dataHora = parseFirestoreDate(data.data_hora_afericao || data.data_hora || data.timestamp);
        if (dataHora >= dataLimite) {
          leituras.push({
            id: d.id,
            user_id: data.user_id,
            sys: data.sys,
            dia: data.dia,
            pul: data.pul,
            data_hora_afericao: dataHora,
            ai_feedback: data.ai_feedback,
            image_url: data.image_url || data.imagem_url,
          });
        }
      });
      return leituras.sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime());
    } catch (fallbackErr) {
      logger.error('[afericoes] Erro no fallback de buscarAfericoes:', fallbackErr);
      return [];
    }
  }
};

// Buscar últimas N aferições
export const buscarUltimasAfericoes = async (uid: string, qtd: number = 10): Promise<BpReading[]> => {
  try {
    const q = query(
      collection(db, 'bp_readings'),
      where('user_id', '==', uid),
      orderBy('data_hora_afericao', 'desc'),
      limit(qtd)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        data_hora_afericao: parseFirestoreDate(data.data_hora_afericao || data.data_hora || data.timestamp),
      };
    }) as BpReading[];
  } catch (err) {
    logger.warn('[afericoes] buscarUltimasAfericoes indexada falhou. Usando fallback local...', err);
    try {
      const fallbackQuery = query(
        collection(db, 'bp_readings'),
        where('user_id', '==', uid)
      );
      const snap = await getDocs(fallbackQuery);
      const leituras: BpReading[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          data_hora_afericao: parseFirestoreDate(data.data_hora_afericao || data.data_hora || data.timestamp),
        } as BpReading;
      });
      return leituras
        .sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime())
        .slice(0, qtd);
    } catch (fallbackErr) {
      logger.error('[afericoes] Erro no fallback de buscarUltimasAfericoes:', fallbackErr);
      return [];
    }
  }
};

// Calcular médias
export const calcularMedias = (afericoes: BpReading[]): { sys: number; dia: number; pul: number } | null => {
  if (afericoes.length === 0) return null;

  const soma = afericoes.reduce((acc, a) => ({
    sys: acc.sys + a.sys,
    dia: acc.dia + a.dia,
    pul: acc.pul + a.pul,
  }), { sys: 0, dia: 0, pul: 0 });

  return {
    sys: Math.round(soma.sys / afericoes.length),
    dia: Math.round(soma.dia / afericoes.length),
    pul: Math.round(soma.pul / afericoes.length),
  };
};
