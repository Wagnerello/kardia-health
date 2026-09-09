import { classificarPressao, classificarGlicemia, formatarData, formatarDataHora } from '../types';
import type { BpReading, GlicemiaReading, DailyWaterLog, PesoLog } from '../types';
import { obterBadgePDF } from './pdf-templates';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export interface ItemRegistroPDF {
  tipo: 'pressao' | 'glicemia' | 'peso';
  id?: string;
  timestamp: number;
  data_hora: Date;
  originalBp?: BpReading;
  originalGlicemia?: GlicemiaReading;
  originalPeso?: PesoLog;
}

export interface EstatisticasPDF {
  total: number;
  countPressao: number;
  mediaSys: number | string;
  mediaDia: number | string;
  countGlicemia: number;
  mediaGlicemia: number | string;
  ultimoPeso: string;
  mediaAguaL: string;
}

export interface CombinarRegistrosOpts {
  afericoes: BpReading[];
  glicemias: GlicemiaReading[];
  pesos: PesoLog[];
  dtInicioInput?: string;
  dtFimInput?: string;
}

export interface EstatisticasDadosOpts {
  afericoes: BpReading[];
  glicemias: GlicemiaReading[];
  pesos: PesoLog[];
  aguaLogs: DailyWaterLog[];
  total: number;
}

export function combinarRegistrosPDF(opts: CombinarRegistrosOpts): ItemRegistroPDF[] {
  const { afericoes, glicemias, pesos, dtInicioInput, dtFimInput } = opts;
  let combined: ItemRegistroPDF[] = [];

  afericoes.forEach(a => combined.push({
    tipo: 'pressao',
    id: a.id,
    timestamp: a.data_hora_afericao.getTime(),
    data_hora: a.data_hora_afericao,
    originalBp: a,
  }));

  glicemias.forEach(g => combined.push({
    tipo: 'glicemia',
    id: g.id,
    timestamp: g.data_hora_afericao.getTime(),
    data_hora: g.data_hora_afericao,
    originalGlicemia: g,
  }));

  pesos.forEach(p => combined.push({
    tipo: 'peso',
    id: p.id,
    timestamp: p.data.getTime(),
    data_hora: p.data,
    originalPeso: p,
  }));

  if (dtInicioInput) {
    const start = new Date(dtInicioInput + 'T00:00:00');
    combined = combined.filter(c => c.data_hora >= start);
  }
  if (dtFimInput) {
    const end = new Date(dtFimInput + 'T23:59:59');
    combined = combined.filter(c => c.data_hora <= end);
  }

  return combined.sort((a, b) => a.timestamp - b.timestamp);
}

export function calcularEstatisticasPDF(opts: EstatisticasDadosOpts): EstatisticasPDF {
  const { afericoes, glicemias, pesos, aguaLogs, total } = opts;
  const countPressao = afericoes.length;
  const mediaSys = countPressao > 0 ? Math.round(afericoes.reduce((s, a) => s + a.sys, 0) / countPressao) : '--';
  const mediaDia = countPressao > 0 ? Math.round(afericoes.reduce((s, a) => s + a.dia, 0) / countPressao) : '--';

  const countGlicemia = glicemias.length;
  const mediaGlicemia = countGlicemia > 0 ? Math.round(glicemias.reduce((s, g) => s + g.valor, 0) / countGlicemia) : '--';

  const ultimoPeso = pesos.length > 0 ? `${pesos[pesos.length - 1].peso}kg` : '--';

  const diasComAgua = new Set(aguaLogs.map(a => a.date_string)).size;
  const mediaAgua = diasComAgua > 0 ? Math.round(aguaLogs.reduce((acc, log) => acc + log.amount_ml, 0) / diasComAgua) : 0;
  const mediaAguaL = mediaAgua > 0 ? `${(mediaAgua / 1000).toFixed(1)}L` : '--';

  return {
    total,
    countPressao,
    mediaSys,
    mediaDia,
    countGlicemia,
    mediaGlicemia,
    ultimoPeso,
    mediaAguaL,
  };
}

export function gerarHtmlGridStatsPDF(stats: EstatisticasPDF): string {
  return `
    <div class="pdf-stats-grid" style="grid-template-columns:repeat(5,1fr);">
      <div class="pdf-stat-card">
        <div class="pdf-stat-value">${stats.mediaSys}<span class="pdf-stat-unit">/</span>${stats.mediaDia}</div>
        <div class="pdf-stat-label">Média Pressão (mmHg)</div>
      </div>
      <div class="pdf-stat-card">
        <div class="pdf-stat-value">${stats.mediaGlicemia}<span class="pdf-stat-unit">mg/dL</span></div>
        <div class="pdf-stat-label">Média Glicemia</div>
      </div>
      <div class="pdf-stat-card">
        <div class="pdf-stat-value">${stats.ultimoPeso}</div>
        <div class="pdf-stat-label">Último Peso</div>
      </div>
      <div class="pdf-stat-card">
        <div class="pdf-stat-value">${stats.total}</div>
        <div class="pdf-stat-label">Medições (Total)</div>
      </div>
      <div class="pdf-stat-card">
        <div class="pdf-stat-value" style="color:#3b82f6;">${stats.mediaAguaL}</div>
        <div class="pdf-stat-label">Média Água/dia</div>
      </div>
    </div>`;
}

