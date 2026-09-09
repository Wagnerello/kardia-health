import { logger } from '../services/logger';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { parseFirestoreDate } from './utils';

export interface SavedLaudo {
  id: string;
  user_id: string;
  conteudo: string;
  modelo_usado?: string;
  dias_analisados?: number;
  periodo_texto?: string;
  data_geracao: Date;
  data_atualizacao?: Date;
  ativo?: boolean;
}

export interface FiltroPeriodoLaudo {
  dataInicio?: Date | string;
  dataFim?: Date | string;
  dias?: number;
}

// Buscar Laudos do Usuário
export const buscarLaudos = async (uid: string, incluirInativos: boolean = false): Promise<SavedLaudo[]> => {
  try {
    const q = query(
      collection(db, 'laudos'),
      where('user_id', '==', uid)
    );
    const snap = await getDocs(q);
    let laudos: SavedLaudo[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        user_id: data.user_id,
        conteudo: data.conteudo || '',
        modelo_usado: data.modelo_usado,
        dias_analisados: data.dias_analisados,
        periodo_texto: data.periodo_texto,
        data_geracao: parseFirestoreDate(data.data_geracao),
        data_atualizacao: data.data_atualizacao ? parseFirestoreDate(data.data_atualizacao) : undefined,
        ativo: data.ativo !== false,
      };
    });

    if (!incluirInativos) {
      laudos = laudos.filter(l => l.ativo !== false);
    }

    return laudos.sort((a, b) => b.data_geracao.getTime() - a.data_geracao.getTime());
  } catch (err) {
    logger.error('[laudos-storage] Erro ao buscar laudos:', err);
    return [];
  }
};

// Atualizar Laudo Existente (Update)
export const atualizarLaudo = async (laudoId: string, conteudo: string, periodoTexto?: string): Promise<void> => {
  try {
    const laudoRef = doc(db, 'laudos', laudoId);
    const dadosAtualizacao: Record<string, unknown> = {
      conteudo,
      data_atualizacao: new Date()
    };
    if (periodoTexto) {
      dadosAtualizacao.periodo_texto = periodoTexto;
    }
    await updateDoc(laudoRef, dadosAtualizacao);
    logger.info(`[laudos-storage] Laudo ${laudoId} atualizado com sucesso.`);
  } catch (err) {
    logger.error('[laudos-storage] Erro ao atualizar laudo:', err);
    throw err;
  }
};

// Criar Laudo / Nota Clínica Manualmente (Create Manual)
export const criarLaudoManual = async (
  uid: string,
  conteudo: string,
  periodoTexto: string = 'Avaliação Clínica Manual',
  modeloUsado: string = 'Anotação Médica Direta'
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'laudos'), {
      user_id: uid,
      conteudo,
      modelo_usado: modeloUsado,
      periodo_texto: periodoTexto,
      dias_analisados: 0,
      data_geracao: new Date(),
      ativo: true
    });
    logger.info(`[laudos-storage] Laudo manual criado: ${docRef.id}`);
    return docRef.id;
  } catch (err) {
    logger.error('[laudos-storage] Erro ao criar laudo manual:', err);
    throw err;
  }
};

// Inativar Laudo (Soft Delete)
export const inativarLaudo = async (laudoId: string): Promise<void> => {
  try {
    const laudoRef = doc(db, 'laudos', laudoId);
    await updateDoc(laudoRef, {
      ativo: false,
      data_inativacao: new Date()
    });
  } catch (err) {
    logger.error('[laudos-storage] Erro ao inativar laudo:', err);
    throw err;
  }
};

// Reativar Laudo
export const reativarLaudo = async (laudoId: string): Promise<void> => {
  try {
    const laudoRef = doc(db, 'laudos', laudoId);
    await updateDoc(laudoRef, {
      ativo: true
    });
  } catch (err) {
    logger.error('[laudos-storage] Erro ao reativar laudo:', err);
    throw err;
  }
};

// Excluir Laudo Permanentemente (Hard Delete)
export const excluirLaudoPermanente = async (laudoId: string): Promise<void> => {
  try {
    const laudoRef = doc(db, 'laudos', laudoId);
    await deleteDoc(laudoRef);
    logger.info(`[laudos-storage] Laudo ${laudoId} excluído permanentemente.`);
  } catch (err) {
    logger.error('[laudos-storage] Erro ao excluir laudo permanentemente:', err);
    throw err;
  }
};

// Persistir laudo gerado pela IA
export async function persistirLaudoGerado(
  uid: string,
  conteudo: string,
  modeloUsado: string,
  dias: number,
  periodoTexto?: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'laudos'), {
      user_id: uid,
      conteudo,
      modelo_usado: modeloUsado,
      dias_analisados: dias,
      periodo_texto: periodoTexto || null,
      data_geracao: new Date(),
      ativo: true
    });
  } catch (dbErr) {
    logger.error('[laudos-storage] Erro ao salvar laudo no banco:', dbErr);
  }
}
