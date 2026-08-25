// Configuração do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'kardia-health-app',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'kardia-health-app.firebasestorage.app',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForVitestTestingEnv12345',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'kardia-health-app.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar serviços
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;

