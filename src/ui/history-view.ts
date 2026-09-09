import { logger } from '../services/logger';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { state } from './app-state';
import { formatarData, formatarDataHora, classificarPressao, classificarGlicemia } from '../types';
import type { BpReading, GlicemiaReading, PesoLog } from '../types';
import { buscarAfericoes } from '../services/afericoes';
import { buscarAnalisesDiarias, type AnaliseDiaria, type AnaliseRecordItem } from '../services/analise-diaria';
import { buscarGlicemias } from '../services/glicemia';
import { buscarHistoricoPeso } from '../services/auth';
import {
  reprocessarIADoDia,
  reprocessarIADaAfericao,
  reprocessarIAsEmLoteAdmin,
  abrirModalDetalheAnalise,
  fecharModalDetalheAnalise
} from './history-ai';

export {
  reprocessarIADoDia,
  reprocessarIADaAfericao,
  reprocessarIAsEmLoteAdmin,
  abrirModalDetalheAnalise,
  fecharModalDetalheAnalise
};

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export interface HistoricoItem {
  tipo: 'pressao' | 'glicemia' | 'peso';
  id?: string;
  timestamp: number;
  data_hora: Date;
  original: BpReading | GlicemiaReading | PesoLog;
}

interface GroupMes {
  key: string;
  label: string;
  totalItens: number;
  diasMap: Record<string, HistoricoItem[]>;
}

export function toggleHistoricoMesGroup(groupId: string): void {
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
}

export function verDetalhe(_id: string): void {
  // Hook para expansão futura
}

