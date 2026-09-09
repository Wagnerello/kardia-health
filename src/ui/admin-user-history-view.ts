import { logger } from '../services/logger';
import { Chart } from 'chart.js';
import { mostrarToast, escapeHtml } from './ui-utils';
import { formatarDataHora, classificarPressao, type BpReading, type UserProfile, type GlicemiaReading } from '../types';
import { buscarLaudos, type SavedLaudo } from '../services/laudos';
import { buscarAfericoes } from '../services/afericoes';
import { buscarPerfilUsuario } from '../services/auth';
import { buscarGlicemias } from '../services/glicemia';
import { criarWrapperPDF, gerarHTMLCabecalhoPDF, gerarHTMLRodapePDF, salvarPDF, obterBadgePDF } from './pdf-templates';
import {
  gerarHtmlHeaderPaciente,
  gerarCardsListaLaudos,
  gerarTabelaAfericoesHtml,
  gerarGlicemiasHtml
} from './admin-user-history-render';
import {
  aoMudarPresetPeriodoAdmin,
  executarGeracaoLaudoAdmin,
  visualizarLaudoAdminInline,
  fecharViewerLaudoAdmin,
  abrirEditorLaudoAdmin,
  salvarEdicaoLaudoAdmin,
  abrirModalCriarLaudoManualAdmin,
  salvarCriacaoLaudoManualAdmin,
  inativarLaudoAdminUI,
  reativarLaudoAdminUI,
  excluirLaudoAdminPermanenteUI,
  copiarTextoLaudoAdmin,
  exportarLaudoAdminParaPDF
} from './admin-user-history-crud';

export interface AdminUserHistoryState {
  targetUid: string | null;
  targetNome: string;
  perfil: UserProfile | null;
  afericoes: BpReading[];
  glicemias: GlicemiaReading[];
  laudos: SavedLaudo[];
  laudoEmVisualizacao: SavedLaudo | null;
  laudoEmEdicao: SavedLaudo | null;
  abaAtiva: 'laudos' | 'pressao' | 'outros';
  chartInstance: Chart | null;
}

export const adminHistoryState: AdminUserHistoryState = {
  targetUid: null,
  targetNome: '',
  perfil: null,
  afericoes: [],
  glicemias: [],
  laudos: [],
  laudoEmVisualizacao: null,
  laudoEmEdicao: null,
  abaAtiva: 'laudos',
  chartInstance: null
};

export async function abrirJanelaHistoricoAdmin(uid: string, nome: string): Promise<void> {
  adminHistoryState.targetUid = uid;
  adminHistoryState.targetNome = nome;
  adminHistoryState.laudoEmVisualizacao = null;
  adminHistoryState.laudoEmEdicao = null;
  adminHistoryState.abaAtiva = 'laudos';

  document.getElementById('admin-sec-users-list')?.setAttribute('style', 'display:none;');
  const historyView = document.getElementById('admin-user-history-view');
  if (historyView) {
    historyView.classList.remove('hidden');
    historyView.style.display = 'block';
  }

  const titleEl = document.getElementById('admin-history-view-title');
  if (titleEl) titleEl.textContent = `Histórico & Laudos Clínicos: ${nome}`;

  const headerCard = document.getElementById('admin-history-patient-card');
  if (headerCard) {
    headerCard.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted);">Carregando dados completos de ${escapeHtml(nome)}...</div>`;
  }

  try {
    const [perfil, afericoes, glicemias, laudos] = await Promise.all([
      buscarPerfilUsuario(uid),
      buscarAfericoes(uid, 3650),
      buscarGlicemias(uid, 3650).catch(() => []),
      buscarLaudos(uid, true)
    ]);

    adminHistoryState.perfil = perfil;
    adminHistoryState.afericoes = afericoes;
    adminHistoryState.glicemias = glicemias;
    adminHistoryState.laudos = laudos;

    if (headerCard) headerCard.innerHTML = gerarHtmlHeaderPaciente(perfil, nome);
    trocarAbaJanelaHistoricoAdmin('laudos');
  } catch (err) {
    logger.error('[Admin] Erro ao carregar dados do paciente:', err);
    mostrarToast('Erro ao carregar histórico completo do usuário.', 'error');
  }
}

export function fecharJanelaHistoricoAdmin(): void {
  if (adminHistoryState.chartInstance) {
    adminHistoryState.chartInstance.destroy();
    adminHistoryState.chartInstance = null;
  }
  document.getElementById('admin-user-history-view')?.classList.add('hidden');
  const listWrapper = document.getElementById('admin-sec-users-list');
  if (listWrapper) listWrapper.style.display = 'block';
}

