import { logger } from '../services/logger';
import { Chart } from 'chart.js';
import { state } from './app-state';
import { mostrarToast, abrirModalConfirmacao } from './ui-utils';
import { classificarImc } from '../types';
import type { UserProfile, PesoLog } from '../types';
import { buscarPerfilUsuario, salvarPerfilUsuario } from '../services/auth';
import { buscarHistoricoPeso, salvarHistoricoPeso, excluirPeso } from '../services/peso';

let weightChart: Chart | null = null;

function atualizarCardImcPrincipal(perfil: UserProfile) {
  const peso = perfil.peso || 0;
  const altura = perfil.altura || 0;
  const imcValEl = document.getElementById('imc-val');
  const badgeEl = document.getElementById('imc-classification-badge');
  const descEl = document.getElementById('imc-classification-desc');

  if (peso > 0 && altura > 0) {
    const imc = peso / ((altura / 100) * (altura / 100));
    if (imcValEl) imcValEl.textContent = imc.toFixed(1);
    
    const clf = classificarImc(peso, altura, perfil.idade, perfil.sexo);
    if (badgeEl) {
      badgeEl.textContent = `${clf.emoji} ${clf.label}`;
      badgeEl.style.background = `${clf.cor}22`;
      badgeEl.style.color = clf.cor;
      badgeEl.style.borderColor = `${clf.cor}44`;
    }
    if (descEl) descEl.textContent = clf.descricao;
  } else {
    if (imcValEl) imcValEl.textContent = '--';
    if (badgeEl) badgeEl.textContent = '--';
    if (descEl) descEl.textContent = '';
  }
}

