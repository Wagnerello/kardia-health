// Serviço de autenticação e perfil de usuário
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import type { User } from 'firebase/auth';

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
  updateDoc,
  getCountFromServer,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';
import { parseFirestoreDate } from './utils';

// Registrar usuário com email e senha
export const registrarUsuario = async (email: string, senha: string): Promise<User> => {
  const { user } = await createUserWithEmailAndPassword(auth, email, senha);
  return user;
};

// Login com email e senha
export const loginUsuario = async (email: string, senha: string): Promise<User> => {
  const { user } = await signInWithEmailAndPassword(auth, email, senha);
  return user;
};

// Logout
export const logoutUsuario = async (): Promise<void> => {
  await signOut(auth);
};

// Salvar perfil do usuário no Firestore
export const salvarPerfilUsuario = async (uid: string, perfil: Omit<UserProfile, 'uid' | 'data_criacao' | 'role' | 'plano' | 'status' | 'email'>): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  let role: 'ADMIN' | 'USER' = 'USER';
  let plano: 'Gratuito' | 'Premium' | 'Ouro' = 'Gratuito';
  let status: 'Pendente' | 'Ativo' | 'Suspenso' | 'Inativo' = 'Ativo';
  
  if (userSnap.exists()) {
    const data = userSnap.data();
    role = data.role || 'USER';
    plano = data.plano || 'Gratuito';
    status = (data.status === 'Suspenso' || data.status === 'Inativo') ? data.status : 'Ativo';
  }
  const userAuth = auth.currentUser;
  const email = userAuth?.email || '';
  
  await setDoc(userRef, {
    uid,
    email,
    ...perfil,
    role,
    plano,
    status,
    data_criacao: serverTimestamp(),
  }, { merge: true });
};

// Buscar perfil do usuário
export const buscarPerfilUsuario = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        uid: data.uid || uid,
        email: data.email || '',
        nome: data.nome || 'Usuário',
        sexo: data.sexo || 'outro',
        idade: Number(data.idade) || 0,
        peso: Number(data.peso) || 0,
        altura: data.altura ? Number(data.altura) : undefined,
        nascimento: data.nascimento,
        hipertenso: data.hipertenso !== false,
        diabetico: !!data.diabetico,
        fumante: !!data.fumante,
        sedentario: !!data.sedentario,
        usaMedicacao: !!data.usaMedicacao,
        termos_aceitos: data.termos_aceitos === true,
        termos_aceitos_em: data.termos_aceitos_em || undefined,
        termos_versao: data.termos_versao || undefined,
        role: data.role || 'USER',
        plano: data.plano || 'Gratuito',
        status: data.status || 'Ativo',
        data_criacao: parseFirestoreDate(data.data_criacao),
      };
    }
    return null;
  } catch (err) {
    console.error('[auth] Erro ao buscar perfil de usuário:', err);
    return null;
  }
};

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

// Versão atual dos termos — incrementar quando houver mudanças nos termos
export const TERMOS_VERSAO_ATUAL = '1.0';

// Registrar aceite dos termos no Firestore
export const aceitarTermos = async (uid: string): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    termos_aceitos: true,
    termos_aceitos_em: new Date().toISOString(),
    termos_versao: TERMOS_VERSAO_ATUAL,
  });
};

// Observer de estado de autenticação
export const observarAutenticacao = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Login com Google.
 * Usando signInWithPopup globalmente pois o signInWithRedirect falha 
 * frequentemente em domínios cruzados (ex: Vercel vs Firebase) devido 
 * ao bloqueio de cookies de terceiros em navegadores modernos.
 */
export const loginComGoogle = async (): Promise<void> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
};

/**
 * Como usamos popup exclusivamente, o redirectResult não é mais necessário.
 */
export const processarRedirectGoogle = async (): Promise<User | null> => {
  return null;
};

// Obter total de aferições do sistema (apenas Admin)
export const obterTotalAfericoes = async (): Promise<number> => {
  const readingsCol = collection(db, 'bp_readings');
  const snapshot = await getCountFromServer(readingsCol);
  return snapshot.data().count;
};

// Salvar registro de peso no histórico
export const salvarHistoricoPeso = async (uid: string, peso: number, data: Date = new Date(), id?: string): Promise<void> => {
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
export const buscarHistoricoPeso = async (uid: string): Promise<Array<{ id: string, peso: number, data: Date }>> => {
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
    console.warn('[auth] buscarHistoricoPeso indexada falhou. Usando fallback local...', err);
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
      console.error('[auth] Falha total ao buscar histórico de peso', err2);
      return [];
    }
  }
};

// --- ESTATÍSTICAS E SERVIÇOS DE ADMIN ---

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
    console.error('[auth] Erro ao registrar log de admin:', err);
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
    console.warn('[auth] Erro ao buscar logs indexados. Tentando fallback local...', err);
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
      console.error('[auth] Erro ao carregar logs admin:', e);
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
    console.error('[auth] Erro ao buscar configurações do sistema:', err);
    return defaultConfig;
  }
};

// Salvar configurações do sistema
export const salvarConfigSistema = async (config: SystemConfig): Promise<void> => {
  const docRef = doc(db, 'config', 'global');
  await setDoc(docRef, config, { merge: true });
};
