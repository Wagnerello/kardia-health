import { logger } from '../services/logger';
import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import { buscarAfericoes } from '../services/afericoes';
import { buscarGlicemias } from '../services/glicemia';
import { buscarHistoricoPeso } from '../services/peso';
import { buscarAnalisesDiarias } from '../services/analise-diaria';
import { buscarHistoricoAgua } from '../services/agua';
import { classificarPressao } from '../types';
import type { BpReading } from '../types';
import {
  criarWrapperPDF,
  obterBadgePDF,
  gerarHTMLCabecalhoPDF,
  gerarHTMLRodapePDF,
  salvarPDF,
  gerarSVGGrafico,
  SPINNER_SVG,
  PDF_ICON,
} from './pdf-templates';
import {
  combinarRegistrosPDF,
  calcularEstatisticasPDF,
  gerarHtmlGridStatsPDF,
  gerarLinhasTabelaUnificadaPDF,
} from './pdf-report-builder';
import type { ItemRegistroPDF, EstatisticasPDF } from './pdf-report-builder';

let _adminPdfUid: string | null = null;

export const setAdminPdfUid = (uid: string | null): void => {
  _adminPdfUid = uid;
};

function formatarDataNomeArquivo(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}-${mes}-${ano}`;
}

function gerarSecaoDistribuicaoPressao(afericoes: BpReading[]): string {
  const countPressao = afericoes.length;
  if (countPressao === 0) return '';

  const mediaSys = Math.round(afericoes.reduce((s, a) => s + a.sys, 0) / countPressao);
  const mediaDia = Math.round(afericoes.reduce((s, a) => s + a.dia, 0) / countPressao);
  const normalCount = afericoes.filter(a => classificarPressao(a.sys, a.dia).label.toLowerCase().includes('normal')).length;
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

  const sortedAfericoes = [...afericoes].sort((a, b) => a.data_hora_afericao.getTime() - b.data_hora_afericao.getTime());

  return `
    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;text-align:center;">
        <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Classificação Média OMS (Pressão)</div>
        <div style="font-size:28px;font-weight:800;color:#1d4ed8;letter-spacing:-1px;">${mediaSys} / ${mediaDia}</div>
        <div style="margin-top:8px;">${obterBadgePDF(clfMedia.label)}</div>
        <div style="margin-top:8px;font-size:12px;color:#475569;">Índice de normalidade: <strong style="color:#047857;">${Math.round((normalCount / countPressao) * 100)}%</strong></div>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;">
        <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Distribuição por Categoria (Pressão)</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;font-size:12px;color:#475569;padding-bottom:6px;">Categoria</th>
            <th style="text-align:center;font-size:12px;color:#475569;padding-bottom:6px;">Qtd</th>
            <th style="text-align:center;font-size:12px;color:#475569;padding-bottom:6px;">%</th>
          </tr></thead>
          <tbody>${distRows}</tbody>
        </table>
      </div>
    </div>
    
    <div class="pdf-section-title">Dashboard — Evolução Temporal da Pressão e Pulso</div>
    ${gerarSVGGrafico(sortedAfericoes)}`;
}

async function carregarDadosHistoricoAdmin(uid: string) {
  const [afericoes, glicemias, pesos, analises, aguaLogs] = await Promise.all([
    buscarAfericoes(uid, 3650),
    buscarGlicemias(uid, 3650),
    buscarHistoricoPeso(uid),
    buscarAnalisesDiarias(uid),
    buscarHistoricoAgua(uid),
  ]);
  return { afericoes, glicemias, pesos, analises, aguaLogs };
}

interface WrapperAdminPDFOpts {
  nomeDoUsuario: string;
  combined: ItemRegistroPDF[];
  stats: EstatisticasPDF;
  afericoes: BpReading[];
  linhasTabela: string;
}

function criarWrapperHistoricoAdminPDF(opts: WrapperAdminPDFOpts): HTMLDivElement {
  const { nomeDoUsuario, combined, stats, afericoes, linhasTabela } = opts;
  const dtInicio = combined[0].data_hora;
  const dtFim = combined[combined.length - 1].data_hora;
  const periodoStr = `${dtInicio.toLocaleDateString('pt-BR')} – ${dtFim.toLocaleDateString('pt-BR')}`;

  const wrapper = criarWrapperPDF();
  wrapper.innerHTML = `
    ${gerarHTMLCabecalhoPDF(
      'Relatório Clínico Unificado — Visão Admin',
      `Período: ${periodoStr} • Painel Administrativo`,
      nomeDoUsuario,
      [
        `Total de medições: ${combined.length}`,
        `Emitido por: ${state.userProfile?.nome || 'Administrador'}`,
      ]
    )}
    ${gerarHtmlGridStatsPDF(stats)}
    ${gerarSecaoDistribuicaoPressao(afericoes)}
    <div class="pdf-section-title">Histórico Completo de Aferições</div>
    <table class="pdf-table">
      <thead><tr>
        <th>Data / Hora</th><th>Tipo</th><th>Resultado</th><th>Classificação</th><th>Contexto</th>
      </tr></thead>
      <tbody>${linhasTabela}</tbody>
    </table>
    ${gerarHTMLRodapePDF()}`;
  return wrapper;
}

function obterFiltrosHistoricoAdmin() {
  const dtInicioInput = (document.getElementById('admin-pdf-inicio') as HTMLInputElement)?.value;
  const dtFimInput = (document.getElementById('admin-pdf-fim') as HTMLInputElement)?.value;
  const tipoRelatorio = (document.getElementById('admin-pdf-tipo') as HTMLSelectElement)?.value || 'detalhado';
  return { dtInicioInput, dtFimInput, tipoRelatorio };
}

async function executarExportacaoHistoricoAdmin(uid: string, nomeDoUsuario: string): Promise<boolean> {
  const { afericoes, glicemias, pesos, analises, aguaLogs } = await carregarDadosHistoricoAdmin(uid);
  const { dtInicioInput, dtFimInput, tipoRelatorio } = obterFiltrosHistoricoAdmin();

  const combined = combinarRegistrosPDF({ afericoes, glicemias, pesos, dtInicioInput, dtFimInput });
  if (combined.length === 0) {
    mostrarToast('Nenhuma aferição no período selecionado.', 'error');
    return false;
  }

  const analisesMap = new Map<string, string>();
  analises.forEach(an => analisesMap.set(an.data_str, an.feedback));

  const stats = calcularEstatisticasPDF({ afericoes, glicemias, pesos, aguaLogs, total: combined.length });
  const linhasTabela = await gerarLinhasTabelaUnificadaPDF(combined, analisesMap, tipoRelatorio);
  const wrapper = criarWrapperHistoricoAdminPDF({ nomeDoUsuario, combined, stats, afericoes, linhasTabela });

  await salvarPDF(wrapper, `historico-admin-${nomeDoUsuario.trim().toUpperCase()}-${formatarDataNomeArquivo(new Date())}.pdf`);
  mostrarToast('Relatório exportado com sucesso!', 'success');
  return true;
}

export const exportarHistoricoAdminParaPDF = async (): Promise<void> => {
  if (!_adminPdfUid) {
    mostrarToast('Erro: abra o histórico do usuário novamente.', 'error');
    return;
  }

  const nomeDoUsuario = document.getElementById('modal-hist-user-nome')?.textContent?.trim() || 'Usuário';
  const btn = document.getElementById('btn-exportar-admin-pdf') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = `${SPINNER_SVG(13)} Gerando...`;

  try {
    await executarExportacaoHistoricoAdmin(_adminPdfUid, nomeDoUsuario);
  } catch (err) {
    logger.error('Erro ao exportar relatório admin:', err);
    mostrarToast('Erro ao gerar o PDF.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${PDF_ICON(13)} Exportar PDF`;
  }
};

window.exportarHistoricoAdminParaPDF = exportarHistoricoAdminParaPDF;