export function trocarAbaJanelaHistoricoAdmin(aba: 'laudos' | 'pressao' | 'outros'): void {
  adminHistoryState.abaAtiva = aba;
  ['laudos', 'pressao', 'outros'].forEach(a => {
    document.getElementById(`admin-hist-tab-${a}`)?.classList.toggle('active', a === aba);
    const sec = document.getElementById(`admin-hist-sec-${a}`);
    if (sec) sec.style.display = a === aba ? 'block' : 'none';
  });

  if (aba === 'laudos') renderizarCrudLaudosAdmin();
  else if (aba === 'pressao') renderizarAbaPressaoAdmin();
  else if (aba === 'outros') renderizarAbaOutrosSinaisAdmin();
}

export function renderizarCrudLaudosAdmin(): void {
  const container = document.getElementById('admin-hist-laudos-container');
  if (!container) return;

  const laudos = adminHistoryState.laudos;
  const countAtivos = laudos.filter(l => l.ativo !== false).length;
  const countInativos = laudos.filter(l => l.ativo === false).length;

  container.innerHTML = `
    <div class="card" style="margin-bottom:16px; background:var(--bg-card); border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
        <div>
          <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--primary);">🤖 Gerar Novo Laudo Clínico com IA</h4>
          <span style="font-size:12px; color:var(--text-muted);">Processamento inteligente de sinais vitais, glicemia e hidratação</span>
        </div>
        <button class="btn btn-secondary btn-small" onclick="abrirModalCriarLaudoManualAdmin()">✍️ Nova Anotação / Laudo Manual</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; align-items:flex-end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:12px;">Período</label>
          <select id="admin-laudo-preset-periodo" class="form-select" onchange="aoMudarPresetPeriodoAdmin(this.value)">
            <option value="7">Últimos 7 dias</option>
            <option value="14">Últimos 14 dias</option>
            <option value="30" selected>Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Período Personalizado</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:12px;">Data Inicial</label><input type="date" id="admin-laudo-data-inicio" class="form-input" /></div>
        <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:12px;">Data Final</label><input type="date" id="admin-laudo-data-fim" class="form-input" /></div>
        <button class="btn btn-primary" id="btn-admin-exec-gerar-laudo" onclick="executarGeracaoLaudoAdmin()" style="height:42px; font-weight:700;">🤖 Gerar Laudo com IA</button>
      </div>
    </div>

    <div id="admin-laudo-viewer-panel" class="card hidden" style="margin-bottom:20px; background:var(--bg-card); border:2px solid var(--primary); padding:20px; border-radius:14px;"></div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin:20px 0 12px;">
      <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--text);">
        📜 Histórico de Laudos Salvos
        <span class="badge" style="background:var(--primary); color:#fff; font-size:11px;">${countAtivos} ativos ${countInativos > 0 ? `(${countInativos} inativos)` : ''}</span>
      </h4>
      <button class="btn btn-ghost btn-small" onclick="recarregarLaudosAdminAtual()">🔄 Atualizar</button>
    </div>

    <div id="admin-hist-laudos-list">${gerarCardsListaLaudos(laudos)}</div>
  `;
}

export async function recarregarLaudosAdminAtual(): Promise<void> {
  if (!adminHistoryState.targetUid) return;
  adminHistoryState.laudos = await buscarLaudos(adminHistoryState.targetUid, true);
  renderizarCrudLaudosAdmin();
}