function renderizarHistoricoListaPeso(pesos: PesoLog[], perfil: UserProfile) {
  const histList = document.getElementById('imc-historico-list');
  if (!histList) return;

  if (pesos.length === 0) {
    histList.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:12px;">Nenhum registro de peso no histórico.</p>';
    return;
  }

  const altura = perfil.altura || 0;
  histList.innerHTML = pesos.slice().reverse().map(p => {
    const dataStr = p.data.toLocaleDateString('pt-BR');
    const imcCalc = altura > 0 ? (p.peso / ((altura / 100) * (altura / 100))).toFixed(1) : '--';
    const clf = classificarImc(p.peso, altura, perfil.idade, perfil.sexo);

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-card2); border-radius:8px; font-size:13px;">
        <div>
          <span style="font-weight:600; color:var(--text);">${p.peso.toFixed(1)} kg</span>
          <span style="color:var(--text-muted); margin-left:8px;">IMC: ${imcCalc}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; background:${clf.cor}22; color:${clf.cor}; padding:2px 6px; border-radius:4px;">${clf.label}</span>
          <span style="color:var(--text-muted); font-size:12px;">${dataStr}</span>
          <button onclick="excluirRegistroPeso('${p.id}')" style="background:none;border:none;color:var(--error);cursor:pointer;padding:4px;" title="Excluir Registro">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

export async function carregarImcPage() {
  if (!state.currentUser) return;
  if (!state.userProfile) {
    state.userProfile = await buscarPerfilUsuario(state.currentUser.uid);
  }
  if (!state.userProfile) return;

  const legacyCard = document.getElementById('imc-legacy-card');
  const activeContent = document.getElementById('imc-active-content');
  if (!legacyCard || !activeContent) return;

  if (!state.userProfile.altura) {
    legacyCard.classList.remove('hidden');
    activeContent.style.display = 'none';
    return;
  }

  legacyCard.classList.add('hidden');
  activeContent.style.display = 'block';

  atualizarCardImcPrincipal(state.userProfile);

  try {
    const pesos = await buscarHistoricoPeso(state.currentUser.uid);
    if (pesos.length > 0) {
      setTimeout(() => renderizarGraficoPeso(pesos), 50);
    }
    renderizarHistoricoListaPeso(pesos, state.userProfile);
  } catch (err) {
    logger.error('Erro ao buscar histórico de peso:', err);
  }
}

export async function salvarAlturaLegada() {
  if (!state.currentUser || !state.userProfile) return;
  const input = document.getElementById('legacy-altura-input') as HTMLInputElement;
  const alturaVal = Number(input?.value);
  if (!alturaVal || alturaVal < 50 || alturaVal > 250) {
    mostrarToast('Por favor, informe uma altura válida entre 50 e 250 cm.', 'error');
    return;
  }

  try {
    state.userProfile.altura = alturaVal;
    await salvarPerfilUsuario(state.currentUser.uid, { altura: alturaVal });
    mostrarToast('Altura salva com sucesso!', 'success');
    carregarImcPage();
    if (window.carregarPerfil) window.carregarPerfil();
  } catch (err) {
    logger.error('Erro ao salvar altura:', err);
    mostrarToast('Erro ao salvar altura.', 'error');
  }
}

export async function registrarPesoRapido() {
  if (!state.currentUser || !state.userProfile) return;
  const input = document.getElementById('peso-modal-input') as HTMLInputElement;
  const pesoVal = Number(input?.value);
  if (!pesoVal || pesoVal < 20 || pesoVal > 300) {
    mostrarToast('Por favor, informe um peso válido entre 20 e 300 kg.', 'error');
    return;
  }

  try {
    await salvarHistoricoPeso(state.currentUser.uid, pesoVal);
    state.userProfile.peso = pesoVal;
    await salvarPerfilUsuario(state.currentUser.uid, { peso: pesoVal });
    
    if (input) input.value = '';
    fecharModalPeso();
    mostrarToast('Registro de peso salvo com sucesso!', 'success');
    
    carregarImcPage();
    if (window.carregarPerfil) window.carregarPerfil();
  } catch (err) {
    logger.error(err);
    mostrarToast('Erro ao salvar registro de peso.', 'error');
  }
}

export function abrirPesoDeEscolha() {
  if (window.fecharModalEscolhaRegistro) window.fecharModalEscolhaRegistro();
  const m = document.getElementById('modal-peso');
  if (m) m.classList.remove('hidden');
}

export function fecharModalPeso() {
  const m = document.getElementById('modal-peso');
  if (m) m.classList.add('hidden');
}

export async function excluirRegistroPeso(id: string) {
  abrirModalConfirmacao(
    'Excluir Registro',
    'Tem certeza que deseja excluir este registro de peso?',
    async () => {
      if (!state.currentUser) return;
      try {
        await excluirPeso(id);
        
        const pesos = await buscarHistoricoPeso(state.currentUser.uid);
        let novoPeso = 0;
        if (pesos.length > 0) {
          novoPeso = pesos[pesos.length - 1].peso;
        }
        
        if (state.userProfile && state.userProfile.peso !== novoPeso) {
          state.userProfile.peso = novoPeso;
          await salvarPerfilUsuario(state.currentUser.uid, { peso: novoPeso });
        }

        mostrarToast('Registro excluído com sucesso!', 'success');
        carregarImcPage();
        if (window.carregarPerfil) window.carregarPerfil();
        if (window.carregarHistorico) window.carregarHistorico();
      } catch (err) {
        logger.error(err);
        mostrarToast('Erro ao excluir registro de peso.', 'error');
      }
    }
  );
}

export function renderizarGraficoPeso(dados: Array<{ peso: number; data: Date }>) {
  const canvas = document.getElementById('weight-chart') as HTMLCanvasElement;
  if (!canvas) return;
  if (weightChart) weightChart.destroy();

  weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dados.map(d => d.data.toLocaleDateString('pt-BR')),
      datasets: [
        {
          label: 'Peso (kg)',
          data: dados.map(d => d.peso),
          borderColor: '#4338ca',
          backgroundColor: '#4338ca11',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
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
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

window.carregarImcPage = carregarImcPage;
window.salvarAlturaLegada = salvarAlturaLegada;
window.registrarPesoRapido = registrarPesoRapido;
window.abrirPesoDeEscolha = abrirPesoDeEscolha;
window.fecharModalPeso = fecharModalPeso;
window.excluirRegistroPeso = excluirRegistroPeso;
