import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { mostrarToast, escapeHtml, abrirModalConfirmacao } from './ui-utils';
import { formatarDataHora } from '../types';
import {
  buscarLaudos,
  atualizarLaudo,
  criarLaudoManual,
  inativarLaudo,
  reativarLaudo,
  excluirLaudoPermanente,
  gerarRelatorioCondutaOMS
} from '../services/laudos';
import { criarWrapperPDF, gerarHTMLCabecalhoPDF, gerarHTMLRodapePDF, salvarPDF } from './pdf-templates';
import { mostrarLoadingPassos, atualizarLoadingPasso, fecharLoadingPassos } from './loading-steps';
import { adminHistoryState, renderizarCrudLaudosAdmin } from './admin-user-history-view';

export function aoMudarPresetPeriodoAdmin(val: string): void {
  const dtInicioEl = document.getElementById('admin-laudo-data-inicio') as HTMLInputElement;
  const dtFimEl = document.getElementById('admin-laudo-data-fim') as HTMLInputElement;
  if (!dtInicioEl || !dtFimEl || val === 'custom') return;

  const dias = parseInt(val, 10) || 30;
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias);
  dtFimEl.value = fim.toISOString().split('T')[0];
  dtInicioEl.value = inicio.toISOString().split('T')[0];
}

export async function executarGeracaoLaudoAdmin(): Promise<void> {
  const { targetUid: uid, perfil, targetNome: nome } = adminHistoryState;
  if (!uid || !perfil) return;

  const preset = (document.getElementById('admin-laudo-preset-periodo') as HTMLSelectElement)?.value || '30';
  const dataInicio = (document.getElementById('admin-laudo-data-inicio') as HTMLInputElement)?.value;
  const dataFim = (document.getElementById('admin-laudo-data-fim') as HTMLInputElement)?.value;

  const periodoParam = preset !== 'custom' ? (parseInt(preset, 10) || 30) : (dataInicio && dataFim ? { dataInicio, dataFim } : { dataInicio });

  mostrarLoadingPassos(`Gerando Laudo - ${nome}`, 'Cruzando sinais vitais, pressão e condutas clínicas OMS/SBC...');
  try {
    await gerarRelatorioCondutaOMS(uid, perfil, periodoParam, (etapa, total, msg) => atualizarLoadingPasso(etapa, total, msg));
    fecharLoadingPassos();
    mostrarToast('Laudo gerado com sucesso!', 'success');
    adminHistoryState.laudos = await buscarLaudos(uid, true);
    renderizarCrudLaudosAdmin();
    if (adminHistoryState.laudos[0]) visualizarLaudoAdminInline(adminHistoryState.laudos[0].id);
  } catch (err: unknown) {
    fecharLoadingPassos();
    mostrarToast(err instanceof Error ? err.message : 'Falha ao gerar laudo.', 'error');
  }
}

export async function visualizarLaudoAdminInline(laudoId: string): Promise<void> {
  const laudo = adminHistoryState.laudos.find(l => l.id === laudoId);
  const panel = document.getElementById('admin-laudo-viewer-panel');
  if (!laudo || !panel) return;

  adminHistoryState.laudoEmVisualizacao = laudo;
  const dt = formatarDataHora(laudo.data_geracao);
  const markdownSanitizado = DOMPurify.sanitize(await marked.parse(laudo.conteudo));

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div>
        <span class="badge" style="background:var(--primary); color:#fff; font-size:11px; font-weight:700;">LAUDO CLÍNICO</span>
        <span style="font-size:13px; font-weight:700; color:var(--text); margin-left:6px;">${dt}</span>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Período: ${escapeHtml(laudo.periodo_texto || 'Geral')}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline btn-small" onclick="copiarTextoLaudoAdmin('${laudo.id}')">📋 Copiar</button>
        <button class="btn btn-primary btn-small" onclick="exportarLaudoAdminParaPDF('${laudo.id}')">📄 PDF</button>
        <button class="btn btn-secondary btn-small" onclick="abrirEditorLaudoAdmin('${laudo.id}')">✏️ Editar</button>
        <button class="btn btn-ghost btn-small" onclick="fecharViewerLaudoAdmin()">✕ Fechar</button>
      </div>
    </div>
    <div style="background:var(--bg-card2); padding:20px; border-radius:10px; font-size:14px; line-height:1.7; max-height:500px; overflow-y:auto; border:1px solid var(--border);">${markdownSanitizado}</div>
  `;
  panel.classList.remove('hidden');
}

export function fecharViewerLaudoAdmin(): void {
  document.getElementById('admin-laudo-viewer-panel')?.classList.add('hidden');
}

export function abrirEditorLaudoAdmin(laudoId: string): void {
  const laudo = adminHistoryState.laudos.find(l => l.id === laudoId);
  const panel = document.getElementById('admin-laudo-viewer-panel');
  if (!laudo || !panel) return;

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
      <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--primary);">✏️ Editar Conteúdo do Laudo</h4>
      <button class="btn btn-ghost btn-small" onclick="fecharViewerLaudoAdmin()">✕</button>
    </div>
    <div class="form-group"><label class="form-label">Período</label><input type="text" id="admin-edit-laudo-periodo" class="form-input" value="${escapeHtml(laudo.periodo_texto || '')}" /></div>
    <div class="form-group"><label class="form-label">Conteúdo Markdown</label><textarea id="admin-edit-laudo-conteudo" class="form-input" rows="12">${escapeHtml(laudo.conteudo)}</textarea></div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharViewerLaudoAdmin()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEdicaoLaudoAdmin('${laudo.id}')">💾 Salvar</button>
    </div>
  `;
  panel.classList.remove('hidden');
}

