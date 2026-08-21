import './style.css';
import { Chart, registerables } from 'chart.js';
import { observarAutenticacao, loginUsuario, registrarUsuario, logoutUsuario, salvarPerfilUsuario, 
buscarPerfilUsuario, obterTodosUsuarios, atualizarFuncaoUsuario, atualizarPlanoUsuario, atualizarStatusUsuario, obterTotalAfericoes, 
loginComGoogle, processarRedirectGoogle, excluirDadosUsuario, atualizarPerfilUsuarioAdmin, salvarHistoricoPeso,
buscarHistoricoPeso, aceitarTermos, TERMOS_VERSAO_ATUAL, excluirPeso, registrarLogAdmin, buscarLogsAdmin,
buscarConfigSistema, salvarConfigSistema } from './services/auth';
import type { SystemConfig } from './services/auth';
import { buscarAfericoes, salvarAfericao, uploadImagemAfericao, calcularMedias, gerarFeedbackIA, atualizarFeedbackIA, gerarRelatorioCondutaOMS, buscarLaudos, inativarLaudo } from './services/afericoes';
import type { SavedLaudo } from './services/afericoes';
import { processarImagemOCR, arquivoParaBase64, criarUrlPreview, comprimirImagem, obterMimeType } from './services/ocr';
import { classificarPressao, formatarDataHora, formatarData, classificarGlicemia, classificarImc } from './types';
import type { BpReading, UserProfile, Medication, GlicemiaReading } from './types';
import { buscarAguaDoDia, salvarAguaDoDia, buscarHistoricoAgua } from './services/agua';
import { buscarMedications, salvarMedication, excluirMedication, atualizarMedication } from './services/medications';
import { buscarGlicemias, salvarGlicemia, atualizarFeedbackGlicemiaIA, gerarFeedbackGlicemiaIA, gerarLaudoIntegradoIA } from './services/glicemia';
import { buscarAnalisesDiarias, gerarAnaliseDiariaIA } from './services/analise-diaria';
import { obterDicaPressao, obterDicaGlicemia, obterDicaHidratacao } from './utils/dicas';
import type { Dica, ContextoSaude } from './utils/dicas';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
Chart.register(...registerables);

// Versão do aplicativo
const APP_VERSION = 'v2.0.0 (Build 28/07/2026 às 14:16)';

// ── Estado global ──────────────────────────────────────────────
let currentUser: any = null;
let aguaHoje: number = 0;
let metaAgua: number = 2000;
let userProfile: UserProfile | null = null;
let afericoes: BpReading[] = [];
let glicemias: GlicemiaReading[] = [];
let medications: Medication[] = [];
let usuariosCadastrados: UserProfile[] = [];
let bpChart: Chart | null = null;
let glicemiaChart: Chart | null = null;
let waterChart: Chart | null = null;
let imagemSelecionada: File | null = null;
let medicacaoEditandoId: string | null = null;
let adminGrowthChart: Chart | null = null;
let listaFiltradaUsuariosAdmin: UserProfile[] = [];

// ── Utilitários de UI ──────────────────────────────────────────
export function mostrarToast(msg: string, tipo: 'success'|'error'|'info' = 'info') {
  const c = document.getElementById('toast-container')!;
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  const iconSvg = tipo === 'success'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : tipo === 'error'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = iconSvg;
  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  t.appendChild(iconSpan);
  t.appendChild(msgSpan);
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function mostrarTela(id: string) {
  ['loading-screen','auth-screen','terms-screen','onboarding-screen','app-screen','blocked-screen']
    .forEach(s => document.getElementById(s)?.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');

  // Inicializar controle de scroll ao exibir tela de termos
  if (id === 'terms-screen') {
    inicializarScrollTermos();
  }
}

export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Termos de Uso e LGPD ──────────────────────────────────────
function inicializarScrollTermos() {
  const scrollBox = document.getElementById('terms-scroll-box');
  const progressFill = document.getElementById('terms-progress-fill');
  const progressLabel = document.getElementById('terms-progress-label');
  const checkbox = document.getElementById('terms-checkbox') as HTMLInputElement;
  const acceptBtn = document.getElementById('btn-aceitar-termos') as HTMLButtonElement;
  const hintEl = document.getElementById('terms-scroll-hint');

  // Resetar estado
  if (checkbox) { checkbox.checked = false; checkbox.disabled = true; }
  if (acceptBtn) acceptBtn.disabled = true;
  if (progressFill) progressFill.style.width = '0%';
  if (progressLabel) progressLabel.textContent = '0% lido';
  if (hintEl) { hintEl.textContent = '⬇️ Role até o final do documento para habilitar o aceite'; hintEl.classList.remove('done'); }

  if (!scrollBox) return;

  // Scroll para o topo ao abrir
  scrollBox.scrollTop = 0;

  const handleScroll = () => {
    const { scrollTop, scrollHeight, clientHeight } = scrollBox;
    const scrollable = scrollHeight - clientHeight;
    if (scrollable <= 0) return;

    const pct = Math.min(100, Math.round((scrollTop / scrollable) * 100));
    let displayPct = pct;
    // Força 100% se estiver muito perto do fim (compensando arredondamentos de pixel)
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      displayPct = 100;
    }

    if (progressFill) progressFill.style.width = displayPct + '%';
    if (progressLabel) progressLabel.textContent = displayPct + '% lido';

    // Habilitar ao chegar em 95%+ (tolerância para pequenas diferenças de pixel)
    if (displayPct >= 95) {
      if (checkbox) checkbox.disabled = false;
      if (hintEl && !hintEl.classList.contains('done')) {
        hintEl.textContent = '✅ Leitura concluída! Marque a caixa para habilitar o aceite.';
        hintEl.classList.add('done');
      }
      // O event listener não é removido para que a porcentagem possa chegar a 100%
    }
  };

  scrollBox.addEventListener('scroll', handleScroll);

  // Habilitar botão somente quando checkbox estiver marcado
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      if (acceptBtn) acceptBtn.disabled = !checkbox.checked;
    });
  }
}

(window as any).aceitarTermosUsuario = async () => {
  if (!currentUser) return;
  const btn = document.getElementById('btn-aceitar-termos') as HTMLButtonElement;
  const checkbox = document.getElementById('terms-checkbox') as HTMLInputElement;
  if (!checkbox?.checked) {
    mostrarToast('Marque a caixa confirmando a leitura para continuar.', 'error');
    return;
  }
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Registrando aceite...'; }
    await aceitarTermos(currentUser.uid);
    mostrarToast('Termos aceitos com sucesso!', 'success');
    const nextStep = (window as any)._termsNextStep || 'app';
    if (nextStep === 'onboarding') {
      mostrarTela('onboarding-screen');
    } else {
      // Usuário já tinha perfil — ir direto para o app
      if (!userProfile) {
        userProfile = await buscarPerfilUsuario(currentUser.uid);
      }
      iniciarApp();
    }
  } catch (err) {
    console.error('[termos] Erro ao aceitar termos:', err);
    mostrarToast('Erro ao registrar aceite. Tente novamente.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Li e Aceito os Termos'; }
  }
};

export function mostrarPagina(pag: string) {
  // Bloquear ADMIN de acessar páginas de usuário comum
  const paginasUsuario = ['dashboard', 'historico', 'laudos', 'glicemia', 'pressao', 'hidratacao', 'imc'];
  if (userProfile?.role === 'ADMIN' && paginasUsuario.includes(pag)) {
    mostrarToast('Área restrita a usuários comuns.', 'error');
    return;
  }

  // Tratar redirecionamento de abas legadas ou internas do dashboard
  if (pag === 'glicemia') {
    mostrarPagina('dashboard');
    mostrarAbaDashboard('glicemia');
    return;
  }
  if (pag === 'pressao' || pag === 'hidratacao' || pag === 'imc') {
    mostrarPagina('dashboard');
    mostrarAbaDashboard(pag);
    return;
  }

  const paginasValidas = ['dashboard', 'historico', 'laudos', 'perfil', 'admin'];

  paginasValidas.forEach(p => {
    document.getElementById(`page-${p}`)?.classList.add('hidden');
    document.getElementById(`nav-${p}`)?.classList.remove('active');
    document.getElementById(`sb-${p}`)?.classList.remove('active');
  });

  let targetPag = paginasValidas.includes(pag) ? pag : 'dashboard';
  const pageEl = document.getElementById(`page-${targetPag}`);
  if (pageEl) {
    pageEl.classList.remove('hidden');
  } else {
    document.getElementById('page-dashboard')?.classList.remove('hidden');
    targetPag = 'dashboard';
  }

  document.getElementById(`nav-${targetPag}`)?.classList.add('active');
  document.getElementById(`sb-${targetPag}`)?.classList.add('active');

  if (targetPag === 'dashboard') {
    mostrarAbaDashboard('hidratacao');
  } else if (targetPag === 'historico') {
    carregarHistorico();
  } else if (targetPag === 'laudos') {
    carregarLaudos();
  } else if (targetPag === 'perfil') {
    carregarPerfil();
  } else if (targetPag === 'admin') {
    carregarAdmin();
  }
}

export function mostrarAbaDashboard(aba: string) {
  const abasDisponiveis = ['imc', 'pressao', 'glicemia', 'hidratacao'];
  
  abasDisponiveis.forEach(a => {
    const tabEl = document.getElementById(`tab-${a}`);
    if (tabEl) tabEl.style.display = 'none';
    const btn = document.getElementById(`tab-btn-${a}`);
    if (btn) btn.classList.remove('active');
  });

  const targetTab = document.getElementById(`tab-${aba}`);
  if (targetTab) targetTab.style.display = 'block';

  const targetBtn = document.getElementById(`tab-btn-${aba}`);
  if (targetBtn) targetBtn.classList.add('active');

  if (aba === 'imc') {
    carregarImcPage();
  } else if (aba === 'hidratacao') {
    carregarHistoricoAgua();
  } else if (aba === 'pressao') {
    if (afericoes && afericoes.length > 0) {
      setTimeout(() => renderizarGrafico(afericoes.slice().reverse().slice(-30)), 50);
    }
  } else if (aba === 'glicemia') {
    carregarGlicemiaPage();
  }
}

export function mostrarAbaPerfil(aba: string) {
  const abasDisponiveis = ['dados', 'historico', 'medicacoes'];
  
  abasDisponiveis.forEach(a => {
    const tabEl = document.getElementById(`tab-perfil-${a}`);
    if (tabEl) tabEl.style.display = 'none';
    const btn = document.getElementById(`tab-btn-perfil-${a}`);
    if (btn) btn.classList.remove('active');
  });

  const targetTab = document.getElementById(`tab-perfil-${aba}`);
  if (targetTab) targetTab.style.display = 'block';

  const targetBtn = document.getElementById(`tab-btn-perfil-${aba}`);
  if (targetBtn) targetBtn.classList.add('active');

  const btnSalvar = document.getElementById('btn-salvar-perfil');
  if (btnSalvar) {
    if (aba === 'medicacoes') {
      btnSalvar.style.display = 'none';
    } else {
      btnSalvar.style.display = 'flex';
    }
  }
}

export function toggleAvatarMenu() {
  const menu = document.getElementById('avatar-menu');
  if (menu) {
    if (menu.style.display === 'none') {
      menu.style.display = 'flex';
      
      const dateEl = document.getElementById('termos-aceite-data');
      if (dateEl && userProfile && userProfile.termos_aceitos_em) {
        const dateStr = new Date(userProfile.termos_aceitos_em).toLocaleDateString('pt-BR');
        dateEl.textContent = `Aceito em: ${dateStr}`;
        dateEl.style.display = 'block';
      }
    } else {
      menu.style.display = 'none';
    }
  }
}

export function abrirTermosNoMenu() {
  const wrapper = document.getElementById('terms-checkbox-wrapper');
  const hint = document.getElementById('terms-scroll-hint');
  const btnAceitar = document.getElementById('btn-aceitar-termos');
  const note = document.getElementById('terms-legal-note');
  const btnVoltar = document.getElementById('btn-voltar-termos');

  if (wrapper) wrapper.style.display = 'none';
  if (hint) hint.style.display = 'none';
  if (btnAceitar) btnAceitar.style.display = 'none';
  if (note) note.style.display = 'none';
  if (btnVoltar) btnVoltar.style.display = 'flex';

  mostrarTela('terms-screen');
}
(window as any).abrirTermosNoMenu = abrirTermosNoMenu;

export function fecharTermosNoMenu() {
  const wrapper = document.getElementById('terms-checkbox-wrapper');
  const hint = document.getElementById('terms-scroll-hint');
  const btnAceitar = document.getElementById('btn-aceitar-termos');
  const note = document.getElementById('terms-legal-note');
  const btnVoltar = document.getElementById('btn-voltar-termos');

  if (wrapper) wrapper.style.display = 'flex';
  if (hint) hint.style.display = 'block';
  if (btnAceitar) btnAceitar.style.display = 'flex';
  if (note) note.style.display = 'block';
  if (btnVoltar) btnVoltar.style.display = 'none';

  mostrarTela('app-screen');
}
(window as any).fecharTermosNoMenu = fecharTermosNoMenu;

export function toggleFabMenu() {
  const menu = document.getElementById('fab-menu');
  const icon = document.getElementById('fab-icon');
  if (menu && icon) {
    if (menu.style.display === 'none') {
      menu.style.display = 'flex';
      icon.style.transform = 'rotate(45deg)';
    } else {
      menu.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
}

// Fechar menu FAB e Avatar ao clicar fora
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

// Expor globalmente para uso no HTML
(window as any).mostrarPagina = mostrarPagina;
(window as any).carregarGlicemiaPage = carregarGlicemiaPage;
(window as any).mostrarAbaDashboard = mostrarAbaDashboard;
(window as any).mostrarAbaPerfil = mostrarAbaPerfil;
(window as any).toggleFabMenu = toggleFabMenu;
(window as any).toggleAvatarMenu = toggleAvatarMenu;

// ── Auth ───────────────────────────────────────────────────────
(window as any).mostrarTab = (tab: string) => {
  document.getElementById('form-login')?.classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register')?.classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login')?.classList.toggle('active', tab === 'login');
  document.getElementById('tab-register')?.classList.toggle('active', tab !== 'login');
};

document.getElementById('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = (document.getElementById('login-email') as HTMLInputElement).value;
  const senha = (document.getElementById('login-password') as HTMLInputElement).value;
  const errEl = document.getElementById('login-error')!;
  try {
    errEl.classList.add('hidden');
    await loginUsuario(email, senha);
  } catch (err: any) {
    console.error("Erro no login:", err);
    errEl.textContent = traduzirErroFirebase(err.code);
    errEl.classList.remove('hidden');
  }
});

document.getElementById('btn-google-login')?.addEventListener('click', async () => {
  const errEl = document.getElementById('login-error')!;
  const btn = document.getElementById('btn-google-login') as HTMLButtonElement;
  try {
    errEl.classList.add('hidden');
    if (btn) { btn.disabled = true; btn.textContent = 'Conectando...'; }
    await loginComGoogle();
    // A página será redirecionada pelo provedor do Google
  } catch (err: any) {
    console.error("Erro no login com Google:", err);
    errEl.textContent = traduzirErroFirebase(err.code) || 'Erro ao entrar com Google. Tente novamente.';
    errEl.classList.remove('hidden');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.33 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.67 14.62 48 24 48z"/></svg> Entrar com Google'; }
  }
});

document.getElementById('form-register')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = (document.getElementById('reg-email') as HTMLInputElement).value;
  const senha = (document.getElementById('reg-password') as HTMLInputElement).value;
  const errEl = document.getElementById('register-error')!;
  try {
    errEl.classList.add('hidden');
    await registrarUsuario(email, senha);
  } catch (err: any) {
    errEl.textContent = traduzirErroFirebase(err.code);
    errEl.classList.remove('hidden');
  }
});

(window as any).fazerLogout = async () => {
  await logoutUsuario();
  location.reload();
};

function traduzirErroFirebase(code: string): string {
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

// ── Onboarding ─────────────────────────────────────────────────
document.getElementById('form-onboarding')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const errEl = document.getElementById('onboarding-error')!;
  try {
    errEl.classList.add('hidden');
    const nascimento = (document.getElementById('ob-nascimento') as HTMLInputElement).value;
    // Calcular idade a partir da data de nascimento
    let idade = 0;
    if (nascimento) {
      const nasc = new Date(nascimento + 'T00:00:00');
      const hoje = new Date();
      idade = hoje.getFullYear() - nasc.getFullYear() -
        (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate()) ? 1 : 0);
    }
    const perfil: any = {
      nome: (document.getElementById('ob-nome') as HTMLInputElement).value,
      sexo: (document.getElementById('ob-sexo') as HTMLSelectElement).value,
      nascimento,
      idade,
      peso: Number((document.getElementById('ob-peso') as HTMLInputElement).value),
      altura: Number((document.getElementById('ob-altura') as HTMLInputElement).value) || undefined,
      hipertenso: (document.getElementById('ob-hipertenso') as HTMLInputElement).checked,
      diabetico: (document.getElementById('ob-diabetico') as HTMLInputElement).checked,
      fumante: (document.getElementById('ob-fumante') as HTMLInputElement).checked,
      sedentario: (document.getElementById('ob-sedentario') as HTMLInputElement).checked,
      usaMedicacao: (document.getElementById('ob-medicacao') as HTMLInputElement).checked,
      status: 'Ativo' as any
    };
    await salvarPerfilUsuario(currentUser.uid, perfil);
    await salvarHistoricoPeso(currentUser.uid, perfil.peso);
    userProfile = { uid: currentUser.uid, data_criacao: new Date(), ...perfil };
    
    iniciarApp();
  } catch (err: any) {
    errEl.textContent = 'Erro ao salvar perfil. Tente novamente.';
    errEl.classList.remove('hidden');
  }
});

// ── Iniciar app ────────────────────────────────────────────────
async function iniciarApp() {
  mostrarTela('app-screen');
  if (userProfile) {
    const inicial = userProfile.nome.charAt(0).toUpperCase();
    const avatarBtn = document.getElementById('user-avatar-btn');
    const greetingText = document.getElementById('greeting-text');
    const greetingSub = document.getElementById('greeting-sub');
    if (avatarBtn) avatarBtn.textContent = inicial;
    
    // Configurar visibilidade do menu admin
    const isAdmin = userProfile.role === 'ADMIN';

    if (isAdmin) {
      // ADMIN: ocultar itens de usuário comum
      if (greetingText) greetingText.textContent = `Bem-vindo, ${userProfile.nome.split(' ')[0]}!`;
      if (greetingSub) greetingSub.textContent = 'Painel de Administração do Sistema.';

      // Sidebar: ocultar itens de usuário
      const sbUserGroupLabel = document.getElementById('sb-user-group-label');
      const sbDashboard = document.getElementById('sb-dashboard');
      const sbHistorico = document.getElementById('sb-historico');
      const sbLaudos = document.getElementById('sb-laudos');
      const sbFab = document.getElementById('sb-fab-container');
      if (sbUserGroupLabel) sbUserGroupLabel.style.display = 'none';
      if (sbDashboard) sbDashboard.style.display = 'none';
      if (sbHistorico) sbHistorico.style.display = 'none';
      if (sbLaudos) sbLaudos.style.display = 'none';
      if (sbFab) sbFab.style.display = 'none';

      // Bottom Nav: ocultar itens de usuário, mostrar admin
      const navDashboard = document.getElementById('nav-dashboard');
      const navHistorico = document.getElementById('nav-historico');
      const navFab = document.getElementById('nav-fab');
      const navLaudos = document.getElementById('nav-laudos');
      const navPerfil = document.getElementById('nav-perfil');
      if (navDashboard) navDashboard.style.display = 'none';
      if (navHistorico) navHistorico.style.display = 'none';
      if (navFab) navFab.style.display = 'none';
      if (navLaudos) navLaudos.style.display = 'none';
      if (navPerfil) navPerfil.style.display = 'none';

      // Mostrar Admin
      const sbLabel = document.getElementById('sb-admin-group-label');
      const sbItem = document.getElementById('sb-admin');
      const navItem = document.getElementById('nav-admin');
      if (sbLabel) sbLabel.style.display = 'block';
      if (sbItem) sbItem.style.display = 'flex';
      if (navItem) navItem.style.display = 'flex';
    } else {
      if (greetingText) greetingText.textContent = `Olá, ${userProfile.nome.split(' ')[0]}!`;
      if (greetingSub) greetingSub.textContent = 'Acompanhe sua saúde e bem-estar de forma integral.';

      // Ocultar menu admin para usuários comuns
      const sbLabel = document.getElementById('sb-admin-group-label');
      const sbItem = document.getElementById('sb-admin');
      const navItem = document.getElementById('nav-admin');
      if (sbLabel) sbLabel.style.display = 'none';
      if (sbItem) sbItem.style.display = 'none';
      if (navItem) navItem.style.display = 'none';
    }
  }

  // Garantir que todas as páginas estejam ocultas antes de mostrar a inicial
  ['dashboard', 'historico', 'laudos', 'perfil', 'admin'].forEach(p => {
    document.getElementById(`page-${p}`)?.classList.add('hidden');
    document.getElementById(`nav-${p}`)?.classList.remove('active');
    document.getElementById(`sb-${p}`)?.classList.remove('active');
  });

  const isAdmin = userProfile?.role === 'ADMIN';

  if (isAdmin) {
    // ADMIN vai direto ao painel admin
    document.getElementById('page-admin')?.classList.remove('hidden');
    document.getElementById('nav-admin')?.classList.add('active');
    document.getElementById('sb-admin')?.classList.add('active');
    await carregarAdmin();
  } else {
    // Usuário comum vai ao dashboard
    document.getElementById('page-dashboard')?.classList.remove('hidden');
    document.getElementById('nav-dashboard')?.classList.add('active');
    document.getElementById('sb-dashboard')?.classList.add('active');
    mostrarAbaDashboard('hidratacao');
    await carregarDashboard();
  }
}


