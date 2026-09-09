import { logger } from '../services/logger';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import { formatarDataHora, classificarPressao } from '../types';
import type { BpReading, UserProfile } from '../types';
import {
  buscarAfericoes,
  gerarFeedbackIA,
  atualizarFeedbackIA,
} from '../services/afericoes';
import { gerarAnaliseDiariaIA } from '../services/analise-diaria';
import { carregarDashboard } from './dashboard-view';
import { abrirHistoricoUsuarioAdmin } from './admin-view';

export async function reprocessarIADoDia(dataStr: string): Promise<void> {
  if (!state.currentUser) return;
  const btnId = `btn-reprocess-day-${dataStr.replace(/\//g, '-')}`;
  const btn = document.getElementById(btnId);
  const textEl = document.getElementById(`ai-feedback-text-${dataStr.replace(/\//g, '-')}`);
  
  if (btn) btn.innerHTML = '<span class="ocr-spinner" style="width:12px;height:12px;border-width:2px;display:inline-block"></span>';
  
  try {
    const groups = window.histDataGroups;
    if (!groups || !groups[dataStr]) {
      throw new Error('Dados do dia não encontrados');
    }
    const records = groups[dataStr];
    const feedback = await gerarAnaliseDiariaIA(records, dataStr, state.currentUser.uid);
    
    if (textEl) {
      const parsed = await marked.parse(String(feedback));
      textEl.innerHTML = DOMPurify.sanitize(parsed as string);
    }
    if (btn) btn.innerHTML = 'Atualizar IA do Dia';
    mostrarToast('Análise diária concluída!', 'success');
  } catch (e) {
    logger.error(e);
    mostrarToast('Erro ao reprocessar IA do dia', 'error');
    if (btn) btn.innerHTML = 'Reprocessar IA';
  }
}

async function atualizarUIAposReprocessamento(id: string) {
  if (document.getElementById('modal-detalhe-analise-ia')?.classList.contains('hidden') === false) {
    await abrirModalDetalheAnalise(id);
  }
  if (state.adminTargetUserUid && state.adminTargetUserPerfil) {
    await abrirHistoricoUsuarioAdmin(state.adminTargetUserUid, state.adminTargetUserPerfil.nome);
  } else {
    carregarDashboard();
  }
}

export async function reprocessarIADaAfericao(id: string): Promise<void> {
  mostrarToast('Reprocessando análise da IA...', 'info');
  try {
    const targetUid = state.adminTargetUserUid || state.currentUser?.uid;
    const perfil = state.adminTargetUserPerfil || state.userProfile;
    if (!targetUid || !perfil) {
      mostrarToast('Usuário ou perfil não encontrado.', 'error');
      return;
    }
    const historico = await buscarAfericoes(targetUid, 90);
    const leitura = historico.find(a => a.id === id);
    if (!leitura) {
      mostrarToast('Aferição não encontrada.', 'error');
      return;
    }
    const feedback = await gerarFeedbackIA(leitura, perfil, historico);
    await atualizarFeedbackIA(id, feedback);
    mostrarToast('Análise de IA atualizada com sucesso!', 'success');
    await atualizarUIAposReprocessamento(id);
  } catch (err) {
    logger.error('Erro ao reprocessar IA:', err);
    mostrarToast('Erro ao reprocessar IA.', 'error');
  }
}

async function processarLeiturasLote(leituras: BpReading[], perfil: UserProfile): Promise<number> {
  let processadas = 0;
  for (const leitura of leituras) {
    mostrarToast(`Reprocessando ${processadas + 1} de ${leituras.length}...`, 'info');
    try {
      const feedback = await gerarFeedbackIA(leitura, perfil, leituras);
      if (leitura.id) {
        await atualizarFeedbackIA(leitura.id, feedback);
      }
      processadas++;
    } catch (e) {
      logger.error(`Erro ao reprocessar leitura ${leitura.id}`, e);
    }
  }
  return processadas;
}

