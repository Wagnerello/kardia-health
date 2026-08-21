import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Medication } from '../types';

export const buscarMedications = async (uid: string): Promise<Medication[]> => {
  const q = query(
    collection(db, 'user_medications'),
    where('user_id', '==', uid)
  );
  
  const snap = await getDocs(q);
  const meds = snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      data_inicio: data.data_inicio?.toDate(),
      data_fim: data.data_fim?.toDate(),
      data_criacao: data.data_criacao?.toDate() || new Date()
    } as Medication;
  });
  
  // Sort desc by data_criacao
  return meds.sort((a, b) => b.data_criacao.getTime() - a.data_criacao.getTime());
};

export const salvarMedication = async (med: Omit<Medication, 'id'>): Promise<string> => {
  const colRef = collection(db, 'user_medications');
  const docRef = await addDoc(colRef, med);
  return docRef.id;
};

export const atualizarMedication = async (id: string, updates: Partial<Medication>): Promise<void> => {
  const docRef = doc(db, 'user_medications', id);
  await updateDoc(docRef, updates);
};

export const excluirMedication = async (id: string): Promise<void> => {
  const docRef = doc(db, 'user_medications', id);
  await deleteDoc(docRef);
};
