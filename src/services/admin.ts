import { logger } from '../services/logger';
// Serviços e operações de administração do sistema e auditoria
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getCountFromServer,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';
import { parseFirestoreDate } from './utils';

export interface AdminLog {
  id?: string;
  acao: string;
  detalhe: string;
  alvo_uid?: string;
  alvo_email?: string;
  admin_uid: string;
  admin_email: string;
  timestamp: Date;
}

export interface SystemConfig {
  mensagem_global: string;
  mensagem_ativa: boolean;
  bloquear_cadastros: boolean;
  manutencao: boolean;
}

// Obter todos os usuários (apenas Admin)
export const obterTodosUsuarios = async (): Promise<UserProfile[]> => {
  const usersCol = collection(db, 'users');
  const userSnapshot = await getDocs(usersCol);
  return userSnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      uid: data.uid,
      email: data.email || '',
      nome: data.nome || 'Sem Nome',
      sexo: data.sexo || 'outro',
      idade: data.idade || 0,
      peso: data.peso || 0,
      altura: data.altura || 0,
      nascimento: data.nascimento,
      role: data.role || 'USER',
      plano: data.plano || 'Gratuito',
      status: data.status || 'Pendente',
      hipertenso: !!data.hipertenso,
      diabetico: !!data.diabetico,
      fumante: !!data.fumante,
      sedentario: !!data.sedentario,
      usaMedicacao: !!data.usaMedicacao,
      termos_aceitos: data.termos_aceitos === true,
      termos_aceitos_em: data.termos_aceitos_em || undefined,
      termos_versao: data.termos_versao || undefined,
      data_criacao: parseFirestoreDate(data.data_criacao),
    };
  });
};

// Atualizar função/role do usuário (apenas Admin)
export const atualizarFuncaoUsuario = async (uid: string, novaRole: 'ADMIN' | 'USER'): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { role: novaRole });
};

// Atualizar plano do usuário (apenas Admin)
export const atualizarPlanoUsuario = async (uid: string, novoPlano: 'Gratuito' | 'Premium' | 'Ouro'): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { plano: novoPlano });
};

// Atualizar status do usuário (apenas Admin)
export const atualizarStatusUsuario = async (uid: string, novoStatus: 'Pendente' | 'Ativo' | 'Suspenso' | 'Inativo'): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { status: novoStatus });
};

// Atualizar perfil do usuário pelo Admin
export const atualizarPerfilUsuarioAdmin = async (uid: string, dados: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, dados);
};

// Excluir dados e conta do usuário do Firestore (apenas Admin)
export const excluirDadosUsuario = async (uid: string): Promise<void> => {
  // 1. Apagar todas as aferições do usuário
  const readingsCol = collection(db, 'bp_readings');
  const q = query(readingsCol, where('user_id', '==', uid));
  const snapshots = await getDocs(q);
  const deletePromises = snapshots.docs.map(docSnap => deleteDoc(doc(db, 'bp_readings', docSnap.id)));
  await Promise.all(deletePromises);
  
  // 2. Apagar o perfil de usuário
  const userRef = doc(db, 'users', uid);
  await deleteDoc(userRef);
};

// Obter total de aferições do sistema (apenas Admin)
export const obterTotalAfericoes = async (): Promise<number> => {
  const readingsCol = collection(db, 'bp_readings');
  const snapshot = await getCountFromServer(readingsCol);
  return snapshot.data().count;
};

// Registrar log de auditoria do admin
export const registrarLogAdmin = async (acao: string, detalhe: string, alvoUid?: string, alvoEmail?: string): Promise<void> => {
  try {
    const adminUser = auth.currentUser;
    if (!adminUser) return;

    await setDoc(doc(collection(db, 'admin_logs')), {
      acao,
      detalhe,
      alvo_uid: alvoUid || '',
      alvo_email: alvoEmail || '',
      admin_uid: adminUser.uid,
      admin_email: adminUser.email || '',
      timestamp: serverTimestamp()
    });
  } catch (err) {
    logger.error('[admin] Erro ao registrar log de admin:', err);
  }
};

// Buscar logs do admin
export const buscarLogsAdmin = async (limite: number = 50): Promise<AdminLog[]> => {
  try {
    const q = query(
      collection(db, 'admin_logs'),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.slice(0, limite).map(d => {
      const data = d.data();
      const ts = data.timestamp ? parseFirestoreDate(data.timestamp) : new Date(0);
      return {
        id: d.id,
        acao: data.acao || 'Ação desconhecida',
        detalhe: data.detalhe || '',
        alvo_uid: data.alvo_uid,
        alvo_email: data.alvo_email,
        admin_uid: data.admin_uid,
        admin_email: data.admin_email,
        timestamp: ts
      };
    });
  } catch (err) {
    logger.warn('[admin] Erro ao buscar logs indexados. Tentando fallback local...', err);
    try {
      const snap = await getDocs(collection(db, 'admin_logs'));
      const items = snap.docs.map(d => {
        const data = d.data();
        const ts = data.timestamp ? parseFirestoreDate(data.timestamp) : new Date(0);
        return {
          id: d.id,
          acao: data.acao || 'Ação desconhecida',
          detalhe: data.detalhe || '',
          alvo_uid: data.alvo_uid,
          alvo_email: data.alvo_email,
          admin_uid: data.admin_uid,
          admin_email: data.admin_email,
          timestamp: ts
        };
      });
      return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limite);
    } catch (e) {
      logger.error('[admin] Erro ao carregar logs admin:', e);
      return [];
    }
  }
};

// Buscar configurações do sistema
export const buscarConfigSistema = async (): Promise<SystemConfig> => {
  const defaultConfig: SystemConfig = {
    mensagem_global: '',
    mensagem_ativa: false,
    bloquear_cadastros: false,
    manutencao: false
  };

  try {
    const docRef = doc(db, 'config', 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...defaultConfig, ...snap.data() };
    }
    return defaultConfig;
  } catch (err) {
    logger.error('[admin] Erro ao buscar configurações do sistema:', err);
    return defaultConfig;
  }
};

// Salvar configurações do sistema
export const salvarConfigSistema = async (config: SystemConfig): Promise<void> => {
  const docRef = doc(db, 'config', 'global');
  await setDoc(docRef, config, { merge: true });
};
