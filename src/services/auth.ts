import { logger } from '../services/logger';
// Serviço de autenticação e perfil de usuário
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';
import { parseFirestoreDate } from './utils';

// Reexportações para preservação estrita de compatibilidade pública
export * from './peso';
export * from './admin';

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
export const salvarPerfilUsuario = async (
  uid: string,
  perfil: Partial<Omit<UserProfile, 'uid' | 'data_criacao' | 'role' | 'plano' | 'status' | 'email'>>
): Promise<void> => {
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

import type { DocumentData } from 'firebase/firestore';

function extrairFlagsSaude(data: DocumentData) {
  return {
    hipertenso: data.hipertenso !== false,
    diabetico: Boolean(data.diabetico),
    fumante: Boolean(data.fumante),
    sedentario: Boolean(data.sedentario),
    usaMedicacao: Boolean(data.usaMedicacao),
  };
}

function extrairTermosPerfil(data: DocumentData) {
  return {
    termos_aceitos: data.termos_aceitos === true,
    termos_aceitos_em: data.termos_aceitos_em || undefined,
    termos_versao: data.termos_versao || undefined,
  };
}

function mapearDocumentoParaUserProfile(data: DocumentData, fallbackUid: string): UserProfile {
  return {
    uid: data.uid || fallbackUid,
    email: data.email || '',
    nome: data.nome || 'Usuário',
    sexo: data.sexo || 'outro',
    idade: Number(data.idade) || 0,
    peso: Number(data.peso) || 0,
    altura: data.altura ? Number(data.altura) : undefined,
    nascimento: data.nascimento,
    role: data.role || 'USER',
    plano: data.plano || 'Gratuito',
    status: data.status || 'Ativo',
    data_criacao: parseFirestoreDate(data.data_criacao),
    ...extrairFlagsSaude(data),
    ...extrairTermosPerfil(data),
  };
}

// Buscar perfil do usuário
export const buscarPerfilUsuario = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    return mapearDocumentoParaUserProfile(docSnap.data(), uid);
  } catch (err) {
    logger.error('[auth] Erro ao buscar perfil de usuário:', err);
    return null;
  }
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
 * Login com Google via popup.
 */
export const loginComGoogle = async (): Promise<void> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
};

/**
 * Compatibilidade redirect Google.
 */
export const processarRedirectGoogle = async (): Promise<User | null> => {
  return null;
};
