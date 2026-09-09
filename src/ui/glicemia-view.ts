import { logger } from '../services/logger';
import { Chart } from 'chart.js';
import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import { classificarGlicemia } from '../types';
import type { GlicemiaReading } from '../types';
import {
  buscarGlicemias,
  salvarGlicemia,
  gerarFeedbackGlicemiaIA,
  atualizarFeedbackGlicemiaIA,
} from '../services/glicemia';

export const abrirModalGlicemia = () => {
  if (state.userProfile?.status === 'Inativo') {
    mostrarToast('Sua conta está desativada.', 'error');
    return;
  }
  document.getElementById('modal-glicemia')?.classList.remove('hidden');
  
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const gDatetime = document.getElementById('g-datetime') as HTMLInputElement;
  const gValor = document.getElementById('g-valor') as HTMLInputElement;
  if (gDatetime) gDatetime.value = now.toISOString().slice(0, 16);
  if (gValor) gValor.value = '';
  document.getElementById('g-form-error')?.classList.add('hidden');
};

export const fecharModalGlicemia = () => {
  document.getElementById('modal-glicemia')?.classList.add('hidden');
};

function parseDataHoraInput(dtStr: string): Date {
  if (dtStr.includes('/')) {
    const parts = dtStr.split(/[\s/:]+/);
    if (parts.length >= 5) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), Number(parts[3]), Number(parts[4]));
    }
  }
  return new Date(dtStr);
}

async function dispararAnaliseIAGlicemia(leitura: GlicemiaReading) {
  if (!state.userProfile || !state.currentUser) return;
  const hist = await buscarGlicemias(state.currentUser.uid, 30);
  const feedback = await gerarFeedbackGlicemiaIA(leitura, state.userProfile, hist, state.medications);
  if (leitura.id) {
    await atualizarFeedbackGlicemiaIA(leitura.id, feedback);
  }
  
  const pageGlicemia = document.getElementById('page-glicemia');
  if (pageGlicemia && !pageGlicemia.classList.contains('hidden')) {
    carregarGlicemiaPage();
  }
  mostrarToast('Análise de glicemia da IA disponível!', 'info');
}

function validarFormularioGlicemia(): { valor: number; momento: GlicemiaReading['momento']; dtStr: string } | null {
  const valor = Number((document.getElementById('g-valor') as HTMLInputElement)?.value);
  const momento = ((document.getElementById('g-momento') as HTMLSelectElement)?.value || 'jejum') as GlicemiaReading['momento'];
  const dtStr = (document.getElementById('g-datetime') as HTMLInputElement)?.value;
  const errEl = document.getElementById('g-form-error');

  if (!valor || !dtStr) {
    if (errEl) {
      errEl.textContent = 'Preencha todos os campos.';
      errEl.classList.remove('hidden');
    }
    return null;
  }
  if (errEl) errEl.classList.add('hidden');
  return { valor, momento, dtStr };
}

function recarregarPaginaGlicemiaSeVisivel() {
  const pageGlicemia = document.getElementById('page-glicemia');
  if (pageGlicemia && !pageGlicemia.classList.contains('hidden')) {
    carregarGlicemiaPage();
  }
}

export const salvarGlicemiaModal = async () => {
  if (!state.currentUser) return;
  const formData = validarFormularioGlicemia();
  if (!formData) return;

  const btn = document.getElementById('btn-salvar-glicemia') as HTMLButtonElement;
  if (btn) btn.disabled = true;

  try {
    const dataHora = parseDataHoraInput(formData.dtStr);
    const leitura: Omit<GlicemiaReading, 'id'> = {
      user_id: state.currentUser.uid,
      valor: formData.valor,
      momento: formData.momento,
      data_hora_afericao: dataHora,
    };

    const id = await salvarGlicemia(leitura);
    mostrarToast('Glicemia salva com sucesso!', 'success');
    fecharModalGlicemia();
    recarregarPaginaGlicemiaSeVisivel();
    dispararAnaliseIAGlicemia({ ...leitura, id });
  } catch (err) {
    logger.error(err);
    mostrarToast('Erro ao salvar glicemia.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

function atualizarCardUltimaGlicemia(ultima: GlicemiaReading) {
  const valEl = document.getElementById('last-glicemia-val');
  if (valEl) valEl.textContent = String(ultima.valor);
  
  const momentosMap: Record<string, string> = {
    jejum: 'Em Jejum',
    pos_prandial: 'Pós-Prandial',
    antes_dormir: 'Antes de Dormir',
    aleatorio: 'Aleatório'
  };
  const momentoEl = document.getElementById('last-glicemia-momento');
  if (momentoEl) momentoEl.textContent = momentosMap[ultima.momento] || ultima.momento;

  const clf = classificarGlicemia(ultima.valor, ultima.momento);
  const badge = document.getElementById('last-glicemia-classification');
  if (badge) {
    badge.textContent = `${clf.emoji} ${clf.label}`;
    badge.style.background = `${clf.cor}22`;
    badge.style.color = clf.cor;
    badge.style.borderColor = `${clf.cor}44`;
  }

  const feedbackEl = document.getElementById('last-glicemia-ai-feedback');
  const feedbackTextEl = document.getElementById('glicemia-ai-feedback-text');
  if (ultima.ai_feedback) {
    if (feedbackEl) feedbackEl.classList.remove('hidden');
    if (feedbackTextEl) feedbackTextEl.textContent = ultima.ai_feedback;
  } else if (feedbackEl) {
    feedbackEl.classList.add('hidden');
  }
}

export async function carregarGlicemiaPage() {
  if (!state.currentUser) return;
  const emptyEl = document.getElementById('glicemia-empty');
  const dataEl = document.getElementById('glicemia-data');

  try {
    state.glicemias = await buscarGlicemias(state.currentUser.uid, 30);
    
    if (state.glicemias.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (dataEl) dataEl.classList.add('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (dataEl) dataEl.classList.remove('hidden');

    atualizarCardUltimaGlicemia(state.glicemias[0]);

    setTimeout(() => {
      renderizarGraficoGlicemia(state.glicemias.slice().reverse().slice(-30));
    }, 50);
  } catch (err) {
    logger.error('Erro ao carregar glicemias:', err);
  }
}

export function renderizarGraficoGlicemia(dados: GlicemiaReading[]) {
  const canvas = document.getElementById('glicemia-chart') as HTMLCanvasElement;
  if (!canvas) return;
  if (state.glicemiaChart) state.glicemiaChart.destroy();

  state.glicemiaChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dados.map(d => {
        const dt = d.data_hora_afericao;
        return `${dt.getDate()}/${dt.getMonth()+1}`;
      }),
      datasets: [
        {
          label: 'Glicemia (mg/dL)',
          data: dados.map(d => d.valor),
          borderColor: '#F59E0B',
          backgroundColor: '#F59E0B22',
          tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#8899BB', font: { size: 10 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#8899BB', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          min: 40
        }
      },
      interaction: { mode: 'index', intersect: false }
    }
  });
}

window.abrirModalGlicemia = abrirModalGlicemia;
window.fecharModalGlicemia = fecharModalGlicemia;
window.salvarGlicemiaModal = salvarGlicemiaModal;
window.carregarGlicemiaPage = carregarGlicemiaPage;
