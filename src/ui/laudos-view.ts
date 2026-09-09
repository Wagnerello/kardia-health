import { logger } from '../services/logger';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import { buscarLaudos, buscarAfericoes } from '../services/afericoes';
import { buscarGlicemias, gerarLaudoIntegradoIA } from '../services/glicemia';
import type { SavedLaudo } from '../services/laudos';
import type { UserProfile, BpReading, GlicemiaReading } from '../types';
import { formatarDataHora } from '../types';
import {
  laudosCacheMap,
  abrirModalVisualizarLaudo,
  fecharModalVisualizarLaudo,
  copiarLaudoModalAtual,
  inativarLaudoUI,
  exportarLaudoPorIdParaPDF
} from './laudos-modal';

export {
  abrirModalVisualizarLaudo,
  fecharModalVisualizarLaudo,
  copiarLaudoModalAtual,
  inativarLaudoUI,
  exportarLaudoPorIdParaPDF
};

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface GroupLaudoMes {
  key: string;
  label: string;
  laudos: SavedLaudo[];
}

function atualizarProgressoBloqueio(diasComDados: number) {
  const progressoBar = document.getElementById('laudo-progresso-bar') as HTMLElement;
  const progressoTexto = document.getElementById('laudo-progresso-texto');
  if (progressoBar && progressoTexto) {
    const pct = Math.min(100, Math.round((diasComDados / 7) * 100));
    progressoBar.style.width = `${pct}%`;
    progressoTexto.textContent = `${diasComDados} de 7 dias com registros`;
  }
}

async function validarLiberacaoGeracaoLaudo(uid: string, role?: string) {
  const gerarCard = document.getElementById('laudo-gerar-card');
  const bloqueadoCard = document.getElementById('laudo-bloqueado-card');

  if (!gerarCard || !bloqueadoCard) return;

  if (role === 'ADMIN') {
    gerarCard.classList.remove('hidden');
    bloqueadoCard.classList.add('hidden');
    return;
  }

  try {
    const historicoTotal = await buscarAfericoes(uid, 3650);
    const diasComDados = new Set(historicoTotal.map(a => a.data_hora_afericao.toISOString().split('T')[0])).size;
    
    if (diasComDados < 7) {
      gerarCard.classList.add('hidden');
      bloqueadoCard.classList.remove('hidden');
      atualizarProgressoBloqueio(diasComDados);
    } else {
      gerarCard.classList.remove('hidden');
      bloqueadoCard.classList.add('hidden');
    }
  } catch (e) {
    logger.error("Erro ao validar histórico para laudo: ", e);
  }
}

