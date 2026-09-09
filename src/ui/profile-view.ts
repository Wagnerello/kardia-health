import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import type { UserProfile } from '../types';
import { buscarPerfilUsuario, salvarPerfilUsuario } from '../services/auth';
import { salvarHistoricoPeso } from '../services/peso';
import { carregarMedications } from './medications-view';

function preencherCamposBasicos(p: UserProfile): void {
  const nomeInput = document.getElementById('p-nome') as HTMLInputElement;
  const sexoSelect = document.getElementById('p-sexo') as HTMLSelectElement;
  const nascInput = document.getElementById('p-nascimento') as HTMLInputElement;
  const pesoInput = document.getElementById('p-peso') as HTMLInputElement;
  const alturaInput = document.getElementById('p-altura') as HTMLInputElement;

  if (nomeInput) nomeInput.value = p.nome || '';
  if (sexoSelect) sexoSelect.value = p.sexo || 'outro';
  if (nascInput) nascInput.value = p.nascimento || '';
  if (pesoInput) pesoInput.value = String(p.peso || 0);
  if (alturaInput) alturaInput.value = String(p.altura || '');
}

function preencherCondicoes(p: UserProfile): void {
  const elHip = document.getElementById('p-hipertenso') as HTMLInputElement;
  const elDiab = document.getElementById('p-diabetico') as HTMLInputElement;
  const elFum = document.getElementById('p-fumante') as HTMLInputElement;
  const elSed = document.getElementById('p-sedentario') as HTMLInputElement;
  const elMed = document.getElementById('p-medicacao') as HTMLInputElement;

  if (elHip) elHip.checked = p.hipertenso !== false;
  if (elDiab) elDiab.checked = !!p.diabetico;
  if (elFum) elFum.checked = !!p.fumante;
  if (elSed) elSed.checked = !!p.sedentario;
  if (elMed) elMed.checked = !!p.usaMedicacao;
}

function calcularTextoIdade(nascStr?: string, idadePadrao?: number): string {
  if (!nascStr) return idadePadrao ? `${idadePadrao} anos` : '';
  const nasc = new Date(nascStr + 'T00:00:00');
  if (isNaN(nasc.getTime())) return idadePadrao ? `${idadePadrao} anos` : '';
  const hoje = new Date();
  const idade = hoje.getFullYear() - nasc.getFullYear() -
    (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate()) ? 1 : 0);
  return `${idade} anos`;
}

function atualizarCabecalho(p: UserProfile): void {
  const ini = p.nome ? p.nome.charAt(0).toUpperCase() : '?';
  const avatarBig = document.getElementById('profile-avatar-big');
  const profName = document.getElementById('profile-name');
  if (avatarBig) avatarBig.textContent = ini;
  if (profName) profName.textContent = p.nome || 'Usuário';

  const profInfo = document.getElementById('profile-info');
  if (profInfo) {
    const idadeStr = calcularTextoIdade(p.nascimento, p.idade);
    const altStr = p.altura ? ` · ${p.altura} cm` : '';
    profInfo.textContent = `${idadeStr} · ${p.peso || 0} kg${altStr} · ${p.sexo || ''}`;
  }
}

export async function carregarPerfil(): Promise<void> {
  if (!state.currentUser) return;
  if (!state.userProfile) {
    state.userProfile = await buscarPerfilUsuario(state.currentUser.uid);
  }
  if (!state.userProfile) return;

  preencherCamposBasicos(state.userProfile);
  preencherCondicoes(state.userProfile);
  atualizarCabecalho(state.userProfile);
  carregarMedications();
}

function lerDadosFormularioPerfil(): Partial<UserProfile> {
  const nascimento = (document.getElementById('p-nascimento') as HTMLInputElement).value;
  let idade = state.userProfile?.idade || 0;
  if (nascimento) {
    const nasc = new Date(nascimento + 'T00:00:00');
    const hoje = new Date();
    idade = hoje.getFullYear() - nasc.getFullYear() -
      (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate()) ? 1 : 0);
  }

  return {
    nome: (document.getElementById('p-nome') as HTMLInputElement).value,
    sexo: (document.getElementById('p-sexo') as HTMLSelectElement).value as 'masculino' | 'feminino' | 'outro',
    nascimento,
    idade,
    peso: Number((document.getElementById('p-peso') as HTMLInputElement).value),
    altura: Number((document.getElementById('p-altura') as HTMLInputElement).value) || undefined,
    hipertenso: (document.getElementById('p-hipertenso') as HTMLInputElement).checked,
    diabetico: (document.getElementById('p-diabetico') as HTMLInputElement).checked,
    fumante: (document.getElementById('p-fumante') as HTMLInputElement).checked,
    sedentario: (document.getElementById('p-sedentario') as HTMLInputElement).checked,
    usaMedicacao: (document.getElementById('p-medicacao') as HTMLInputElement).checked,
  };
}

export const inicializarEventosPerfil = (): void => {
  document.getElementById('form-perfil')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.currentUser) return;
    try {
      const dados = lerDadosFormularioPerfil();
      await salvarPerfilUsuario(state.currentUser.uid, dados);
      if (dados.peso !== undefined && state.userProfile?.peso !== dados.peso) {
        await salvarHistoricoPeso(state.currentUser.uid, dados.peso);
      }
      if (state.userProfile) {
        state.userProfile = { ...state.userProfile, ...dados };
      }
      mostrarToast('Perfil atualizado com sucesso!', 'success');
      carregarPerfil();
    } catch {
      mostrarToast('Erro ao salvar perfil.', 'error');
    }
  });
};

window.carregarPerfil = carregarPerfil;