// ── Dashboard ──────────────────────────────────────────────────
function calcularMetaHidratacao(peso?: number, idade?: number): number {
  if (!peso || !idade || peso <= 0 || idade <= 0) return 2000;
  if (idade <= 17) return peso * 40;
  if (idade <= 55) return peso * 35;
  if (idade <= 65) return peso * 30;
  return peso * 25;
}

function renderizarDica(elementId: string, dica: Dica) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  // Garante que o container esteja visível
  container.style.display = 'flex';
  
  container.innerHTML = `
    <span class="tip-icon" style="color:var(--primary); font-size:24px;">${dica.icone}</span>
    <div>
      <p><strong>${dica.titulo}:</strong> ${dica.texto}</p>
    </div>
  `;
}

async function carregarDashboard() {
  if (!currentUser) {
    console.error('[carregarDashboard] currentUser é nulo — abortando.');
    return;
  }
  try {
    // Configuração de UI para dicas médicas (visíveis apenas se tiver o diagnóstico)
    const elOmsPressao = document.getElementById('oms-tip-pressao');
    const elOmsGlicemia = document.getElementById('oms-tip-glicemia');
    const elWaterCard = document.getElementById('water-dashboard-card');
    const elGlicemiaOnly = document.getElementById('dashboard-glicemia-only');
    const elDashEmpty = document.getElementById('dashboard-empty');
    const elDashData = document.getElementById('dashboard-data');

    if (elOmsPressao) elOmsPressao.style.display = 'flex';
    if (elOmsGlicemia) elOmsGlicemia.style.display = 'flex';
    
    // Todos vêm o painel de hidratação e o dashboard principal
    if (elWaterCard) elWaterCard.style.display = 'block';
    if (elGlicemiaOnly) elGlicemiaOnly.style.display = 'none';

    // Carregar água do dia para todos
    metaAgua = calcularMetaHidratacao(userProfile?.peso, userProfile?.idade);
    const d = new Date();
    const hojeStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const waterLog = await buscarAguaDoDia(currentUser.uid, hojeStr);
    aguaHoje = waterLog ? waterLog.amount_ml : 0;
    atualizarUIWaterCard();

    // Carregar pressão arterial para todos no Dashboard Principal
    afericoes = await buscarAfericoes(currentUser.uid, 30);
    elDashEmpty?.style.setProperty('display', 'none');
    elDashData?.classList.remove('hidden');

    // Carregar 1 última glicemia e histórico de 7d de água para contexto
    const histGlicemia = await buscarGlicemias(currentUser.uid, 1);
    const ultimaGlicemia = histGlicemia.length > 0 ? histGlicemia[0] : null;
    const historicoAgua7d = await buscarHistoricoAgua(currentUser.uid, 7);

    // Inteligência de Dicas
    const contexto: ContextoSaude = {
      userProfile,
      ultimaPressao: afericoes.length > 0 ? afericoes[0] : null,
      ultimaGlicemia,
      aguaHoje,
      metaAgua,
      historicoAgua7d
    };

    renderizarDica('oms-tip-pressao', obterDicaPressao(contexto));
    renderizarDica('oms-tip-glicemia', obterDicaGlicemia(contexto));
    renderizarDica('oms-tip-hidratacao', obterDicaHidratacao(contexto));

      if (afericoes.length === 0) {
        if (elDashEmpty) elDashEmpty.style.display = 'flex';
        if (elDashData) elDashData.classList.add('hidden');
      } else {
        const ultima = afericoes[0];
        const lastSys = document.getElementById('last-sys');
        const lastDia = document.getElementById('last-dia');
        const lastPul = document.getElementById('last-pul');
        if (lastSys) lastSys.textContent = String(ultima.sys);
        if (lastDia) lastDia.textContent = String(ultima.dia);
        if (lastPul) lastPul.textContent = String(ultima.pul);

        const clf = classificarPressao(ultima.sys, ultima.dia);
        const badge = document.getElementById('last-classification');
        if (badge) {
          badge.textContent = `${clf.emoji} ${clf.label}`;
          badge.style.background = clf.cor + '22';
          badge.style.color = clf.cor;
          badge.style.borderColor = clf.cor + '44';
        }

        const lastAiFb = document.getElementById('last-ai-feedback');
        const aiFbText = document.getElementById('ai-feedback-text');
        if (ultima.ai_feedback) {
          if (lastAiFb) lastAiFb.classList.remove('hidden');
          if (aiFbText) aiFbText.textContent = ultima.ai_feedback;
        } else {
          if (lastAiFb) lastAiFb.classList.add('hidden');
        }

        // Médias 7 dias
        const ult7 = afericoes.filter(a => {
          const d = new Date(); d.setDate(d.getDate() - 7);
          return a.data_hora_afericao >= d;
        });
        const medias = calcularMedias(ult7);
        if (medias) {
          const avgSys = document.getElementById('avg-sys');
          const avgDia = document.getElementById('avg-dia');
          const avgPul = document.getElementById('avg-pul');
          if (avgSys) avgSys.textContent = String(medias.sys);
          if (avgDia) avgDia.textContent = String(medias.dia);
          if (avgPul) avgPul.textContent = String(medias.pul);
        }

        setTimeout(() => {
          renderizarGrafico(afericoes.slice().reverse().slice(-30));
        }, 50);
      }
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

function renderizarGrafico(dados: BpReading[]) {
  const canvas = document.getElementById('bp-chart') as HTMLCanvasElement;
  if (!canvas) return;
  if (bpChart) bpChart.destroy();

  bpChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dados.map(d => {
        const dt = d.data_hora_afericao;
        return `${dt.getDate()}/${dt.getMonth()+1} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
      }),
      datasets: [
        {
          label: 'Sistólica',
          data: dados.map(d => d.sys),
          borderColor: '#5BA3E0',
          backgroundColor: '#5BA3E022',
          tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6
        },
        {
          label: 'Diastólica',
          data: dados.map(d => d.dia),
          borderColor: '#00C9A7',
          backgroundColor: '#00C9A711',
          tension: 0.4, fill: false, pointRadius: 4, pointHoverRadius: 6
        },
        {
          label: 'Pulso',
          data: dados.map(d => d.pul),
          borderColor: '#F59E0B',
          backgroundColor: 'transparent',
          tension: 0.4, fill: false,
          borderDash: [4, 4], pointRadius: 3, pointHoverRadius: 5
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#8899BB', font: { size: 10 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#8899BB', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          min: 40
        }
      },
      interaction: { mode: 'index', intersect: false }
    }
  });
}

// Nomes dos meses em português
const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

(window as any).toggleHistoricoMesGroup = (groupId: string) => {
  const content = document.getElementById(groupId);
  const icon = document.getElementById(`icon-${groupId}`);
  if (!content || !icon) return;

  if (content.style.display === 'none') {
    content.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
  } else {
    content.style.display = 'none';
    icon.style.transform = 'rotate(0deg)';
  }
};

// ── Histórico ──────────────────────────────────────────────────
async function carregarHistorico() {
  if (!currentUser) {
    console.error('[carregarHistorico] currentUser is null – aborting.');
    return;
  }
  const list = document.getElementById('historico-list')!;
  list.innerHTML = '<div class="ocr-loading"><div class="ocr-spinner"></div><p style="color:var(--text-muted)">Carregando...</p></div>';
  try {
    const afericoes = await buscarAfericoes(currentUser.uid, 365);
    const glicemias = await buscarGlicemias(currentUser.uid, 365);
    const pesos = await buscarHistoricoPeso(currentUser.uid);
    const analises = await buscarAnalisesDiarias(currentUser.uid);
    
    const combined: any[] = [];
    
    afericoes.forEach(a => combined.push({
      tipo: 'pressao', id: a.id,
      timestamp: a.data_hora_afericao.getTime(),
      data_hora: a.data_hora_afericao,
      original: a
    }));
    
    glicemias.forEach(g => combined.push({
      tipo: 'glicemia', id: g.id,
      timestamp: g.data_hora_afericao.getTime(),
      data_hora: g.data_hora_afericao,
      original: g
    }));
    
    pesos.forEach(p => combined.push({
      tipo: 'peso', id: p.id,
      timestamp: p.data.getTime(),
      data_hora: p.data,
      original: p
    }));
    
    if (combined.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon" style="color:var(--primary)"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></div><div class="empty-title">Sem registros</div><p class="empty-sub">Adicione medições para ver o histórico unificado aqui.</p></div>';
      return;
    }

    combined.sort((a, b) => b.timestamp - a.timestamp);

    // Mapeamento por Mês/Ano -> Dia -> Itens
    interface GroupMes {
      key: string;
      label: string;
      totalItens: number;
      diasMap: Record<string, any[]>;
    }

    const mesesMap: Record<string, GroupMes> = {};
    const legacyGroups: Record<string, any[]> = {};

    combined.forEach(item => {
      const dt: Date = item.data_hora;
      const mesKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const dtStr = formatarData(dt);

      if (!mesesMap[mesKey]) {
        mesesMap[mesKey] = {
          key: mesKey,
          label: `${NOMES_MESES[dt.getMonth()]} de ${dt.getFullYear()}`,
          totalItens: 0,
          diasMap: {}
        };
      }

      mesesMap[mesKey].totalItens += 1;

      if (!mesesMap[mesKey].diasMap[dtStr]) {
        mesesMap[mesKey].diasMap[dtStr] = [];
      }
      mesesMap[mesKey].diasMap[dtStr].push(item);

      if (!legacyGroups[dtStr]) legacyGroups[dtStr] = [];
      legacyGroups[dtStr].push(item);
    });

    const analisesMap = new Map<string, string>();
    analises.forEach(an => analisesMap.set(an.data_str, an.feedback));

    (window as any).histDataGroups = legacyGroups;

    const mesesOrdenados = Object.values(mesesMap).sort((a, b) => b.key.localeCompare(a.key));

    let html = '';

    for (let mIdx = 0; mIdx < mesesOrdenados.length; mIdx++) {
      const mesGroup = mesesOrdenados[mIdx];
      const isAberto = mIdx === 0; // O primeiro mês (mês mais recente) fica expandido por padrão
      const groupId = `mes-group-${mesGroup.key}`;

      html += `
      <div class="history-month-card" style="margin-bottom: 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <div class="history-month-header" onclick="toggleHistoricoMesGroup('${groupId}')" 
             style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: var(--bg-card2); cursor: pointer; user-select: none;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style="font-size: 15px; font-weight: 700; color: var(--text);">${mesGroup.label}</span>
            <span class="badge" style="background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">${mesGroup.totalItens} ${mesGroup.totalItens === 1 ? 'registro' : 'registros'}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${mIdx === 0 ? '<span style="font-size:11px; color:var(--accent); font-weight:600; background:var(--accent)15; padding:2px 8px; border-radius:10px;">Mês Atual</span>' : ''}
            <svg id="icon-${groupId}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.3s ease; transform: ${isAberto ? 'rotate(180deg)' : 'rotate(0deg)'}; color: var(--text-muted);">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div id="${groupId}" style="display: ${isAberto ? 'block' : 'none'}; padding: 16px; border-top: 1px solid var(--border);">`;

      for (const [dtStr, itensDia] of Object.entries(mesGroup.diasMap)) {
        html += `<div class="history-day-group" style="margin-bottom: 20px;">`;
        html += `<div class="section-divider" style="margin-bottom: 12px;">
                   <div class="section-divider-line"></div>
                   <span class="section-divider-label">${dtStr}</span>
                   <div class="section-divider-line"></div>
                 </div>`;
                 
        for (const item of itensDia) {
          if (item.tipo === 'pressao') {
            const a = item.original;
            const clf = classificarPressao(a.sys, a.dia);
            const dt = formatarDataHora(item.data_hora);
            const label = clf.label.toLowerCase();
            const classeNivel = label.includes('normal') ? 'normal'
              : label.includes('elevad') ? 'elevada'
              : label.includes('crise') ? 'crise'
              : 'hipertensao';

            html += `
            <div class="reading-item ${classeNivel} fade-in" onclick="verDetalhe('${a.id}')" style="margin-bottom:8px;">
              <div class="reading-header">
                <span class="reading-date">${dt} · <span style="font-weight:600">Pressão</span></span>
                <span class="reading-status" style="background:${clf.cor}22;color:${clf.cor};border:1px solid ${clf.cor}44">${clf.label}</span>
              </div>
              <div class="reading-values">
                <span class="reading-bp" style="color:var(--primary-light)">${a.sys}</span>
                <span class="reading-sep">/</span>
                <span class="reading-bp" style="color:var(--accent)">${a.dia}</span>
                <span style="color:var(--text-muted);font-size:12px;margin-left:4px">mmHg</span>
                <span class="reading-pul" style="margin-left:12px;display:flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="color:var(--danger)"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> ${a.pul} bpm</span>
              </div>
            </div>`;
          } else if (item.tipo === 'glicemia') {
            const g = item.original;
            const clf = classificarGlicemia(g.valor, g.momento);
            const dt = formatarDataHora(item.data_hora);
            const label = clf.label.toLowerCase();
            const classeNivel = label.includes('hipo') ? 'hipoglicemia'
              : label.includes('normal') ? 'glicemia-normal'
              : (label.includes('pre') || label.includes('pré')) ? 'glicemia-pre_diabetes'
              : label.includes('grave') ? 'hiperglicemia_grave'
              : 'glicemia-diabetes';
            
            const momentosMap: any = { jejum: 'Jejum', pos_prandial: 'Pós-Prandial', antes_dormir: 'Antes de Dormir', aleatorio: 'Aleatório' };

            html += `
            <div class="reading-item ${classeNivel} fade-in" style="margin-bottom:8px;">
              <div class="reading-header">
                <span class="reading-date">${dt} · <span style="font-weight:600">Glicemia (${momentosMap[g.momento] || g.momento})</span></span>
                <span class="reading-status" style="background:${clf.cor}22;color:${clf.cor};border:1px solid ${clf.cor}44">${clf.label}</span>
              </div>
              <div class="reading-values">
                <span class="reading-bp" style="color:var(--warning)">${g.valor}</span>
                <span style="color:var(--text-muted);font-size:12px;margin-left:4px">mg/dL</span>
              </div>
            </div>`;
          } else if (item.tipo === 'peso') {
            const p = item.original;
            const dt = formatarDataHora(item.data_hora);
            html += `
            <div class="reading-item fade-in" style="margin-bottom:8px; border-left-color: #64748b;">
              <div class="reading-header">
                <span class="reading-date">${dt} · <span style="font-weight:600">Peso</span></span>
              </div>
              <div class="reading-values">
                <span class="reading-bp" style="color:var(--text)">${p.peso}</span>
                <span style="color:var(--text-muted);font-size:12px;margin-left:4px">kg</span>
              </div>
            </div>`;
          }
        }

        const feedback = analisesMap.get(dtStr);
        let feedbackText = 'Análise diária indisponível.';
        if (feedback) {
          if (typeof feedback === 'string') {
            feedbackText = feedback;
          } else if (typeof feedback === 'object' && feedback !== null) {
            feedbackText = (feedback as any).text || JSON.stringify(feedback);
          }
        }

        html += `
        <div class="ai-feedback" style="display:flex; flex-direction:column; gap:8px; align-items:flex-start; margin-top:12px; background:var(--surface-variant); border-radius:12px; padding:12px;">
          <div style="display:flex; gap:8px;">
            <span class="ai-icon" style="margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></span>
            <span id="ai-feedback-text-${dtStr.replace(/\//g, '-')}">${DOMPurify.sanitize(await marked.parse(String(feedbackText)))}</span>
          </div>
          <button class="btn btn-ghost btn-small" onclick="event.stopPropagation(); window.reprocessarIADoDia('${dtStr}')" id="btn-reprocess-day-${dtStr.replace(/\//g, '-')}" style="padding:6px 12px; font-size:12px; align-self:flex-end;">
            ${feedback ? 'Atualizar IA do Dia' : 'Gerar IA do Dia'}
          </button>
        </div>`;

        html += `</div>`; // Fechar history-day-group
      }

      html += `</div></div>`; // Fechar div do conteúdo e card do mês
    }

    list.innerHTML = html;

  } catch (err) {
    console.error('Erro no carregarHistorico', err);
    list.innerHTML = '<div class="empty-state"><div class="empty-icon" style="color:var(--danger)"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div><div class="empty-title">Erro ao carregar</div></div>';
  }
}

(window as any).verDetalhe = (_id: string) => { /* expandir no futuro */ };

// ── Perfil ─────────────────────────────────────────────────────
async function carregarPerfil() {
  if (!currentUser) return;
  if (!userProfile) {
    userProfile = await buscarPerfilUsuario(currentUser.uid);
  }
  if (!userProfile) return;

  const nomeInput = document.getElementById('p-nome') as HTMLInputElement;
  const sexoSelect = document.getElementById('p-sexo') as HTMLSelectElement;
  const nascInput = document.getElementById('p-nascimento') as HTMLInputElement;
  const pesoInput = document.getElementById('p-peso') as HTMLInputElement;
  const alturaInput = document.getElementById('p-altura') as HTMLInputElement;

  if (nomeInput) nomeInput.value = userProfile.nome || '';
  if (sexoSelect) sexoSelect.value = userProfile.sexo || 'outro';
  if (nascInput && (userProfile as any).nascimento) {
    nascInput.value = (userProfile as any).nascimento;
  }
  if (pesoInput) pesoInput.value = String(userProfile.peso || 0);
  if (alturaInput) alturaInput.value = String(userProfile.altura || '');

  const elHip = document.getElementById('p-hipertenso') as HTMLInputElement;
  const elDiab = document.getElementById('p-diabetico') as HTMLInputElement;
  const elFum = document.getElementById('p-fumante') as HTMLInputElement;
  const elSed = document.getElementById('p-sedentario') as HTMLInputElement;
  const elMed = document.getElementById('p-medicacao') as HTMLInputElement;

  if (elHip) elHip.checked = userProfile.hipertenso !== false;
  if (elDiab) elDiab.checked = !!userProfile.diabetico;
  if (elFum) elFum.checked = !!userProfile.fumante;
  if (elSed) elSed.checked = !!userProfile.sedentario;
  if (elMed) elMed.checked = !!(userProfile as any).usaMedicacao;

  const ini = userProfile.nome ? userProfile.nome.charAt(0).toUpperCase() : '?';
  const avatarBig = document.getElementById('profile-avatar-big');
  const profName = document.getElementById('profile-name');
  if (avatarBig) avatarBig.textContent = ini;
  if (profName) profName.textContent = userProfile.nome || 'Usuário';

  const nascStr = (userProfile as any).nascimento as string | undefined;
  let idadeStr = userProfile.idade ? `${userProfile.idade} anos` : '';
  if (nascStr) {
    const nasc = new Date(nascStr + 'T00:00:00');
    if (!isNaN(nasc.getTime())) {
      const hoje = new Date();
      const idade = hoje.getFullYear() - nasc.getFullYear() -
        (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate()) ? 1 : 0);
      idadeStr = `${idade} anos`;
    }
  }
  const profInfo = document.getElementById('profile-info');
  if (profInfo) {
    const altStr = userProfile.altura ? ` · ${userProfile.altura} cm` : '';
    profInfo.textContent = `${idadeStr} · ${userProfile.peso || 0} kg${altStr} · ${userProfile.sexo || ''}`;
  }

  if ((window as any).carregarMedications) {
    (window as any).carregarMedications();
  }
}

document.getElementById('form-perfil')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  try {
    const nascimento = (document.getElementById('p-nascimento') as HTMLInputElement).value;
    // Calcular idade a partir da data de nascimento
    let idade = (userProfile as any)?.idade || 0;
    if (nascimento) {
      const nasc = new Date(nascimento + 'T00:00:00');
      const hoje = new Date();
      idade = hoje.getFullYear() - nasc.getFullYear() -
        (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate()) ? 1 : 0);
    }
    const dados: any = {
      nome: (document.getElementById('p-nome') as HTMLInputElement).value,
      sexo: (document.getElementById('p-sexo') as HTMLSelectElement).value,
      nascimento,
      idade,
      peso: Number((document.getElementById('p-peso') as HTMLInputElement).value),
      altura: Number((document.getElementById('p-altura') as HTMLInputElement).value) || undefined,
      hipertenso: (document.getElementById('p-hipertenso') as HTMLInputElement).checked,
      diabetico: (document.getElementById('p-diabetico') as HTMLInputElement).checked,
      fumante: (document.getElementById('p-fumante') as HTMLInputElement).checked,
      sedentario: (document.getElementById('p-sedentario') as HTMLInputElement).checked,
      usaMedicacao: (document.getElementById('p-medicacao') as HTMLInputElement).checked,
    };
    await salvarPerfilUsuario(currentUser.uid, dados);
    if (userProfile?.peso !== dados.peso) {
      await salvarHistoricoPeso(currentUser.uid, dados.peso);
    }
    userProfile = { ...userProfile!, ...dados };
    mostrarToast('Perfil updated com sucesso!', 'success');
    carregarPerfil();
  } catch {
    mostrarToast('Erro ao salvar perfil.', 'error');
  }
});

// ── Modal Nova Aferição ────────────────────────────────────────
(window as any).abrirModalAfericao = () => {
  if (userProfile?.status === 'Inativo') {
    mostrarToast('Sua conta está desativada. Você apenas pode visualizar seus dados.', 'error');
    return;
  }
  document.getElementById('modal-afericao')?.classList.remove('hidden');
  resetarModal();
};
(window as any).fecharModalAfericao = () => {
  document.getElementById('modal-afericao')?.classList.add('hidden');
};

function resetarModal() {
  imagemSelecionada = null;
  mostrarStep('upload');
  ['f-sys','f-dia','f-pul'].forEach(id => (document.getElementById(id) as HTMLInputElement).value = '');
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  (document.getElementById('f-datetime') as HTMLInputElement).value = now.toISOString().slice(0, 16);
  document.getElementById('form-error')?.classList.add('hidden');
  document.getElementById('form-classification')!.innerHTML = '';
}

function mostrarStep(step: 'upload'|'ocr'|'form') {
  ['step-upload','step-ocr','step-form'].forEach(s => document.getElementById(s)?.classList.add('hidden'));
  document.getElementById(`step-${step}`)?.classList.remove('hidden');
}

// Upload de imagem
document.getElementById('file-input')?.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  imagemSelecionada = file;
  const url = criarUrlPreview(file);

  mostrarStep('ocr');
  const prevEl = document.getElementById('image-preview') as HTMLImageElement;
  prevEl.src = url;
  document.getElementById('image-preview-container')?.classList.remove('hidden');
  document.getElementById('ocr-loading')?.classList.remove('hidden');

  try {
    const base64 = await arquivoParaBase64(file);
    const mimeType = obterMimeType(file);
    const resultado = await processarImagemOCR(base64, mimeType);

    mostrarStep('form');
    const fPrev = document.getElementById('form-preview') as HTMLImageElement;
    fPrev.src = url;
    document.getElementById('ocr-preview-img')?.classList.remove('hidden');
    document.getElementById('ocr-result-badge')?.classList.remove('hidden');

    const badge = document.getElementById('ocr-confidence-badge')!;
    badge.className = `ocr-confidence ${resultado.confianca}`;
    const labels: Record<string, string> = {
      alta: 'Alta confiança',
      media: 'Confiança média',
      baixa: 'Baixa confiança — verifique!'
    };
    badge.textContent = labels[resultado.confianca];
    if (resultado.modelo_usado) {
      badge.title = `Modelo usado: ${resultado.modelo_usado}`;
    }

    if (resultado.sys) (document.getElementById('f-sys') as HTMLInputElement).value = String(resultado.sys);
    if (resultado.dia) (document.getElementById('f-dia') as HTMLInputElement).value = String(resultado.dia);
    if (resultado.pul) (document.getElementById('f-pul') as HTMLInputElement).value = String(resultado.pul);
    if (resultado.data_hora) {
      const dt = new Date(resultado.data_hora);
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      (document.getElementById('f-datetime') as HTMLInputElement).value = dt.toISOString().slice(0, 16);
    }
    atualizarPreviewClassificacao();
  } catch {
    // Mesmo com falha total do OCR, avança para o formulário
    mostrarStep('form');
    const fPrev = document.getElementById('form-preview') as HTMLImageElement;
    fPrev.src = url;
    document.getElementById('ocr-preview-img')?.classList.remove('hidden');
    document.getElementById('ocr-result-badge')?.classList.remove('hidden');
    const badge = document.getElementById('ocr-confidence-badge')!;
    badge.className = 'ocr-confidence baixa';
    badge.textContent = 'OCR indisponível — preencha manualmente';
    mostrarToast('OCR indisponível. Preencha os valores manualmente.', 'error');
  }
});

// Drag & drop
const uploadZone = document.getElementById('upload-zone');
uploadZone?.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone?.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (file) {
    imagemSelecionada = file;
    const input = document.getElementById('file-input') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  }
});

(window as any).pularOCR = () => {
  imagemSelecionada = null;
  document.getElementById('ocr-result-badge')?.classList.add('hidden');
  document.getElementById('ocr-preview-img')?.classList.add('hidden');
  mostrarStep('form');
};

// Preview live da classificação
function atualizarPreviewClassificacao() {
  const sys = Number((document.getElementById('f-sys') as HTMLInputElement).value);
  const dia = Number((document.getElementById('f-dia') as HTMLInputElement).value);
  const div = document.getElementById('form-classification')!;
  if (sys > 0 && dia > 0) {
    const clf = classificarPressao(sys, dia);
    div.innerHTML = `<span class="classification-badge" style="background:${clf.cor}22;color:${clf.cor};border-color:${clf.cor}44">${clf.emoji} ${clf.label} — ${clf.descricao}</span>`;
  } else {
    div.innerHTML = '';
  }
}
['f-sys','f-dia','f-pul'].forEach(id => document.getElementById(id)?.addEventListener('input', atualizarPreviewClassificacao));

// Salvar aferição
(window as any).salvarAfericaoModal = async () => {
  const sys = Number((document.getElementById('f-sys') as HTMLInputElement).value);
  const dia = Number((document.getElementById('f-dia') as HTMLInputElement).value);
  const pul = Number((document.getElementById('f-pul') as HTMLInputElement).value);
  const dtStr = (document.getElementById('f-datetime') as HTMLInputElement).value;
  
  
  const errEl = document.getElementById('form-error')!;

  if (!sys || !dia || !pul || !dtStr) {
    errEl.textContent = 'Preencha todos os campos.';
    errEl.classList.remove('hidden');
    return;
  }
  if (sys <= dia) {
    errEl.textContent = 'Sistólica deve ser maior que diastólica.';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');

  const btn = document.getElementById('btn-salvar') as HTMLButtonElement;
  btn.disabled = true;
  document.getElementById('btn-salvar-icon')!.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>';

  try {
    const leitura: Omit<BpReading, 'id'> = {
      user_id: currentUser.uid,
      sys, dia, pul,
      data_hora_afericao: new Date(dtStr),
    };

    // Salvar leitura no banco primeiro para não travar a tela
    const id = await salvarAfericao(leitura);
    mostrarToast('Aferição salva! Processando anexos...', 'success');
    (window as any).fecharModalAfericao();
    carregarDashboard();

    // Fazer upload da imagem em background se houver
    if (imagemSelecionada) {
      comprimirImagem(imagemSelecionada, 0.6) // Compressão maior para ser mais rápido
        .then(compressed => uploadImagemAfericao(currentUser.uid, compressed))
        .then(imageUrl => {
           // Importação local para updateDoc ou usar função existente
           import('firebase/firestore').then(({ updateDoc, doc }) => {
             import('./firebase').then(({ db }) => {
               updateDoc(doc(db, 'bp_readings', id), { image_url: imageUrl });
             });
           });
        })
        .catch(err => console.error('[Storage] Erro no upload em background:', err));
    }

    // Gerar feedback IA em background com histórico de 30 dias
    if (userProfile) {
      const historico = await buscarAfericoes(currentUser.uid, 30);
      const feedback = await gerarFeedbackIA({ ...leitura, id }, userProfile, historico);
      await atualizarFeedbackIA(id, feedback);
      carregarDashboard();
      mostrarToast('Análise de IA disponível!', 'info');
    }
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao salvar aferição.', 'error');
  } finally {
    btn.disabled = false;
    document.getElementById('btn-salvar-icon')!.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  }
};

// Fechar modal ao clicar fora
document.getElementById('modal-afericao')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-afericao')) {
    (window as any).fecharModalAfericao();
  }
});

// ── Painel Admin (Funções de Suporte ao Histórico Admin) ──────────────

// UID do usuário sendo visualizado no modal de histórico admin
let adminTargetUserUid: string | null = null;
let adminTargetUserPerfil: any | null = null;

async function abrirHistoricoUsuarioAdmin(uid: string, nome: string) {
  adminTargetUserUid = uid;
  // Tenta encontrar o perfil do usuário nos já carregados
  adminTargetUserPerfil = usuariosCadastrados.find(u => u.uid === uid) || null;
  const modal = document.getElementById('modal-historico-usuario')!;
  const nomeEl = document.getElementById('modal-hist-user-nome')!;
  const contentEl = document.getElementById('modal-hist-content')!;
  
  nomeEl.textContent = nome;
  contentEl.innerHTML = `<div class="ocr-loading"><div class="ocr-spinner"></div><p style="color:var(--text-muted);font-size:14px">Buscando histórico...</p></div>`;
  modal.classList.remove('hidden');
  
  try {
    const leituras = await buscarAfericoes(uid, 90);
    (window as any).adminLeiturasCache = leituras;
    if (leituras.length === 0) {
      contentEl.innerHTML = `<div class="empty-state" style="padding:40px 10px"><div class="empty-icon" style="color:var(--primary)"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></div><div class="empty-title">Sem aferições</div><p class="empty-sub">Este usuário ainda não registrou aferições de pressão arterial.</p></div>`;
      return;
    }
    
    contentEl.innerHTML = `
      <div style="max-height: 420px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 12px;">
        ${leituras.map(a => {
          const clf = classificarPressao(a.sys, a.dia);
          const dt = formatarDataHora(a.data_hora_afericao);
          
          return `
            <div class="reading-item admin-reading-card" onclick="abrirModalDetalheAnalise('${a.id}')" style="border-left: 4px solid ${clf.cor};">
              <div class="admin-reading-header">
                <span style="font-size:12px; color:var(--text-muted)">${dt}</span>
                <span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; background:${clf.cor}22; color:${clf.cor}">${clf.label}</span>
              </div>
              <div class="admin-reading-values">
                <span style="font-size:24px; font-weight:800; color:var(--primary-light)">${a.sys}</span>
                <span style="font-size:18px; color:var(--text-muted)">/</span>
                <span style="font-size:24px; font-weight:800; color:var(--accent)">${a.dia}</span>
                <span style="font-size:12px; color:var(--text-muted)">mmHg</span>
                <span class="admin-reading-pulse">${a.pul} BPM</span>
              </div>
              ${a.ai_feedback ? `
                <div class="admin-reading-ai-box">
                  <div class="admin-reading-ai-content">
                    <span style="display:flex;align-items:center;margin-top:2px;flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></span>
                    <span class="admin-reading-ai-text">${a.ai_feedback.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                  </div>
                  <div class="admin-reading-ai-actions">
                    <button class="btn btn-ghost btn-small" onclick="event.stopPropagation(); reprocessarIADaAfericao('${a.id}')" title="Reprocessar IA desta aferição" style="padding: 4px 10px; font-size: 11px; display:flex; align-items:center; gap:4px; border-radius:6px;">🔄 Reprocessar</button>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); abrirModalDetalheAnalise('${a.id}')" style="padding: 4px 10px; font-size: 11px; display:flex; align-items:center; gap:4px; border-radius:6px;">🔍 Ver Completo</button>
                  </div>
                </div>
              ` : `
                <div style="display:flex; justify-content:flex-end;">
                  <button class="btn btn-ghost btn-small" onclick="event.stopPropagation(); reprocessarIADaAfericao('${a.id}')" style="padding: 4px 10px; font-size: 11px; display:flex; align-items:center; gap:4px; border-radius:6px;">⚡ Gerar IA</button>
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>
    `;
    
  } catch (err) {
    console.error('Erro ao carregar histórico do usuário:', err);
    contentEl.innerHTML = `<div class="empty-state"><div class="empty-icon" style="color:var(--danger)"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div><div class="empty-title">Erro ao carregar histórico</div></div>`;
  }
}

function fecharHistoricoUsuarioAdmin() {
  document.getElementById('modal-historico-usuario')?.classList.add('hidden');
}

(window as any).gerarLaudoDoUsuarioAdmin = async () => {
  if (!adminTargetUserUid || !adminTargetUserPerfil) {
    mostrarToast('Nenhum usuário selecionado.', 'error');
    return;
  }
  const btn = document.getElementById('btn-gerar-laudo-admin') as HTMLButtonElement;
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = `<svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right:6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Gerando...`;

  try {
    const markdownText = await gerarRelatorioCondutaOMS(adminTargetUserUid, adminTargetUserPerfil, 90);
    const contentEl = document.getElementById('modal-hist-content')!;
    const parsedHtml = DOMPurify.sanitize(await marked.parse(markdownText));
    contentEl.innerHTML = `
      <div style="border-top: 1px solid var(--border); padding-top: 16px; margin-top: 8px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary)"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <span style="font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">Laudo IA Gerado</span>
        </div>
        <div class="laudo-content" style="font-size: 13px; line-height: 1.7; color: var(--text);">${parsedHtml}</div>
      </div>
    `;
    mostrarToast('Laudo gerado com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao gerar laudo admin:', err);
    mostrarToast('Erro ao gerar laudo. O usuário pode não ter histórico suficiente.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Gerar Laudo IA`;
  }
};

(window as any).reprocessarIADaAfericao = async (id: string) => {
  mostrarToast('Reprocessando análise da IA...', 'info');
  try {
    const targetUid = adminTargetUserUid || currentUser?.uid;
    if (!targetUid) return;
    const historico = await buscarAfericoes(targetUid, 90);
    const leitura = historico.find(a => a.id === id);
    if (!leitura) {
      mostrarToast('Aferição não encontrada.', 'error');
      return;
    }
    const perfil = adminTargetUserPerfil || userProfile;
    const feedback = await gerarFeedbackIA(leitura, perfil, historico);
    await atualizarFeedbackIA(id, feedback);
    mostrarToast('Análise de IA atualizada com sucesso!', 'success');
    if (document.getElementById('modal-detalhe-analise-ia')?.classList.contains('hidden') === false) {
      await (window as any).abrirModalDetalheAnalise(id);
    }
    if (adminTargetUserUid && adminTargetUserPerfil) {
      await abrirHistoricoUsuarioAdmin(adminTargetUserUid, adminTargetUserPerfil.nome);
    } else {
      carregarDashboard();
    }
  } catch (err) {
    console.error('Erro ao reprocessar IA:', err);
    mostrarToast('Erro ao reprocessar IA.', 'error');
  }
};

(window as any).reprocessarIAsEmLoteAdmin = async () => {
  if (!adminTargetUserUid || !adminTargetUserPerfil) {
    mostrarToast('Nenhum usuário selecionado.', 'error');
    return;
  }
  const btn = document.getElementById('btn-reprocessar-lote-admin') as HTMLButtonElement;
  if (btn) btn.disabled = true;
  mostrarToast('Iniciando reprocessamento em lote...', 'info');

  try {
    const leituras = await buscarAfericoes(adminTargetUserUid, 90);
    let processadas = 0;
    for (const leitura of leituras) {
      mostrarToast(`Reprocessando ${processadas + 1} de ${leituras.length}...`, 'info');
      try {
        const feedback = await gerarFeedbackIA(leitura, adminTargetUserPerfil, leituras);
        if (leitura.id) {
          await atualizarFeedbackIA(leitura.id, feedback);
        }
        processadas++;
      } catch (e) {
        console.error(`Erro ao reprocessar leitura ${leitura.id}`, e);
      }
    }
    mostrarToast(`${processadas} aferições reprocessadas com sucesso!`, 'success');
    await abrirHistoricoUsuarioAdmin(adminTargetUserUid, adminTargetUserPerfil.nome);
  } catch (err) {
    console.error('Erro ao reprocessar em lote:', err);
    mostrarToast('Erro no reprocessamento em lote.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};



(window as any).abrirModalDetalheAnalise = async (id: string) => {
  const modal = document.getElementById('modal-detalhe-analise-ia');
  const contentEl = document.getElementById('modal-detalhe-analise-content');
  if (!modal || !contentEl) return;

  const targetUid = adminTargetUserUid || currentUser?.uid;
  if (!targetUid) return;

  // Buscar aferições atualizadas diretamente do banco de dados (sem cache)
  const leituras = await buscarAfericoes(targetUid, 90);
  (window as any).adminLeiturasCache = leituras;
  const leitura = leituras.find((a: any) => a.id === id);

  if (!leitura) {
    mostrarToast('Aferição não encontrada', 'error');
    return;
  }

  const clf = classificarPressao(leitura.sys, leitura.dia);
  const dt = formatarDataHora(leitura.data_hora_afericao);
  const rawFeedback = leitura.ai_feedback || '';
  const feedbackSlot = `ai-feedback-slot-${leitura.id}`;


  // Montar HTML estrutural SEM injetar o texto da IA diretamente
  contentEl.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2); padding:14px; border-radius:12px; border-left: 4px solid ${clf.cor};">
        <div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">${dt}</div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <span style="font-size:26px; font-weight:800; color:var(--primary-light)">${leitura.sys}</span>
            <span style="font-size:18px; color:var(--text-muted)">/</span>
            <span style="font-size:26px; font-weight:800; color:var(--accent)">${leitura.dia}</span>
            <span style="font-size:12px; color:var(--text-muted)">mmHg</span>
            <span style="margin-left:8px; font-size:13px; font-weight:600; color:var(--warning)">❤️ ${leitura.pul} BPM</span>
          </div>
        </div>
        <span style="font-size:12px; font-weight:700; padding:4px 12px; border-radius:20px; background:${clf.cor}22; color:${clf.cor}; border:1px solid ${clf.cor}44;">
          ${clf.label}
        </span>
      </div>

      <div style="background:var(--surface-variant); padding:16px; border-radius:12px; border:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
            🤖 Parecer do Especialista Virtual
          </span>
          <button class="btn btn-ghost btn-small" onclick="reprocessarIADaAfericao('${leitura.id}')" style="padding:4px 10px; font-size:12px; display:flex; align-items:center; gap:4px;">
            🔄 Recalcular
          </button>
        </div>
        <div id="${feedbackSlot}" style="font-size:13.5px; line-height:1.8; color:var(--text); white-space:pre-wrap; word-break:break-word;"></div>
      </div>
    </div>
  `;

  // PASSO CRÍTICO: injetar texto via textContent — NUNCA via innerHTML
  // Garante que < > / números e qualquer caractere especial apareçam literalmente
  const slot = document.getElementById(feedbackSlot);
  if (slot) {
    slot.textContent = rawFeedback || 'Nenhum parecer de IA disponível. Clique em Recalcular para gerar.';
  }

  modal.classList.remove('hidden');
};

(window as any).fecharModalDetalheAnalise = () => {
  document.getElementById('modal-detalhe-analise-ia')?.classList.add('hidden');
};

// Fechar modal ao clicar fora
document.getElementById('modal-detalhe-analise-ia')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-detalhe-analise-ia')) {
    (window as any).fecharModalDetalheAnalise();
  }
});



// Fechar modal de histórico admin ao clicar fora
document.getElementById('modal-historico-usuario')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-historico-usuario')) {
    fecharHistoricoUsuarioAdmin();
  }
});

(window as any).alterarStatusAdmin = async (uid: string, stat: 'Ativo' | 'Pendente' | 'Suspenso' | 'Inativo') => {
  let msg = '';
  if (stat === 'Ativo') msg = 'Deseja ativar e liberar o acesso deste usuário?';
  else if (stat === 'Suspenso') msg = 'Deseja suspender e bloquear o acesso deste usuário?';
  else if (stat === 'Inativo') msg = 'Deseja desativar este usuário? Ele não poderá adicionar novos dados.';
  else msg = 'Deseja alterar o status deste usuário?';
  
  abrirModalConfirmacao('Alterar Status do Usuário', msg, async () => {
    try {
      await atualizarStatusUsuario(uid, stat);
      mostrarToast(`Status do usuário atualizado com sucesso!`, 'success');
      carregarAdmin();
      (window as any).fecharGerenciarUsuarioAdmin();
    } catch (err) {
      mostrarToast('Erro ao atualizar status.', 'error');
    }
  });
};

(window as any).excluirUsuarioAdmin = async (uid: string, nome: string) => {
  abrirModalConfirmacao(
    'Excluir Usuário',
    `Tem certeza que deseja excluir DEFINITIVAMENTE o usuário ${nome} e TODOS os seus dados? Esta ação não pode ser desfeita.`,
    async () => {
      try {
        await excluirDadosUsuario(uid);
        mostrarToast('Usuário e dados excluídos com sucesso!', 'success');
        carregarAdmin();
        (window as any).fecharGerenciarUsuarioAdmin();
      } catch (err) {
        console.error(err);
        mostrarToast('Erro ao excluir usuário.', 'error');
      }
    }
  );
};

// ── Modal Gerenciar Usuário ────────────────────────────────────
(window as any).abrirGerenciarUsuarioAdmin = (uid: string) => {
  try {
    const u = usuariosCadastrados.find(user => user.uid === uid);
    if (!u) {
      alert('Usuário não encontrado!');
      return;
    }

    (document.getElementById('admin-user-uid') as HTMLInputElement).value = u.uid || '';
    (document.getElementById('admin-user-nome') as HTMLInputElement).value = u.nome || '';
    (document.getElementById('admin-user-sexo') as HTMLSelectElement).value = u.sexo || '';
    
    if ((u as any).nascimento) {
      (document.getElementById('admin-user-nascimento') as HTMLInputElement).value = (u as any).nascimento;
    } else {
      (document.getElementById('admin-user-nascimento') as HTMLInputElement).value = '';
    }

    const isMe = u.uid === currentUser?.uid;
    const statusText = u.status || 'Ativo';
    
    let acoesHtml = '';
    if (!isMe) {
      acoesHtml += `<button type="button" class="btn btn-ghost btn-small" onclick="alternarFuncaoAdmin('${u.uid}', '${u.role}')">
        ${u.role === 'ADMIN' ? 'Rebaixar para Usuário' : 'Promover a Admin'}
      </button>`;
      
      if (statusText === 'Pendente') {
        acoesHtml += `<button type="button" class="btn btn-primary btn-small" onclick="alterarStatusAdmin('${u.uid}', 'Ativo')">Aprovar Acesso</button>`;
      } else if (statusText !== 'Ativo') {
        acoesHtml += `<button type="button" class="btn btn-ghost btn-small" style="color:#00C9A7" onclick="alterarStatusAdmin('${u.uid}', 'Ativo')">Ativar</button>`;
      }
      if (statusText !== 'Suspenso') {
        acoesHtml += `<button type="button" class="btn btn-ghost btn-small" style="color:#E53935" onclick="alterarStatusAdmin('${u.uid}', 'Suspenso')">Bloquear</button>`;
      }
      if (statusText !== 'Inativo') {
        acoesHtml += `<button type="button" class="btn btn-ghost btn-small" style="color:#F59E0B" onclick="alterarStatusAdmin('${u.uid}', 'Inativo')">Desativar</button>`;
      }
      
      acoesHtml += `<button type="button" class="btn btn-small" style="color:#C62828; border: 1px solid #ef5350; background: #ffebee; width: 100%; margin-top: 12px;" onclick="excluirUsuarioAdmin('${escapeHtml(u.uid)}', '${escapeHtml(u.nome)}')">Excluir Usuário</button>`;
    } else {
      acoesHtml = `<span style="font-size:12px; color:var(--text-muted)">Você não pode alterar seus próprios privilégios por aqui.</span>`;
    }
    
    document.getElementById('admin-user-acoes')!.innerHTML = acoesHtml;
    document.getElementById('modal-gerenciar-usuario')?.classList.remove('hidden');
  } catch (error: any) {
    alert('Erro ao abrir o modal: ' + error.message);
    console.error(error);
  }
};

(window as any).fecharGerenciarUsuarioAdmin = () => {
  document.getElementById('modal-gerenciar-usuario')?.classList.add('hidden');
};

document.getElementById('form-gerenciar-usuario')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const uid = (document.getElementById('admin-user-uid') as HTMLInputElement).value;
  const nome = (document.getElementById('admin-user-nome') as HTMLInputElement).value;
  const sexo = (document.getElementById('admin-user-sexo') as HTMLSelectElement).value;
  const nascimento = (document.getElementById('admin-user-nascimento') as HTMLInputElement).value;
  
  let idade = 0;
  if (nascimento) {
    const nasc = new Date(nascimento + 'T00:00:00');
    const hoje = new Date();
    idade = hoje.getFullYear() - nasc.getFullYear() -
      (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate()) ? 1 : 0);
  }

  try {
    await atualizarPerfilUsuarioAdmin(uid, { nome, sexo: sexo as any, nascimento, idade } as any);
    mostrarToast('Dados do usuário atualizados!', 'success');
    (window as any).fecharGerenciarUsuarioAdmin();
    carregarAdmin();
  } catch (err) {
    mostrarToast('Erro ao atualizar dados.', 'error');
  }
});

// ── Lógica do Modal de Confirmação ─────────────────────────────
let confirmActionCallback: (() => void) | null = null;

function abrirModalConfirmacao(titulo: string, mensagem: string, callback: () => void) {
  document.getElementById('confirm-title')!.textContent = titulo;
  document.getElementById('confirm-message')!.textContent = mensagem;
  confirmActionCallback = callback;
  document.getElementById('modal-confirmacao')?.classList.remove('hidden');
}

(window as any).fecharModalConfirmacao = () => {
  document.getElementById('modal-confirmacao')?.classList.add('hidden');
  confirmActionCallback = null;
};

document.getElementById('btn-confirm-action')?.addEventListener('click', () => {
  if (confirmActionCallback) confirmActionCallback();
  (window as any).fecharModalConfirmacao();
});

(window as any).gerarLaudoTela = async () => {
  if (!userProfile) return;
  const dias = Number((document.getElementById('laudo-periodo') as HTMLSelectElement).value);
  const btn = document.getElementById('btn-gerar-laudo') as HTMLButtonElement;
  const container = document.getElementById('laudo-resultado-container')!;
  const content = document.getElementById('laudo-resultado-content')!;

  if (userProfile.role !== 'ADMIN') {
    try {
      const historicoTotal = await buscarAfericoes(currentUser.uid, 3650);
      const diasComDados = new Set(historicoTotal.map(a => a.data_hora_afericao.toISOString().split('T')[0])).size;
      
      if (diasComDados < 7) {
        mostrarToast(`Você possui aferições em apenas ${diasComDados} dia(s). São necessários no mínimo 7 dias para gerar um laudo.`, 'error');
        return;
      }
    } catch (e) {
      console.error("Erro ao validar histórico: ", e);
      mostrarToast('Erro ao validar histórico para laudo.', 'error');
      return;
    }
  }

  btn.disabled = true;
  btn.innerHTML = `
    <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; animation: spin 1s linear infinite;">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Analisando histórico e gerando laudo...
  `;
  container.classList.add('hidden');

  try {
    const markdownText = await gerarRelatorioCondutaOMS(currentUser.uid, userProfile, dias);
    content.innerHTML = DOMPurify.sanitize(await marked.parse(markdownText));
    
    // Atualiza a data de geração
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR') + ' às ' + dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('laudo-data-geracao')!.innerText = `Gerado em ${dataFormatada}`;
    
    container.classList.remove('hidden');
    await carregarLaudos();
  } catch (err) {
    mostrarToast('Erro ao gerar laudo da IA.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Analisar Histórico e Gerar Conduta';
  }
};

(window as any).copiarLaudo = () => {
  const content = document.getElementById('laudo-resultado-content');
  if (content) {
    // Usar innerText para copiar apenas o texto limpo sem tags HTML
    const textoParaCopiar = content.innerText;
    navigator.clipboard.writeText(textoParaCopiar).then(() => {
      mostrarToast('Laudo copiado para a área de transferência!', 'success');
    }).catch(err => {
      console.error('Erro ao copiar: ', err);
      mostrarToast('Não foi possível copiar o laudo.', 'error');
    });
  }
};

const laudosCacheMap = new Map<string, SavedLaudo>();
let laudoAtualModal: SavedLaudo | null = null;

export async function carregarLaudos() {
  if (!currentUser || !userProfile) return;
  const listEl = document.getElementById('laudos-historico-list');
  if (!listEl) return;

  // Lógica de Bloqueio/Progresso da Geração de Laudo
  const gerarCard = document.getElementById('laudo-gerar-card');
  const bloqueadoCard = document.getElementById('laudo-bloqueado-card');
  const progressoBar = document.getElementById('laudo-progresso-bar') as HTMLElement;
  const progressoTexto = document.getElementById('laudo-progresso-texto');

  if (gerarCard && bloqueadoCard) {
    if (userProfile.role === 'ADMIN') {
      gerarCard.classList.remove('hidden');
      bloqueadoCard.classList.add('hidden');
    } else {
      try {
        const historicoTotal = await buscarAfericoes(currentUser.uid, 3650);
        const diasComDados = new Set(historicoTotal.map(a => a.data_hora_afericao.toISOString().split('T')[0])).size;
        
        if (diasComDados < 7) {
          gerarCard.classList.add('hidden');
          bloqueadoCard.classList.remove('hidden');
          if (progressoBar && progressoTexto) {
            const pct = Math.min(100, Math.round((diasComDados / 7) * 100));
            progressoBar.style.width = `${pct}%`;
            progressoTexto.textContent = `${diasComDados} de 7 dias com registros`;
          }
        } else {
          gerarCard.classList.remove('hidden');
          bloqueadoCard.classList.add('hidden');
        }
      } catch (e) {
        console.error("Erro ao validar histórico para laudo: ", e);
      }
    }
  }

  listEl.innerHTML = '<div class="ocr-loading"><div class="ocr-spinner"></div><p style="color:var(--text-muted)">Carregando laudos salvos...</p></div>';

  try {
    const isAdminUser = userProfile.role === 'ADMIN';
    const laudos = await buscarLaudos(currentUser.uid, isAdminUser);
    laudosCacheMap.clear();
    laudos.forEach((l, idx) => laudosCacheMap.set(l.id || `laudo-${idx}`, l));

    const container = document.getElementById('laudo-resultado-container');
    const contentEl = document.getElementById('laudo-resultado-content');
    const previewEl = document.getElementById('laudo-resultado-preview');
    const dataEl = document.getElementById('laudo-data-geracao');

    if (laudos.length === 0) {
      if (container) container.classList.add('hidden');
      listEl.innerHTML = `
        <div class="empty-state" style="padding:24px; text-align:center;">
          <p style="color:var(--text-muted); font-size:14px;">Nenhum laudo gerado anteriormente.</p>
        </div>`;
      return;
    }

    // Prévia do laudo ativo mais recente no card do topo
    const ultimosAtivos = laudos.filter(l => l.ativo !== false);
    const ultimoLaudo = ultimosAtivos.length > 0 ? ultimosAtivos[0] : laudos[0];

    if (container && contentEl && dataEl) {
      contentEl.innerHTML = DOMPurify.sanitize(await marked.parse(ultimoLaudo.conteudo));
      if (previewEl) {
        const textoLimpo = ultimoLaudo.conteudo.replace(/[#*`_~>-]/g, ' ').replace(/\s+/g, ' ').trim();
        previewEl.innerText = textoLimpo.length > 200 ? textoLimpo.slice(0, 200) + '...' : textoLimpo;
      }
      const dtUltimo = formatarDataHora(ultimoLaudo.data_geracao);
      const statusBadgeHtml = ultimoLaudo.ativo === false ? ' <span style="background:var(--danger); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">Inativo (Admin)</span>' : '';
      dataEl.innerHTML = `Gerado em ${dtUltimo} ${ultimoLaudo.dias_analisados ? `(${ultimoLaudo.dias_analisados} dias analisados)` : ''}${statusBadgeHtml}`;
      container.classList.remove('hidden');
    }

(window as any).toggleLaudosMesGroup = (groupId: string) => {
  const content = document.getElementById(groupId);
  const icon = document.getElementById(`icon-${groupId}`);
  if (!content || !icon) return;

  if (content.style.display === 'none') {
    content.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
  } else {
    content.style.display = 'none';
    icon.style.transform = 'rotate(0deg)';
  }
};

    // Agrupar laudos por Mês/Ano (Accordion Hierárquico)
    interface GroupLaudoMes {
      key: string;
      label: string;
      laudos: SavedLaudo[];
    }

    const mesesMap: Record<string, GroupLaudoMes> = {};

    laudos.forEach((l) => {
      const dt: Date = l.data_geracao;
      const mesKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

      if (!mesesMap[mesKey]) {
        mesesMap[mesKey] = {
          key: mesKey,
          label: `${NOMES_MESES[dt.getMonth()]} de ${dt.getFullYear()}`,
          laudos: []
        };
      }
      mesesMap[mesKey].laudos.push(l);
    });

    const mesesOrdenados = Object.values(mesesMap).sort((a, b) => b.key.localeCompare(a.key));

    let html = '';

    for (let mIdx = 0; mIdx < mesesOrdenados.length; mIdx++) {
      const mesGroup = mesesOrdenados[mIdx];
      const isAberto = mIdx === 0; // O primeiro mês (mês mais recente) fica expandido por padrão
      const groupId = `laudos-mes-group-${mesGroup.key}`;

      html += `
      <div class="history-month-card" style="margin-bottom: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <div class="history-month-header" onclick="toggleLaudosMesGroup('${groupId}')" 
             style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: var(--bg-card2); cursor: pointer; user-select: none;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style="font-size: 15px; font-weight: 700; color: var(--text);">${mesGroup.label}</span>
            <span class="badge" style="background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">${mesGroup.laudos.length} ${mesGroup.laudos.length === 1 ? 'laudo' : 'laudos'}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${mIdx === 0 ? '<span style="font-size:11px; color:var(--accent); font-weight:600; background:var(--accent)15; padding:2px 8px; border-radius:10px;">Mês Atual</span>' : ''}
            <svg id="icon-${groupId}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.3s ease; transform: ${isAberto ? 'rotate(180deg)' : 'rotate(0deg)'}; color: var(--text-muted);">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div id="${groupId}" style="display: ${isAberto ? 'block' : 'none'}; padding: 16px; border-top: 1px solid var(--border);">`;

      for (const l of mesGroup.laudos) {
        const dt = formatarDataHora(l.data_geracao);
        const laudoId = l.id || `laudo-${l.data_geracao.getTime()}`;
        const previewTexto = l.conteudo.replace(/[#*`_~>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) + '...';
        const isLaudoInativo = l.ativo === false;

        html += `
        <div class="card fade-in" style="background:var(--bg-card2); border:1px solid ${isLaudoInativo ? 'var(--danger)' : 'var(--border)'}; margin-bottom:12px; padding:16px; opacity: ${isLaudoInativo ? '0.75' : '1'};">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom: 8px;">
            <div style="font-size: 13px; color: var(--text); font-weight: 600; display:flex; align-items:center; gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary)"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Gerado em ${dt} ${l.dias_analisados ? `<span style="font-size:11px; font-weight:500; color:var(--text-muted);">(${l.dias_analisados} dias)</span>` : ''}
              ${isLaudoInativo ? '<span style="background:var(--danger); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">Inativo (Admin)</span>' : ''}
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button class="btn btn-primary btn-small" onclick="abrirModalVisualizarLaudo('${laudoId}')" style="padding: 4px 10px; font-size: 12px; display:flex; align-items:center; gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg> Visualizar
              </button>
              <button class="btn btn-outline btn-small" onclick="exportarLaudoPorIdParaPDF('${laudoId}')" style="padding: 4px 8px; font-size: 12px; display:flex; align-items:center; gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF
              </button>
              ${!isLaudoInativo ? `
              <button class="btn btn-outline btn-small" onclick="inativarLaudoUI('${laudoId}')" style="padding: 4px 8px; font-size: 12px; color:var(--danger); border-color:var(--danger);" title="Inativar laudo">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>` : ''}
            </div>
          </div>
          <p style="font-size:13px; color:var(--text-muted); line-height:1.5; margin:0; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${previewTexto}
          </p>
        </div>`;
      }

      html += `</div></div>`; // Fechar div do conteúdo e card do mês
    }

    listEl.innerHTML = html;

  } catch (err) {
    console.error('Erro ao carregar laudos salvos:', err);
    listEl.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Erro ao carregar histórico de laudos.</p></div>';
  }
}

(window as any).carregarLaudos = carregarLaudos;

(window as any).inativarLaudoUI = (id: string) => {
  const laudo = laudosCacheMap.get(id);
  if (!laudo) return;

  abrirModalConfirmacao(
    'Inativar Laudo',
    'Tem certeza que deseja inativar este laudo? Ele deixará de ser exibido na sua lista (permanecendo auditável no Admin).',
    async () => {
      try {
        await inativarLaudo(id);
        mostrarToast('Laudo inativado com sucesso!', 'success');
        await carregarLaudos();
      } catch (err) {
        console.error('Erro ao inativar laudo:', err);
        mostrarToast('Erro ao inativar laudo.', 'error');
      }
    }
  );
};

(window as any).inativarLaudoModalAtual = () => {
  if (laudoAtualModal && laudoAtualModal.id) {
    (window as any).fecharModalVisualizarLaudo();
    (window as any).inativarLaudoUI(laudoAtualModal.id);
  }
};

(window as any).abrirModalVisualizarLaudo = async (id: string) => {
  const laudo = laudosCacheMap.get(id);
  if (!laudo) {
    mostrarToast('Laudo não encontrado.', 'error');
    return;
  }

  laudoAtualModal = laudo;
  const modal = document.getElementById('modal-visualizar-laudo');
  const bodyEl = document.getElementById('modal-laudo-body');
  const dataEl = document.getElementById('modal-laudo-data');

  if (bodyEl && dataEl && modal) {
    bodyEl.innerHTML = DOMPurify.sanitize(await marked.parse(laudo.conteudo));
    const dt = formatarDataHora(laudo.data_geracao);
    const statusInativo = laudo.ativo === false ? ' <span style="background:var(--danger); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">Inativo (Admin)</span>' : '';
    dataEl.innerHTML = `Gerado em ${dt} ${laudo.dias_analisados ? `(${laudo.dias_analisados} dias analisados)` : ''}${statusInativo}`;
    modal.classList.remove('hidden');
  }
};

(window as any).abrirModalUltimoLaudo = async () => {
  const laudosArray = Array.from(laudosCacheMap.values());
  if (laudosArray.length > 0) {
    await (window as any).abrirModalVisualizarLaudo(laudosArray[0].id);
  } else {
    mostrarToast('Nenhum laudo gerado ainda.', 'info');
  }
};

(window as any).fecharModalVisualizarLaudo = () => {
  document.getElementById('modal-visualizar-laudo')?.classList.add('hidden');
};

(window as any).copiarLaudoModalAtual = () => {
  const el = document.getElementById('modal-laudo-body');
  if (el && el.innerText.trim()) {
    navigator.clipboard.writeText(el.innerText).then(() => {
      mostrarToast('Laudo copiado para a área de transferência!', 'success');
    });
  }
};

(window as any).exportarLaudoModalParaPDF = async () => {
  if (!laudoAtualModal) return;
  await (window as any).exportarLaudoPorIdParaPDF(laudoAtualModal.id);
};

(window as any).exportarLaudoPorIdParaPDF = async (id: string) => {
  const laudo = laudosCacheMap.get(id);
  if (!laudo) return;

  try {
    const nomeUsuario = userProfile?.nome || currentUser?.displayName || 'Paciente';
    const dataGeracaoStr = formatarDataHora(laudo.data_geracao);
    const periodo = laudo.dias_analisados ? `${laudo.dias_analisados} dias` : '—';

    const wrapper = criarWrapperPDF();
    wrapper.innerHTML = `
      ${gerarHTMLCabecalhoPDF('Relatório de Conduta IA', `Gerado em ${dataGeracaoStr}`, nomeUsuario, [`Período analisado: ${periodo}`])}
      <div class="pdf-section-title">Análise e Conduta — IA Médica (OMS)</div>
      <div class="pdf-laudo-text">${laudo.conteudo}</div>
      ${gerarHTMLRodapePDF()}`;

    const nomeSanitizado = nomeUsuario.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase();
    const dataFormatada = laudo.data_geracao.toISOString().split('T')[0];
    await salvarPDF(wrapper, `laudo-${nomeSanitizado}-${dataFormatada}.pdf`);
    mostrarToast('Laudo exportado com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao exportar laudo para PDF:', err);
    mostrarToast('Erro ao gerar o PDF.', 'error');
  }
};

function criarWrapperPDF(): HTMLDivElement {
  const w = document.createElement('div');
  w.className = 'pdf-report-wrapper';
  w.style.cssText = [
    '--primary:#4338ca', '--primary-dark:#312e81', '--primary-light:#6366f1',
    '--accent:#10b981', '--accent-dark:#059669',
    '--bg:#f8fafc', '--bg-card:#ffffff', '--bg-card2:#f1f5f9',
    '--bg-input:#f8fafc', '--border:#e2e8f0',
    '--text:#1e293b', '--text-muted:#64748b',
    '--danger:#ef4444', '--warning:#f59e0b', '--success:#10b981',
    '--normal-color:#10b981', '--elevated-color:#f59e0b',
    '--hyper1-color:#ef4444', '--hyper2-color:#dc2626',
    '--crisis-color:#991b1b', '--low-color:#6366f1',
    'background:#ffffff', 'color:#1e293b',
    'width:800px', 'box-sizing:border-box'
  ].join(';');
  return w;
}

function obterBadgePDF(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('normal')) return `<span class="pdf-badge pdf-badge-normal">${label}</span>`;
  if (l.includes('elevad')) return `<span class="pdf-badge pdf-badge-elevada">${label}</span>`;
  if (l.includes('crise')) return `<span class="pdf-badge pdf-badge-crise">${label}</span>`;
  return `<span class="pdf-badge pdf-badge-hiper">${label}</span>`;
}

function gerarHTMLCabecalhoPDF(titulo: string, subtitulo: string, nomePaciente: string, extraInfo?: string[]): string {
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const infoExtra = extraInfo ? extraInfo.map(info => `
    <div class="pdf-patient-field">
      <span class="pdf-patient-label">${info.split(':')[0]}</span>
      <span class="pdf-patient-value">${info.split(':').slice(1).join(':').trim()}</span>
    </div>`).join('') : '';

  return `
    <div class="pdf-report-header">
      <div class="pdf-report-brand">
        <div class="pdf-report-brand-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <div>
          <div class="pdf-report-brand-name">KardIA</div>
          <div class="pdf-report-brand-tagline">Monitoramento Inteligente de Saúde</div>
        </div>
      </div>
      <div class="pdf-report-meta">
        <div class="pdf-report-meta-title">${titulo}</div>
        <div class="pdf-report-meta-date">${subtitulo}</div>
        <div class="pdf-report-meta-date" style="margin-top:4px">${agora}</div>
      </div>
    </div>
    <div class="pdf-patient-box">
      <div class="pdf-patient-field">
        <span class="pdf-patient-label">Paciente</span>
        <span class="pdf-patient-value">${nomePaciente || 'Não informado'}</span>
      </div>
      ${infoExtra}
    </div>`;
}

function gerarHTMLRodapePDF(): string {
  return `
    <div class="pdf-disclaimer">
      ⚠️ <strong>Aviso importante:</strong> Este relatório é gerado automaticamente com auxílio de Inteligência Artificial
      com base nos dados registrados pelo usuário. Não substitui avaliação, diagnóstico ou tratamento médico profissional.
      Consulte sempre um médico ou especialista de saúde qualificado.
    </div>
    <div class="pdf-report-footer">
      <span>Gerado por <strong>KardIA</strong> — Plataforma de Monitoramento de Saúde</span>
      <span>KardIA ${APP_VERSION} • kardia.app</span>
    </div>`;
}

async function salvarPDF(wrapper: HTMLDivElement, filename: string): Promise<void> {
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;overflow:hidden;height:0;z-index:-9999;';
  container.appendChild(wrapper);
  document.body.appendChild(container);
  
  await new Promise(r => setTimeout(r, 100));
  
  const html2pdf = (await import('html2pdf.js')).default;
  await html2pdf().set({
    margin: 0,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff', 
      logging: false, 
      scrollX: 0, 
      scrollY: 0 
    },
    jsPDF: { unit: 'px', format: [800, wrapper.scrollHeight + 40], orientation: 'portrait' }
  }).from(wrapper).save();
  
  document.body.removeChild(container);
}

const SPINNER_SVG = (w = 14) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    style="animation:spin 1s linear infinite">
    <path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/>
    <path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/>
    <path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/>
  </svg>`;

const PDF_ICON = (w = 14) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>`;

let _adminPdfUid: string | null = null;

(window as any).carregarAdmin = carregarAdmin;
(window as any).abrirHistoricoUsuarioAdmin = async (uid: string, nome: string) => {
  _adminPdfUid = uid;
  await abrirHistoricoUsuarioAdmin(uid, nome);
};
(window as any).fecharHistoricoUsuarioAdmin = fecharHistoricoUsuarioAdmin;

function gerarSVGGrafico(leituras: any[]): string {
  if (leituras.length < 2) return '';

  const W = 676, H = 180, PX = 44, PY = 18;
  const chartW = W - PX * 2, chartH = H - PY * 2 - 22;

  const sorted = [...leituras].sort(
    (a, b) => a.data_hora_afericao.getTime() - b.data_hora_afericao.getTime()
  );
  const n = sorted.length;

  const allVals = sorted.flatMap(a => [a.sys, a.dia, a.pul]);
  const maxV = Math.max(...allVals) + 15;
  const minV = Math.max(0, Math.min(...allVals) - 15);
  const range = maxV - minV || 1;

  const gX = (i: number) => PX + (i / Math.max(n - 1, 1)) * chartW;
  const gY = (v: number) => PY + ((maxV - v) / range) * chartH;

  const polyline = (series: number[], color: string, dash = '') =>
    `<polyline points="${series.map((v, i) => `${gX(i)},${gY(v)}`).join(' ')}"
      fill="none" stroke="${color}" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round"
      ${dash ? `stroke-dasharray="${dash}"` : ''} />`;

  const dots = (series: number[], color: string) =>
    series.map((v, i) =>
      `<circle cx="${gX(i)}" cy="${gY(v)}" r="3" fill="${color}" stroke="#fff" stroke-width="1.2"/>`
    ).join('');

  const gridVals = [80, 90, 100, 120, 130, 140, 160].filter(v => v >= minV && v <= maxV);
  const grids = gridVals.map(v => {
    const y = gY(v);
    const isRef = v === 120 || v === 80;
    return `
      <line x1="${PX}" y1="${y}" x2="${W - PX}" y2="${y}"
        stroke="${isRef ? '#c7d2fe' : '#e2e8f0'}" stroke-width="${isRef ? 1.2 : 0.8}" stroke-dasharray="4,3"/>
      <text x="${PX - 5}" y="${y + 3.5}" text-anchor="end" font-size="8.5" fill="#94a3b8">${v}</text>`;
  }).join('');

  const step = Math.ceil(n / 6);
  const xLabels = sorted
    .filter((_, i) => i === 0 || i === n - 1 || i % step === 0)
    .map((a, _) => {
      const i = sorted.indexOf(a);
      const d = a.data_hora_afericao instanceof Date
        ? a.data_hora_afericao : new Date((a.data_hora_afericao as any).seconds * 1000);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return `<text x="${gX(i)}" y="${PY + chartH + 12}" text-anchor="middle" font-size="8" fill="#94a3b8">${label}</text>`;
    }).join('');

  const sysSeries = sorted.map(a => a.sys);
  const diaSeries = sorted.map(a => a.dia);
  const pulSeries = sorted.map(a => a.pul);

  const legendY = H - 8;
  return `
    <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:12px 8px 6px;margin-bottom:20px;">
      <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
           style="display:block;overflow:visible;">
        <rect width="${W}" height="${H}" fill="#f8fafc" rx="0"/>
        ${grids}
        ${polyline(sysSeries, '#6366f1')}
        ${polyline(diaSeries, '#10b981')}
        ${polyline(pulSeries, '#f59e0b', '5,3')}
        ${dots(sysSeries, '#6366f1')}
        ${dots(diaSeries, '#10b981')}
        ${dots(pulSeries, '#f59e0b')}
        ${xLabels}
        <rect x="${PX}" y="${legendY - 7}" width="8" height="8" rx="2" fill="#6366f1"/>
        <text x="${PX + 11}" y="${legendY}" font-size="9" fill="#475569">Sistólica</text>
        <rect x="${PX + 70}" y="${legendY - 7}" width="8" height="8" rx="2" fill="#10b981"/>
        <text x="${PX + 83}" y="${legendY}" font-size="9" fill="#475569">Diastólica</text>
        <rect x="${PX + 152}" y="${legendY - 7}" width="8" height="4" rx="1" fill="#f59e0b"/>
        <text x="${PX + 164}" y="${legendY}" font-size="9" fill="#475569">Pulso</text>
      </svg>
    </div>`;
}

(window as any).exportarLaudoParaPDF = async () => {
  const btn = document.getElementById('btn-exportar-laudo-pdf') as HTMLButtonElement;
  const contentEl = document.getElementById('laudo-resultado-content');
  if (!contentEl || !contentEl.innerText.trim()) {
    mostrarToast('Gere o laudo antes de exportar.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `${SPINNER_SVG(14)} Gerando...`;

  try {
    const nomeUsuario = userProfile?.nome || currentUser?.displayName || 'Paciente';
    const periodoEl = document.getElementById('laudo-periodo') as HTMLSelectElement;
    const periodo = periodoEl ? `${periodoEl.value} dias` : '—';
    const dataGeracao = document.getElementById('laudo-data-geracao')?.innerText || '';

    const wrapper = criarWrapperPDF();
    wrapper.innerHTML = `
      ${gerarHTMLCabecalhoPDF('Relatório de Conduta IA', dataGeracao, nomeUsuario, [`Período analisado: ${periodo}`])}
      <div class="pdf-section-title">Análise e Conduta — IA Médica (OMS)</div>
      <div class="pdf-laudo-text">${contentEl.innerText}</div>
      ${gerarHTMLRodapePDF()}`;

    const nomeSanitizado = nomeUsuario.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase();
    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    const dataFormatada = `${dia}-${mes}-${ano}`;
    await salvarPDF(wrapper, `laudo-${nomeSanitizado}-${dataFormatada}.pdf`);
    mostrarToast('Laudo exportado com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao exportar laudo:', err);
    mostrarToast('Erro ao gerar o PDF.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${PDF_ICON(14)} Exportar PDF`;
  }
};

(window as any).exportarHistoricoParaPDF = async () => {
  const btn = document.getElementById('btn-exportar-historico-pdf') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = `${SPINNER_SVG(16)} Gerando...`;

  try {
    const afericoes = await buscarAfericoes(currentUser.uid, 90);
    const glicemias = await buscarGlicemias(currentUser.uid, 90);
    const pesos = await buscarHistoricoPeso(currentUser.uid);
    const analises = await buscarAnalisesDiarias(currentUser.uid);
    const aguaLogs = await buscarHistoricoAgua(currentUser.uid);

    let combined: any[] = [];
    afericoes.forEach(a => combined.push({ tipo: 'pressao', id: a.id, timestamp: a.data_hora_afericao.getTime(), data_hora: a.data_hora_afericao, original: a }));
    glicemias.forEach(g => combined.push({ tipo: 'glicemia', id: g.id, timestamp: g.data_hora_afericao.getTime(), data_hora: g.data_hora_afericao, original: g }));
    pesos.forEach(p => combined.push({ tipo: 'peso', id: p.id, timestamp: p.data.getTime(), data_hora: p.data, original: p }));

    if (combined.length === 0) {
      mostrarToast('Nenhuma aferição para exportar.', 'error');
      btn.disabled = false;
      btn.innerHTML = `${PDF_ICON(16)} Exportar PDF`;
      return;
    }

    const dtInicioInput = (document.getElementById('user-pdf-inicio') as HTMLInputElement)?.value;
    const dtFimInput = (document.getElementById('user-pdf-fim') as HTMLInputElement)?.value;
    const tipoRelatorio = (document.getElementById('user-pdf-tipo') as HTMLSelectElement)?.value || 'detalhado';

    if (dtInicioInput) {
      const start = new Date(dtInicioInput + 'T00:00:00');
      combined = combined.filter(c => c.data_hora >= start);
    }
    if (dtFimInput) {
      const end = new Date(dtFimInput + 'T23:59:59');
      combined = combined.filter(c => c.data_hora <= end);
    }

    if (combined.length === 0) {
      mostrarToast('Nenhuma aferição no período selecionado.', 'error');
      btn.disabled = false;
      btn.innerHTML = `${PDF_ICON(16)} Exportar PDF`;
      return;
    }

    combined.sort((a, b) => a.timestamp - b.timestamp); // Mais antigos primeiro
    
    // Calcular estatísticas
    const nomeUsuario = userProfile?.nome || currentUser?.displayName || 'Paciente';
    const total = combined.length;
    
    const countPressao = afericoes.length;
    const mediaSys = countPressao > 0 ? Math.round(afericoes.reduce((s, a) => s + a.sys, 0) / countPressao) : '--';
    const mediaDia = countPressao > 0 ? Math.round(afericoes.reduce((s, a) => s + a.dia, 0) / countPressao) : '--';
    
    const countGlicemia = glicemias.length;
    const mediaGlicemia = countGlicemia > 0 ? Math.round(glicemias.reduce((s, g) => s + g.valor, 0) / countGlicemia) : '--';
    
    const ultimoPeso = pesos.length > 0 ? pesos[pesos.length - 1].peso + 'kg' : '--';

    const diasComAgua = new Set(aguaLogs.map(a => a.date_string)).size;
    const mediaAgua = diasComAgua > 0 ? Math.round(aguaLogs.reduce((acc, log) => acc + log.amount_ml, 0) / diasComAgua) : 0;
    const mediaAguaL = mediaAgua > 0 ? (mediaAgua / 1000).toFixed(1) + 'L' : '--';

    const analisesMap = new Map();
    analises.forEach(an => analisesMap.set(an.data_str, an.feedback));

    const groups: Record<string, any[]> = {};
    combined.forEach(item => {
      const dtStr = formatarData(item.data_hora);
      if (!groups[dtStr]) groups[dtStr] = [];
      groups[dtStr].push(item);
    });

    let linhasTabela = '';
    for (const [dtStr, itensDia] of Object.entries(groups)) {
      for (let i = 0; i < itensDia.length; i++) {
        const item = itensDia[i];
        const dt = formatarDataHora(item.data_hora);
        let tipo = '';
        let resultado = '';
        let classificacao = '';
        let contexto = '';

        if (item.tipo === 'pressao') {
          const a = item.original;
          const clf = classificarPressao(a.sys, a.dia);
          tipo = 'Pressão';
          resultado = `<span style="font-weight:700;color:#6366f1;">${a.sys} / ${a.dia} <span style="font-size:11px;color:#94a3b8;">mmHg</span></span>`;
          classificacao = obterBadgePDF(clf.label);
          contexto = `Pulso: ${a.pul} bpm`;
        } else if (item.tipo === 'glicemia') {
          const g = item.original;
          const clf = classificarGlicemia(g.valor, g.momento);
          tipo = 'Glicemia';
          resultado = `<span style="font-weight:700;color:#f59e0b;">${g.valor} <span style="font-size:11px;color:#94a3b8;">mg/dL</span></span>`;
          classificacao = obterBadgePDF(clf.label);
          contexto = `Momento: ${g.momento.charAt(0).toUpperCase() + g.momento.slice(1)}`;
        } else if (item.tipo === 'peso') {
          const p = item.original;
          tipo = 'Peso';
          resultado = `<span style="font-weight:700;color:#10b981;">${p.peso} <span style="font-size:11px;color:#94a3b8;">kg</span></span>`;
          classificacao = '--';
          contexto = 'Registro de Peso';
        }

        linhasTabela += `
          <tr>
            <td>${dt}</td>
            <td style="font-weight:600;color:#475569;">${tipo}</td>
            <td>${resultado}</td>
            <td>${classificacao}</td>
            <td style="color:#64748b;font-size:11.5px;line-height:1.4;">${contexto}</td>
          </tr>
        `;
      }
      
      if (tipoRelatorio === 'detalhado' && analisesMap.has(dtStr)) {
        linhasTabela += `
          <tr style="background-color: #f8fafc;">
            <td colspan="5" style="padding: 10px 14px; font-size: 11.5px; color: #475569; line-height: 1.5; border-bottom: 2px solid #e2e8f0;">
              <div style="font-weight: 700; color: #3b82f6; margin-bottom: 4px;">🩺 Resumo da IA (${dtStr}):</div>
              ${DOMPurify.sanitize(await marked.parse(String(analisesMap.get(dtStr) || '')))}
            </td>
          </tr>
        `;
      }
    }

    const dtInicioUser = combined[0].data_hora instanceof Date
      ? combined[0].data_hora
      : new Date((combined[0].data_hora as any).seconds * 1000);
    const dtFimUser = combined[combined.length - 1].data_hora instanceof Date
      ? combined[combined.length - 1].data_hora
      : new Date((combined[combined.length - 1].data_hora as any).seconds * 1000);
    const periodoStrUser = `${dtInicioUser.toLocaleDateString('pt-BR')} – ${dtFimUser.toLocaleDateString('pt-BR')}`;

    const wrapper = criarWrapperPDF();
    wrapper.innerHTML = `
      ${gerarHTMLCabecalhoPDF('Relatório de Histórico Unificado', `Período: ${periodoStrUser}`, nomeUsuario, [`Total de registros: ${total}`])}
      <div class="pdf-stats-grid" style="grid-template-columns:repeat(5,1fr);">
        <div class="pdf-stat-card">
          <div class="pdf-stat-value">${mediaSys}<span class="pdf-stat-unit">/</span>${mediaDia}</div>
          <div class="pdf-stat-label">Média Pressão (mmHg)</div>
        </div>
        <div class="pdf-stat-card">
          <div class="pdf-stat-value">${mediaGlicemia}<span class="pdf-stat-unit">mg/dL</span></div>
          <div class="pdf-stat-label">Média Glicemia</div>
        </div>
        <div class="pdf-stat-card">
          <div class="pdf-stat-value">${ultimoPeso}</div>
          <div class="pdf-stat-label">Último Peso</div>
        </div>
        <div class="pdf-stat-card">
          <div class="pdf-stat-value">${total}</div>
          <div class="pdf-stat-label">Medições (Total)</div>
        </div>
        <div class="pdf-stat-card">
          <div class="pdf-stat-value" style="color:#3b82f6;">${mediaAguaL}</div>
          <div class="pdf-stat-label">Média Água/dia</div>
        </div>
      </div>
      <div class="pdf-section-title">Registros Unificados (Pressão, Glicemia, Peso)</div>
      <table class="pdf-table">
        <thead><tr>
          <th>Data / Hora</th><th>Tipo</th><th>Resultado</th><th>Classificação</th><th>Contexto</th>
        </tr></thead>
        <tbody>${linhasTabela}</tbody>
      </table>
      ${gerarHTMLRodapePDF()}`;

    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    const dataFormatada = `${dia}-${mes}-${ano}`;
    await salvarPDF(wrapper, `historico-${nomeUsuario.trim().toUpperCase()}-${dataFormatada}.pdf`);
    mostrarToast('Histórico unificado exportado com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao exportar histórico unificado:', err);
    mostrarToast('Erro ao gerar o PDF.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${PDF_ICON(16)} Exportar PDF`;
  }
};

(window as any).exportarHistoricoAdminParaPDF = async () => {
  const nomeDoUsuario = document.getElementById('modal-hist-user-nome')?.textContent?.trim() || 'Usuário';
  const btn = document.getElementById('btn-exportar-admin-pdf') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = `${SPINNER_SVG(13)} Gerando...`;

  try {
    if (!_adminPdfUid) {
      mostrarToast('Erro: abra o histórico do usuário novamente.', 'error');
      return;
    }

    const afericoes = await buscarAfericoes(_adminPdfUid, 3650);
    const glicemias = await buscarGlicemias(_adminPdfUid, 3650);
    const pesos = await buscarHistoricoPeso(_adminPdfUid);
    const analises = await buscarAnalisesDiarias(_adminPdfUid);
    const aguaLogs = await buscarHistoricoAgua(_adminPdfUid);

    let combined: any[] = [];
    afericoes.forEach(a => combined.push({ tipo: 'pressao', id: a.id, timestamp: a.data_hora_afericao.getTime(), data_hora: a.data_hora_afericao, original: a }));
    glicemias.forEach(g => combined.push({ tipo: 'glicemia', id: g.id, timestamp: g.data_hora_afericao.getTime(), data_hora: g.data_hora_afericao, original: g }));
    pesos.forEach(p => combined.push({ tipo: 'peso', id: p.id, timestamp: p.data.getTime(), data_hora: p.data, original: p }));

    if (combined.length === 0) {
      mostrarToast('Este usuário não possui aferições registradas.', 'error');
      return;
    }

    const dtInicioInput = (document.getElementById('admin-pdf-inicio') as HTMLInputElement)?.value;
    const dtFimInput = (document.getElementById('admin-pdf-fim') as HTMLInputElement)?.value;
    const tipoRelatorio = (document.getElementById('admin-pdf-tipo') as HTMLSelectElement)?.value || 'detalhado';

    if (dtInicioInput) {
      const start = new Date(dtInicioInput + 'T00:00:00');
      combined = combined.filter(c => c.data_hora >= start);
    }
    if (dtFimInput) {
      const end = new Date(dtFimInput + 'T23:59:59');
      combined = combined.filter(c => c.data_hora <= end);
    }

    if (combined.length === 0) {
      mostrarToast('Nenhuma aferição no período selecionado.', 'error');
      btn.disabled = false;
      btn.innerHTML = `${PDF_ICON(13)} Exportar PDF`;
      return;
    }

    combined.sort((a, b) => a.timestamp - b.timestamp); // Mais antigos primeiro

    const total = combined.length;
    
    // Estatísticas focadas em pressão para a visão administrativa
    const countPressao = afericoes.length;
    const mediaSys = countPressao > 0 ? Math.round(afericoes.reduce((s, a) => s + a.sys, 0) / countPressao) : 0;
    const mediaDia = countPressao > 0 ? Math.round(afericoes.reduce((s, a) => s + a.dia, 0) / countPressao) : 0;
    const normalCount = countPressao > 0 ? afericoes.filter(a => classificarPressao(a.sys, a.dia).label.toLowerCase().includes('normal')).length : 0;
    
    const countGlicemia = glicemias.length;
    const mediaGlicemia = countGlicemia > 0 ? Math.round(glicemias.reduce((s, g) => s + g.valor, 0) / countGlicemia) : '--';
    
    const ultimoPeso = pesos.length > 0 ? pesos[pesos.length - 1].peso + 'kg' : '--';

    const diasComAgua = new Set(aguaLogs.map(a => a.date_string)).size;
    const mediaAgua = diasComAgua > 0 ? Math.round(aguaLogs.reduce((acc, log) => acc + log.amount_ml, 0) / diasComAgua) : 0;
    const mediaAguaL = mediaAgua > 0 ? (mediaAgua / 1000).toFixed(1) + 'L' : '--';

    const sortedAfericoes = [...afericoes].sort((a, b) => a.data_hora_afericao.getTime() - b.data_hora_afericao.getTime());
    
    const dtInicio = combined[0].data_hora instanceof Date
      ? combined[0].data_hora
      : new Date((combined[0].data_hora as any).seconds * 1000);
    const dtFim = combined[combined.length - 1].data_hora instanceof Date
      ? combined[combined.length - 1].data_hora
      : new Date((combined[combined.length - 1].data_hora as any).seconds * 1000);
    const periodoStr = `${dtInicio.toLocaleDateString('pt-BR')} – ${dtFim.toLocaleDateString('pt-BR')}`;

    const clfMedia = classificarPressao(mediaSys, mediaDia);

    const dist: Record<string, number> = {};
    afericoes.forEach(a => {
      const lbl = classificarPressao(a.sys, a.dia).label;
      dist[lbl] = (dist[lbl] || 0) + 1;
    });
    const distRows = Object.entries(dist).map(([lbl, cnt]) => `
      <tr>
        <td>${obterBadgePDF(lbl)}</td>
        <td style="text-align:center;font-weight:700;">${cnt}</td>
        <td style="text-align:center;color:#64748b;">${countPressao > 0 ? Math.round((cnt / countPressao) * 100) : 0}%</td>
      </tr>`).join('');

    const analisesMap = new Map();
    analises.forEach(an => analisesMap.set(an.data_str, an.feedback));

    const groups: Record<string, any[]> = {};
    combined.forEach(item => {
      const dtStr = formatarData(item.data_hora);
      if (!groups[dtStr]) groups[dtStr] = [];
      groups[dtStr].push(item);
    });

    let linhasTabela = '';
    for (const [dtStr, itensDia] of Object.entries(groups)) {
      for (let i = 0; i < itensDia.length; i++) {
        const item = itensDia[i];
        const dt = formatarDataHora(item.data_hora);
        let tipo = '';
        let resultado = '';
        let classificacao = '';
        let contexto = '';

        if (item.tipo === 'pressao') {
          const a = item.original;
          const clf = classificarPressao(a.sys, a.dia);
          tipo = 'Pressão';
          resultado = `<span style="font-weight:700;color:#6366f1;">${a.sys} / ${a.dia} <span style="font-size:11px;color:#94a3b8;">mmHg</span></span>`;
          classificacao = obterBadgePDF(clf.label);
          contexto = `Pulso: ${a.pul} bpm`;
        } else if (item.tipo === 'glicemia') {
          const g = item.original;
          const clf = classificarGlicemia(g.valor, g.momento);
          tipo = 'Glicemia';
          resultado = `<span style="font-weight:700;color:#f59e0b;">${g.valor} <span style="font-size:11px;color:#94a3b8;">mg/dL</span></span>`;
          classificacao = obterBadgePDF(clf.label);
          contexto = `Momento: ${g.momento.charAt(0).toUpperCase() + g.momento.slice(1)}`;
        } else if (item.tipo === 'peso') {
          const p = item.original;
          tipo = 'Peso';
          resultado = `<span style="font-weight:700;color:#10b981;">${p.peso} <span style="font-size:11px;color:#94a3b8;">kg</span></span>`;
          classificacao = '--';
          contexto = 'Registro de Peso';
        }

        linhasTabela += `
          <tr>
            <td>${dt}</td>
            <td style="font-weight:600;color:#475569;">${tipo}</td>
            <td>${resultado}</td>
            <td>${classificacao}</td>
            <td style="color:#64748b;font-size:11px;line-height:1.4;">${contexto}</td>
          </tr>
        `;
      }
      
      if (tipoRelatorio === 'detalhado' && analisesMap.has(dtStr)) {
        linhasTabela += `
          <tr style="background-color: #f8fafc;">
            <td colspan="5" style="padding: 8px 12px; font-size: 11px; color: #475569; line-height: 1.4; border-bottom: 2px solid #e2e8f0;">
              <div style="font-weight: 700; color: #3b82f6; margin-bottom: 4px;">🩺 Resumo da IA (${dtStr}):</div>
              ${DOMPurify.sanitize(await marked.parse(String(analisesMap.get(dtStr) || '')))}
            </td>
          </tr>
        `;
      }
    }

    const wrapper = criarWrapperPDF();
    wrapper.innerHTML = `
      ${gerarHTMLCabecalhoPDF(
        'Relatório Clínico Unificado — Visão Admin',
        `Período: ${periodoStr} • Painel Administrativo`,
        nomeDoUsuario,
        [
          `Total de medições: ${total}`,
          `Emitido por: ${userProfile?.nome || 'Administrador'}`,
        ]
      )}

      <div class="pdf-stats-grid" style="grid-template-columns:repeat(5,1fr);">
        <div class="pdf-stat-card">
          <div class="pdf-stat-value">${mediaSys > 0 ? mediaSys : '--'}<span class="pdf-stat-unit">/</span>${mediaDia > 0 ? mediaDia : '--'}</div>
          <div class="pdf-stat-label">Média Pressão</div>
        </div>
        <div class="pdf-stat-card">
          <div class="pdf-stat-value">${mediaGlicemia}<span class="pdf-stat-unit">mg/dL</span></div>
          <div class="pdf-stat-label">Média Glicemia</div>
        </div>
        <div class="pdf-stat-card">
          <div class="pdf-stat-value">${ultimoPeso}</div>
          <div class="pdf-stat-label">Último Peso</div>
        </div>
        <div class="pdf-stat-card">
          <div class="pdf-stat-value">${total}</div>
          <div class="pdf-stat-label">Medições (Total)</div>
        </div>
        <div class="pdf-stat-card">
          <div class="pdf-stat-value" style="color:#3b82f6;">${mediaAguaL}</div>
          <div class="pdf-stat-label">Média Água/dia</div>
        </div>
      </div>

      ${countPressao > 0 ? `
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Classificação Média OMS (Pressão)</div>
          <div style="font-size:28px;font-weight:800;color:#6366f1;letter-spacing:-1px;">${mediaSys} / ${mediaDia}</div>
          <div style="margin-top:8px;">${obterBadgePDF(clfMedia.label)}</div>
          <div style="margin-top:8px;font-size:11.5px;color:#64748b;">Índice de normalidade: <strong style="color:#16a34a;">${Math.round((normalCount / countPressao) * 100)}%</strong></div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Distribuição por Categoria (Pressão)</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <thead><tr>
              <th style="text-align:left;font-size:10px;color:#94a3b8;padding-bottom:6px;">Categoria</th>
              <th style="text-align:center;font-size:10px;color:#94a3b8;padding-bottom:6px;">Qtd</th>
              <th style="text-align:center;font-size:10px;color:#94a3b8;padding-bottom:6px;">%</th>
            </tr></thead>
            <tbody>${distRows}</tbody>
          </table>
        </div>
      </div>
      
      <div class="pdf-section-title">Dashboard — Evolução Temporal da Pressão e Pulso</div>
      ${gerarSVGGrafico(sortedAfericoes)}
      ` : ''}

      <div class="pdf-section-title">Histórico Completo de Aferições</div>
      <table class="pdf-table">
        <thead><tr>
          <th>Data / Hora</th><th>Tipo</th><th>Resultado</th><th>Classificação</th><th>Contexto</th>
        </tr></thead>
        <tbody>${linhasTabela}</tbody>
      </table>

      ${gerarHTMLRodapePDF()}`;

    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    const dataFormatada = `${dia}-${mes}-${ano}`;
    await salvarPDF(wrapper, `historico-admin-${nomeDoUsuario.trim().toUpperCase()}-${dataFormatada}.pdf`);
    mostrarToast('Relatório exportado com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao exportar relatório admin:', err);
    mostrarToast('Erro ao gerar o PDF.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${PDF_ICON(13)} Exportar PDF`;
  }
};


// ── Observer de autenticação ───────────────────────────────────
// ── Inicialização da autenticação ────────────────────────────────────────────
// Estratégia:
//   • Em LOCALHOST: loginComGoogle usa signInWithPopup → onAuthStateChanged
//     dispara diretamente com user != null. processarRedirectGoogle retorna null
//     imediatamente (sem overhead).
//   • Em PRODUÇÃO (HTTPS): loginComGoogle usa signInWithRedirect → ao voltar,
//     processarRedirectGoogle() chama getRedirectResult() para processar o token
//     antes do observer, garantindo que user != null quando o observer disparar.
//
// O onAuthStateChanged é a ÚNICA fonte de verdade do estado de autenticação.
(async () => {
  // 1) Mostrar loading enquanto processa possível redirect pendente
  mostrarTela('loading-screen');

  // 2) Em produção: aguardar processamento do token de redirect antes do observer.
  //    Em localhost: retorna null imediatamente (popup flow não tem redirect).
  await processarRedirectGoogle();

  // 3) Registrar o observer — fonte de verdade do estado de autenticação.
  //    Após processarRedirectGoogle(), a sessão já está injetada no Firebase Auth
  //    (em produção) ou já estava (em localhost após popup bem-sucedido).
  observarAutenticacao(async (user) => {
    if (!user) {
      mostrarTela('auth-screen');
      return;
    }
    currentUser = user;
    try {
      const perfil = await buscarPerfilUsuario(user.uid);
      if (!perfil) {
        // Novo usuário — precisa aceitar termos ANTES do onboarding
        // Pré-preencher nome do onboarding se vier do Google
        const nomeInput = document.getElementById('ob-nome') as HTMLInputElement;
        if (nomeInput && user.displayName) {
          nomeInput.value = user.displayName;
        }
        // Sinalizar que após os termos deve ir para onboarding
        (window as any)._termsNextStep = 'onboarding';
        mostrarTela('terms-screen');
      } else {
        userProfile = perfil;
        if (userProfile.status === 'Suspenso' || userProfile.status === 'Inativo') {
          document.getElementById('blocked-msg')!.textContent = 'Sua conta foi suspensa temporariamente. Entre em contato com o suporte.';
          mostrarTela('blocked-screen');
        } else if (!perfil.termos_aceitos || perfil.termos_versao !== TERMOS_VERSAO_ATUAL) {
          // Usuário existente sem termos aceitos (ou versão desatualizada)
          (window as any)._termsNextStep = 'app';
          mostrarTela('terms-screen');
        } else {
          iniciarApp();
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar perfil do usuário:', err);
      mostrarToast('Erro de permissão no banco de dados. Verifique as regras do Firestore.', 'error');
      mostrarTela('onboarding-screen');
    }
  });
})();

// ================= WATER CARD =================
function atualizarUIWaterCard() {
  const amountEl = document.getElementById('water-amount-text');
  const barEl = document.getElementById('water-progress-bar');
  const metaEl = document.getElementById('water-meta-text');
  
  let percentage = 0;
  if (metaAgua > 0) {
    percentage = (aguaHoje / metaAgua) * 100;
  }

  if (metaEl) {
    const metaLitros = (metaAgua / 1000).toFixed(1).replace('.0', '');
    metaEl.textContent = `Meta: ${metaLitros}L`;
    
    if (percentage >= 100) {
      metaEl.style.background = '#d1fae5'; // emerald-100
      metaEl.style.color = '#047857'; // emerald-700
      metaEl.style.borderColor = '#a7f3d0'; // emerald-200
    } else if (percentage >= 50) {
      metaEl.style.background = '#bfdbfe'; // blue-200 (Azul mais forte para >50%)
      metaEl.style.color = '#1e3a8a'; // blue-950
      metaEl.style.borderColor = '#93c5fd'; // blue-300
    } else {
      metaEl.style.background = '#dbeafe'; // blue-100 (Azul inicial para <50%)
      metaEl.style.color = '#1e40af'; // blue-900
      metaEl.style.borderColor = '#bfdbfe'; // blue-200
    }
  }
  
  if (!amountEl || !barEl) return;
  
  amountEl.textContent = String(aguaHoje);
  
  let barPercentage = percentage;
  if (barPercentage > 100) barPercentage = 100;
  barEl.style.width = barPercentage + '%';
  
  // Mudar cor se atingiu a meta
  if (aguaHoje >= metaAgua) {
    barEl.style.background = '#10B981'; // Green
  } else {
    barEl.style.background = 'var(--primary)'; // Blue
  }
}

(window as any).adicionarAgua = async (amount: number) => {
  if (!currentUser) return;
  aguaHoje += amount;
  atualizarUIWaterCard();
  
  try {
    const d = new Date();
    const hojeStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    await salvarAguaDoDia(currentUser.uid, hojeStr, aguaHoje, metaAgua);
    
    await carregarHistoricoAgua();
  } catch (e) {
    console.error(e);
  }
};

(window as any).adicionarAguaPersonalizada = () => {
  const inputEl = document.getElementById('water-custom-input') as HTMLInputElement;
  if (!inputEl) return;
  const amt = inputEl.value;
  if (amt && !isNaN(Number(amt))) {
    const val = Number(amt);
    if (val > 0) {
      (window as any).adicionarAgua(val);
      inputEl.value = '';
    }
  }
};

let waterWeekOffset = 0;

async function carregarHistoricoAgua() {
  if (!currentUser) return;
  const canvas = document.getElementById('water-history-chart') as HTMLCanvasElement;
  if (!canvas) return;

  try {
    const logs = await buscarHistoricoAgua(currentUser.uid, 7, waterWeekOffset * 7);
    
    // Ordena do mais antigo para o mais novo (esquerda para direita no gráfico)
    const sortedLogs = [...logs].reverse();
    
    if (waterChart) waterChart.destroy();
    
    const labels = sortedLogs.map(log => {
      const parts = log.date_string.split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : log.date_string;
    });
    
    const consumidoData = sortedLogs.map(log => log.amount_ml);
    const metaData = sortedLogs.map(log => log.meta_ml);

    waterChart = new Chart(canvas, {
      data: {
        labels: labels.length > 0 ? labels : ['Sem dados'],
        datasets: [
          {
            type: 'bar',
            label: 'Consumido',
            data: consumidoData.length > 0 ? consumidoData : [0],
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 16
          },
          {
            type: 'line',
            label: 'Meta',
            data: metaData.length > 0 ? metaData : [metaAgua],
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#8899BB', font: { size: 9 } },
            grid: { display: false }
          },
          y: {
            ticks: { color: '#8899BB', font: { size: 9 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            beginAtZero: true
          }
        }
      }
    });

    // Atualizar rótulo do período e botões
    const periodLabelEl = document.getElementById('water-period-label');
    const btnNext = document.getElementById('btn-water-next-week') as HTMLButtonElement | null;

    if (periodLabelEl) {
      if (waterWeekOffset === 0) {
        periodLabelEl.innerText = 'Últimos 7 dias';
      } else if (waterWeekOffset === 1) {
        periodLabelEl.innerText = 'Semana anterior';
      } else {
        periodLabelEl.innerText = `${waterWeekOffset} sem. atrás`;
      }
    }

    if (btnNext) {
      btnNext.disabled = waterWeekOffset <= 0;
      btnNext.style.opacity = waterWeekOffset <= 0 ? '0.3' : '1';
      btnNext.style.cursor = waterWeekOffset <= 0 ? 'default' : 'pointer';
    }

    // Atualizar os cards de Médias da semana visualizada
    const totalIngerido = logs.reduce((acc, l) => acc + (l.amount_ml || 0), 0);
    const mediaDiaria = logs.length > 0 ? Math.round(totalIngerido / logs.length) : 0;
    const diasMetaAtingida = logs.filter(l => l.amount_ml >= l.meta_ml && l.meta_ml > 0).length;

    const avgDailyEl = document.getElementById('avg-water-daily');
    const avgTargetEl = document.getElementById('avg-water-target-days');
    const avgTotalEl = document.getElementById('avg-water-total');

    if (avgDailyEl) avgDailyEl.innerText = mediaDiaria.toLocaleString('pt-BR');
    if (avgTargetEl) avgTargetEl.innerText = `${diasMetaAtingida}/${logs.length || 7}`;
    if (avgTotalEl) avgTotalEl.innerText = (totalIngerido / 1000).toFixed(1).replace('.', ',');

  } catch (err) {
    console.error('Erro ao carregar gráfico de água:', err);
  }
}

(window as any).navegarSemanaAgua = async (dir: number) => {
  waterWeekOffset += dir;
  if (waterWeekOffset < 0) waterWeekOffset = 0;
  await carregarHistoricoAgua();
};

(window as any).toggleWaterHistory = async () => {
  const historySec = document.getElementById('water-history-section');
  const btn = document.getElementById('btn-toggle-water-history');
  if (!historySec || !btn) return;

  if (historySec.style.display === 'none') {
    historySec.style.display = 'block';
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      Fechar
    `;
    await carregarHistoricoAgua();
  } else {
    historySec.style.display = 'none';
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
      Histórico
    `;
  }
};

// ── Funcionalidade Sobre/Ajuda ──────────────────────────────
(window as any).abrirModalSobre = () => {
  document.getElementById('modal-sobre')?.classList.remove('hidden');
};

(window as any).fecharModalSobre = () => {
  document.getElementById('modal-sobre')?.classList.add('hidden');
};

// ── Funcionalidade de Medicações ──────────────────────────────
(window as any).toggleMedicationDates = () => {
  const tipo = (document.getElementById('m-tipo') as HTMLSelectElement).value;
  const container = document.getElementById('m-datas-container');
  const mInicio = document.getElementById('m-inicio') as HTMLInputElement;
  const mDias = document.getElementById('m-dias') as HTMLInputElement;
  
  if (tipo === 'Temporario') {
    container?.classList.remove('hidden');
    mInicio.required = true;
    mDias.required = true;
    if (!mInicio.value) {
      mInicio.value = new Date().toISOString().split('T')[0];
    }
  } else {
    container?.classList.add('hidden');
    mInicio.required = false;
    mDias.required = false;
  }
};

(window as any).abrirModalMedicacao = () => {
  medicacaoEditandoId = null;
  const title = document.getElementById('modal-medicacao-title');
  if (title) title.innerText = 'Nova Medicação';
  document.getElementById('modal-medicacao')?.classList.remove('hidden');
  (window as any).toggleMedicationDates();
};

(window as any).editarMedicationId = (id: string) => {
  medicacaoEditandoId = id;
  const med = medications.find(m => m.id === id);
  if (!med) return;

  const title = document.getElementById('modal-medicacao-title');
  if (title) title.innerText = 'Editar Medicação';

  (document.getElementById('m-nome') as HTMLInputElement).value = med.nome;
  (document.getElementById('m-dosagem') as HTMLInputElement).value = med.dosagem;
  (document.getElementById('m-freq') as HTMLInputElement).value = med.frequencia;
  (document.getElementById('m-tipo') as HTMLSelectElement).value = med.tipo;
  
  if (med.tipo === 'Temporario' && med.data_inicio && med.data_fim) {
    (document.getElementById('m-inicio') as HTMLInputElement).value = med.data_inicio.toISOString().split('T')[0];
    const dias = Math.round((med.data_fim.getTime() - med.data_inicio.getTime()) / (1000 * 3600 * 24));
    (document.getElementById('m-dias') as HTMLInputElement).value = dias.toString();
  }

  document.getElementById('modal-medicacao')?.classList.remove('hidden');
  (window as any).toggleMedicationDates();
};

(window as any).fecharModalMedicacao = () => {
  document.getElementById('modal-medicacao')?.classList.add('hidden');
  (document.getElementById('form-medicacao') as HTMLFormElement)?.reset();
  medicacaoEditandoId = null;
};

const formMedicacao = document.getElementById('form-medicacao');
if (formMedicacao) {
  formMedicacao.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const btn = formMedicacao.querySelector('button[type="submit"]') as HTMLButtonElement;
    const oldText = btn.innerHTML;
    btn.innerHTML = 'Salvando...';
    btn.disabled = true;

    try {
      const nome = (document.getElementById('m-nome') as HTMLInputElement).value;
      const dosagem = (document.getElementById('m-dosagem') as HTMLInputElement).value;
      const frequencia = (document.getElementById('m-freq') as HTMLInputElement).value;
      const tipo = (document.getElementById('m-tipo') as HTMLSelectElement).value as 'Continuo'|'Temporario';
      
      let data_inicio: Date | undefined;
      let data_fim: Date | undefined;
      
      if (tipo === 'Temporario') {
        const strInicio = (document.getElementById('m-inicio') as HTMLInputElement).value;
        const strDias = (document.getElementById('m-dias') as HTMLInputElement).value;
        if (strInicio && strDias) {
          data_inicio = new Date(strInicio + 'T12:00:00'); // Meio dia p/ evitar timezone issues
          data_fim = new Date(data_inicio);
          data_fim.setDate(data_fim.getDate() + parseInt(strDias));
        }
      }

      if (medicacaoEditandoId) {
        const payload: Partial<Medication> = {
          nome, dosagem, frequencia, tipo
        };
        // Para update, Firebase aceita atualizar campo existente
        // Mas se mudou de Temporario para Continuo e queremos remover data_fim/data_inicio
        // Precisaríamos enviar deleteField() (do firestore), mas para simplificar, apenas reescrevemos com null ou ignoramos
        // Para contornar e manter simples, mandaremos as datas apenas se existirem.
        // Se mudou pra contínuo, a lógica na tela de leitura vai ignorar as datas antigas devido a m.tipo === 'Continuo'
        if (data_inicio) payload.data_inicio = data_inicio;
        if (data_fim) payload.data_fim = data_fim;
        
        await atualizarMedication(medicacaoEditandoId, payload);
        mostrarToast('Medicação atualizada com sucesso!', 'success');
      } else {
        const payload: Omit<Medication, 'id'> = {
          user_id: currentUser.uid,
          nome, dosagem, frequencia, tipo,
          ativa: true,
          data_criacao: new Date()
        };
        if (data_inicio) payload.data_inicio = data_inicio;
        if (data_fim) payload.data_fim = data_fim;
        await salvarMedication(payload);
        mostrarToast('Medicação salva com sucesso!', 'success');
      }

      (window as any).fecharModalMedicacao();
      await (window as any).carregarMedications();
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao salvar medicação', 'error');
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  });
}

(window as any).carregarMedications = async () => {
  if (!currentUser) return;
  try {
    medications = await buscarMedications(currentUser.uid);
    const list = document.getElementById('medications-list');
    if (!list) return;

    if (medications.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center;">Nenhuma medicação cadastrada.</p>';
      return;
    }

    list.innerHTML = medications.map(m => {
      let status = '';
      let opacity = '1';
      if (m.tipo === 'Temporario' && m.data_fim) {
        if (new Date() > m.data_fim) {
          status = ' <span style="background:var(--border); color:var(--text-muted); padding:2px 6px; border-radius:4px; font-size:10px; margin-left:4px;">Concluído</span>';
          opacity = '0.6';
        } else {
          const diasFaltam = Math.ceil((m.data_fim.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
          status = ` <span style="background:var(--primary); color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:4px;">Faltam ${diasFaltam} dias</span>`;
        }
      }
      
      return `
      <div style="background:var(--surface); border:1px solid var(--border); padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; opacity:${opacity};">
        <div>
          <div style="font-weight:600; color:var(--text); font-size:14px;">${m.nome} <span style="font-size:12px; font-weight:normal; color:var(--text-muted); margin-left:4px;">${m.dosagem}</span></div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${m.frequencia} • ${m.tipo === 'Continuo' ? 'Uso Contínuo' : 'Uso Temporário'} ${status}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" style="color:var(--primary); padding:4px;" onclick="editarMedicationId('${m.id}')" title="Editar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost" style="color:var(--danger); padding:4px;" onclick="excluirMedicationId('${m.id}')" title="Excluir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `}).join('');
  } catch(e) {
    console.error(e);
  }
};

(window as any).excluirMedicationId = (id: string) => {
  abrirModalConfirmacao('Excluir Medicação', 'Tem certeza que deseja excluir esta medicação?', async () => {
    try {
      await excluirMedication(id);
      mostrarToast('Medicação excluída!', 'success');
      await (window as any).carregarMedications();
    } catch(e) {
      console.error(e);
      mostrarToast('Erro ao excluir', 'error');
    }
  });
};

// ── Funcionalidade de Reprocessar IA ──────────────────────────
(window as any).reprocessarIADoDia = async (dataStr: string) => {
  if (!currentUser) return;
  const btnId = `btn-reprocess-day-${dataStr.replace(/\//g, '-')}`;
  const btn = document.getElementById(btnId);
  const textEl = document.getElementById(`ai-feedback-text-${dataStr.replace(/\//g, '-')}`);
  
  if (btn) btn.innerHTML = '<span class="ocr-spinner" style="width:12px;height:12px;border-width:2px;display:inline-block"></span>';
  
  try {
    const groups = (window as any).histDataGroups;
    if (!groups || !groups[dataStr]) {
      throw new Error('Dados do dia não encontrados');
    }
    const records = groups[dataStr];
    const feedback = await gerarAnaliseDiariaIA(records, dataStr, currentUser.uid);
    
    if (textEl) textEl.innerHTML = DOMPurify.sanitize(await marked.parse(String(feedback)));
    if (btn) btn.innerHTML = 'Atualizar IA do Dia';
    mostrarToast('Análise diária concluída!', 'success');
  } catch (e) {
    console.error(e);
    mostrarToast('Erro ao reprocessar IA do dia', 'error');
    if (btn) btn.innerHTML = 'Reprocessar IA';
  }
};

// ================= MODAL ESCOLHA DE REGISTRO =================
(window as any).abrirModalEscolhaRegistro = () => {
  if (userProfile?.role === 'ADMIN') {
    mostrarToast('Administradores não registram aferições.', 'error');
    return;
  }
  if (userProfile?.status === 'Inativo') {
    mostrarToast('Sua conta está desativada.', 'error');
    return;
  }
  
  // Agora todos os usuários podem registrar tanto Pressão quanto Glicemia preventivamente.
  document.getElementById('modal-escolha-registro')?.classList.remove('hidden');
};

(window as any).fecharModalEscolhaRegistro = () => {
  document.getElementById('modal-escolha-registro')?.classList.add('hidden');
};

(window as any).abrirPressaoDeEscolha = () => {
  (window as any).fecharModalEscolhaRegistro();
  (window as any).abrirModalAfericao();
};

(window as any).abrirGlicemiaDeEscolha = () => {
  (window as any).fecharModalEscolhaRegistro();
  (window as any).abrirModalGlicemia();
};

(window as any).abrirAguaDeEscolha = () => {
  (window as any).fecharModalEscolhaRegistro();
  (window as any).abrirModalAgua();
};

(window as any).abrirModalAgua = () => {
  if (userProfile?.status === 'Inativo') {
    mostrarToast('Sua conta está desativada.', 'error');
    return;
  }
  document.getElementById('modal-agua')?.classList.remove('hidden');
};

(window as any).fecharModalAgua = () => {
  document.getElementById('modal-agua')?.classList.add('hidden');
};

(window as any).adicionarAguaRapido = (amount: number) => {
  (window as any).adicionarAgua(amount);
  (window as any).fecharModalAgua();
};

(window as any).adicionarAguaModalPersonalizada = () => {
  const inputEl = document.getElementById('water-modal-input') as HTMLInputElement;
  if (!inputEl) return;
  const amt = inputEl.value;
  if (amt && !isNaN(Number(amt))) {
    const val = Number(amt);
    if (val > 0) {
      (window as any).adicionarAgua(val);
      inputEl.value = '';
      (window as any).fecharModalAgua();
    }
  }
};

// ================= GLICEMIA FUNCTIONS =================
(window as any).abrirModalGlicemia = () => {
  if (userProfile?.status === 'Inativo') {
    mostrarToast('Sua conta está desativada.', 'error');
    return;
  }
  document.getElementById('modal-glicemia')?.classList.remove('hidden');
  
  // Set current datetime
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  (document.getElementById('g-datetime') as HTMLInputElement).value = now.toISOString().slice(0, 16);
  (document.getElementById('g-valor') as HTMLInputElement).value = '';
  document.getElementById('g-form-error')?.classList.add('hidden');
};

(window as any).fecharModalGlicemia = () => {
  document.getElementById('modal-glicemia')?.classList.add('hidden');
};

(window as any).salvarGlicemiaModal = async () => {
  const valor = Number((document.getElementById('g-valor') as HTMLInputElement).value);
  const momento = (document.getElementById('g-momento') as HTMLSelectElement).value as any;
  const dtStr = (document.getElementById('g-datetime') as HTMLInputElement).value;
  const errEl = document.getElementById('g-form-error')!;

  if (!valor || !dtStr) {
    errEl.textContent = 'Preencha todos os campos.';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');

  const btn = document.getElementById('btn-salvar-glicemia') as HTMLButtonElement;
  btn.disabled = true;
  document.getElementById('btn-salvar-glicemia-icon')!.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>';

  let dataHora: Date;
  if (dtStr.includes('/')) {
    const parts = dtStr.split(/[\s/:]+/);
    if (parts.length >= 5) {
      dataHora = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), Number(parts[3]), Number(parts[4]));
    } else {
      dataHora = new Date();
    }
  } else {
    dataHora = new Date(dtStr);
  }

  try {
    const leitura: Omit<GlicemiaReading, 'id'> = {
      user_id: currentUser.uid,
      valor,
      momento,
      data_hora_afericao: dataHora,
    };

    const id = await salvarGlicemia(leitura);
    mostrarToast('Glicemia salva com sucesso!', 'success');
    (window as any).fecharModalGlicemia();
    
    // Se estiver na página de glicemia, atualiza ela
    const pageGlicemia = document.getElementById('page-glicemia');
    if (pageGlicemia && !pageGlicemia.classList.contains('hidden')) {
      carregarGlicemiaPage();
    }

    // Gerar IA feedback em background
    if (userProfile) {
      const hist = await buscarGlicemias(currentUser.uid, 30);
      const feedback = await gerarFeedbackGlicemiaIA({ ...leitura, id }, userProfile, hist, medications);
      await atualizarFeedbackGlicemiaIA(id, feedback);
      
      if (pageGlicemia && !pageGlicemia.classList.contains('hidden')) {
        carregarGlicemiaPage();
      }
      mostrarToast('Análise de glicemia da IA disponível!', 'info');
    }
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao salvar glicemia.', 'error');
  } finally {
    btn.disabled = false;
    document.getElementById('btn-salvar-glicemia-icon')!.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  }
};

async function carregarGlicemiaPage() {
  const emptyEl = document.getElementById('glicemia-empty')!;
  const dataEl = document.getElementById('glicemia-data')!;

  try {
    glicemias = await buscarGlicemias(currentUser.uid, 30);
    
    if (glicemias.length === 0) {
      emptyEl.classList.remove('hidden');
      dataEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    dataEl.classList.remove('hidden');

    const ultima = glicemias[0];
    document.getElementById('last-glicemia-val')!.textContent = String(ultima.valor);
    
    const momentosMap: Record<string, string> = {
      jejum: 'Em Jejum',
      pos_prandial: 'Pós-Prandial',
      antes_dormir: 'Antes de Dormir',
      aleatorio: 'Aleatório'
    };
    document.getElementById('last-glicemia-momento')!.textContent = momentosMap[ultima.momento] || ultima.momento;

    const clf = classificarGlicemia(ultima.valor, ultima.momento);
    const badge = document.getElementById('last-glicemia-classification')!;
    badge.textContent = `${clf.emoji} ${clf.label}`;
    badge.style.background = clf.cor + '22';
    badge.style.color = clf.cor;
    badge.style.borderColor = clf.cor + '44';

    const feedbackEl = document.getElementById('last-glicemia-ai-feedback')!;
    if (ultima.ai_feedback) {
      feedbackEl.classList.remove('hidden');
      document.getElementById('glicemia-ai-feedback-text')!.textContent = ultima.ai_feedback;
    } else {
      feedbackEl.classList.add('hidden');
    }


    setTimeout(() => {
      renderizarGraficoGlicemia(glicemias.slice().reverse().slice(-30));
    }, 50);

  } catch (err) {
    console.error('Erro ao carregar glicemias:', err);
  }
}

function renderizarGraficoGlicemia(dados: GlicemiaReading[]) {
  const canvas = document.getElementById('glicemia-chart') as HTMLCanvasElement;
  if (!canvas) return;
  if (glicemiaChart) glicemiaChart.destroy();

  glicemiaChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dados.map(d => {
        const dt = d.data_hora_afericao;
        return `${dt.getDate()}/${dt.getMonth()+1}`;
      }),
      datasets: [
        {
          label: 'Glicemia (mg/dL)',
          data: dados.map(d => d.valor),
          borderColor: '#F59E0B',
          backgroundColor: '#F59E0B22',
          tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#8899BB', font: { size: 10 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#8899BB', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          min: 40
        }
      },
      interaction: { mode: 'index', intersect: false }
    }
  });
}

// Fechar modal ao clicar fora
document.getElementById('modal-glicemia')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-glicemia')) {
    (window as any).fecharModalGlicemia();
  }
});
document.getElementById('modal-escolha-registro')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-escolha-registro')) {
    (window as any).fecharModalEscolhaRegistro();
  }
});

// Sobrescrever a função do Laudo para dar suporte integrado
const oldGerarLaudoTela = (window as any).gerarLaudoTela;
(window as any).gerarLaudoTela = async () => {
  if (!userProfile) return;
  
  const isDiabetico = !!userProfile.diabetico;
  const isHipertenso = userProfile.hipertenso !== false;

  // Se for hipertenso e diabético, usa a lógica de laudo integrado
  if (isHipertenso && isDiabetico) {
    const dias = Number((document.getElementById('laudo-periodo') as HTMLSelectElement).value);
    const btn = document.getElementById('btn-gerar-laudo') as HTMLButtonElement;
    const container = document.getElementById('laudo-resultado-container')!;
    const content = document.getElementById('laudo-resultado-content')!;

    btn.disabled = true;
    btn.innerHTML = `
      <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; animation: spin 1s linear infinite;">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Analisando histórico integrado...
    `;
    container.classList.add('hidden');

    try {
      // Buscar séries
      const pressaoSeries = await buscarAfericoes(currentUser.uid, dias);
      const glicemiaSeries = await buscarGlicemias(currentUser.uid, dias);

      if (pressaoSeries.length === 0 && glicemiaSeries.length === 0) {
        mostrarToast('Sem medições suficientes para gerar o laudo.', 'error');
        return;
      }

      const markdownText = await gerarLaudoIntegradoIA(pressaoSeries, glicemiaSeries, userProfile, medications, dias);
      content.innerHTML = DOMPurify.sanitize(await marked.parse(markdownText));
      
      const dataAtual = new Date();
      const dataFormatada = dataAtual.toLocaleDateString('pt-BR') + ' às ' + dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('laudo-data-geracao')!.innerText = `Gerado em ${dataFormatada}`;
      
      container.classList.remove('hidden');
      await carregarLaudos();
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao gerar laudo integrado.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Analisar Histórico e Gerar Conduta';
    }
  } else {
    // Caso contrário usa o laudo padrão OMS
    await oldGerarLaudoTela();
  }
};

// ── IMC e Peso ──────────────────────────────────────────────────
let weightChart: any = null;

async function carregarImcPage() {
  if (!currentUser) return;
  if (!userProfile) {
    userProfile = await buscarPerfilUsuario(currentUser.uid);
  }
  if (!userProfile) return;

  const legacyCard = document.getElementById('imc-legacy-card')!;
  const activeContent = document.getElementById('imc-active-content')!;

  // Caso seja usuário legado sem altura
  if (!userProfile.altura) {
    legacyCard.classList.remove('hidden');
    activeContent.style.display = 'none';
    return;
  }

  legacyCard.classList.add('hidden');
  activeContent.style.display = 'block';

  // Calcular IMC e Classificação
  const peso = userProfile.peso || 0;
  const altura = userProfile.altura;
  const imcValEl = document.getElementById('imc-val')!;
  const badgeEl = document.getElementById('imc-classification-badge')!;
  const descEl = document.getElementById('imc-classification-desc')!;

  if (peso > 0 && altura > 0) {
    const imc = peso / ((altura / 100) * (altura / 100));
    imcValEl.textContent = imc.toFixed(1);
    
    const clf = classificarImc(peso, altura, userProfile.idade, userProfile.sexo);
    badgeEl.textContent = `${clf.emoji} ${clf.label}`;
    badgeEl.style.background = clf.cor + '22';
    badgeEl.style.color = clf.cor;
    badgeEl.style.borderColor = clf.cor + '44';
    descEl.textContent = clf.descricao;
  } else {
    imcValEl.textContent = '--';
    badgeEl.textContent = '--';
    descEl.textContent = '';
  }

  // Carregar histórico de pesagens
  try {
    const pesos = await buscarHistoricoPeso(currentUser.uid);
    
    // Renderizar gráfico de peso
    if (pesos.length > 0) {
      setTimeout(() => renderizarGraficoPeso(pesos), 50);
    }

    // Renderizar listagem cronológica
    const histList = document.getElementById('imc-historico-list')!;
    if (pesos.length === 0) {
      histList.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:12px;">Nenhum registro de peso no histórico.</p>';
    } else {
      histList.innerHTML = pesos.slice().reverse().map(p => {
        const dataStr = p.data.toLocaleDateString('pt-BR');
        const imcCalc = p.peso / ((altura / 100) * (altura / 100));
        const clf = classificarImc(p.peso, altura, userProfile!.idade, userProfile!.sexo);

        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-card2); border-radius:8px; font-size:13px;">
            <div>
              <span style="font-weight:600; color:var(--text);">${p.peso.toFixed(1)} kg</span>
              <span style="color:var(--text-muted); margin-left:8px;">IMC: ${imcCalc.toFixed(1)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11px; background:${clf.cor}22; color:${clf.cor}; padding:2px 6px; border-radius:4px;">${clf.label}</span>
              <span style="color:var(--text-muted); font-size:11px;">${dataStr}</span>
              <button onclick="excluirRegistroPeso('${p.id}')" style="background:none;border:none;color:var(--error);cursor:pointer;padding:4px;" title="Excluir Registro">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Erro ao buscar histórico de peso:', err);
  }
}

async function salvarAlturaLegada() {
  if (!currentUser || !userProfile) return;
  const input = document.getElementById('legacy-altura-input') as HTMLInputElement;
  const alturaVal = Number(input.value);
  if (!alturaVal || alturaVal < 50 || alturaVal > 250) {
    mostrarToast('Por favor, informe uma altura válida entre 50 e 250 cm.', 'error');
    return;
  }

  try {
    userProfile.altura = alturaVal;
    await salvarPerfilUsuario(currentUser.uid, { altura: alturaVal } as any);
    mostrarToast('Altura salva com sucesso!', 'success');
    carregarImcPage();
    carregarPerfil(); // atualizar a página de perfil
  } catch (err) {
    mostrarToast('Erro ao salvar altura.', 'error');
  }
}

async function registrarPesoRapido() {
  if (!currentUser || !userProfile) return;
  const input = document.getElementById('peso-modal-input') as HTMLInputElement;
  const pesoVal = Number(input.value);
  if (!pesoVal || pesoVal < 20 || pesoVal > 300) {
    mostrarToast('Por favor, informe um peso válido entre 20 e 300 kg.', 'error');
    return;
  }

  try {
    // Salvar no histórico
    await salvarHistoricoPeso(currentUser.uid, pesoVal);
    // Atualizar no perfil
    userProfile.peso = pesoVal;
    await salvarPerfilUsuario(currentUser.uid, { peso: pesoVal } as any);
    
    input.value = '';
    fecharModalPeso();
    mostrarToast('Registro de peso salvo com sucesso!', 'success');
    
    carregarImcPage();
    carregarPerfil(); // atualizar painel de perfil
  } catch (err) {
    console.error(err);
    mostrarToast('Erro ao salvar registro de peso.', 'error');
  }
}

function abrirPesoDeEscolha() {
  (window as any).fecharModalEscolhaRegistro();
  const m = document.getElementById('modal-peso');
  if (m) m.classList.remove('hidden');
}

function fecharModalPeso() {
  const m = document.getElementById('modal-peso');
  if (m) m.classList.add('hidden');
}

async function excluirRegistroPeso(id: string) {
  abrirModalConfirmacao(
    'Excluir Registro',
    'Tem certeza que deseja excluir este registro de peso?',
    async () => {
      if (!currentUser) return;
      try {
        await excluirPeso(id);
        
        // Recuperar histórico para reverter o peso atual do perfil para o último registrado
        const pesos = await buscarHistoricoPeso(currentUser.uid);
        let novoPeso = 0;
        if (pesos.length > 0) {
          novoPeso = pesos[pesos.length - 1].peso;
        }
        
        if (userProfile && userProfile.peso !== novoPeso) {
          userProfile.peso = novoPeso;
          await salvarPerfilUsuario(currentUser.uid, { peso: novoPeso } as any);
        }

        mostrarToast('Registro excluído com sucesso!', 'success');
        
        // Atualiza UI e os dados globais
        carregarImcPage();
        carregarPerfil(); 
        
        // E também forçar re-carregar histórico unificado se tivermos a tab inicial aberta
        carregarHistorico();
      } catch (err) {
        console.error(err);
        mostrarToast('Erro ao excluir registro de peso.', 'error');
      }
    }
  );
}

function renderizarGraficoPeso(dados: Array<{ peso: number, data: Date }>) {
  const canvas = document.getElementById('weight-chart') as HTMLCanvasElement;
  if (!canvas) return;
  if (weightChart) weightChart.destroy();

  weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dados.map(d => d.data.toLocaleDateString('pt-BR')),
      datasets: [
        {
          label: 'Peso (kg)',
          data: dados.map(d => d.peso),
          borderColor: '#4338ca',
          backgroundColor: '#4338ca11',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#8899BB', font: { size: 10 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#8899BB', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

// Expor funções para a janela global
(window as any).carregarImcPage = carregarImcPage;
(window as any).salvarAlturaLegada = salvarAlturaLegada;
(window as any).registrarPesoRapido = registrarPesoRapido;
(window as any).abrirPesoDeEscolha = abrirPesoDeEscolha;
(window as any).fecharModalPeso = fecharModalPeso;
(window as any).excluirRegistroPeso = excluirRegistroPeso;


// ── MÓDULO PAINEL DE CONTROLE ADMIN ─────────────────────────────

async function carregarAdmin() {
  if (!userProfile || userProfile.role !== 'ADMIN') {
    mostrarToast('Acesso negado: área restrita a Administradores.', 'error');
    mostrarPagina('dashboard');
    return;
  }

  // Carregar dados de usuários e aferições
  try {
    usuariosCadastrados = await obterTodosUsuarios();
    listaFiltradaUsuariosAdmin = [...usuariosCadastrados];
    
    // Atualizar Visão Geral
    await carregarVisaoGeralAdmin();
    // Atualizar Tabela de Usuários
    renderizarTabelaUsuariosAdmin();
    // Carregar Logs e Configurações em segundo plano
    carregarLogsAdminUI();
    carregarConfiguracoesAdminUI();
  } catch (err) {
    console.error('[Admin] Erro ao carregar dados do painel:', err);
    mostrarToast('Erro ao carregar dados administrativos.', 'error');
  }
}

function mostrarSubAbaAdmin(subAba: 'overview' | 'users' | 'logs' | 'config') {
  const abas = ['overview', 'users', 'logs', 'config'];
  abas.forEach(a => {
    const sec = document.getElementById(`admin-sec-${a}`);
    const btn = document.getElementById(`admin-subtab-${a}`);
    if (sec) sec.style.display = 'none';
    if (btn) btn.classList.remove('active');
  });

  const targetSec = document.getElementById(`admin-sec-${subAba}`);
  const targetBtn = document.getElementById(`admin-subtab-${subAba}`);
  if (targetSec) targetSec.style.display = 'block';
  if (targetBtn) targetBtn.classList.add('active');

  if (subAba === 'overview') {
    carregarVisaoGeralAdmin();
  } else if (subAba === 'users') {
    renderizarTabelaUsuariosAdmin();
  } else if (subAba === 'logs') {
    carregarLogsAdminUI();
  } else if (subAba === 'config') {
    carregarConfiguracoesAdminUI();
  }
}

async function carregarVisaoGeralAdmin() {
  const totalUsers = usuariosCadastrados.length;
  const activeUsers = usuariosCadastrados.filter(u => u.status === 'Ativo').length;
  const premiumUsers = usuariosCadastrados.filter(u => u.plano === 'Premium' || u.plano === 'Ouro').length;
  
  // Novos nos últimos 7 dias
  const agora = new Date();
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newUsers = usuariosCadastrados.filter(u => u.data_criacao >= seteDiasAtras).length;

  let totalReadings = 0;
  try {
    totalReadings = await obterTotalAfericoes();
  } catch (e) {
    console.warn('[Admin] Erro ao obter total de aferições:', e);
  }

  // Renderizar KPIs
  const totalEl = document.getElementById('admin-kpi-total-users');
  const activeEl = document.getElementById('admin-kpi-active-users');
  const readingsEl = document.getElementById('admin-kpi-total-readings');
  const premiumEl = document.getElementById('admin-kpi-premium-users');
  const newEl = document.getElementById('admin-kpi-new-users');

  if (totalEl) totalEl.textContent = totalUsers.toString();
  if (activeEl) activeEl.textContent = activeUsers.toString();
  if (readingsEl) readingsEl.textContent = totalReadings.toString();
  if (premiumEl) premiumEl.textContent = premiumUsers.toString();
  if (newEl) newEl.textContent = newUsers.toString();

  // Renderizar Gráfico de Crescimento (últimas 8 semanas)
  renderizarGraficoCrescimentoAdmin();
}

function renderizarGraficoCrescimentoAdmin() {
  const canvas = document.getElementById('admin-chart-growth') as HTMLCanvasElement;
  if (!canvas) return;
  if (adminGrowthChart) adminGrowthChart.destroy();

  // Calcular novos cadastros por semana (últimas 8 semanas)
  const semanas: string[] = [];
  const contagemSemanal: number[] = Array(8).fill(0);
  const agora = new Date();

  for (let i = 7; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    semanas.push(`Sem ${8 - i} (${label})`);
  }

  usuariosCadastrados.forEach(u => {
    const diffMs = agora.getTime() - u.data_criacao.getTime();
    const diffSemanas = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffSemanas >= 0 && diffSemanas < 8) {
      const idx = 7 - diffSemanas;
      contagemSemanal[idx]++;
    }
  });

  adminGrowthChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: semanas,
      datasets: [{
        label: 'Novos Usuários',
        data: contagemSemanal,
        backgroundColor: '#6366f1',
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 11 } } },
        y: { ticks: { color: '#64748b', stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}

function filtrarTabelaUsuariosAdmin() {
  const busca = (document.getElementById('admin-search-user') as HTMLInputElement)?.value.toLowerCase().trim() || '';
  const statusFiltro = (document.getElementById('admin-filter-status') as HTMLSelectElement)?.value || 'todos';
  const planoFiltro = (document.getElementById('admin-filter-plano') as HTMLSelectElement)?.value || 'todos';

  listaFiltradaUsuariosAdmin = usuariosCadastrados.filter(u => {
    const userEmail = u.email || '';
    const matchBusca = u.nome.toLowerCase().includes(busca) || userEmail.toLowerCase().includes(busca);
    const matchStatus = statusFiltro === 'todos' || u.status === statusFiltro;
    const matchPlano = planoFiltro === 'todos' || u.plano === planoFiltro;
    return matchBusca && matchStatus && matchPlano;
  });

  renderizarCardsUsuariosAdmin();
}

function renderizarTabelaUsuariosAdmin() {
  renderizarCardsUsuariosAdmin();
}

function renderizarCardsUsuariosAdmin() {
  const container = document.getElementById('admin-users-cards-view');
  if (!container) return;

  if (listaFiltradaUsuariosAdmin.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); grid-column:1/-1;">Nenhum usuário encontrado.</div>`;
    return;
  }

  container.innerHTML = listaFiltradaUsuariosAdmin.map(u => {
    const isSelf = u.uid === currentUser?.uid;
    const safeEmail = escapeHtml(u.email || '');
    const safeNome = escapeHtml(u.nome || 'Usuário Sem Nome');
    const safeUid = escapeHtml(u.uid || '');
    const statusText = escapeHtml(u.status || 'Ativo');
    const roleText = escapeHtml(u.role === 'ADMIN' ? 'Admin' : 'Usuário');

    return `
      <div class="admin-user-card">
        <div class="admin-user-header">
          <div class="admin-user-avatar">${safeNome.charAt(0).toUpperCase()}</div>
          <div class="admin-user-info">
            <div class="admin-user-nome">${safeNome} ${isSelf ? '<span style="font-size:10px; color:var(--primary);">(Você)</span>' : ''}</div>
            <div class="admin-user-email">${safeEmail || '--'}</div>
          </div>
        </div>

        <div class="admin-user-body">
          <div class="admin-detail-row">
            <span style="color:var(--text-muted);">Plano:</span>
            <select onchange="alterarPlanoUsuarioAdmin('${safeUid}', this.value, '${safeEmail}')" class="admin-filter-select" style="padding:2px 6px; font-size:11px;" ${isSelf ? 'disabled' : ''}>
              <option value="Gratuito" ${u.plano === 'Gratuito' ? 'selected' : ''}>Gratuito</option>
              <option value="Premium" ${u.plano === 'Premium' ? 'selected' : ''}>Premium</option>
              <option value="Ouro" ${u.plano === 'Ouro' ? 'selected' : ''}>Ouro</option>
            </select>
          </div>

          <div class="admin-detail-row">
            <span style="color:var(--text-muted);">Status:</span>
            <select onchange="alterarStatusUsuarioAdmin('${safeUid}', this.value, '${safeEmail}')" class="admin-filter-select" style="padding:2px 6px; font-size:11px;" ${isSelf ? 'disabled' : ''}>
              <option value="Ativo" ${statusText === 'Ativo' ? 'selected' : ''}>Ativo</option>
              <option value="Pendente" ${statusText === 'Pendente' ? 'selected' : ''}>Pendente</option>
              <option value="Suspenso" ${statusText === 'Suspenso' ? 'selected' : ''}>Suspenso</option>
              <option value="Inativo" ${statusText === 'Inativo' ? 'selected' : ''}>Inativo</option>
            </select>
          </div>

          <div class="admin-detail-row">
            <span style="color:var(--text-muted);">Função:</span>
            <select onchange="alterarRoleUsuarioAdmin('${safeUid}', this.value, '${safeEmail}')" class="admin-filter-select" style="padding:2px 6px; font-size:11px;" ${isSelf ? 'disabled' : ''}>
              <option value="USER" ${u.role !== 'ADMIN' ? 'selected' : ''}>USER (${roleText})</option>
              <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
            </select>
          </div>
        </div>

        <div class="admin-user-actions">
          <button onclick="abrirHistoricoUsuarioAdmin('${safeUid}', '${safeNome}')" class="btn btn-primary btn-small" style="flex:1" title="Ver Histórico Clínico">📜 Histórico</button>
          <button onclick="abrirDetalhesUsuarioAdmin('${safeUid}')" class="btn btn-secondary btn-small" style="flex:1" title="Ver Perfil Completo">👁️ Detalhes</button>
          ${!isSelf ? `<button onclick="excluirUsuarioAdmin('${safeUid}', '${safeNome}', '${safeEmail}')" class="btn btn-danger btn-small" title="Excluir Usuário">🗑️</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function alterarPlanoUsuarioAdmin(uid: string, novoPlano: string, email: string) {
  try {
    await atualizarPlanoUsuario(uid, novoPlano as any);
    await registrarLogAdmin('ALTERAR_PLANO', `Plano alterado para ${novoPlano}`, uid, email);
    mostrarToast(`Plano de ${email} alterado para ${novoPlano}.`, 'success');
    const userObj = usuariosCadastrados.find(u => u.uid === uid);
    if (userObj) userObj.plano = novoPlano as any;
  } catch (err) {
    mostrarToast('Erro ao alterar plano.', 'error');
  }
}

async function alterarStatusUsuarioAdmin(uid: string, novoStatus: string, email: string) {
  try {
    await atualizarStatusUsuario(uid, novoStatus as any);
    await registrarLogAdmin('ALTERAR_STATUS', `Status alterado para ${novoStatus}`, uid, email);
    mostrarToast(`Status de ${email} alterado para ${novoStatus}.`, 'success');
    const userObj = usuariosCadastrados.find(u => u.uid === uid);
    if (userObj) userObj.status = novoStatus as any;
  } catch (err) {
    mostrarToast('Erro ao alterar status.', 'error');
  }
}

async function alterarRoleUsuarioAdmin(uid: string, novaRole: string, email: string) {
  try {
    await atualizarFuncaoUsuario(uid, novaRole as any);
    await registrarLogAdmin('ALTERAR_ROLE', `Role alterada para ${novaRole}`, uid, email);
    mostrarToast(`Permissão de ${email} alterada para ${novaRole}.`, 'success');
    const userObj = usuariosCadastrados.find(u => u.uid === uid);
    if (userObj) userObj.role = novaRole as any;
  } catch (err) {
    mostrarToast('Erro ao alterar permissão.', 'error');
  }
}

async function excluirUsuarioAdmin(uid: string, nome: string, email: string) {
  if (confirm(`⚠️ ATENÇÃO: Tem certeza que deseja excluir permanentemente a conta de "${nome}" (${email})?\n\nEsta ação excluirá todas as aferições e dados do Firestore!`)) {
    try {
      await excluirDadosUsuario(uid);
      await registrarLogAdmin('EXCLUIR_USUARIO', `Conta e dados de ${nome} excluídos permanentemente`, uid, email);
      mostrarToast(`Usuário ${nome} excluído com sucesso.`, 'success');
      usuariosCadastrados = usuariosCadastrados.filter(u => u.uid !== uid);
      filtrarTabelaUsuariosAdmin();
    } catch (err) {
      mostrarToast('Erro ao excluir usuário.', 'error');
    }
  }
}

async function abrirDetalhesUsuarioAdmin(uid: string) {
  const userObj = usuariosCadastrados.find(u => u.uid === uid);
  if (!userObj) return;

  const modal = document.getElementById('modal-admin-user-detail');
  const body = document.getElementById('modal-admin-user-body');

  if (body) {
    body.innerHTML = `
      <div style="background:var(--bg-card2); padding:12px; border-radius:8px;">
        <h4 style="margin:0 0 6px; font-size:14px; color:var(--primary);">${escapeHtml(userObj.nome)}</h4>
        <div><strong>UID:</strong> ${escapeHtml(userObj.uid)}</div>
        <div><strong>E-mail:</strong> ${escapeHtml(userObj.email)}</div>
        <div><strong>Sexo:</strong> ${escapeHtml(userObj.sexo || '--')} | <strong>Idade:</strong> ${userObj.idade || '--'} anos</div>
        <div><strong>Peso:</strong> ${userObj.peso || '--'} kg | <strong>Altura:</strong> ${userObj.altura || '--'} cm</div>
        <div><strong>Data Nasc:</strong> ${escapeHtml(userObj.nascimento || '--')}</div>
      </div>

      <div style="background:var(--bg-card2); padding:12px; border-radius:8px;">
        <h4 style="margin:0 0 6px; font-size:14px; color:var(--text);">📋 Condições de Saúde Declaradas</h4>
        <div>• Hipertenso: ${userObj.hipertenso ? 'Sim 🔴' : 'Não 🟢'}</div>
        <div>• Diabético: ${userObj.diabetico ? 'Sim 🔴' : 'Não 🟢'}</div>
        <div>• Fumante: ${userObj.fumante ? 'Sim 🔴' : 'Não 🟢'}</div>
        <div>• Sedentário: ${userObj.sedentario ? 'Sim 🔴' : 'Não 🟢'}</div>
        <div>• Usa medicação: ${userObj.usaMedicacao ? 'Sim' : 'Não'}</div>
      </div>

      <div style="background:var(--bg-card2); padding:12px; border-radius:8px;">
        <h4 style="margin:0 0 6px; font-size:14px; color:var(--text);">⚖️ Termos de Uso e Conta</h4>
        <div>• Termos aceitos: ${userObj.termos_aceitos ? 'Sim ✅' : 'Não ❌'}</div>
        <div>• Versão dos termos: ${escapeHtml(userObj.termos_versao || '--')}</div>
        <div>• Aceito em: ${userObj.termos_aceitos_em ? escapeHtml(new Date(userObj.termos_aceitos_em).toLocaleString('pt-BR')) : '--'}</div>
        <div>• Criado em: ${escapeHtml(formatarDataHora(userObj.data_criacao))}</div>
      </div>
    `;
  }

  if (modal) modal.classList.remove('hidden');
}

function fecharModalAdminUserDetail() {
  const modal = document.getElementById('modal-admin-user-detail');
  if (modal) modal.classList.add('hidden');
}

async function carregarLogsAdminUI() {
  const container = document.getElementById('admin-logs-list');
  if (!container) return;
  container.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">Carregando logs...</p>`;

  try {
    const logs = await buscarLogsAdmin(40);
    if (logs.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">Nenhum log registrado até o momento.</p>`;
      return;
    }

    container.innerHTML = logs.map(l => `
      <div class="admin-log-card">
        <div class="admin-log-main">
          <span class="admin-log-action">${l.acao}</span>
          <span class="admin-log-detail">${l.detalhe} ${l.alvo_email ? `(${l.alvo_email})` : ''}</span>
          <span style="font-size:10px; color:var(--text-muted);">Por: ${l.admin_email}</span>
        </div>
        <span class="admin-log-time">${formatarDataHora(l.timestamp)}</span>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger); font-size:13px; text-align:center; padding:20px;">Erro ao carregar logs do sistema.</p>`;
  }
}

async function carregarConfiguracoesAdminUI() {
  try {
    const cfg = await buscarConfigSistema();
    const txtMsg = document.getElementById('admin-config-global-msg') as HTMLTextAreaElement;
    const chkActive = document.getElementById('admin-config-global-active') as HTMLInputElement;
    const chkBlock = document.getElementById('admin-config-block-reg') as HTMLInputElement;
    const chkMaint = document.getElementById('admin-config-maint') as HTMLInputElement;

    if (txtMsg) txtMsg.value = cfg.mensagem_global || '';
    if (chkActive) chkActive.checked = !!cfg.mensagem_ativa;
    if (chkBlock) chkBlock.checked = !!cfg.bloquear_cadastros;
    if (chkMaint) chkMaint.checked = !!cfg.manutencao;
  } catch (err) {
    mostrarToast('Erro ao carregar configurações.', 'error');
  }
}

async function salvarConfiguracoesAdminUI() {
  const txtMsg = (document.getElementById('admin-config-global-msg') as HTMLTextAreaElement)?.value || '';
  const chkActive = (document.getElementById('admin-config-global-active') as HTMLInputElement)?.checked || false;
  const chkBlock = (document.getElementById('admin-config-block-reg') as HTMLInputElement)?.checked || false;
  const chkMaint = (document.getElementById('admin-config-maint') as HTMLInputElement)?.checked || false;

  try {
    const configObj: SystemConfig = {
      mensagem_global: txtMsg,
      mensagem_ativa: chkActive,
      bloquear_cadastros: chkBlock,
      manutencao: chkMaint
    };

    await salvarConfigSistema(configObj);
    await registrarLogAdmin('SALVAR_CONFIG', 'Configurações globais do sistema atualizadas');
    mostrarToast('Configurações salvas com sucesso!', 'success');
  } catch (err) {
    mostrarToast('Erro ao salvar configurações.', 'error');
  }
}

// Expor funções globais do Admin
(window as any).carregarAdmin = carregarAdmin;
(window as any).mostrarSubAbaAdmin = mostrarSubAbaAdmin;
(window as any).filtrarTabelaUsuariosAdmin = filtrarTabelaUsuariosAdmin;
(window as any).alterarPlanoUsuarioAdmin = alterarPlanoUsuarioAdmin;
(window as any).alterarStatusUsuarioAdmin = alterarStatusUsuarioAdmin;
(window as any).alterarRoleUsuarioAdmin = alterarRoleUsuarioAdmin;
(window as any).excluirUsuarioAdmin = excluirUsuarioAdmin;
(window as any).abrirDetalhesUsuarioAdmin = abrirDetalhesUsuarioAdmin;
(window as any).fecharModalAdminUserDetail = fecharModalAdminUserDetail;
(window as any).carregarLogsAdminUI = carregarLogsAdminUI;
(window as any).salvarConfiguracoesAdminUI = salvarConfiguracoesAdminUI;


