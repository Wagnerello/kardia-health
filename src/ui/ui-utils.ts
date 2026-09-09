import { state } from './app-state';

export function mostrarToast(msg: string, tipo: 'success' | 'error' | 'info' = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  const iconSvg = tipo === 'success'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : tipo === 'error'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = iconSvg;
  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  t.appendChild(iconSpan);
  t.appendChild(msgSpan);
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function mostrarTela(id: string) {
  ['loading-screen','auth-screen','terms-screen','onboarding-screen','app-screen','blocked-screen']
    .forEach(s => document.getElementById(s)?.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');

  if (id === 'terms-screen') {
    inicializarScrollTermos();
  }
}

function resetarEstadoTermosUI() {
  const progressFill = document.getElementById('terms-progress-fill');
  const progressLabel = document.getElementById('terms-progress-label');
  const checkbox = document.getElementById('terms-checkbox') as HTMLInputElement;
  const acceptBtn = document.getElementById('btn-aceitar-termos') as HTMLButtonElement;
  const hintEl = document.getElementById('terms-scroll-hint');

  if (checkbox) { checkbox.checked = false; checkbox.disabled = true; }
  if (acceptBtn) acceptBtn.disabled = true;
  if (progressFill) progressFill.style.width = '0%';
  if (progressLabel) progressLabel.textContent = '0% lido';
  if (hintEl) { hintEl.textContent = '⬇️ Role até o final do documento para habilitar o aceite'; hintEl.classList.remove('done'); }
}

export function inicializarScrollTermos() {
  resetarEstadoTermosUI();
  const scrollBox = document.getElementById('terms-scroll-box');
  const checkbox = document.getElementById('terms-checkbox') as HTMLInputElement;
  const acceptBtn = document.getElementById('btn-aceitar-termos') as HTMLButtonElement;
  const progressFill = document.getElementById('terms-progress-fill');
  const progressLabel = document.getElementById('terms-progress-label');
  const hintEl = document.getElementById('terms-scroll-hint');

  if (!scrollBox) return;
  scrollBox.scrollTop = 0;

  const handleScroll = () => {
    const { scrollTop, scrollHeight, clientHeight } = scrollBox;
    const scrollable = scrollHeight - clientHeight;
    if (scrollable <= 0) return;

    const pct = Math.min(100, Math.round((scrollTop / scrollable) * 100));
    const displayPct = (scrollTop + clientHeight >= scrollHeight - 5) ? 100 : pct;

    if (progressFill) progressFill.style.width = displayPct + '%';
    if (progressLabel) progressLabel.textContent = displayPct + '% lido';

    if (displayPct >= 95) {
      if (checkbox) checkbox.disabled = false;
      if (hintEl && !hintEl.classList.contains('done')) {
        hintEl.textContent = '✅ Leitura concluída! Marque a caixa para habilitar o aceite.';
        hintEl.classList.add('done');
      }
    }
  };

  scrollBox.addEventListener('scroll', handleScroll);
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      if (acceptBtn) acceptBtn.disabled = !checkbox.checked;
    });
  }
}

export function toggleAvatarMenu() {
  const menu = document.getElementById('avatar-menu');
  if (menu) {
    if (menu.style.display === 'none') {
      menu.style.display = 'flex';
      
      const dateEl = document.getElementById('termos-aceite-data');
      if (dateEl && state.userProfile && state.userProfile.termos_aceitos_em) {
        const dateStr = new Date(state.userProfile.termos_aceitos_em).toLocaleDateString('pt-BR');
        dateEl.textContent = `Aceito em: ${dateStr}`;
        dateEl.style.display = 'block';
      }
    } else {
      menu.style.display = 'none';
    }
  }
}

export interface ModalConfirmacaoOpts {
  textoBtn?: string;
  corBtn?: string;
}

export function abrirModalConfirmacao(
  titulo: string,
  mensagem: string,
  callbackConfirmar: () => void,
  opts?: ModalConfirmacaoOpts
) {
  const textoBtn = opts?.textoBtn || 'Confirmar';
  const corBtn = opts?.corBtn || 'var(--danger)';
  const modal = document.getElementById('modal-confirmacao');
  const titleEl = document.getElementById('confirm-title') || document.getElementById('modal-confirm-title');
  const msgEl = document.getElementById('confirm-message') || document.getElementById('modal-confirm-msg');
  const btnEl = (document.getElementById('btn-confirm-action') || document.getElementById('modal-confirm-btn')) as HTMLButtonElement | null;

  if (titleEl) titleEl.textContent = titulo;
  if (msgEl) msgEl.textContent = mensagem;
  if (btnEl) {
    btnEl.textContent = textoBtn;
    btnEl.style.backgroundColor = corBtn;
    btnEl.onclick = () => {
      callbackConfirmar();
      fecharModalConfirmacao();
    };
  }
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

export function fecharModalConfirmacao(): void {
  const modal = document.getElementById('modal-confirmacao');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

window.mostrarToast = mostrarToast;
window.escapeHtml = escapeHtml;
window.mostrarTela = mostrarTela;
window.toggleAvatarMenu = toggleAvatarMenu;
window.abrirModalConfirmacao = abrirModalConfirmacao;
window.fecharModalConfirmacao = fecharModalConfirmacao;
