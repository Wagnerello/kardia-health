import { logger } from '../services/logger';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { state } from './app-state';
import { mostrarToast, abrirModalConfirmacao } from './ui-utils';
import { inativarLaudo } from '../services/afericoes';
import type { SavedLaudo } from '../services/laudos';
import { formatarDataHora } from '../types';
import { criarWrapperPDF, gerarHTMLCabecalhoPDF, gerarHTMLRodapePDF, salvarPDF } from './pdf-templates';

export const laudosCacheMap = new Map<string, SavedLaudo>();
export let laudoAtualModal: SavedLaudo | null = null;

export const setLaudoAtualModal = (laudo: SavedLaudo | null) => {
  laudoAtualModal = laudo;
};

export const inativarLaudoUI = (laudoId: string, onSucesso?: () => Promise<void>) => {
  abrirModalConfirmacao(
    'Inativar Laudo',
    'Tem certeza que deseja inativar este laudo? Ele deixará de ser exibido para os usuários.',
    async () => {
      try {
        await inativarLaudo(laudoId);
        mostrarToast('Laudo inativado com sucesso.', 'success');
        if (onSucesso) await onSucesso();
      } catch (err) {
        logger.error('Erro ao inativar laudo:', err);
        mostrarToast('Erro ao inativar o laudo.', 'error');
      }
    }
  );
};

export const abrirModalVisualizarLaudo = async (id: string) => {
  const laudo = laudosCacheMap.get(id);
  if (!laudo) return;

  laudoAtualModal = laudo;
  const modal = document.getElementById('modal-visualizar-laudo');
  const contentEl = document.getElementById('modal-laudo-content');
  const dataEl = document.getElementById('modal-laudo-data');
  const btnInativar = document.getElementById('btn-inativar-laudo-modal');

  if (btnInativar) {
    btnInativar.style.display = (state.userProfile?.role === 'ADMIN' && laudo.ativo !== false) ? 'inline-flex' : 'none';
  }

  if (contentEl) {
    contentEl.innerHTML = DOMPurify.sanitize(await marked.parse(laudo.conteudo));
  }
  if (dataEl) {
    const dt = formatarDataHora(laudo.data_geracao);
    const statusText = laudo.ativo === false ? ' · <span style="color:var(--danger);font-weight:700;">INATIVO</span>' : '';
    dataEl.innerHTML = `Gerado em ${dt} ${laudo.dias_analisados ? `(${laudo.dias_analisados} dias)` : ''}${statusText}`;
  }

  if (modal) modal.classList.remove('hidden');
};

export const fecharModalVisualizarLaudo = () => {
  const modal = document.getElementById('modal-visualizar-laudo');
  if (modal) modal.classList.add('hidden');
  laudoAtualModal = null;
};

export const copiarLaudoModalAtual = () => {
  const el = document.getElementById('modal-laudo-content');
  if (el) {
    navigator.clipboard.writeText(el.innerText).then(() => {
      mostrarToast('Laudo copiado para a área de transferência!', 'success');
    });
  }
};

export const exportarLaudoPorIdParaPDF = async (id: string) => {
  const laudo = laudosCacheMap.get(id);
  if (!laudo) return;

  try {
    const nomeUsuario = state.userProfile?.nome || state.currentUser?.displayName || 'Paciente';
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
    logger.error('Erro ao exportar laudo para PDF:', err);
    mostrarToast('Erro ao gerar o PDF.', 'error');
  }
};

// Vinculação global
window.inativarLaudoUI = inativarLaudoUI;
window.inativarLaudoModalAtual = () => {
  if (laudoAtualModal && laudoAtualModal.id) {
    fecharModalVisualizarLaudo();
    inativarLaudoUI(laudoAtualModal.id, window.carregarLaudos);
  }
};
window.abrirModalVisualizarLaudo = abrirModalVisualizarLaudo;
window.abrirModalUltimoLaudo = async () => {
  const laudosArray = Array.from(laudosCacheMap.values());
  if (laudosArray.length > 0) {
    await abrirModalVisualizarLaudo(laudosArray[0].id);
  } else {
    mostrarToast('Nenhum laudo gerado ainda.', 'info');
  }
};
window.fecharModalVisualizarLaudo = fecharModalVisualizarLaudo;
window.copiarLaudoModalAtual = copiarLaudoModalAtual;
window.exportarLaudoModalParaPDF = async () => {
  if (!laudoAtualModal) return;
  await exportarLaudoPorIdParaPDF(laudoAtualModal.id);
};
window.exportarLaudoPorIdParaPDF = exportarLaudoPorIdParaPDF;
