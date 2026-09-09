import { state } from './app-state';
import { mostrarToast, mostrarTela } from './ui-utils';

const PAGINAS_VALIDAS = ['dashboard', 'historico', 'laudos', 'perfil', 'admin'];

function acionarCallbackPagina(targetPag: string): void {
  const callbacks: Record<string, (() => void | Promise<void>) | undefined> = {
    dashboard: () => mostrarAbaDashboard('hidratacao'),
    historico: window.carregarHistorico,
    laudos: window.carregarLaudos,
    perfil: window.carregarPerfil,
    admin: window.carregarAdmin,
  };
  callbacks[targetPag]?.();
}

function alternarElementosPagina(targetPag: string): void {
  PAGINAS_VALIDAS.forEach(p => {
    document.getElementById(`page-${p}`)?.classList.toggle('hidden', p !== targetPag);
    document.getElementById(`nav-${p}`)?.classList.toggle('active', p === targetPag);
    document.getElementById(`sb-${p}`)?.classList.toggle('active', p === targetPag);
  });
}

export function mostrarPagina(pag: string): void {
  const paginasUsuario = ['dashboard', 'historico', 'laudos', 'glicemia', 'pressao', 'hidratacao', 'imc'];
  if (state.userProfile?.role === 'ADMIN' && paginasUsuario.includes(pag)) {
    mostrarToast('Área restrita a usuários comuns.', 'error');
    return;
  }

  if (['glicemia', 'pressao', 'hidratacao', 'imc'].includes(pag)) {
    mostrarPagina('dashboard');
    mostrarAbaDashboard(pag);
    return;
  }

  const targetPag = PAGINAS_VALIDAS.includes(pag) ? pag : 'dashboard';
  alternarElementosPagina(targetPag);
  acionarCallbackPagina(targetPag);
}

function acionarCallbackAbaDashboard(aba: string): void {
  if (aba === 'imc') {
    window.carregarImcPage?.();
  } else if (aba === 'hidratacao') {
    window.carregarHistoricoAgua?.();
  } else if (aba === 'pressao') {
    if (state.afericoes && state.afericoes.length > 0 && window.renderizarGrafico) {
      setTimeout(() => window.renderizarGrafico?.(state.afericoes.slice().reverse().slice(-30)), 50);
    }
  } else if (aba === 'glicemia') {
    window.carregarGlicemiaPage?.();
  }
}

export function mostrarAbaDashboard(aba: string): void {
  const abasDisponiveis = ['imc', 'pressao', 'glicemia', 'hidratacao'];
  
  abasDisponiveis.forEach(a => {
    const tabEl = document.getElementById(`tab-${a}`);
    if (tabEl) tabEl.style.display = a === aba ? 'block' : 'none';
    const btn = document.getElementById(`tab-btn-${a}`);
    if (btn) btn.classList.toggle('active', a === aba);
  });

  acionarCallbackAbaDashboard(aba);
}

export function mostrarAbaPerfil(aba: string): void {
  const abasDisponiveis = ['dados', 'historico', 'medicacoes'];
  
  abasDisponiveis.forEach(a => {
    const isAtiva = a === aba;
    const tabEl = document.getElementById(`tab-perfil-${a}`);
    if (tabEl) {
      tabEl.style.display = isAtiva ? 'block' : 'none';
      tabEl.setAttribute('aria-hidden', isAtiva ? 'false' : 'true');
    }
    const btn = document.getElementById(`tab-btn-perfil-${a}`);
    if (btn) {
      btn.classList.toggle('active', isAtiva);
      btn.setAttribute('aria-selected', isAtiva ? 'true' : 'false');
      btn.setAttribute('tabindex', isAtiva ? '0' : '-1');
    }
  });

  const btnSalvar = document.getElementById('btn-salvar-perfil');
  if (btnSalvar) {
    btnSalvar.style.display = aba === 'medicacoes' ? 'none' : 'flex';
  }
}