export async function salvarEdicaoLaudoAdmin(laudoId: string): Promise<void> {
  const periodo = (document.getElementById('admin-edit-laudo-periodo') as HTMLInputElement)?.value;
  const conteudo = (document.getElementById('admin-edit-laudo-conteudo') as HTMLTextAreaElement)?.value;
  if (!conteudo || conteudo.trim().length < 10) return;

  await atualizarLaudo(laudoId, conteudo.trim(), periodo?.trim());
  mostrarToast('Laudo atualizado!', 'success');
  if (adminHistoryState.targetUid) {
    adminHistoryState.laudos = await buscarLaudos(adminHistoryState.targetUid, true);
  }
  renderizarCrudLaudosAdmin();
  visualizarLaudoAdminInline(laudoId);
}

export function abrirModalCriarLaudoManualAdmin(): void {
  const panel = document.getElementById('admin-laudo-viewer-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
      <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--primary);">✍️ Nova Anotação / Parecer Manual</h4>
      <button class="btn btn-ghost btn-small" onclick="fecharViewerLaudoAdmin()">✕</button>
    </div>
    <div class="form-group"><label class="form-label">Título/Período</label><input type="text" id="admin-manual-laudo-periodo" class="form-input" placeholder="Ex: Avaliação Presencial" /></div>
    <div class="form-group"><label class="form-label">Parecer Clínico</label><textarea id="admin-manual-laudo-conteudo" class="form-input" rows="10" placeholder="Digite o parecer médico..."></textarea></div>
    <div style="display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-secondary" onclick="fecharViewerLaudoAdmin()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarCriacaoLaudoManualAdmin()">💾 Salvar</button>
    </div>
  `;
  panel.classList.remove('hidden');
}

export async function salvarCriacaoLaudoManualAdmin(): Promise<void> {
  const uid = adminHistoryState.targetUid;
  const periodo = (document.getElementById('admin-manual-laudo-periodo') as HTMLInputElement)?.value || 'Anotação Médica';
  const conteudo = (document.getElementById('admin-manual-laudo-conteudo') as HTMLTextAreaElement)?.value;
  if (!uid || !conteudo || conteudo.trim().length < 5) return;

  const idCriado = await criarLaudoManual(uid, conteudo.trim(), periodo.trim(), 'Parecer Médico Admin');
  mostrarToast('Anotação salva!', 'success');
  adminHistoryState.laudos = await buscarLaudos(uid, true);
  renderizarCrudLaudosAdmin();
  visualizarLaudoAdminInline(idCriado);
}

export function inativarLaudoAdminUI(laudoId: string): void {
  abrirModalConfirmacao('Inativar Laudo', 'Deseja inativar este laudo?', async () => {
    await inativarLaudo(laudoId);
    if (adminHistoryState.targetUid) {
      adminHistoryState.laudos = await buscarLaudos(adminHistoryState.targetUid, true);
    }
    renderizarCrudLaudosAdmin();
  });
}

export async function reativarLaudoAdminUI(laudoId: string): Promise<void> {
  await reativarLaudo(laudoId);
  if (adminHistoryState.targetUid) {
    adminHistoryState.laudos = await buscarLaudos(adminHistoryState.targetUid, true);
  }
  renderizarCrudLaudosAdmin();
}

export function excluirLaudoAdminPermanenteUI(laudoId: string): void {
  abrirModalConfirmacao('Excluir Laudo', 'Excluir definitivamente?', async () => {
    await excluirLaudoPermanente(laudoId);
    if (adminHistoryState.targetUid) {
      adminHistoryState.laudos = await buscarLaudos(adminHistoryState.targetUid, true);
    }
    fecharViewerLaudoAdmin();
    renderizarCrudLaudosAdmin();
  }, { textoBtn: 'Excluir', corBtn: 'var(--danger)' });
}

export function copiarTextoLaudoAdmin(laudoId: string): void {
  const laudo = adminHistoryState.laudos.find(l => l.id === laudoId);
  if (laudo) navigator.clipboard.writeText(laudo.conteudo).then(() => mostrarToast('Copiado!', 'success'));
}

export async function exportarLaudoAdminParaPDF(laudoId: string): Promise<void> {
  const laudo = adminHistoryState.laudos.find(l => l.id === laudoId);
  if (!laudo) return;
  const wrapper = criarWrapperPDF();
  wrapper.innerHTML = `
    ${gerarHTMLCabecalhoPDF('Relatório de Conduta IA (Admin)', formatarDataHora(laudo.data_geracao), adminHistoryState.targetNome, [`Período: ${laudo.periodo_texto || '—'}`])}
    <div class="pdf-section-title">Análise Clínica</div>
    <div class="pdf-laudo-text">${laudo.conteudo}</div>
    ${gerarHTMLRodapePDF()}`;
  await salvarPDF(wrapper, `laudo-${adminHistoryState.targetNome.toLowerCase()}-${laudo.data_geracao.toISOString().split('T')[0]}.pdf`);
  mostrarToast('PDF baixado!', 'success');
}