export async function reprocessarIAsEmLoteAdmin(): Promise<void> {
  if (!state.adminTargetUserUid || !state.adminTargetUserPerfil) {
    mostrarToast('Nenhum usuário selecionado.', 'error');
    return;
  }
  const btn = document.getElementById('btn-reprocessar-lote-admin') as HTMLButtonElement;
  if (btn) btn.disabled = true;
  mostrarToast('Iniciando reprocessamento em lote...', 'info');

  try {
    const leituras = await buscarAfericoes(state.adminTargetUserUid, 90);
    const total = await processarLeiturasLote(leituras, state.adminTargetUserPerfil);
    mostrarToast(`${total} aferições reprocessadas com sucesso!`, 'success');
    await abrirHistoricoUsuarioAdmin(state.adminTargetUserUid, state.adminTargetUserPerfil.nome);
  } catch (err) {
    logger.error('Erro ao reprocessar em lote:', err);
    mostrarToast('Erro no reprocessamento em lote.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function abrirModalDetalheAnalise(id: string): Promise<void> {
  const modal = document.getElementById('modal-detalhe-analise-ia');
  const contentEl = document.getElementById('modal-detalhe-analise-content');
  if (!modal || !contentEl) return;

  const targetUid = state.adminTargetUserUid || state.currentUser?.uid;
  if (!targetUid) return;

  const leituras = await buscarAfericoes(targetUid, 90);
  window.adminLeiturasCache = leituras;
  const leitura = leituras.find(a => a.id === id);

  if (!leitura) {
    mostrarToast('Aferição não encontrada', 'error');
    return;
  }

  const clf = classificarPressao(leitura.sys, leitura.dia);
  const dt = formatarDataHora(leitura.data_hora_afericao);
  const rawFeedback = leitura.ai_feedback || '';
  const feedbackSlot = `ai-feedback-slot-${leitura.id}`;

  contentEl.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card2); padding:14px; border-radius:12px; border-left: 4px solid ${clf.cor};">
        <div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">${dt}</div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <span style="font-size:26px; font-weight:800; color:var(--primary-light)">${leitura.sys}</span>
            <span style="font-size:18px; color:var(--text-muted)">/</span>
            <span style="font-size:26px; font-weight:800; color:var(--accent)">${leitura.dia}</span>
            <span style="font-size:12px; color:var(--text-muted)">mmHg</span>
            <span style="margin-left:8px; font-size:13px; font-weight:600; color:var(--warning)">❤️ ${leitura.pul} BPM</span>
          </div>
        </div>
        <span style="font-size:12px; font-weight:700; padding:4px 12px; border-radius:20px; background:${clf.cor}22; color:${clf.cor}; border:1px solid ${clf.cor}44;">
          ${clf.label}
        </span>
      </div>

      <div style="background:var(--surface-variant); padding:16px; border-radius:12px; border:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
            🤖 Parecer do Especialista Virtual
          </span>
          <button class="btn btn-ghost btn-small" onclick="reprocessarIADaAfericao('${leitura.id}')" style="padding:4px 10px; font-size:12px; display:flex; align-items:center; gap:4px;">
            🔄 Recalcular
          </button>
        </div>
        <div id="${feedbackSlot}" style="font-size:13.5px; line-height:1.8; color:var(--text); white-space:pre-wrap; word-break:break-word;"></div>
      </div>
    </div>
  `;

  const slot = document.getElementById(feedbackSlot);
  if (slot) {
    slot.textContent = rawFeedback || 'Nenhum parecer de IA disponível. Clique em Recalcular para gerar.';
  }

  modal.classList.remove('hidden');
}

export function fecharModalDetalheAnalise(): void {
  document.getElementById('modal-detalhe-analise-ia')?.classList.add('hidden');
}

// Vinculação global
window.reprocessarIADoDia = reprocessarIADoDia;
window.reprocessarIADaAfericao = reprocessarIADaAfericao;
window.reprocessarIAsEmLoteAdmin = reprocessarIAsEmLoteAdmin;
window.abrirModalDetalheAnalise = abrirModalDetalheAnalise;
window.fecharModalDetalheAnalise = fecharModalDetalheAnalise;

document.getElementById('modal-detalhe-analise-ia')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-detalhe-analise-ia')) {
    fecharModalDetalheAnalise();
  }
});
