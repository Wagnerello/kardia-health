import { logger } from '../services/logger';
import { Chart } from 'chart.js';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import {
  obterTodosUsuarios,
  obterTotalAfericoes,
} from '../services/admin';
import { buscarPerfilUsuario } from '../services/auth';
import { buscarAfericoes, gerarRelatorioCondutaOMS } from '../services/afericoes';
import { formatarDataHora, classificarPressao } from '../types';
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

export async function abrirHistoricoUsuarioAdmin(uid: string, nome: string): Promise<void> {
  const modal = document.getElementById('modal-historico-usuario');
  const titleEl = document.getElementById('modal-hist-user-title');
  const contentEl = document.getElementById('modal-hist-content');
  if (!modal || !contentEl) return;

  state.adminTargetUserUid = uid;
  state.adminTargetUserPerfil = null;

  modal.classList.remove('hidden');
  if (titleEl) titleEl.textContent = `Histórico de ${nome}`;
  contentEl.innerHTML = `<div class="ocr-loading"><div class="ocr-spinner"></div><p style="color:var(--text-muted)">Carregando...</p></div>`;

  try {
    const perfil = await buscarPerfilUsuario(uid);
    state.adminTargetUserPerfil = perfil;

    const afericoes = await buscarAfericoes(uid, 90);
    if (afericoes.length === 0) {
      contentEl.innerHTML = `<div class="empty-state"><div class="empty-title">Sem medições</div><p class="empty-sub">Este usuário ainda não registrou aferições.</p></div>`;
      return;
    }

    contentEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${afericoes.map(a => {
          const clf = classificarPressao(a.sys, a.dia);
          const dt = formatarDataHora(a.data_hora_afericao);
          return `
            <div class="admin-reading-card" style="border-left: 4px solid ${clf.cor};">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="admin-reading-date">${dt}</span>
                <span class="admin-reading-badge" style="background:${clf.cor}22; color:${clf.cor}; border:1px solid ${clf.cor}44;">${clf.label}</span>
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
    logger.error('Erro ao carregar histórico do usuário:', err);
    contentEl.innerHTML = `<div class="empty-state"><div class="empty-icon" style="color:var(--danger)"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div><div class="empty-title">Erro ao carregar histórico</div></div>`;
  }
}

export function fecharHistoricoUsuarioAdmin(): void {
  document.getElementById('modal-historico-usuario')?.classList.add('hidden');
}

export async function gerarLaudoDoUsuarioAdmin(): Promise<void> {
  if (!state.adminTargetUserUid || !state.adminTargetUserPerfil) {
    mostrarToast('Nenhum usuário selecionado.', 'error');
    return;
  }
  const btn = document.getElementById('btn-gerar-laudo-admin') as HTMLButtonElement;
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = `<svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right:6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Gerando...`;

  try {
    const markdownText = await gerarRelatorioCondutaOMS(state.adminTargetUserUid, state.adminTargetUserPerfil, 90);
    const contentEl = document.getElementById('modal-hist-content');
    if (contentEl) {
      const parsed = await marked.parse(markdownText);
      const parsedHtml = DOMPurify.sanitize(parsed as string);
      contentEl.innerHTML = `
        <div style="border-top: 1px solid var(--border); padding-top: 16px; margin-top: 8px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary)"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            <span style="font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">Laudo IA Gerado</span>
          </div>
          <div class="laudo-content" style="font-size: 13px; line-height: 1.7; color: var(--text);">${parsedHtml}</div>
        </div>
      `;
    }
    mostrarToast('Laudo gerado com sucesso!', 'success');
  } catch (err) {
    logger.error('Erro ao gerar laudo admin:', err);
    mostrarToast('Erro ao gerar laudo. O usuário pode não ter histórico suficiente.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Gerar Laudo IA`;
  }
}

// Vinculação global
window.carregarAdmin = carregarAdmin;
window.mostrarSubAbaAdmin = mostrarSubAbaAdmin;
window.abrirHistoricoUsuarioAdmin = abrirHistoricoUsuarioAdmin;
window.fecharHistoricoUsuarioAdmin = fecharHistoricoUsuarioAdmin;
window.gerarLaudoDoUsuarioAdmin = gerarLaudoDoUsuarioAdmin;
