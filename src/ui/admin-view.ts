import { logger } from '../services/logger';
import { Chart } from 'chart.js';
import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import {
  obterTodosUsuarios,
  obterTotalAfericoes,
} from '../services/admin';
import { gerarRelatorioCondutaOMS } from '../services/afericoes';
import {
  renderizarTabelaUsuariosAdmin,
  filtrarTabelaUsuariosAdmin,
  alterarPlanoUsuarioAdmin,
  alterarStatusUsuarioAdmin,
  alterarRoleUsuarioAdmin,
  excluirUsuarioAdmin,
  abrirDetalhesUsuarioAdmin,
  fecharModalAdminUserDetail
} from './admin-users';
import {
  carregarLogsAdminUI,
  carregarConfiguracoesAdminUI,
  salvarConfiguracoesAdminUI
} from './admin-config-logs';

export {
  renderizarTabelaUsuariosAdmin,
  filtrarTabelaUsuariosAdmin,
  alterarPlanoUsuarioAdmin,
  alterarStatusUsuarioAdmin,
  alterarRoleUsuarioAdmin,
  excluirUsuarioAdmin,
  abrirDetalhesUsuarioAdmin,
  fecharModalAdminUserDetail,
  carregarLogsAdminUI,
  carregarConfiguracoesAdminUI,
  salvarConfiguracoesAdminUI
};

export async function carregarAdmin(): Promise<void> {
  if (!state.userProfile || state.userProfile.role !== 'ADMIN') {
    mostrarToast('Acesso negado: área restrita a Administradores.', 'error');
    if (window.mostrarPagina) window.mostrarPagina('dashboard');
    return;
  }

  try {
    state.usuariosCadastrados = await obterTodosUsuarios();
    state.listaFiltradaUsuariosAdmin = [...state.usuariosCadastrados];
    
    await carregarVisaoGeralAdmin();
    renderizarTabelaUsuariosAdmin();
    carregarLogsAdminUI();
    carregarConfiguracoesAdminUI();
  } catch (err) {
    logger.error('[Admin] Erro ao carregar dados do painel:', err);
    mostrarToast('Erro ao carregar dados administrativos.', 'error');
  }
}

export function mostrarSubAbaAdmin(subAba: 'overview' | 'users' | 'logs' | 'config'): void {
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

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  readings: number;
  premiumUsers: number;
  newUsers: number;
}

function atualizarKPIsAdmin(stats: AdminStats): void {
  const map: Record<string, number> = {
    'admin-kpi-total-users': stats.totalUsers,
    'admin-kpi-active-users': stats.activeUsers,
    'admin-kpi-total-readings': stats.readings,
    'admin-kpi-premium-users': stats.premiumUsers,
    'admin-kpi-new-users': stats.newUsers,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val.toString();
  });
}

export async function carregarVisaoGeralAdmin(): Promise<void> {
  const totalUsers = state.usuariosCadastrados.length;
  const activeUsers = state.usuariosCadastrados.filter(u => u.status === 'Ativo').length;
  const premiumUsers = state.usuariosCadastrados.filter(u => u.plano === 'Premium' || u.plano === 'Ouro').length;
  
  const agora = new Date();
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newUsers = state.usuariosCadastrados.filter(u => u.data_criacao >= seteDiasAtras).length;

  let totalReadings = 0;
  try {
    totalReadings = await obterTotalAfericoes();
  } catch (e) {
    logger.warn('[Admin] Erro ao obter total de aferições:', e);
  }

  atualizarKPIsAdmin({ totalUsers, activeUsers, readings: totalReadings, premiumUsers, newUsers });
  renderizarGraficoCrescimentoAdmin();
}

