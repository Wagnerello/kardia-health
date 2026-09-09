import { logger } from '../services/logger';
import { Chart } from 'chart.js';
import { state } from './app-state';
import { salvarAguaDoDia, buscarHistoricoAgua } from '../services/agua';
import type { DailyWaterLog } from '../types';

let waterWeekOffset = 0;

function atualizarBadgeMetaAgua(metaEl: HTMLElement, percentage: number) {
  const metaLitros = (state.metaAgua / 1000).toFixed(1).replace('.0', '');
  metaEl.textContent = `Meta: ${metaLitros}L`;
  
  if (percentage >= 100) {
    metaEl.style.background = '#d1fae5';
    metaEl.style.color = '#047857';
    metaEl.style.borderColor = '#a7f3d0';
  } else if (percentage >= 50) {
    metaEl.style.background = '#bfdbfe';
    metaEl.style.color = '#1e3a8a';
    metaEl.style.borderColor = '#93c5fd';
  } else {
    metaEl.style.background = '#dbeafe';
    metaEl.style.color = '#1e40af';
    metaEl.style.borderColor = '#bfdbfe';
  }
}

function atualizarBarraProgressoAgua(amountEl: HTMLElement, barEl: HTMLElement, percentage: number) {
  amountEl.textContent = String(state.aguaHoje);
  const barPercentage = Math.min(100, percentage);
  barEl.style.width = `${barPercentage}%`;
  barEl.style.background = (state.aguaHoje >= state.metaAgua) ? '#10B981' : 'var(--primary)';
}

export function atualizarUIWaterCard() {
  const amountEl = document.getElementById('water-amount-text');
  const barEl = document.getElementById('water-progress-bar');
  const metaEl = document.getElementById('water-meta-text');
  
  const percentage = state.metaAgua > 0 ? (state.aguaHoje / state.metaAgua) * 100 : 0;
  if (metaEl) atualizarBadgeMetaAgua(metaEl, percentage);
  if (amountEl && barEl) atualizarBarraProgressoAgua(amountEl, barEl, percentage);
}

export const adicionarAgua = async (amount: number) => {
  if (!state.currentUser) return;
  state.aguaHoje += amount;
  atualizarUIWaterCard();
  
  try {
    const d = new Date();
    const hojeStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await salvarAguaDoDia(state.currentUser.uid, hojeStr, state.aguaHoje, state.metaAgua);
    await carregarHistoricoAgua();
  } catch (e) {
    logger.error(e);
  }
};

export const adicionarAguaPersonalizada = () => {
  const inputEl = document.getElementById('water-custom-input') as HTMLInputElement;
  if (!inputEl) return;
  const amt = inputEl.value;
  if (amt && !isNaN(Number(amt))) {
    const val = Number(amt);
    if (val > 0) {
      adicionarAgua(val);
      inputEl.value = '';
    }
  }
};

function renderizarGraficoBarrasAgua(canvas: HTMLCanvasElement, logs: DailyWaterLog[]) {
  const sortedLogs = [...logs].reverse();
  if (state.waterChart) state.waterChart.destroy();
  
  const labels = sortedLogs.map(log => {
    const parts = log.date_string.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : log.date_string;
  });
  
  const consumidoData = sortedLogs.map(log => log.amount_ml);
  const metaData = sortedLogs.map(log => log.meta_ml);

  state.waterChart = new Chart(canvas, {
    data: {
      labels: labels.length > 0 ? labels : ['Sem dados'],
      datasets: [
        {
          type: 'bar',
          label: 'Consumido',
          data: consumidoData.length > 0 ? consumidoData : [0],
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 16
        },
        {
          type: 'line',
          label: 'Meta',
          data: metaData.length > 0 ? metaData : [state.metaAgua],
          borderColor: '#ef4444',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8899BB', font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: '#8899BB', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
      }
    }
  });
}

function atualizarMetricasSemanaisAgua(logs: DailyWaterLog[]) {
  const totalIngerido = logs.reduce((acc, l) => acc + (l.amount_ml || 0), 0);
  const mediaDiaria = logs.length > 0 ? Math.round(totalIngerido / logs.length) : 0;
  const diasMetaAtingida = logs.filter(l => l.amount_ml >= l.meta_ml && l.meta_ml > 0).length;

  const avgDailyEl = document.getElementById('avg-water-daily');
  const avgTargetEl = document.getElementById('avg-water-target-days');
  const avgTotalEl = document.getElementById('avg-water-total');

  if (avgDailyEl) avgDailyEl.innerText = mediaDiaria.toLocaleString('pt-BR');
  if (avgTargetEl) avgTargetEl.innerText = `${diasMetaAtingida}/${logs.length || 7}`;
  if (avgTotalEl) avgTotalEl.innerText = (totalIngerido / 1000).toFixed(1).replace('.', ',');
}

function atualizarControlesNavegacaoSemanaAgua() {
  const periodLabelEl = document.getElementById('water-period-label');
  const btnNext = document.getElementById('btn-water-next-week') as HTMLButtonElement | null;

  if (periodLabelEl) {
    if (waterWeekOffset === 0) {
      periodLabelEl.innerText = 'Últimos 7 dias';
    } else if (waterWeekOffset === 1) {
      periodLabelEl.innerText = 'Semana anterior';
    } else {
      periodLabelEl.innerText = `${waterWeekOffset} sem. atrás`;
    }
  }

  if (btnNext) {
    btnNext.disabled = waterWeekOffset <= 0;
    btnNext.style.opacity = waterWeekOffset <= 0 ? '0.3' : '1';
    btnNext.style.cursor = waterWeekOffset <= 0 ? 'default' : 'pointer';
  }
}

export async function carregarHistoricoAgua() {
  if (!state.currentUser) return;
  const canvas = document.getElementById('water-history-chart') as HTMLCanvasElement;
  if (!canvas) return;

  try {
    const logs = await buscarHistoricoAgua(state.currentUser.uid, 7, waterWeekOffset * 7);
    renderizarGraficoBarrasAgua(canvas, logs);
    atualizarControlesNavegacaoSemanaAgua();
    atualizarMetricasSemanaisAgua(logs);
  } catch (err) {
    logger.error('Erro ao carregar gráfico de água:', err);
  }
}

export const navegarSemanaAgua = async (dir: number) => {
  waterWeekOffset += dir;
  if (waterWeekOffset < 0) waterWeekOffset = 0;
  await carregarHistoricoAgua();
};

export const toggleWaterHistory = async () => {
  const historySec = document.getElementById('water-history-section');
  const btn = document.getElementById('btn-toggle-water-history');
  if (!historySec || !btn) return;

  if (historySec.style.display === 'none') {
    historySec.style.display = 'block';
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      Fechar
    `;
    await carregarHistoricoAgua();
  } else {
    historySec.style.display = 'none';
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
      Histórico
    `;
  }
};

window.adicionarAgua = adicionarAgua;
window.adicionarAguaPersonalizada = adicionarAguaPersonalizada;
window.navegarSemanaAgua = navegarSemanaAgua;
window.toggleWaterHistory = toggleWaterHistory;
window.carregarHistoricoAgua = carregarHistoricoAgua;
window.atualizarUIWaterCard = atualizarUIWaterCard;
