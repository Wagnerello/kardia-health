import { logger } from '../services/logger';
import { state } from './app-state';
import { mostrarToast, abrirModalConfirmacao } from './ui-utils';
import {
  inativarLaudo,
  atualizarLaudo,
  criarLaudoManual,
  excluirLaudoPermanente,
  type SavedLaudo
} from '../services/laudos';
import { formatarDataHora } from '../types';
import { criarWrapperPDF, gerarHTMLCabecalhoPDF, gerarHTMLRodapePDF, salvarPDF } from './pdf-templates';
import { abrirLaudoEmNovaJanela } from './laudo-window';

export const laudosCacheMap = new Map<string, SavedLaudo>();
export let laudoAtualModal: SavedLaudo | null = null;

export const setLaudoAtualModal = (laudo: SavedLaudo | null) => {
  laudoAtualModal = laudo;
};

// CRUD - Soft Delete / Inativar
export const inativarLaudoUI = (laudoId: string, onSucesso?: () => Promise<void>) => {
  abrirModalConfirmacao(
    'Inativar Laudo',
    'Tem certeza que deseja inativar este laudo? Ele deixará de ser exibido no histórico ativo.',
    async () => {
      try {
        await inativarLaudo(laudoId);
        const l = laudosCacheMap.get(laudoId);
        if (l) l.ativo = false;
        mostrarToast('Laudo inativado com sucesso.', 'success');
        if (onSucesso) await onSucesso();
      } catch (err) {
        logger.error('Erro ao inativar laudo:', err);
        mostrarToast('Erro ao inativar o laudo.', 'error');
      }
    }
  );
};

// CRUD - Hard Delete / Excluir Permanente (Admin/Médico)
export const excluirLaudoPermanenteUI = (laudoId: string, onSucesso?: () => Promise<void>) => {
  abrirModalConfirmacao(
    'Excluir Laudo Permanentemente',
    'Esta ação não pode ser desfeita. O laudo clínico será removido em definitivo do banco de dados.',
    async () => {
      try {
        await excluirLaudoPermanente(laudoId);
        laudosCacheMap.delete(laudoId);
        mostrarToast('Laudo excluído permanentemente com sucesso.', 'success');
        if (onSucesso) await onSucesso();
      } catch (err) {
        logger.error('Erro ao excluir laudo:', err);
        mostrarToast('Erro ao excluir o laudo.', 'error');
      }
    }
  );
};

// CRUD - Read
export const abrirLaudoPorId = (id: string): void => {
  const laudo = laudosCacheMap.get(id);
  if (!laudo) {
    mostrarToast('Laudo não encontrado no histórico.', 'error');
    return;
  }

  laudoAtualModal = laudo;
  const nomeUsuario = state.userProfile?.nome || state.currentUser?.displayName || 'Paciente';

  abrirLaudoEmNovaJanela({
    titulo: 'Relatório Clínico Integrado',
    conteudoMarkdown: laudo.conteudo,
    nomePaciente: nomeUsuario,
    dataGeracao: laudo.data_geracao,
    diasAnalisados: laudo.dias_analisados,
    periodoTexto: laudo.periodo_texto,
    modeloUsado: laudo.modelo_usado || 'Gemini 2.5 Flash',
    detalhesClinicos: {
      idade: state.userProfile?.idade,
      sexo: state.userProfile?.sexo,
      peso: state.userProfile?.peso,
      altura: state.userProfile?.altura
    }
  });
};

export const abrirModalVisualizarLaudo = async (id: string): Promise<void> => {
  abrirLaudoPorId(id);
};

export const fecharModalVisualizarLaudo = (): void => {
  const modal = document.getElementById('modal-visualizar-laudo');
  if (modal) modal.classList.add('hidden');
  laudoAtualModal = null;
};

// CRUD - Update / Editar Laudo
export const abrirModalEditarLaudo = (id: string): void => {
  const laudo = laudosCacheMap.get(id);
  if (!laudo) {
    mostrarToast('Laudo não encontrado para edição.', 'error');
    return;
  }

  const idInput = document.getElementById('editar-laudo-id') as HTMLInputElement;
  const periodoInput = document.getElementById('editar-laudo-periodo') as HTMLInputElement;
  const conteudoInput = document.getElementById('editar-laudo-conteudo') as HTMLTextAreaElement;
  const modal = document.getElementById('modal-editar-laudo');

  if (!modal || !idInput || !periodoInput || !conteudoInput) return;

  idInput.value = laudo.id;
  periodoInput.value = laudo.periodo_texto || (laudo.dias_analisados ? `Últimos ${laudo.dias_analisados} dias` : 'Avaliação Clínica');
  conteudoInput.value = laudo.conteudo;

  modal.classList.remove('hidden');
};

export const fecharModalEditarLaudo = (): void => {
  const modal = document.getElementById('modal-editar-laudo');
  if (modal) modal.classList.add('hidden');
};

