import { logger } from '../services/logger';
import { state } from './app-state';
import { mostrarToast, abrirModalConfirmacao } from './ui-utils';
import { buscarMedications, salvarMedication, atualizarMedication, excluirMedication } from '../services/medications';
import type { Medication } from '../types';

export const toggleMedicationDates = () => {
  const tipo = (document.getElementById('m-tipo') as HTMLSelectElement)?.value;
  const container = document.getElementById('m-datas-container');
  const mInicio = document.getElementById('m-inicio') as HTMLInputElement;
  const mDias = document.getElementById('m-dias') as HTMLInputElement;
  
  if (tipo === 'Temporario') {
    container?.classList.remove('hidden');
    if (mInicio) mInicio.required = true;
    if (mDias) mDias.required = true;
    if (mInicio && !mInicio.value) {
      mInicio.value = new Date().toISOString().split('T')[0];
    }
  } else {
    container?.classList.add('hidden');
    if (mInicio) mInicio.required = false;
    if (mDias) mDias.required = false;
  }
};

export const abrirModalMedicacao = () => {
  state.medicacaoEditandoId = null;
  const title = document.getElementById('modal-medicacao-title');
  if (title) title.innerText = 'Nova Medicação';
  document.getElementById('modal-medicacao')?.classList.remove('hidden');
  toggleMedicationDates();
};

function preencherCamposMedicacao(med: Medication) {
  const mNome = document.getElementById('m-nome') as HTMLInputElement;
  const mDosagem = document.getElementById('m-dosagem') as HTMLInputElement;
  const mFreq = document.getElementById('m-freq') as HTMLInputElement;
  const mTipo = document.getElementById('m-tipo') as HTMLSelectElement;
  const mInicio = document.getElementById('m-inicio') as HTMLInputElement;
  const mDias = document.getElementById('m-dias') as HTMLInputElement;

  if (mNome) mNome.value = med.nome;
  if (mDosagem) mDosagem.value = med.dosagem;
  if (mFreq) mFreq.value = med.frequencia;
  if (mTipo) mTipo.value = med.tipo;
  
  if (med.tipo === 'Temporario' && med.data_inicio && med.data_fim) {
    if (mInicio) mInicio.value = med.data_inicio.toISOString().split('T')[0];
    const dias = Math.round((med.data_fim.getTime() - med.data_inicio.getTime()) / (1000 * 3600 * 24));
    if (mDias) mDias.value = dias.toString();
  }
}

export const editarMedicationId = (id: string) => {
  state.medicacaoEditandoId = id;
  const med = state.medications.find(m => m.id === id);
  if (!med) return;

  const title = document.getElementById('modal-medicacao-title');
  if (title) title.innerText = 'Editar Medicação';

  preencherCamposMedicacao(med);
  document.getElementById('modal-medicacao')?.classList.remove('hidden');
  toggleMedicationDates();
};

export const fecharModalMedicacao = () => {
  document.getElementById('modal-medicacao')?.classList.add('hidden');
  (document.getElementById('form-medicacao') as HTMLFormElement)?.reset();
  state.medicacaoEditandoId = null;
};

interface FormMedicacaoData {
  nome: string;
  dosagem: string;
  frequencia: string;
  tipo: 'Continuo' | 'Temporario';
  data_inicio?: Date;
  data_fim?: Date;
}

function extrairDadosFormularioMedicacao(): FormMedicacaoData {
  const nome = (document.getElementById('m-nome') as HTMLInputElement).value;
  const dosagem = (document.getElementById('m-dosagem') as HTMLInputElement).value;
  const frequencia = (document.getElementById('m-freq') as HTMLInputElement).value;
  const tipo = (document.getElementById('m-tipo') as HTMLSelectElement).value as 'Continuo' | 'Temporario';
  
  let data_inicio: Date | undefined;
  let data_fim: Date | undefined;
  
  if (tipo === 'Temporario') {
    const strInicio = (document.getElementById('m-inicio') as HTMLInputElement).value;
    const strDias = (document.getElementById('m-dias') as HTMLInputElement).value;
    if (strInicio && strDias) {
      data_inicio = new Date(`${strInicio}T12:00:00`);
      data_fim = new Date(data_inicio);
      data_fim.setDate(data_fim.getDate() + parseInt(strDias, 10));
    }
  }

  return { nome, dosagem, frequencia, tipo, data_inicio, data_fim };
}

