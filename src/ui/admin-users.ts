import { state } from './app-state';
import { mostrarToast, escapeHtml } from './ui-utils';
import { formatarDataHora } from '../types';
import type { UserProfile } from '../types';
import { logger } from '../services/logger';
import {
  atualizarPlanoUsuario,
  atualizarStatusUsuario,
  atualizarFuncaoUsuario,
  excluirDadosUsuario,
  registrarLogAdmin,
} from '../services/admin';

type PlanoTipo = 'Gratuito' | 'Premium' | 'Ouro';
type StatusTipo = 'Pendente' | 'Ativo' | 'Suspenso' | 'Inativo';
type RoleTipo = 'ADMIN' | 'USER';

function gerarSelectPlano(u: UserProfile, safeUid: string, safeEmail: string, disabled: string): string {
  return `
    <div class="admin-detail-row">
      <span style="color:var(--text-muted);">Plano:</span>
      <select onchange="alterarPlanoUsuarioAdmin('${safeUid}', this.value, '${safeEmail}')" class="admin-filter-select" style="padding:2px 6px; font-size:12px;" ${disabled}>
        <option value="Gratuito" ${u.plano === 'Gratuito' ? 'selected' : ''}>Gratuito</option>
        <option value="Premium" ${u.plano === 'Premium' ? 'selected' : ''}>Premium</option>
        <option value="Ouro" ${u.plano === 'Ouro' ? 'selected' : ''}>Ouro</option>
      </select>
    </div>
  `;
}

function gerarSelectStatus(u: UserProfile, safeUid: string, safeEmail: string, disabled: string): string {
  return `
    <div class="admin-detail-row">
      <span style="color:var(--text-muted);">Status:</span>
      <select onchange="alterarStatusUsuarioAdmin('${safeUid}', this.value, '${safeEmail}')" class="admin-filter-select" style="padding:2px 6px; font-size:12px;" ${disabled}>
        <option value="Ativo" ${u.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
        <option value="Pendente" ${u.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
        <option value="Suspenso" ${u.status === 'Suspenso' ? 'selected' : ''}>Suspenso</option>
        <option value="Inativo" ${u.status === 'Inativo' ? 'selected' : ''}>Inativo</option>
      </select>
    </div>
  `;
}

function gerarSelectRole(u: UserProfile, safeUid: string, safeEmail: string, disabled: string): string {
  const roleText = escapeHtml(u.role === 'ADMIN' ? 'Admin' : 'Usuário');
  return `
    <div class="admin-detail-row">
      <span style="color:var(--text-muted);">Função:</span>
      <select onchange="alterarRoleUsuarioAdmin('${safeUid}', this.value, '${safeEmail}')" class="admin-filter-select" style="padding:2px 6px; font-size:12px;" ${disabled}>
        <option value="USER" ${u.role !== 'ADMIN' ? 'selected' : ''}>USER (${roleText})</option>
        <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
      </select>
    </div>
  `;
}

function gerarHtmlSelects(u: UserProfile, isSelf: boolean): string {
  const safeEmail = escapeHtml(u.email || '');
  const safeUid = escapeHtml(u.uid || '');
  const disabled = isSelf ? 'disabled' : '';
  return `
    ${gerarSelectPlano(u, safeUid, safeEmail, disabled)}
    ${gerarSelectStatus(u, safeUid, safeEmail, disabled)}
    ${gerarSelectRole(u, safeUid, safeEmail, disabled)}
  `;
}

function gerarCardUsuarioHtml(u: UserProfile, isSelf: boolean): string {
  const safeEmail = escapeHtml(u.email || '');
  const safeNome = escapeHtml(u.nome || 'Usuário Sem Nome');
  const safeUid = escapeHtml(u.uid || '');

  const btnExcluir = !isSelf
    ? `<button onclick="excluirUsuarioAdmin('${safeUid}', '${safeNome}', '${safeEmail}')" class="btn btn-danger btn-small" title="Excluir Usuário">🗑️</button>`
    : '';

  return `
    <div class="admin-user-card">
      <div class="admin-user-header">
        <div class="admin-user-avatar">${safeNome.charAt(0).toUpperCase()}</div>
        <div class="admin-user-info">
          <div class="admin-user-nome">${safeNome} ${isSelf ? '<span style="font-size:10px; color:var(--primary);">(Você)</span>' : ''}</div>
          <div class="admin-user-email">${safeEmail || '--'}</div>
        </div>
      </div>

      <div class="admin-user-body">
        ${gerarHtmlSelects(u, isSelf)}
      </div>

      <div class="admin-user-actions">
        <button onclick="abrirHistoricoUsuarioAdmin('${safeUid}', '${safeNome}')" class="btn btn-primary btn-small" style="flex:1" title="Ver Histórico Clínico">📜 Histórico</button>
        <button onclick="abrirDetalhesUsuarioAdmin('${safeUid}')" class="btn btn-secondary btn-small" style="flex:1" title="Ver Perfil Completo">👁️ Detalhes</button>
        ${btnExcluir}
      </div>
    </div>
  `;
}