export const salvarEdicaoLaudoUI = async (): Promise<void> => {
  const idInput = document.getElementById('editar-laudo-id') as HTMLInputElement;
  const periodoInput = document.getElementById('editar-laudo-periodo') as HTMLInputElement;
  const conteudoInput = document.getElementById('editar-laudo-conteudo') as HTMLTextAreaElement;
  const btnSalvar = document.getElementById('btn-salvar-edicao-laudo') as HTMLButtonElement;

  if (!idInput?.value || !conteudoInput?.value.trim()) {
    mostrarToast('Por favor, preencha o conteúdo do laudo.', 'error');
    return;
  }

  const id = idInput.value;
  const novoConteudo = conteudoInput.value.trim();
  const novoPeriodo = periodoInput?.value.trim() || undefined;

  if (btnSalvar) btnSalvar.disabled = true;

  try {
    await atualizarLaudo(id, novoConteudo, novoPeriodo);
    const laudoCached = laudosCacheMap.get(id);
    if (laudoCached) {
      laudoCached.conteudo = novoConteudo;
      if (novoPeriodo) laudoCached.periodo_texto = novoPeriodo;
      laudoCached.data_atualizacao = new Date();
    }

    fecharModalEditarLaudo();
    mostrarToast('Laudo clínico atualizado com sucesso!', 'success');
    if (window.carregarLaudos) {
      await window.carregarLaudos();
    }
  } catch (err) {
    logger.error('Erro ao salvar edição do laudo:', err);
    mostrarToast('Erro ao atualizar o laudo.', 'error');
  } finally {
    if (btnSalvar) btnSalvar.disabled = false;
  }
};

// CRUD - Create Manual / Criar Nota Clínica
export const abrirModalCriarLaudoManualUI = (): void => {
  const periodoInput = document.getElementById('criar-laudo-periodo') as HTMLInputElement;
  const conteudoInput = document.getElementById('criar-laudo-conteudo') as HTMLTextAreaElement;
  const modal = document.getElementById('modal-criar-laudo-manual');

  if (!modal) return;
  if (periodoInput) periodoInput.value = '';
  if (conteudoInput) conteudoInput.value = '';

  modal.classList.remove('hidden');
};

export const fecharModalCriarLaudoManual = (): void => {
  const modal = document.getElementById('modal-criar-laudo-manual');
  if (modal) modal.classList.add('hidden');
};

export const salvarCriacaoLaudoManualUI = async (): Promise<void> => {
  if (!state.currentUser) {
    mostrarToast('Usuário não autenticado.', 'error');
    return;
  }

  const periodoInput = document.getElementById('criar-laudo-periodo') as HTMLInputElement;
  const conteudoInput = document.getElementById('criar-laudo-conteudo') as HTMLTextAreaElement;
  const btnSalvar = document.getElementById('btn-salvar-criar-laudo-manual') as HTMLButtonElement;

  const periodo = periodoInput?.value.trim() || 'Consulta / Nota Clínica';
  const conteudo = conteudoInput?.value.trim();

  if (!conteudo) {
    mostrarToast('Por favor, informe as orientações ou parecer do laudo.', 'error');
    return;
  }

  if (btnSalvar) btnSalvar.disabled = true;

  try {
    await criarLaudoManual(state.currentUser.uid, conteudo, periodo, 'Parecer Médico Direto');
    fecharModalCriarLaudoManual();
    mostrarToast('Novo laudo registrado com sucesso no prontuário!', 'success');
    if (window.carregarLaudos) {
      await window.carregarLaudos();
    }
  } catch (err) {
    logger.error('Erro ao criar laudo manual:', err);
    mostrarToast('Erro ao registrar novo laudo.', 'error');
  } finally {
    if (btnSalvar) btnSalvar.disabled = false;
  }
};

export const copiarLaudoModalAtual = (): void => {
  if (laudoAtualModal?.conteudo) {
    navigator.clipboard.writeText(laudoAtualModal.conteudo).then(() => {
      mostrarToast('Laudo copiado para a área de transferência!', 'success');
    });
  }
};

export const abrirLaudoModalEmNovaJanela = (): void => {
  if (!laudoAtualModal) {
    mostrarToast('Nenhum laudo selecionado para exibição.', 'error');
    return;
  }
  abrirLaudoPorId(laudoAtualModal.id);
};

export const exportarLaudoPorIdParaPDF = async (id: string): Promise<void> => {
  const laudo = laudosCacheMap.get(id);
  if (!laudo) return;

  try {
    const nomeUsuario = state.userProfile?.nome || state.currentUser?.displayName || 'Paciente';
    const dataGeracaoStr = formatarDataHora(laudo.data_geracao);
    const periodo = laudo.periodo_texto || (laudo.dias_analisados ? `${laudo.dias_analisados} dias` : '—');

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
window.excluirLaudoPermanenteUI = excluirLaudoPermanenteUI;
window.inativarLaudoModalAtual = () => {
  if (laudoAtualModal && laudoAtualModal.id) {
    fecharModalVisualizarLaudo();
    inativarLaudoUI(laudoAtualModal.id, window.carregarLaudos);
  }
};
window.abrirModalVisualizarLaudo = abrirModalVisualizarLaudo;
window.abrirModalEditarLaudo = abrirModalEditarLaudo;
window.fecharModalEditarLaudo = fecharModalEditarLaudo;
window.salvarEdicaoLaudoUI = salvarEdicaoLaudoUI;
window.abrirModalCriarLaudoManualUI = abrirModalCriarLaudoManualUI;
window.fecharModalCriarLaudoManual = fecharModalCriarLaudoManual;
window.salvarCriacaoLaudoManualUI = salvarCriacaoLaudoManualUI;
window.abrirLaudoModalEmNovaJanela = abrirLaudoModalEmNovaJanela;
window.abrirModalUltimoLaudo = async () => {
  const laudosArray = Array.from(laudosCacheMap.values());
  if (laudosArray.length > 0) {
    abrirLaudoPorId(laudosArray[0].id);
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