export function renderizarGraficoCrescimentoAdmin(): void {
  const canvas = document.getElementById('admin-chart-growth') as HTMLCanvasElement;
  if (!canvas) return;
  if (state.adminGrowthChart) state.adminGrowthChart.destroy();

  const semanas: string[] = [];
  const contagemSemanal: number[] = Array(8).fill(0);
  const agora = new Date();

  for (let i = 7; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    semanas.push(`Sem ${8 - i} (${label})`);
  }

  state.usuariosCadastrados.forEach(u => {
    const diffMs = agora.getTime() - u.data_criacao.getTime();
    const diffSemanas = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffSemanas >= 0 && diffSemanas < 8) {
      const idx = 7 - diffSemanas;
      contagemSemanal[idx]++;
    }
  });

  state.adminGrowthChart = new Chart(canvas, {
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

import { abrirJanelaHistoricoAdmin } from './admin-user-history-view';

export async function abrirHistoricoUsuarioAdmin(uid: string, nome: string): Promise<void> {
  state.adminTargetUserUid = uid;
  await abrirJanelaHistoricoAdmin(uid, nome);
}

export function abrirLaudoSalvoAdminPorDados(laudoJson: string, nomePaciente: string, perfilJson: string): void {
  try {
    const laudo = JSON.parse(laudoJson);
    const perfil = perfilJson ? JSON.parse(perfilJson) : null;
    abrirLaudoEmNovaJanela({
      titulo: 'Laudo Clínico Integrado',
      conteudoMarkdown: laudo.conteudo,
      nomePaciente,
      dataGeracao: laudo.data_geracao,
      diasAnalisados: laudo.dias_analisados,
      periodoTexto: laudo.periodo_texto,
      modeloUsado: laudo.modelo_usado,
      detalhesClinicos: {
        idade: perfil?.idade,
        sexo: perfil?.sexo,
        peso: perfil?.peso,
        altura: perfil?.altura
      }
    });
  } catch (err) {
    logger.error('Erro ao abrir laudo salvo:', err);
    mostrarToast('Erro ao abrir laudo salvo.', 'error');
  }
}

import { mostrarLoadingPassos, atualizarLoadingPasso, fecharLoadingPassos } from './loading-steps';
import { abrirLaudoEmNovaJanela } from './laudo-window';

export function fecharHistoricoUsuarioAdmin(): void {
  document.getElementById('modal-historico-usuario')?.classList.add('hidden');
}

export async function gerarLaudoDoUsuarioAdmin(): Promise<void> {
  if (!state.adminTargetUserUid || !state.adminTargetUserPerfil) {
    mostrarToast('Nenhum usuário selecionado.', 'error');
    return;
  }
  const btn = document.getElementById('btn-gerar-laudo-admin') as HTMLButtonElement;
  if (btn) {
    btn.disabled = true;
  }

  const nomePaciente = state.adminTargetUserPerfil.nome || 'Paciente';

  mostrarLoadingPassos(
    `Gerando Laudo Clínico - ${nomePaciente}`,
    'A inteligência médica está correlacionando o histórico de aferições, sinais vitais e perfil'
  );

  const dtInicioInput = (document.getElementById('admin-pdf-inicio') as HTMLInputElement)?.value;
  const dtFimInput = (document.getElementById('admin-pdf-fim') as HTMLInputElement)?.value;

  const filtroPeriodo = (dtInicioInput || dtFimInput)
    ? { dataInicio: dtInicioInput, dataFim: dtFimInput }
    : 90;

  try {
    const resLaudo = await gerarRelatorioCondutaOMS(
      state.adminTargetUserUid,
      state.adminTargetUserPerfil,
      filtroPeriodo,
      (etapa, total, msg) => {
        atualizarLoadingPasso(etapa, total, msg);
      }
    );

    fecharLoadingPassos();

    abrirLaudoEmNovaJanela({
      titulo: 'Laudo Clínico Integrado',
      conteudoMarkdown: resLaudo.text,
      nomePaciente,
      diasAnalisados: resLaudo.diasAnalisados,
      periodoTexto: resLaudo.periodoTexto,
      modeloUsado: resLaudo.modelName,
      detalhesClinicos: {
        idade: state.adminTargetUserPerfil.idade,
        sexo: state.adminTargetUserPerfil.sexo,
        peso: state.adminTargetUserPerfil.peso,
        altura: state.adminTargetUserPerfil.altura
      }
    });

    mostrarToast('Laudo gerado e aberto em nova janela!', 'success');
  } catch (err: unknown) {
    fecharLoadingPassos();
    logger.error('Erro ao gerar laudo admin:', err);
    const msgErro = err instanceof Error ? err.message : 'Erro ao gerar laudo. Verifique o histórico do usuário.';
    mostrarToast(msgErro, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
    }
  }
}

// Vinculação global
window.carregarAdmin = carregarAdmin;
window.mostrarSubAbaAdmin = mostrarSubAbaAdmin;
window.abrirHistoricoUsuarioAdmin = abrirHistoricoUsuarioAdmin;
window.fecharHistoricoUsuarioAdmin = fecharHistoricoUsuarioAdmin;
window.gerarLaudoDoUsuarioAdmin = gerarLaudoDoUsuarioAdmin;
window.abrirLaudoSalvoAdminPorDados = abrirLaudoSalvoAdminPorDados;