export function focarGeradorLaudoAdmin(): void {
  trocarAbaJanelaHistoricoAdmin('laudos');
  document.getElementById('btn-admin-exec-gerar-laudo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export async function exportarHistoricoCompletoAdminPDF(): Promise<void> {
  const afericoes = adminHistoryState.afericoes;
  if (!afericoes.length) return;
  const linhasHtml = afericoes.map(a => `<tr><td>${formatarDataHora(a.data_hora_afericao)}</td><td><strong>${a.sys}/${a.dia}</strong> mmHg</td><td>${a.pul} BPM</td><td>${obterBadgePDF(classificarPressao(a.sys, a.dia).label)}</td></tr>`).join('');
  const wrapper = criarWrapperPDF();
  wrapper.innerHTML = `
    ${gerarHTMLCabecalhoPDF('Histórico Clínico', new Date().toLocaleDateString('pt-BR'), adminHistoryState.targetNome, [`Total: ${afericoes.length}`])}
    <table class="pdf-table"><thead><tr><th>Data/Hora</th><th>PA</th><th>Pulso</th><th>Classificação</th></tr></thead><tbody>${linhasHtml}</tbody></table>
    ${gerarHTMLRodapePDF()}`;
  await salvarPDF(wrapper, `historico-${adminHistoryState.targetNome.toLowerCase()}.pdf`);
  mostrarToast('PDF exportado!', 'success');
}

export function renderizarAbaPressaoAdmin(): void {
  const container = document.getElementById('admin-hist-sec-pressao');
  if (!container) return;
  const count = adminHistoryState.afericoes.length;
  const mediaSys = count ? Math.round(adminHistoryState.afericoes.reduce((s, a) => s + a.sys, 0) / count) : 0;
  const mediaDia = count ? Math.round(adminHistoryState.afericoes.reduce((s, a) => s + a.dia, 0) / count) : 0;
  const mediaPul = count ? Math.round(adminHistoryState.afericoes.reduce((s, a) => s + a.pul, 0) / count) : 0;

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:16px;">
      <div class="stat-card sys-card"><div class="stat-value">${mediaSys || '--'}</div><div class="stat-unit">mmHg</div><div class="stat-label">Média SYS</div></div>
      <div class="stat-card dia-card"><div class="stat-value">${mediaDia || '--'}</div><div class="stat-unit">mmHg</div><div class="stat-label">Média DIA</div></div>
      <div class="stat-card pul-card"><div class="stat-value">${mediaPul || '--'}</div><div class="stat-unit">BPM</div><div class="stat-label">Média Pulso</div></div>
    </div>
    <div class="card" style="margin-bottom:16px;"><div style="height:240px;"><canvas id="admin-patient-bp-chart"></canvas></div></div>
    <div class="card" style="padding:0; overflow:hidden;"><table style="width:100%; border-collapse:collapse;"><thead><tr style="background:var(--bg-card2);"><th style="padding:10px;">Data/Hora</th><th style="padding:10px;">SYS</th><th style="padding:10px;">DIA</th><th style="padding:10px;">Pulso</th><th style="padding:10px;">Status</th></tr></thead><tbody>${gerarTabelaAfericoesHtml(adminHistoryState.afericoes)}</tbody></table></div>
  `;
  setTimeout(() => {
    const canvas = document.getElementById('admin-patient-bp-chart') as HTMLCanvasElement;
    if (!canvas) return;
    if (adminHistoryState.chartInstance) adminHistoryState.chartInstance.destroy();
    const ultimas30 = [...adminHistoryState.afericoes].reverse().slice(-30);
    adminHistoryState.chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ultimas30.map(a => `${a.data_hora_afericao.getDate()}/${a.data_hora_afericao.getMonth() + 1}`),
        datasets: [
          { label: 'SYS', data: ultimas30.map(a => a.sys), borderColor: '#ef4444' },
          { label: 'DIA', data: ultimas30.map(a => a.dia), borderColor: '#3b82f6' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }, 50);
}

export function renderizarAbaOutrosSinaisAdmin(): void {
  const container = document.getElementById('admin-hist-sec-outros');
  if (!container) return;
  container.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
      <div class="card"><h4 style="margin:0 0 12px;">🩸 Registros de Glicemia</h4><div style="max-height:350px; overflow-y:auto;">${gerarGlicemiasHtml(adminHistoryState.glicemias)}</div></div>
      <div class="card"><h4 style="margin:0 0 12px;">💡 Cruzamento Multidisciplinar</h4><p style="font-size:13px; color:var(--text-muted); line-height:1.6;">O laudo clínico com IA cruza pressão arterial, glicemia, hidratação e IMC.</p><button class="btn btn-primary" onclick="focarGeradorLaudoAdmin()">🤖 Gerar Laudo</button></div>
    </div>
  `;
}

// Vinculação global
window.abrirJanelaHistoricoAdmin = abrirJanelaHistoricoAdmin;
window.fecharJanelaHistoricoAdmin = fecharJanelaHistoricoAdmin;
window.trocarAbaJanelaHistoricoAdmin = trocarAbaJanelaHistoricoAdmin;
window.aoMudarPresetPeriodoAdmin = aoMudarPresetPeriodoAdmin;
window.executarGeracaoLaudoAdmin = executarGeracaoLaudoAdmin;
window.visualizarLaudoAdminInline = visualizarLaudoAdminInline;
window.fecharViewerLaudoAdmin = fecharViewerLaudoAdmin;
window.abrirEditorLaudoAdmin = abrirEditorLaudoAdmin;
window.salvarEdicaoLaudoAdmin = salvarEdicaoLaudoAdmin;
window.abrirModalCriarLaudoManualAdmin = abrirModalCriarLaudoManualAdmin;
window.salvarCriacaoLaudoManualAdmin = salvarCriacaoLaudoManualAdmin;
window.inativarLaudoAdminUI = inativarLaudoAdminUI;
window.reativarLaudoAdminUI = reativarLaudoAdminUI;
window.excluirLaudoAdminPermanenteUI = excluirLaudoAdminPermanenteUI;
window.copiarTextoLaudoAdmin = copiarTextoLaudoAdmin;
window.exportarLaudoAdminParaPDF = exportarLaudoAdminParaPDF;
window.recarregarLaudosAdminAtual = recarregarLaudosAdminAtual;
window.focarGeradorLaudoAdmin = focarGeradorLaudoAdmin;
window.exportarHistoricoCompletoAdminPDF = exportarHistoricoCompletoAdminPDF;
