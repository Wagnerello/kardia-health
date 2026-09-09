import { logger } from '../services/logger';
import { Chart } from 'chart.js';
import { state } from './app-state';
import { calcularMedias, buscarAfericoes } from '../services/afericoes';
import { buscarGlicemias } from '../services/glicemia';
import { buscarAguaDoDia, buscarHistoricoAgua } from '../services/agua';
import { classificarPressao } from '../types';
import type { BpReading } from '../types';
import { obterDicaPressao, obterDicaGlicemia, obterDicaHidratacao } from '../utils/dicas';
import type { Dica, ContextoSaude } from '../utils/dicas';
import { atualizarUIWaterCard } from './water-view';

export function calcularMetaHidratacao(peso?: number, idade?: number): number {
  if (!peso || !idade || peso <= 0 || idade <= 0) return 2000;
  if (idade <= 17) return peso * 40;
  if (idade <= 55) return peso * 35;
  if (idade <= 65) return peso * 30;
  return peso * 25;
}

export function renderizarDica(elementId: string, dica: Dica) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.style.display = 'flex';
  container.innerHTML = `
    <span class="tip-icon" style="color:var(--primary); font-size:24px;">${dica.icone}</span>
    <div>
      <p><strong>${dica.titulo}:</strong> ${dica.texto}</p>
    </div>
  `;
}

async function inicializarAguaDashboard(uid: string) {
  state.metaAgua = calcularMetaHidratacao(state.userProfile?.peso, state.userProfile?.idade);
  const d = new Date();
  const hojeStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const waterLog = await buscarAguaDoDia(uid, hojeStr);
  state.aguaHoje = waterLog ? waterLog.amount_ml : 0;
  atualizarUIWaterCard();
}

function atualizarCardUltimaAfericao(ultima: BpReading) {
  const lastSys = document.getElementById('last-sys');
  const lastDia = document.getElementById('last-dia');
  const lastPul = document.getElementById('last-pul');
  if (lastSys) lastSys.textContent = String(ultima.sys);
  if (lastDia) lastDia.textContent = String(ultima.dia);
  if (lastPul) lastPul.textContent = String(ultima.pul);

  const clf = classificarPressao(ultima.sys, ultima.dia);
  const badge = document.getElementById('last-classification');
  if (badge) {
    badge.textContent = `${clf.emoji} ${clf.label}`;
    badge.style.background = `${clf.cor}22`;
    badge.style.color = clf.cor;
    badge.style.borderColor = `${clf.cor}44`;
  }

  const lastAiFb = document.getElementById('last-ai-feedback');
  const aiFbText = document.getElementById('ai-feedback-text');
  if (ultima.ai_feedback) {
    if (lastAiFb) lastAiFb.classList.remove('hidden');
    if (aiFbText) aiFbText.textContent = ultima.ai_feedback;
  } else if (lastAiFb) {
    lastAiFb.classList.add('hidden');
  }
}

function atualizarCardMediasSemanais(afericoes: BpReading[]) {
  const data7 = new Date();
  data7.setDate(data7.getDate() - 7);
  const ult7 = afericoes.filter(a => a.data_hora_afericao >= data7);
  const medias = calcularMedias(ult7);
  if (medias) {
    const avgSys = document.getElementById('avg-sys');
    const avgDia = document.getElementById('avg-dia');
    const avgPul = document.getElementById('avg-pul');
    if (avgSys) avgSys.textContent = String(medias.sys);
    if (avgDia) avgDia.textContent = String(medias.dia);
    if (avgPul) avgPul.textContent = String(medias.pul);
  }
}

function renderizarTodasDicasDashboard(contexto: ContextoSaude) {
  renderizarDica('oms-tip-pressao', obterDicaPressao(contexto));
  renderizarDica('oms-tip-glicemia', obterDicaGlicemia(contexto));
  renderizarDica('oms-tip-hidratacao', obterDicaHidratacao(contexto));
}

function atualizarVisibilidadeDashboard(temAfericoes: boolean) {
  const elDashEmpty = document.getElementById('dashboard-empty');
  const elDashData = document.getElementById('dashboard-data');

  if (!temAfericoes) {
    if (elDashEmpty) elDashEmpty.style.display = 'flex';
    if (elDashData) elDashData.classList.add('hidden');
    return;
  }

  if (elDashEmpty) elDashEmpty.style.display = 'none';
  if (elDashData) elDashData.classList.remove('hidden');
}

export async function carregarDashboard() {
  if (!state.currentUser) {
    logger.error('[carregarDashboard] currentUser é nulo — abortando.');
    return;
  }
  try {
    await inicializarAguaDashboard(state.currentUser.uid);
    state.afericoes = await buscarAfericoes(state.currentUser.uid, 30);

    const histGlicemia = await buscarGlicemias(state.currentUser.uid, 1);
    const historicoAgua7d = await buscarHistoricoAgua(state.currentUser.uid, 7);

    renderizarTodasDicasDashboard({
      userProfile: state.userProfile,
      ultimaPressao: state.afericoes.length > 0 ? state.afericoes[0] : null,
      ultimaGlicemia: histGlicemia.length > 0 ? histGlicemia[0] : null,
      aguaHoje: state.aguaHoje,
      metaAgua: state.metaAgua,
      historicoAgua7d
    });

    const temAfericoes = state.afericoes.length > 0;
    atualizarVisibilidadeDashboard(temAfericoes);

    if (!temAfericoes) return;

    atualizarCardUltimaAfericao(state.afericoes[0]);
    atualizarCardMediasSemanais(state.afericoes);

    setTimeout(() => {
      renderizarGrafico(state.afericoes.slice().reverse().slice(-30));
    }, 50);
  } catch (err) {
    logger.error('Erro ao carregar dashboard:', err);
  }
}

export function renderizarGrafico(dados: BpReading[]) {
  const canvas = document.getElementById('bp-chart') as HTMLCanvasElement;
  if (!canvas) return;
  if (state.bpChart) state.bpChart.destroy();

  state.bpChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dados.map(d => {
        const dt = d.data_hora_afericao;
        return `${dt.getDate()}/${dt.getMonth()+1} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
      }),
      datasets: [
        {
          label: 'Sistólica',
          data: dados.map(d => d.sys),
          borderColor: '#5BA3E0',
          backgroundColor: '#5BA3E022',
          tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6
        },
        {
          label: 'Diastólica',
          data: dados.map(d => d.dia),
          borderColor: '#00C9A7',
          backgroundColor: '#00C9A711',
          tension: 0.4, fill: false, pointRadius: 4, pointHoverRadius: 6
        },
        {
          label: 'Pulso',
          data: dados.map(d => d.pul),
          borderColor: '#F59E0B',
          backgroundColor: 'transparent',
          tension: 0.4, fill: false,
          borderDash: [4, 4], pointRadius: 3, pointHoverRadius: 5
        },
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

window.carregarDashboard = carregarDashboard;
window.renderizarGrafico = renderizarGrafico;
