import { logger } from './services/logger';
import './style.css';
import { Chart, registerables } from 'chart.js';
import { state } from './ui/app-state';
import { mostrarTela, mostrarToast } from './ui/ui-utils';
import {
  observarAutenticacao,
  buscarPerfilUsuario,
  processarRedirectGoogle,
  TERMOS_VERSAO_ATUAL
} from './services/auth';

import { inicializarEventosAuth, iniciarApp } from './ui/auth-navigation';
import { inicializarEventosModais } from './ui/modals-view';
import { inicializarEventosPerfil } from './ui/profile-view';
import { inicializarEventosMedicacao } from './ui/medications-view';
import { initTelemetry } from './services/telemetry';

// Importação dos módulos de visualização para registro global e efeitos colaterais
import './ui/dashboard-view';
import './ui/glicemia-view';
import './ui/water-view';
import './ui/imc-view';
import './ui/laudos-view';
import './ui/history-view';
import './ui/admin-view';
import './ui/pdf-export';

Chart.register(...registerables);

// Re-exportações públicas para compatibilidade
export { mostrarToast, escapeHtml } from './ui/ui-utils';
export { APP_VERSION } from './version';
export { state } from './ui/app-state';

// ── Inicialização de Listeners de Eventos e Telemetria ─────────
initTelemetry();
inicializarEventosAuth();
inicializarEventosModais();
inicializarEventosPerfil();
inicializarEventosMedicacao();

import type { User } from 'firebase/auth';
import type { UserProfile } from './types';

async function direcionarUsuarioAutenticado(user: User, perfil: UserProfile | null) {
  if (!perfil) {
    const nomeInput = document.getElementById('ob-nome') as HTMLInputElement;
    if (nomeInput && user.displayName) {
      nomeInput.value = user.displayName;
    }
    window._termsNextStep = 'onboarding';
    mostrarTela('terms-screen');
    return;
  }

  state.userProfile = perfil;
  if (state.userProfile.status === 'Suspenso' || state.userProfile.status === 'Inativo') {
    const blockedMsg = document.getElementById('blocked-msg');
    if (blockedMsg) {
      blockedMsg.textContent = 'Sua conta foi suspensa temporariamente. Entre em contato com o suporte.';
    }
    mostrarTela('blocked-screen');
    return;
  }

  if (!perfil.termos_aceitos || perfil.termos_versao !== TERMOS_VERSAO_ATUAL) {
    window._termsNextStep = 'app';
    mostrarTela('terms-screen');
    return;
  }

  await iniciarApp();
}

// ── Fluxo Principal de Autenticação e Inicialização ───────────
(async () => {
  mostrarTela('loading-screen');
  await processarRedirectGoogle();

  observarAutenticacao(async (user) => {
    if (!user) {
      state.currentUser = null;
      state.userProfile = null;
      mostrarTela('auth-screen');
      return;
    }

    state.currentUser = user;
    try {
      const perfil = await buscarPerfilUsuario(user.uid);
      await direcionarUsuarioAutenticado(user, perfil);
    } catch (err: unknown) {
      logger.error('Erro ao buscar perfil do usuário:', err);
      mostrarToast('Erro de permissão no banco de dados. Verifique as regras do Firestore.', 'error');
      mostrarTela('onboarding-screen');
    }
  });
})();