async function coletarItensHistorico(uid: string): Promise<HistoricoItem[]> {
  const [afericoes, glicemias, pesos] = await Promise.all([
    buscarAfericoes(uid, 365),
    buscarGlicemias(uid, 365),
    buscarHistoricoPeso(uid)
  ]);

  const items: HistoricoItem[] = [];
  afericoes.forEach(a => items.push({ tipo: 'pressao', id: a.id, timestamp: a.data_hora_afericao.getTime(), data_hora: a.data_hora_afericao, original: a }));
  glicemias.forEach(g => items.push({ tipo: 'glicemia', id: g.id, timestamp: g.data_hora_afericao.getTime(), data_hora: g.data_hora_afericao, original: g }));
  pesos.forEach(p => items.push({ tipo: 'peso', id: p.id, timestamp: p.data.getTime(), data_hora: p.data, original: p }));

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

function renderizarItemPressao(item: HistoricoItem): string {
  const a = item.original as BpReading;
  const clf = classificarPressao(a.sys, a.dia);
  const dt = formatarDataHora(item.data_hora);
  const label = clf.label.toLowerCase();
  const classeNivel = label.includes('normal') ? 'normal'
    : label.includes('elevad') ? 'elevada'
    : label.includes('crise') ? 'crise'
    : 'hipertensao';

  return `
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
}

function renderizarItemGlicemia(item: HistoricoItem): string {
  const g = item.original as GlicemiaReading;
  const clf = classificarGlicemia(g.valor, g.momento);
  const dt = formatarDataHora(item.data_hora);
  const label = clf.label.toLowerCase();
  const classeNivel = label.includes('hipo') ? 'hipoglicemia'
    : label.includes('normal') ? 'glicemia-normal'
    : (label.includes('pre') || label.includes('pré')) ? 'glicemia-pre_diabetes'
    : label.includes('grave') ? 'hiperglicemia_grave'
    : 'glicemia-diabetes';
  
  const momentosMap: Record<string, string> = { jejum: 'Jejum', pos_prandial: 'Pós-Prandial', antes_dormir: 'Antes de Dormir', aleatorio: 'Aleatório' };

  return `
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
}

function renderizarItemPeso(item: HistoricoItem): string {
  const p = item.original as PesoLog;
  const dt = formatarDataHora(item.data_hora);
  return `
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

function renderizarItemHistorico(item: HistoricoItem): string {
  if (item.tipo === 'pressao') return renderizarItemPressao(item);
  if (item.tipo === 'glicemia') return renderizarItemGlicemia(item);
  return renderizarItemPeso(item);
}

async function renderizarCardFeedbackDia(dtStr: string, feedback?: string): Promise<string> {
  const feedbackText = feedback || 'Análise diária indisponível.';
  const parsedFeedback = await marked.parse(String(feedbackText));

  return `
  <div class="ai-feedback" style="display:flex; flex-direction:column; gap:8px; align-items:flex-start; margin-top:12px; background:var(--surface-variant); border-radius:12px; padding:12px;">
    <div style="display:flex; gap:8px;">
      <span class="ai-icon" style="margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></span>
      <span id="ai-feedback-text-${dtStr.replace(/\//g, '-')}">${DOMPurify.sanitize(parsedFeedback as string)}</span>
    </div>
    <button class="btn btn-ghost btn-small" onclick="event.stopPropagation(); window.reprocessarIADoDia('${dtStr}')" id="btn-reprocess-day-${dtStr.replace(/\//g, '-')}" style="padding:6px 12px; font-size:12px; align-self:flex-end;">
      ${feedback ? 'Atualizar IA do Dia' : 'Gerar IA do Dia'}
    </button>
  </div>`;
}

function agruparPorMes(combined: HistoricoItem[]) {
  const mesesMap: Record<string, GroupMes> = {};
  const legacyGroups: Record<string, HistoricoItem[]> = {};

  combined.forEach(item => {
    const dt = item.data_hora;
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

  return { mesesMap, legacyGroups };
}

async function renderizarDiasDoMes(diasMap: Record<string, HistoricoItem[]>, analisesMap: Map<string, string>): Promise<string> {
  let html = '';
  for (const [dtStr, itensDia] of Object.entries(diasMap)) {
    html += `<div class="history-day-group" style="margin-bottom: 20px;">`;
    html += `<div class="section-divider" style="margin-bottom: 12px;">
               <div class="section-divider-line"></div>
               <span class="section-divider-label">${dtStr}</span>
               <div class="section-divider-line"></div>
             </div>`;
    
    itensDia.forEach(item => {
      html += renderizarItemHistorico(item);
    });

    html += await renderizarCardFeedbackDia(dtStr, analisesMap.get(dtStr));
    html += `</div>`;
  }
  return html;
}

async function gerarHtmlMesesHistorico(mesesMap: Record<string, GroupMes>, analisesMap: Map<string, string>): Promise<string> {
  const mesesOrdenados = Object.values(mesesMap).sort((a, b) => b.key.localeCompare(a.key));
  let html = '';

  for (let mIdx = 0; mIdx < mesesOrdenados.length; mIdx++) {
    const mesGroup = mesesOrdenados[mIdx];
    const isAberto = mIdx === 0;
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

    html += await renderizarDiasDoMes(mesGroup.diasMap, analisesMap);
    html += `</div></div>`;
  }
  return html;
}

export async function carregarHistorico(): Promise<void> {
  if (!state.currentUser) {
    logger.error('[carregarHistorico] currentUser is null – aborting.');
    return;
  }
  const list = document.getElementById('historico-list');
  if (!list) return;

  list.innerHTML = '<div class="ocr-loading"><div class="ocr-spinner"></div><p style="color:var(--text-muted)">Carregando...</p></div>';
  try {
    const combined = await coletarItensHistorico(state.currentUser.uid);
    if (combined.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon" style="color:var(--primary)"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></div><div class="empty-title">Sem registros</div><p class="empty-sub">Adicione medições para ver o histórico unificado aqui.</p></div>';
      return;
    }

    const analises = await buscarAnalisesDiarias(state.currentUser.uid);
    const analisesMap = new Map<string, string>();
    analises.forEach((an: AnaliseDiaria) => analisesMap.set(an.data_str, an.feedback));

    const { mesesMap, legacyGroups } = agruparPorMes(combined);
    window.histDataGroups = legacyGroups as unknown as Record<string, AnaliseRecordItem[]>;

    list.innerHTML = await gerarHtmlMesesHistorico(mesesMap, analisesMap);
  } catch (err) {
    logger.error('Erro no carregarHistorico', err);
    list.innerHTML = '<div class="empty-state"><div class="empty-icon" style="color:var(--danger)"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div><div class="empty-title">Erro ao carregar</div></div>';
  }
}

// Vinculação global
window.toggleHistoricoMesGroup = toggleHistoricoMesGroup;
window.carregarHistorico = carregarHistorico;
window.verDetalhe = verDetalhe;