export function toggleFabMenu(): void {
  const menu = document.getElementById('fab-menu');
  const icon = document.getElementById('fab-icon');
  if (!menu || !icon) return;
  const isHidden = menu.style.display === 'none';
  menu.style.display = isHidden ? 'flex' : 'none';
  icon.style.transform = isHidden ? 'rotate(45deg)' : 'rotate(0deg)';
}

function alternarVisibilidadeTermos(modoModal: boolean): void {
  const displayModal = modoModal ? 'flex' : 'none';
  const displayInline = modoModal ? 'none' : 'flex';

  const idsInline = ['terms-checkbox-wrapper', 'terms-scroll-hint', 'btn-aceitar-termos', 'terms-legal-note'];
  idsInline.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = displayInline;
  });

  const btnVoltar = document.getElementById('btn-voltar-termos');
  if (btnVoltar) btnVoltar.style.display = displayModal;
}

export function abrirTermosNoMenu(): void {
  alternarVisibilidadeTermos(true);
  mostrarTela('terms-screen');
}

export function fecharTermosNoMenu(): void {
  alternarVisibilidadeTermos(false);
  mostrarTela('app-screen');
}

function configurarVisibilidadeMenuAdmin(isAdmin: boolean): void {
  const userIds = [
    'sb-user-group-label', 'sb-dashboard', 'sb-historico', 'sb-laudos', 'sb-fab-container',
    'nav-dashboard', 'nav-historico', 'nav-fab', 'nav-laudos', 'nav-perfil'
  ];
  userIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAdmin ? 'none' : '';
  });

  const adminIds = ['sb-admin-group-label', 'sb-admin', 'nav-admin'];
  adminIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAdmin ? 'flex' : 'none';
  });
  const sbLabel = document.getElementById('sb-admin-group-label');
  if (sbLabel) sbLabel.style.display = isAdmin ? 'block' : 'none';
}

function atualizarCabecalhoUsuario(nome: string, isAdmin: boolean): void {
  const inicial = nome.charAt(0).toUpperCase();
  const avatarBtn = document.getElementById('user-avatar-btn');
  const greetingText = document.getElementById('greeting-text');
  const greetingSub = document.getElementById('greeting-sub');

  if (avatarBtn) avatarBtn.textContent = inicial;
  const primeiroNome = nome.split(' ')[0];

  if (isAdmin) {
    if (greetingText) greetingText.textContent = `Bem-vindo, ${primeiroNome}!`;
    if (greetingSub) greetingSub.textContent = 'Painel de Administração do Sistema.';
  } else {
    if (greetingText) greetingText.textContent = `Olá, ${primeiroNome}!`;
    if (greetingSub) greetingSub.textContent = 'Acompanhe sua saúde e bem-estar de forma integral.';
  }

  configurarVisibilidadeMenuAdmin(isAdmin);
}

export async function iniciarApp(): Promise<void> {
  mostrarTela('app-screen');
  const isAdmin = state.userProfile?.role === 'ADMIN';

  if (state.userProfile) {
    atualizarCabecalhoUsuario(state.userProfile.nome, isAdmin);
  }

  const targetPag = isAdmin ? 'admin' : 'dashboard';
  alternarElementosPagina(targetPag);

  if (isAdmin) {
    if (window.carregarAdmin) await window.carregarAdmin();
  } else {
    mostrarAbaDashboard('hidratacao');
    if (window.carregarDashboard) await window.carregarDashboard();
  }
}

// Vinculação global
window.mostrarPagina = mostrarPagina;
window.mostrarAbaDashboard = mostrarAbaDashboard;
window.mostrarAbaPerfil = mostrarAbaPerfil;
window.toggleFabMenu = toggleFabMenu;
window.abrirTermosNoMenu = abrirTermosNoMenu;
window.fecharTermosNoMenu = fecharTermosNoMenu;
