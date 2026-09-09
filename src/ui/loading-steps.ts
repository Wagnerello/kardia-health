/**
 * Componente de Overlay de Carregamento Progressivo por Etapas (Multi-Step Loading)
 * Oferece feedback visual rico e em tempo real do processamento de dados e IA médica.
 * Segue rigorosamente os padrões visuais Impeccable (sem emojis genéricos, ícones vetoriais nítidos).
 */

export interface PassoProgresso {
  etapa: number;
  label: string;
  descricaoBase: string;
  iconSvg: string;
}

const PASSOS_LAUDO: PassoProgresso[] = [
  {
    etapa: 1,
    label: 'Coleta de Aferições e Histórico',
    descricaoBase: 'Buscando aferições de pressão e dados biométricos...',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`
  },
  {
    etapa: 2,
    label: 'Cruzamento de Sinais Vitais',
    descricaoBase: 'Correlacionando glicemia, hidratação, IMC e fármacos...',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>`
  },
  {
    etapa: 3,
    label: 'Raciocínio Clínico e Diretrizes SBC/OMS',
    descricaoBase: 'Inteligência Artificial processando estratificação de risco...',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>`
  },
  {
    etapa: 4,
    label: 'Estruturação do Laudo Médico',
    descricaoBase: 'Formatando condutas, alertas e plano terapêutico...',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`
  }
];

let overlayElement: HTMLElement | null = null;

function criarHtmlOverlay(titulo: string, subtitulo: string): string {
  const itensHtml = PASSOS_LAUDO.map(p => `
    <div class="loading-step-item step-pending" id="loading-step-${p.etapa}" data-step="${p.etapa}">
      <div class="loading-step-indicator">
        <span class="loading-step-icon" aria-hidden="true">${p.iconSvg}</span>
        <span class="loading-step-check hidden" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <span class="loading-step-spinner hidden" aria-hidden="true"></span>
      </div>
      <div class="loading-step-content">
        <div class="loading-step-label">${p.label}</div>
        <div class="loading-step-sub" id="loading-step-sub-${p.etapa}">${p.descricaoBase}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="loading-steps-backdrop">
      <div class="loading-steps-card" role="dialog" aria-modal="true" aria-labelledby="loading-steps-title">
        <div class="loading-steps-header">
          <div class="loading-steps-badge">
            <span class="pulse-dot"></span>
            Processamento de Inteligência Clínica
          </div>
          <h3 id="loading-steps-title" class="loading-steps-title">${titulo}</h3>
          <p class="loading-steps-desc">${subtitulo}</p>
        </div>

        <div class="loading-progress-container">
          <div class="loading-progress-header">
            <span class="loading-progress-label" id="loading-progress-text">Iniciando síntese clínica...</span>
            <span class="loading-progress-percent" id="loading-progress-percent">0%</span>
          </div>
          <div class="loading-progress-track">
            <div class="loading-progress-fill" id="loading-progress-fill" style="width: 0%;"></div>
          </div>
        </div>

        <div class="loading-steps-list" role="status" aria-live="polite">
          ${itensHtml}
        </div>
      </div>
    </div>
  `;
}

export function mostrarLoadingPassos(
  titulo: string = 'Gerando Laudo Clínico Integrado',
  subtitulo: string = 'A inteligência médica está correlacionando os sinais vitais e histórico do paciente'
): void {
  fecharLoadingPassos();

  overlayElement = document.createElement('div');
  overlayElement.id = 'loading-steps-overlay';
  overlayElement.className = 'loading-steps-overlay';
  overlayElement.innerHTML = criarHtmlOverlay(titulo, subtitulo);
  document.body.appendChild(overlayElement);

  // Iniciar primeiro passo como ativo
  atualizarLoadingPasso(1, 4, 'Buscando aferições e histórico clínico...');
}

export function atualizarLoadingPasso(
  etapaAtual: number,
  totalEtapas: number = 4,
  mensagemDetalhe?: string
): void {
  if (!overlayElement) return;

  const pct = Math.min(100, Math.round((etapaAtual / totalEtapas) * 100));
  const progressFill = document.getElementById('loading-progress-fill');
  const progressPercent = document.getElementById('loading-progress-percent');
  const progressText = document.getElementById('loading-progress-text');

  if (progressFill) progressFill.style.width = `${pct}%`;
  if (progressPercent) progressPercent.textContent = `${pct}%`;
  if (progressText && mensagemDetalhe) progressText.textContent = mensagemDetalhe;

  for (let i = 1; i <= totalEtapas; i++) {
    const itemEl = document.getElementById(`loading-step-${i}`);
    const subEl = document.getElementById(`loading-step-sub-${i}`);
    if (!itemEl) continue;

    const iconEl = itemEl.querySelector('.loading-step-icon');
    const checkEl = itemEl.querySelector('.loading-step-check');
    const spinnerEl = itemEl.querySelector('.loading-step-spinner');

    if (i < etapaAtual) {
      // Concluído
      itemEl.className = 'loading-step-item step-completed';
      iconEl?.classList.add('hidden');
      checkEl?.classList.remove('hidden');
      spinnerEl?.classList.add('hidden');
      if (subEl) subEl.textContent = 'Etapa concluída com sucesso';
    } else if (i === etapaAtual) {
      // Em andamento
      itemEl.className = 'loading-step-item step-active';
      iconEl?.classList.add('hidden');
      checkEl?.classList.add('hidden');
      spinnerEl?.classList.remove('hidden');
      if (subEl && mensagemDetalhe) subEl.textContent = mensagemDetalhe;
    } else {
      // Pendente
      itemEl.className = 'loading-step-item step-pending';
      iconEl?.classList.remove('hidden');
      checkEl?.classList.add('hidden');
      spinnerEl?.classList.add('hidden');
      const def = PASSOS_LAUDO.find(p => p.etapa === i);
      if (subEl && def) subEl.textContent = def.descricaoBase;
    }
  }
}

export function fecharLoadingPassos(): void {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
}
