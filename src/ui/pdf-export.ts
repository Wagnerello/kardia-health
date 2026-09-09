import { logger } from '../services/logger';
import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import { buscarAfericoes } from '../services/afericoes';
import { buscarGlicemias } from '../services/glicemia';
import { buscarHistoricoPeso } from '../services/peso';
import { buscarAnalisesDiarias } from '../services/analise-diaria';
import { buscarHistoricoAgua } from '../services/agua';
import {
  criarWrapperPDF,
  gerarHTMLCabecalhoPDF,
  gerarHTMLRodapePDF,
  salvarPDF,
  SPINNER_SVG,
  PDF_ICON,
} from './pdf-templates';
import {
  setAdminPdfUid,
  exportarHistoricoAdminParaPDF
} from './pdf-export-admin';
import {
  combinarRegistrosPDF,
  calcularEstatisticasPDF,
  gerarHtmlGridStatsPDF,
  gerarLinhasTabelaUnificadaPDF,
} from './pdf-report-builder';
import type { ItemRegistroPDF, EstatisticasPDF } from './pdf-report-builder';

export {
  setAdminPdfUid,
  exportarHistoricoAdminParaPDF
};

function formatarDataNomeArquivo(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}-${mes}-${ano}`;
}

function criarWrapperLaudoPDF(nomeUsuario: string, laudoTexto: string): HTMLDivElement {
  const periodoEl = document.getElementById('laudo-periodo') as HTMLSelectElement;
  const periodo = periodoEl ? `${periodoEl.value} dias` : '—';
  const dataGeracao = document.getElementById('laudo-data-geracao')?.innerText || '';

  const wrapper = criarWrapperPDF();
  wrapper.innerHTML = `
    ${gerarHTMLCabecalhoPDF('Relatório de Conduta IA', dataGeracao, nomeUsuario, [`Período analisado: ${periodo}`])}
    <div class="pdf-section-title">Análise e Conduta — IA Médica (OMS)</div>
    <div class="pdf-laudo-text">${laudoTexto}</div>
    ${gerarHTMLRodapePDF()}`;
  return wrapper;
}

export const exportarLaudoParaPDF = async (): Promise<void> => {
  const btn = document.getElementById('btn-exportar-laudo-pdf') as HTMLButtonElement;
  const contentEl = document.getElementById('laudo-resultado-content');
  if (!contentEl?.innerText.trim()) {
    mostrarToast('Gere o laudo antes de exportar.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `${SPINNER_SVG(14)} Gerando...`;

  try {
    const nomeUsuario = state.userProfile?.nome || state.currentUser?.displayName || 'Paciente';
    const wrapper = criarWrapperLaudoPDF(nomeUsuario, contentEl.innerText);
    const nomeSanitizado = nomeUsuario.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase();
    await salvarPDF(wrapper, `laudo-${nomeSanitizado}-${formatarDataNomeArquivo(new Date())}.pdf`);
    mostrarToast('Laudo exportado com sucesso!', 'success');
  } catch (err) {
    logger.error('Erro ao exportar laudo:', err);
    mostrarToast('Erro ao gerar o PDF.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${PDF_ICON(14)} Exportar PDF`;
  }
};

async function carregarDadosHistoricoUsuario(uid: string) {
  const [afericoes, glicemias, pesos, analises, aguaLogs] = await Promise.all([
    buscarAfericoes(uid, 90),
    buscarGlicemias(uid, 90),
    buscarHistoricoPeso(uid),
    buscarAnalisesDiarias(uid),
    buscarHistoricoAgua(uid),
  ]);
  return { afericoes, glicemias, pesos, analises, aguaLogs };
}

function criarWrapperHistoricoUserPDF(
  nomeUsuario: string,
  combined: ItemRegistroPDF[],
  stats: EstatisticasPDF,
  linhasTabela: string
): HTMLDivElement {
  const dtInicioUser = combined[0].data_hora;
  const dtFimUser = combined[combined.length - 1].data_hora;
  const periodoStrUser = `${dtInicioUser.toLocaleDateString('pt-BR')} – ${dtFimUser.toLocaleDateString('pt-BR')}`;

  const wrapper = criarWrapperPDF();
  wrapper.innerHTML = `
    ${gerarHTMLCabecalhoPDF('Relatório de Histórico Unificado', `Período: ${periodoStrUser}`, nomeUsuario, [`Total de registros: ${combined.length}`])}
    ${gerarHtmlGridStatsPDF(stats)}
    <div class="pdf-section-title">Registros Unificados (Pressão, Glicemia, Peso)</div>
    <table class="pdf-table">
      <thead><tr>
        <th>Data / Hora</th><th>Tipo</th><th>Resultado</th><th>Classificação</th><th>Contexto</th>
      </tr></thead>
      <tbody>${linhasTabela}</tbody>
    </table>
    ${gerarHTMLRodapePDF()}`;
  return wrapper;
}

function obterFiltrosHistoricoUser() {
  const dtInicioInput = (document.getElementById('user-pdf-inicio') as HTMLInputElement)?.value;
  const dtFimInput = (document.getElementById('user-pdf-fim') as HTMLInputElement)?.value;
  const tipoRelatorio = (document.getElementById('user-pdf-tipo') as HTMLSelectElement)?.value || 'detalhado';
  return { dtInicioInput, dtFimInput, tipoRelatorio };
}

async function executarExportacaoHistoricoUser(uid: string): Promise<boolean> {
  const { afericoes, glicemias, pesos, analises, aguaLogs } = await carregarDadosHistoricoUsuario(uid);
  const { dtInicioInput, dtFimInput, tipoRelatorio } = obterFiltrosHistoricoUser();

  const combined = combinarRegistrosPDF({ afericoes, glicemias, pesos, dtInicioInput, dtFimInput });
  if (combined.length === 0) {
    mostrarToast('Nenhuma aferição no período selecionado.', 'error');
    return false;
  }

  const nomeUsuario = state.userProfile?.nome || state.currentUser?.displayName || 'Paciente';
  const analisesMap = new Map<string, string>();
  analises.forEach(an => analisesMap.set(an.data_str, an.feedback));

  const stats = calcularEstatisticasPDF({ afericoes, glicemias, pesos, aguaLogs, total: combined.length });
  const linhasTabela = await gerarLinhasTabelaUnificadaPDF(combined, analisesMap, tipoRelatorio);
  const wrapper = criarWrapperHistoricoUserPDF(nomeUsuario, combined, stats, linhasTabela);

  await salvarPDF(wrapper, `historico-${nomeUsuario.trim().toUpperCase()}-${formatarDataNomeArquivo(new Date())}.pdf`);
  mostrarToast('Histórico unificado exportado com sucesso!', 'success');
  return true;
}

export const exportarHistoricoParaPDF = async (): Promise<void> => {
  if (!state.currentUser) return;
  const btn = document.getElementById('btn-exportar-historico-pdf') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = `${SPINNER_SVG(16)} Gerando...`;

  try {
    await executarExportacaoHistoricoUser(state.currentUser.uid);
  } catch (err) {
    logger.error('Erro ao exportar histórico unificado:', err);
    mostrarToast('Erro ao gerar o PDF.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${PDF_ICON(16)} Exportar PDF`;
  }
};

window.exportarLaudoParaPDF = exportarLaudoParaPDF;
window.exportarHistoricoParaPDF = exportarHistoricoParaPDF;