export function renderizarCardsUsuariosAdmin(): void {
  const container = document.getElementById('admin-users-cards-view');
  if (!container) return;

  if (state.listaFiltradaUsuariosAdmin.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); grid-column:1/-1;">Nenhum usuário encontrado.</div>`;
    return;
  }

  container.innerHTML = state.listaFiltradaUsuariosAdmin.map(u => {
    const isSelf = u.uid === state.currentUser?.uid;
    return gerarCardUsuarioHtml(u, isSelf);
  }).join('');
}

export function renderizarTabelaUsuariosAdmin(): void {
  renderizarCardsUsuariosAdmin();
}

export function filtrarTabelaUsuariosAdmin(): void {
  const busca = (document.getElementById('admin-search-user') as HTMLInputElement)?.value.toLowerCase().trim() || '';
  const statusFiltro = (document.getElementById('admin-filter-status') as HTMLSelectElement)?.value || 'todos';
  const planoFiltro = (document.getElementById('admin-filter-plano') as HTMLSelectElement)?.value || 'todos';

  state.listaFiltradaUsuariosAdmin = state.usuariosCadastrados.filter(u => {
    const userEmail = u.email || '';
    const matchBusca = u.nome.toLowerCase().includes(busca) || userEmail.toLowerCase().includes(busca);
    const matchStatus = statusFiltro === 'todos' || u.status === statusFiltro;
    const matchPlano = planoFiltro === 'todos' || u.plano === planoFiltro;
    return matchBusca && matchStatus && matchPlano;
  });

  renderizarCardsUsuariosAdmin();
}

export async function alterarPlanoUsuarioAdmin(uid: string, novoPlano: string, email: string): Promise<void> {
  try {
    const planoTipado = novoPlano as PlanoTipo;
    await atualizarPlanoUsuario(uid, planoTipado);
    await registrarLogAdmin('ALTERAR_PLANO', `Plano alterado para ${novoPlano}`, uid, email);
    mostrarToast(`Plano de ${email} alterado para ${novoPlano}.`, 'success');
    const userObj = state.usuariosCadastrados.find(u => u.uid === uid);
    if (userObj) userObj.plano = planoTipado;
  } catch (err) {
    logger.error('Erro ao alterar plano:', err);
    mostrarToast('Erro ao alterar plano.', 'error');
  }
}

export async function alterarStatusUsuarioAdmin(uid: string, novoStatus: string, email: string): Promise<void> {
  try {
    const statusTipado = novoStatus as StatusTipo;
    await atualizarStatusUsuario(uid, statusTipado);
    await registrarLogAdmin('ALTERAR_STATUS', `Status alterado para ${novoStatus}`, uid, email);
    mostrarToast(`Status de ${email} alterado para ${novoStatus}.`, 'success');
    const userObj = state.usuariosCadastrados.find(u => u.uid === uid);
    if (userObj) userObj.status = statusTipado;
  } catch (err) {
    logger.error('Erro ao alterar status:', err);
    mostrarToast('Erro ao alterar status.', 'error');
  }
}

export async function alterarRoleUsuarioAdmin(uid: string, novaRole: string, email: string): Promise<void> {
  try {
    const roleTipada = novaRole as RoleTipo;
    await atualizarFuncaoUsuario(uid, roleTipada);
    await registrarLogAdmin('ALTERAR_ROLE', `Role alterada para ${novaRole}`, uid, email);
    mostrarToast(`Permissão de ${email} alterada para ${novaRole}.`, 'success');
    const userObj = state.usuariosCadastrados.find(u => u.uid === uid);
    if (userObj) userObj.role = roleTipada;
  } catch (err) {
    logger.error('Erro ao alterar permissão:', err);
    mostrarToast('Erro ao alterar permissão.', 'error');
  }
}