async function persistirMedicacaoForm(data: FormMedicacaoData, uid: string) {
  if (state.medicacaoEditandoId) {
    const payload: Partial<Medication> = {
      nome: data.nome,
      dosagem: data.dosagem,
      frequencia: data.frequencia,
      tipo: data.tipo,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
    };
    await atualizarMedication(state.medicacaoEditandoId, payload);
    mostrarToast('Medicação atualizada com sucesso!', 'success');
  } else {
    const payload: Omit<Medication, 'id'> = {
      user_id: uid,
      nome: data.nome,
      dosagem: data.dosagem,
      frequencia: data.frequencia,
      tipo: data.tipo,
      ativa: true,
      data_criacao: new Date(),
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
    };
    await salvarMedication(payload);
    mostrarToast('Medicação salva com sucesso!', 'success');
  }
}

export const inicializarEventosMedicacao = () => {
  const formMedicacao = document.getElementById('form-medicacao');
  if (!formMedicacao) return;

  formMedicacao.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.currentUser) return;
    const btn = formMedicacao.querySelector('button[type="submit"]') as HTMLButtonElement;
    const oldText = btn.innerHTML;
    btn.innerHTML = 'Salvando...';
    btn.disabled = true;

    try {
      const data = extrairDadosFormularioMedicacao();
      await persistirMedicacaoForm(data, state.currentUser.uid);
      fecharModalMedicacao();
      await carregarMedications();
    } catch (err) {
      logger.error(err);
      mostrarToast('Erro ao salvar medicação', 'error');
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  });
};

function formatarStatusMedicacaoItem(m: Medication): { status: string; opacity: string } {
  if (m.tipo === 'Temporario' && m.data_fim) {
    if (new Date() > m.data_fim) {
      return {
        status: ' <span style="background:var(--border); color:var(--text-muted); padding:2px 6px; border-radius:4px; font-size:10px; margin-left:4px;">Concluído</span>',
        opacity: '0.6'
      };
    }
    const diasFaltam = Math.ceil((m.data_fim.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return {
      status: ` <span style="background:var(--primary); color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:4px;">Faltam ${diasFaltam} dias</span>`,
      opacity: '1'
    };
  }
  return { status: '', opacity: '1' };
}

function renderizarItemMedicacao(m: Medication): string {
  const { status, opacity } = formatarStatusMedicacaoItem(m);
  return `
  <div style="background:var(--surface); border:1px solid var(--border); padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; opacity:${opacity};">
    <div>
      <div style="font-weight:600; color:var(--text); font-size:14px;">${m.nome} <span style="font-size:12px; font-weight:normal; color:var(--text-muted); margin-left:4px;">${m.dosagem}</span></div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${m.frequencia} • ${m.tipo === 'Continuo' ? 'Uso Contínuo' : 'Uso Temporário'} ${status}</div>
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-ghost" style="color:var(--primary); padding:4px;" onclick="editarMedicationId('${m.id}')" title="Editar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn btn-ghost" style="color:var(--danger); padding:4px;" onclick="excluirMedicationId('${m.id}')" title="Excluir">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  </div>`;
}

export const carregarMedications = async () => {
  if (!state.currentUser) return;
  try {
    state.medications = await buscarMedications(state.currentUser.uid);
    const list = document.getElementById('medications-list');
    if (!list) return;

    if (state.medications.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center;">Nenhuma medicação cadastrada.</p>';
      return;
    }

    list.innerHTML = state.medications.map(renderizarItemMedicacao).join('');
  } catch (e) {
    logger.error(e);
  }
};

export const excluirMedicationId = (id: string) => {
  abrirModalConfirmacao('Excluir Medicação', 'Tem certeza que deseja excluir esta medicação?', async () => {
    try {
      await excluirMedication(id);
      mostrarToast('Medicação excluída!', 'success');
      await carregarMedications();
    } catch (e) {
      logger.error(e);
      mostrarToast('Erro ao excluir', 'error');
    }
  });
};

window.toggleMedicationDates = toggleMedicationDates;
window.abrirModalMedicacao = abrirModalMedicacao;
window.editarMedicationId = editarMedicationId;
window.fecharModalMedicacao = fecharModalMedicacao;
window.carregarMedications = carregarMedications;
window.excluirMedicationId = excluirMedicationId;
