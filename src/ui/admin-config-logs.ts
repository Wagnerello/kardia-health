import { formatarDataHora } from '../types';
import { mostrarToast } from './ui-utils';
import { logger } from '../services/logger';
import {
  registrarLogAdmin,
  buscarLogsAdmin,
  buscarConfigSistema,
  salvarConfigSistema,
} from '../services/admin';
import type { SystemConfig } from '../services/admin';

export async function carregarLogsAdminUI(): Promise<void> {
  const container = document.getElementById('admin-logs-list');
  if (!container) return;
  container.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">Carregando logs...</p>`;

  try {
    const logs = await buscarLogsAdmin(40);
    if (logs.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">Nenhum log registrado até o momento.</p>`;
      return;
    }

    container.innerHTML = logs.map(l => `
      <div class="admin-log-card">
        <div class="admin-log-main">
          <span class="admin-log-action">${l.acao}</span>
          <span class="admin-log-detail">${l.detalhe} ${l.alvo_email ? `(${l.alvo_email})` : ''}</span>
          <span style="font-size:10px; color:var(--text-muted);">Por: ${l.admin_email}</span>
        </div>
        <span class="admin-log-time">${formatarDataHora(l.timestamp)}</span>
      </div>
    `).join('');
  } catch (error) {
    logger.error('Erro ao carregar logs admin:', error);
    container.innerHTML = `<p style="color:var(--danger); font-size:13px; text-align:center; padding:20px;">Erro ao carregar logs do sistema.</p>`;
  }
}

export async function carregarConfiguracoesAdminUI(): Promise<void> {
  try {
    const cfg = await buscarConfigSistema();
    const txtMsg = document.getElementById('admin-config-global-msg') as HTMLTextAreaElement;
    const chkActive = document.getElementById('admin-config-global-active') as HTMLInputElement;
    const chkBlock = document.getElementById('admin-config-block-reg') as HTMLInputElement;
    const chkMaint = document.getElementById('admin-config-maint') as HTMLInputElement;

    if (txtMsg) txtMsg.value = cfg.mensagem_global || '';
    if (chkActive) chkActive.checked = !!cfg.mensagem_ativa;
    if (chkBlock) chkBlock.checked = !!cfg.bloquear_cadastros;
    if (chkMaint) chkMaint.checked = !!cfg.manutencao;
  } catch (error) {
    logger.error('Erro ao carregar configurações admin:', error);
    mostrarToast('Erro ao carregar configurações.', 'error');
  }
}

export async function salvarConfiguracoesAdminUI(): Promise<void> {
  const txtMsg = (document.getElementById('admin-config-global-msg') as HTMLTextAreaElement)?.value || '';
  const chkActive = (document.getElementById('admin-config-global-active') as HTMLInputElement)?.checked || false;
  const chkBlock = (document.getElementById('admin-config-block-reg') as HTMLInputElement)?.checked || false;
  const chkMaint = (document.getElementById('admin-config-maint') as HTMLInputElement)?.checked || false;

  try {
    const configObj: SystemConfig = {
      mensagem_global: txtMsg,
      mensagem_ativa: chkActive,
      bloquear_cadastros: chkBlock,
      manutencao: chkMaint
    };

    await salvarConfigSistema(configObj);
    await registrarLogAdmin('SALVAR_CONFIG', 'Configurações globais do sistema atualizadas');
    mostrarToast('Configurações salvas com sucesso!', 'success');
  } catch (error) {
    logger.error('Erro ao salvar configurações admin:', error);
    mostrarToast('Erro ao salvar configurações.', 'error');
  }
}

// Vinculação global
window.carregarLogsAdminUI = carregarLogsAdminUI;
window.salvarConfiguracoesAdminUI = salvarConfiguracoesAdminUI;
