import { logger } from '../services/logger';
import { state } from './app-state';
import { mostrarToast, mostrarTela, toggleAvatarMenu } from './ui-utils';
import type { UserProfile } from '../types';
import {
  loginUsuario,
  registrarUsuario,
  logoutUsuario,
  loginComGoogle,
  salvarPerfilUsuario,
  buscarPerfilUsuario,
  aceitarTermos,
} from '../services/auth';
import { salvarHistoricoPeso } from '../services/peso';
import {
  mostrarPagina,
  mostrarAbaDashboard,
  mostrarAbaPerfil,
  toggleFabMenu,
  abrirTermosNoMenu,
  fecharTermosNoMenu,
  iniciarApp
} from './navigation';

export {
  mostrarPagina,
  mostrarAbaDashboard,
  mostrarAbaPerfil,
  toggleFabMenu,
  abrirTermosNoMenu,
  fecharTermosNoMenu,
  iniciarApp
};

export function traduzirErroFirebase(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    const code = (err as { code: string }).code;
    const erros: Record<string, string> = {
      'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    };
    return erros[code] || 'Ocorreu um erro. Tente novamente.';
  }
  return 'Ocorreu um erro. Tente novamente.';
}

function calcularIdade(nascimento: string): number {
  if (!nascimento) return 0;
  const nasc = new Date(nascimento + 'T00:00:00');
  const hoje = new Date();
  return hoje.getFullYear() - nasc.getFullYear() -
    (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate()) ? 1 : 0);
}

function lerDadosOnboarding(): Omit<UserProfile, 'uid' | 'data_criacao'> {
  const nascimento = (document.getElementById('ob-nascimento') as HTMLInputElement).value;
  return {
    nome: (document.getElementById('ob-nome') as HTMLInputElement).value,
    sexo: (document.getElementById('ob-sexo') as HTMLSelectElement).value as 'masculino' | 'feminino' | 'outro',
    nascimento,
    idade: calcularIdade(nascimento),
    peso: Number((document.getElementById('ob-peso') as HTMLInputElement).value),
    altura: Number((document.getElementById('ob-altura') as HTMLInputElement).value) || undefined,
    hipertenso: (document.getElementById('ob-hipertenso') as HTMLInputElement).checked,
    diabetico: (document.getElementById('ob-diabetico') as HTMLInputElement).checked,
    fumante: (document.getElementById('ob-fumante') as HTMLInputElement).checked,
    sedentario: (document.getElementById('ob-sedentario') as HTMLInputElement).checked,
    usaMedicacao: (document.getElementById('ob-medicacao') as HTMLInputElement).checked,
    status: 'Ativo'
  };
}

async function prosseguirAposAceitarTermos(uid: string): Promise<void> {
  const nextStep = window._termsNextStep || 'app';
  if (nextStep === 'onboarding') {
    mostrarTela('onboarding-screen');
    return;
  }
  if (!state.userProfile) {
    state.userProfile = await buscarPerfilUsuario(uid);
  }
  iniciarApp();
}

export const inicializarEventosAuth = (): void => {
  window.mostrarTab = (tab: string) => {
    document.getElementById('form-login')?.classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register')?.classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login')?.classList.toggle('active', tab === 'login');
    document.getElementById('tab-register')?.classList.toggle('active', tab !== 'login');
  };

  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const senha = (document.getElementById('login-password') as HTMLInputElement).value;
    const errEl = document.getElementById('login-error');
    if (!errEl) return;
    try {
      errEl.classList.add('hidden');
      await loginUsuario(email, senha);
    } catch (err) {
      logger.error('Erro no login:', err);
      errEl.textContent = traduzirErroFirebase(err);
      errEl.classList.remove('hidden');
    }
  });

  document.getElementById('btn-google-login')?.addEventListener('click', async () => {
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('btn-google-login') as HTMLButtonElement;
    try {
      if (errEl) errEl.classList.add('hidden');
      if (btn) { btn.disabled = true; btn.textContent = 'Conectando...'; }
      await loginComGoogle();
    } catch (err) {
      logger.error('Erro no login com Google:', err);
      if (errEl) {
        errEl.textContent = traduzirErroFirebase(err);
        errEl.classList.remove('hidden');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.33 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.67 14.62 48 24 48z"/></svg> Entrar com Google';
      }
    }
  });

  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('reg-email') as HTMLInputElement).value;
    const senha = (document.getElementById('reg-password') as HTMLInputElement).value;
    const errEl = document.getElementById('register-error');
    if (!errEl) return;
    try {
      errEl.classList.add('hidden');
      await registrarUsuario(email, senha);
    } catch (err) {
      errEl.textContent = traduzirErroFirebase(err);
      errEl.classList.remove('hidden');
    }
  });

  window.fazerLogout = async () => {
    await logoutUsuario();
    location.reload();
  };

  document.getElementById('form-onboarding')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.currentUser) return;
    const errEl = document.getElementById('onboarding-error');
    try {
      if (errEl) errEl.classList.add('hidden');
      const perfil = lerDadosOnboarding();
      await salvarPerfilUsuario(state.currentUser.uid, perfil);
      await salvarHistoricoPeso(state.currentUser.uid, perfil.peso);
      state.userProfile = { uid: state.currentUser.uid, data_criacao: new Date(), ...perfil };
      
      iniciarApp();
    } catch (err) {
      logger.error('Erro ao salvar onboarding:', err);
      if (errEl) {
        errEl.textContent = 'Erro ao salvar perfil. Tente novamente.';
        errEl.classList.remove('hidden');
      }
    }
  });

  window.aceitarTermosUsuario = async () => {
    if (!state.currentUser) return;
    const btn = document.getElementById('btn-aceitar-termos') as HTMLButtonElement;
    const checkbox = document.getElementById('terms-checkbox') as HTMLInputElement;
    if (!checkbox?.checked) {
      mostrarToast('Marque a caixa confirmando a leitura para continuar.', 'error');
      return;
    }
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Registrando aceite...'; }
      await aceitarTermos(state.currentUser.uid);
      mostrarToast('Termos aceitos com sucesso!', 'success');
      await prosseguirAposAceitarTermos(state.currentUser.uid);
    } catch (err) {
      logger.error('[termos] Erro ao aceitar termos:', err);
      mostrarToast('Erro ao registrar aceite. Tente novamente.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Li e Aceito os Termos';
      }
    }
  };

  document.addEventListener('click', (e) => {
    const fabBtn = document.getElementById('fab-main-btn');
    const fabMenu = document.getElementById('fab-menu');
    if (fabBtn && fabMenu && fabMenu.style.display !== 'none') {
      if (!fabBtn.contains(e.target as Node) && !fabMenu.contains(e.target as Node)) {
        toggleFabMenu();
      }
    }
    
    const avatarBtn = document.getElementById('user-avatar-btn');
    const avatarMenu = document.getElementById('avatar-menu');
    if (avatarBtn && avatarMenu && avatarMenu.style.display !== 'none') {
      if (!avatarBtn.contains(e.target as Node) && !avatarMenu.contains(e.target as Node)) {
        toggleAvatarMenu();
      }
    }
  });
};