function renderizarLinhaPressao(dt: string, a: BpReading): string {
  const clf = classificarPressao(a.sys, a.dia);
  const resultado = `<span style="font-weight:700;color:#6366f1;">${a.sys} / ${a.dia} <span style="font-size:11px;color:#94a3b8;">mmHg</span></span>`;
  const classificacao = obterBadgePDF(clf.label);
  const contexto = `Pulso: ${a.pul} bpm`;
  return `
    <tr>
      <td>${dt}</td>
      <td style="font-weight:600;color:#475569;">Pressão</td>
      <td>${resultado}</td>
      <td>${classificacao}</td>
      <td style="color:#64748b;font-size:11px;line-height:1.4;">${contexto}</td>
    </tr>`;
}

function renderizarLinhaGlicemia(dt: string, g: GlicemiaReading): string {
  const clf = classificarGlicemia(g.valor, g.momento);
  const resultado = `<span style="font-weight:700;color:#f59e0b;">${g.valor} <span style="font-size:11px;color:#94a3b8;">mg/dL</span></span>`;
  const classificacao = obterBadgePDF(clf.label);
  const contexto = `Momento: ${g.momento.charAt(0).toUpperCase() + g.momento.slice(1)}`;
  return `
    <tr>
      <td>${dt}</td>
      <td style="font-weight:600;color:#475569;">Glicemia</td>
      <td>${resultado}</td>
      <td>${classificacao}</td>
      <td style="color:#64748b;font-size:11px;line-height:1.4;">${contexto}</td>
    </tr>`;
}

function renderizarLinhaPeso(dt: string, p: PesoLog): string {
  const resultado = `<span style="font-weight:700;color:#10b981;">${p.peso} <span style="font-size:11px;color:#94a3b8;">kg</span></span>`;
  return `
    <tr>
      <td>${dt}</td>
      <td style="font-weight:600;color:#475569;">Peso</td>
      <td>${resultado}</td>
      <td>--</td>
      <td style="color:#64748b;font-size:11px;line-height:1.4;">Registro de Peso</td>
    </tr>`;
}

function renderizarLinhaItemPDF(item: ItemRegistroPDF): string {
  const dt = formatarDataHora(item.data_hora);
  if (item.tipo === 'pressao' && item.originalBp) {
    return renderizarLinhaPressao(dt, item.originalBp);
  }
  if (item.tipo === 'glicemia' && item.originalGlicemia) {
    return renderizarLinhaGlicemia(dt, item.originalGlicemia);
  }
  if (item.tipo === 'peso' && item.originalPeso) {
    return renderizarLinhaPeso(dt, item.originalPeso);
  }
  return '';
}

export async function gerarLinhasTabelaUnificadaPDF(
  combined: ItemRegistroPDF[],
  analisesMap: Map<string, string>,
  tipoRelatorio: string
): Promise<string> {
  const groups: Record<string, ItemRegistroPDF[]> = {};
  combined.forEach(item => {
    const dtStr = formatarData(item.data_hora);
    if (!groups[dtStr]) groups[dtStr] = [];
    groups[dtStr].push(item);
  });

  const linhasPromises = Object.entries(groups).map(async ([dtStr, itensDia]) => {
    const linhasItens = itensDia.map(renderizarLinhaItemPDF).join('');
    let linhaResumoIA = '';

    if (tipoRelatorio === 'detalhado' && analisesMap.has(dtStr)) {
      const parsed = await marked.parse(String(analisesMap.get(dtStr) || ''));
      linhaResumoIA = `
        <tr style="background-color: #f8fafc;">
          <td colspan="5" style="padding: 8px 12px; font-size: 11px; color: #475569; line-height: 1.4; border-bottom: 2px solid #e2e8f0;">
            <div style="font-weight: 700; color: #3b82f6; margin-bottom: 4px;">🩺 Resumo da IA (${dtStr}):</div>
            ${DOMPurify.sanitize(parsed as string)}
          </td>
        </tr>`;
    }

    return linhasItens + linhaResumoIA;
  });

  const resultados = await Promise.all(linhasPromises);
  return resultados.join('');
}