export async function excluirUsuarioAdmin(uid: string, nome: string, email: string): Promise<void> {
  if (confirm(`⚠️ ATENÇÃO: Tem certeza que deseja excluir permanentemente a conta de "${nome}" (${email})?\n\nEsta ação excluirá todas as aferições e dados do Firestore!`)) {
    try {
      await excluirDadosUsuario(uid);
      await registrarLogAdmin('EXCLUIR_USUARIO', `Conta e dados de ${nome} excluídos permanentemente`, uid, email);
      mostrarToast(`Usuário ${nome} excluído com sucesso.`, 'success');
      state.usuariosCadastrados = state.usuariosCadastrados.filter(u => u.uid !== uid);
      filtrarTabelaUsuariosAdmin();
    } catch (err) {
      logger.error('Erro ao excluir usuário:', err);
      mostrarToast('Erro ao excluir usuário.', 'error');
    }
  }
}

function gerarHtmlDetalhesUsuario(userObj: UserProfile): string {
  const formatBool = (val?: boolean) => val ? 'Sim 🔴' : 'Não 🟢';
  const aceitoEm = userObj.termos_aceitos_em ? escapeHtml(new Date(userObj.termos_aceitos_em).toLocaleString('pt-BR')) : '--';

  return `
    <div style="background:var(--bg-card2); padding:12px; border-radius:8px;">
      <h4 style="margin:0 0 6px; font-size:14px; color:var(--primary);">${escapeHtml(userObj.nome)}</h4>
      <div><strong>UID:</strong> ${escapeHtml(userObj.uid)}</div>
      <div><strong>E-mail:</strong> ${escapeHtml(userObj.email || '')}</div>
      <div><strong>Sexo:</strong> ${escapeHtml(userObj.sexo || '--')} | <strong>Idade:</strong> ${userObj.idade || '--'} anos</div>
      <div><strong>Peso:</strong> ${userObj.peso || '--'} kg | <strong>Altura:</strong> ${userObj.altura || '--'} cm</div>
      <div><strong>Data Nasc:</strong> ${escapeHtml(userObj.nascimento || '--')}</div>
    </div>

    <div style="background:var(--bg-card2); padding:12px; border-radius:8px;">
      <h4 style="margin:0 0 6px; font-size:14px; color:var(--text);">📋 Condições de Saúde Declaradas</h4>
      <div>• Hipertenso: ${formatBool(userObj.hipertenso)}</div>
      <div>• Diabético: ${formatBool(userObj.diabetico)}</div>
      <div>• Fumante: ${formatBool(userObj.fumante)}</div>
      <div>• Sedentário: ${formatBool(userObj.sedentario)}</div>
      <div>• Usa medicação: ${userObj.usaMedicacao ? 'Sim' : 'Não'}</div>
    </div>

    <div style="background:var(--bg-card2); padding:12px; border-radius:8px;">
      <h4 style="margin:0 0 6px; font-size:14px; color:var(--text);">⚖️ Termos de Uso e Conta</h4>
      <div>• Termos aceitos: ${userObj.termos_aceitos ? 'Sim ✅' : 'Não ❌'}</div>
      <div>• Versão dos termos: ${escapeHtml(userObj.termos_versao || '--')}</div>
      <div>• Aceito em: ${aceitoEm}</div>
      <div>• Criado em: ${escapeHtml(formatarDataHora(userObj.data_criacao))}</div>
    </div>
  `;
}

export function abrirDetalhesUsuarioAdmin(uid: string): void {
  const userObj = state.usuariosCadastrados.find(u => u.uid === uid);
  if (!userObj) return;

  const modal = document.getElementById('modal-admin-user-detail');
  const body = document.getElementById('modal-admin-user-body');

  if (body) {
    body.innerHTML = gerarHtmlDetalhesUsuario(userObj);
  }

  if (modal) modal.classList.remove('hidden');
}

export function fecharModalAdminUserDetail(): void {
  const modal = document.getElementById('modal-admin-user-detail');
  if (modal) modal.classList.add('hidden');
}

// Vinculação global
window.renderizarCardsUsuariosAdmin = renderizarCardsUsuariosAdmin;
window.renderizarTabelaUsuariosAdmin = renderizarTabelaUsuariosAdmin;
window.filtrarTabelaUsuariosAdmin = filtrarTabelaUsuariosAdmin;
window.alterarPlanoUsuarioAdmin = alterarPlanoUsuarioAdmin;
window.alterarStatusUsuarioAdmin = alterarStatusUsuarioAdmin;
window.alterarRoleUsuarioAdmin = alterarRoleUsuarioAdmin;
window.excluirUsuarioAdmin = excluirUsuarioAdmin;
window.abrirDetalhesUsuarioAdmin = abrirDetalhesUsuarioAdmin;
window.fecharModalAdminUserDetail = fecharModalAdminUserDetail;