async function renderizarUltimoLaudoContainer(ultimoLaudo: SavedLaudo) {
  const container = document.getElementById('laudo-resultado-container');
  const contentEl = document.getElementById('laudo-resultado-content');
  const previewEl = document.getElementById('laudo-resultado-preview');
  const dataEl = document.getElementById('laudo-data-geracao');

  if (!container || !contentEl || !dataEl) return;

  contentEl.innerHTML = DOMPurify.sanitize(await marked.parse(ultimoLaudo.conteudo));
  if (previewEl) {
    const textoLimpo = ultimoLaudo.conteudo.replace(/[#*`_~>-]/g, ' ').replace(/\s+/g, ' ').trim();
    previewEl.innerText = textoLimpo.length > 200 ? `${textoLimpo.slice(0, 200)}...` : textoLimpo;
  }
  const dtUltimo = formatarDataHora(ultimoLaudo.data_geracao);
  const statusBadgeHtml = ultimoLaudo.ativo === false ? ' <span style="background:var(--danger); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">Inativo (Admin)</span>' : '';
  dataEl.innerHTML = `Gerado em ${dtUltimo} ${ultimoLaudo.dias_analisados ? `(${ultimoLaudo.dias_analisados} dias analisados)` : ''}${statusBadgeHtml}`;
  container.classList.remove('hidden');
}

function renderizarCardLaudoIndividual(l: SavedLaudo, isAdminUser: boolean): string {
  const dt = formatarDataHora(l.data_geracao);
  const lId = l.id || '';
  const preview = l.conteudo.replace(/[#*`_~>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110) + '...';
  const inativo = l.ativo === false;
  const opacityStyle = inativo ? 'opacity: 0.65; border-left: 3px solid var(--danger);' : 'border-left: 3px solid var(--primary);';
  const inativoBadge = inativo ? '<span style="background:var(--danger); color:#fff; padding:1px 5px; border-radius:3px; font-size:9px; font-weight:700;">INATIVO</span>' : '';

  return `
  <div class="laudo-history-card" style="margin-bottom: 8px; padding: 10px 14px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border); ${opacityStyle} display: flex; justify-content: space-between; align-items: center; gap: 12px;">
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--text);">${dt}</span>
        <span style="font-size: 11px; color: var(--text-muted);">· ${l.dias_analisados ? `${l.dias_analisados} dias` : 'Período completo'}</span>
        ${inativoBadge}
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${preview}</p>
    </div>
    <div style="display: flex; gap: 6px; flex-shrink: 0;">
      <button class="btn btn-ghost btn-small" onclick="abrirModalVisualizarLaudo('${lId}')" style="padding: 4px 8px; font-size: 11px;" title="Visualizar laudo completo">👁️ Ver</button>
      <button class="btn btn-ghost btn-small" onclick="exportarLaudoPorIdParaPDF('${lId}')" style="padding: 4px 8px; font-size: 11px;" title="Exportar laudo em PDF">📄 PDF</button>
      ${(isAdminUser && !inativo) ? `<button class="btn btn-ghost btn-small" onclick="inativarLaudoUI('${lId}', carregarLaudos)" style="padding: 4px 8px; font-size: 11px; color: var(--danger);" title="Inativar este laudo">🗑️</button>` : ''}
    </div>
  </div>`;
}

function gerarHtmlMesesLaudos(mesesMap: Record<string, GroupLaudoMes>, isAdminUser: boolean): string {
  const mesesOrdenados = Object.values(mesesMap).sort((a, b) => b.key.localeCompare(a.key));
  let html = '';

  for (let mIdx = 0; mIdx < mesesOrdenados.length; mIdx++) {
    const mesGroup = mesesOrdenados[mIdx];
    const isAberto = mIdx === 0;
    const groupId = `laudos-mes-group-${mesGroup.key}`;

    html += `
    <div class="history-month-card" style="margin-bottom: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;">
      <div class="history-month-header" onclick="toggleLaudosMesGroup('${groupId}')"
           style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-card2); cursor: pointer; user-select: none;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <span style="font-size: 14px; font-weight: 700; color: var(--text);">${mesGroup.label}</span>
          <span class="badge" style="background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">${mesGroup.laudos.length} ${mesGroup.laudos.length === 1 ? 'laudo' : 'laudos'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${mIdx === 0 ? '<span style="font-size:11px; color:var(--accent); font-weight:600; background:var(--accent)15; padding:2px 8px; border-radius:10px;">Mês Atual</span>' : ''}
          <svg id="icon-${groupId}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.3s ease; transform: ${isAberto ? 'rotate(180deg)' : 'rotate(0deg)'}; color: var(--text-muted);">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      <div id="${groupId}" style="display: ${isAberto ? 'block' : 'none'}; padding: 12px; border-top: 1px solid var(--border);">`;

    html += mesGroup.laudos.map(l => renderizarCardLaudoIndividual(l, isAdminUser)).join('');
    html += `</div></div>`;
  }

  return html;
}

function agruparLaudosPorMes(laudos: SavedLaudo[]): Record<string, GroupLaudoMes> {
  const mesesMap: Record<string, GroupLaudoMes> = {};
  laudos.forEach(l => {
    const dt = l.data_geracao;
    const mesKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    if (!mesesMap[mesKey]) {
      mesesMap[mesKey] = { key: mesKey, label: `${NOMES_MESES[dt.getMonth()]} de ${dt.getFullYear()}`, laudos: [] };
    }
    mesesMap[mesKey].laudos.push(l);
  });
  return mesesMap;
}

function popularCacheLaudos(laudos: SavedLaudo[]) {
  laudosCacheMap.clear();
  laudos.forEach((l, idx) => laudosCacheMap.set(l.id || `laudo-${idx}`, l));
}

export async function carregarLaudos(): Promise<void> {
  if (!state.currentUser || !state.userProfile) return;
  const listEl = document.getElementById('laudos-historico-list');
  if (!listEl) return;

  await validarLiberacaoGeracaoLaudo(state.currentUser.uid, state.userProfile.role);
  listEl.innerHTML = '<div class="ocr-loading"><div class="ocr-spinner"></div><p style="color:var(--text-muted)">Carregando laudos salvos...</p></div>';

  try {
    const isAdminUser = state.userProfile.role === 'ADMIN';
    const laudos = await buscarLaudos(state.currentUser.uid, isAdminUser);
    popularCacheLaudos(laudos);

    if (laudos.length === 0) {
      document.getElementById('laudo-resultado-container')?.classList.add('hidden');
      listEl.innerHTML = '<div class="empty-state" style="padding:24px; text-align:center;"><p style="color:var(--text-muted); font-size:14px;">Nenhum laudo gerado anteriormente.</p></div>';
      return;
    }

    const ultimosAtivos = laudos.filter(l => l.ativo !== false);
    const ultimoLaudo = ultimosAtivos.length > 0 ? ultimosAtivos[0] : laudos[0];
    await renderizarUltimoLaudoContainer(ultimoLaudo);

    const mesesMap = agruparLaudosPorMes(laudos);
    listEl.innerHTML = gerarHtmlMesesLaudos(mesesMap, isAdminUser);
  } catch (err) {
    logger.error('Erro ao carregar histórico de laudos:', err);
    listEl.innerHTML = '<div class="empty-state" style="padding:16px; text-align:center;"><p style="color:var(--danger); font-size:13px;">Erro ao carregar laudos.</p></div>';
  }
}

export function toggleLaudosMesGroup(groupId: string): void {
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

interface ObterMarkdownLaudoOpts {
  uid: string;
  perfil: UserProfile;
  dias: number;
  pressao: BpReading[];
  glicemia: GlicemiaReading[];
}

async function obterMarkdownLaudo(opts: ObterMarkdownLaudoOpts): Promise<string> {
  const { uid, perfil, dias, pressao, glicemia } = opts;
  const isDiabetico = Boolean(perfil.diabetico);
  const isHipertenso = perfil.hipertenso !== false;

  if (isHipertenso && isDiabetico) {
    return await gerarLaudoIntegradoIA({
      afericoesPressao: pressao,
      leiturasGlicemia: glicemia,
      perfil,
      medicacoes: state.medications,
      dias
    });
  }

  const { gerarRelatorioCondutaOMS } = await import('../services/laudos');
  return await gerarRelatorioCondutaOMS(uid, perfil, dias);
}

async function atualizarUiResultadoLaudo(markdownText: string) {
  const container = document.getElementById('laudo-resultado-container');
  const content = document.getElementById('laudo-resultado-content');
  if (!container || !content) return;

  content.innerHTML = DOMPurify.sanitize(await marked.parse(markdownText));
  const dataAtual = new Date();
  const dataFormatada = `${dataAtual.toLocaleDateString('pt-BR')} às ${dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const dataGenEl = document.getElementById('laudo-data-geracao');
  if (dataGenEl) dataGenEl.innerText = `Gerado em ${dataFormatada}`;
  container.classList.remove('hidden');
}

export const gerarLaudoTelaIntegrado = async (): Promise<void> => {
  if (!state.userProfile || !state.currentUser) return;
  const dias = Number((document.getElementById('laudo-periodo') as HTMLSelectElement)?.value || 30);
  const btn = document.getElementById('btn-gerar-laudo') as HTMLButtonElement;
  const container = document.getElementById('laudo-resultado-container');
  if (!btn || !container) return;

  btn.disabled = true;
  btn.innerHTML = '<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Analisando histórico integrado...';
  container.classList.add('hidden');

  try {
    const [pressao, glicemia] = await Promise.all([
      buscarAfericoes(state.currentUser.uid, dias),
      buscarGlicemias(state.currentUser.uid, dias)
    ]);

    if (pressao.length === 0 && glicemia.length === 0) {
      mostrarToast('Sem medições suficientes para gerar o laudo.', 'error');
      return;
    }

    const markdownText = await obterMarkdownLaudo({ uid: state.currentUser.uid, perfil: state.userProfile, dias, pressao, glicemia });
    await atualizarUiResultadoLaudo(markdownText);
    await carregarLaudos();
  } catch (err) {
    logger.error(err);
    mostrarToast('Erro ao gerar laudo.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Analisar Histórico e Gerar Conduta';
  }
};

window.carregarLaudos = carregarLaudos;
window.toggleLaudosMesGroup = toggleLaudosMesGroup;
window.gerarLaudoTela = gerarLaudoTelaIntegrado;
