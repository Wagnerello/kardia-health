import { logger } from '../services/logger';
import { state } from './app-state';
import { mostrarToast } from './ui-utils';
import { classificarPressao } from '../types';
import type { BpReading } from '../types';
import {
  processarImagemOCR,
  arquivoParaBase64,
  criarUrlPreview,
  comprimirImagem,
  obterMimeType
} from '../services/ocr';
import {
  salvarAfericao,
  uploadImagemAfericao,
  atualizarFeedbackIA,
  gerarFeedbackIA,
  buscarAfericoes,
} from '../services/afericoes';
import { carregarDashboard } from './dashboard-view';

export const abrirModalAfericao = (): void => {
  if (state.userProfile?.status === 'Inativo') {
    mostrarToast('Sua conta está desativada. Você apenas pode visualizar seus dados.', 'error');
    return;
  }
  document.getElementById('modal-afericao')?.classList.remove('hidden');
  resetarModal();
};

export const fecharModalAfericao = (): void => {
  document.getElementById('modal-afericao')?.classList.add('hidden');
};

export function resetarModal(): void {
  state.imagemSelecionada = null;
  mostrarStep('upload');
  ['f-sys', 'f-dia', 'f-pul'].forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) el.value = '';
  });
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const dtEl = document.getElementById('f-datetime') as HTMLInputElement;
  if (dtEl) dtEl.value = now.toISOString().slice(0, 16);
  document.getElementById('form-error')?.classList.add('hidden');
  const classDiv = document.getElementById('form-classification');
  if (classDiv) classDiv.innerHTML = '';
}

export function mostrarStep(step: 'upload' | 'ocr' | 'form'): void {
  ['step-upload', 'step-ocr', 'step-form'].forEach(s => document.getElementById(s)?.classList.add('hidden'));
  document.getElementById(`step-${step}`)?.classList.remove('hidden');
}

export function atualizarPreviewClassificacao(): void {
  const sys = Number((document.getElementById('f-sys') as HTMLInputElement)?.value);
  const dia = Number((document.getElementById('f-dia') as HTMLInputElement)?.value);
  const div = document.getElementById('form-classification');
  if (!div) return;
  if (sys > 0 && dia > 0) {
    const clf = classificarPressao(sys, dia);
    div.innerHTML = `<span class="classification-badge" style="background:${clf.cor}22;color:${clf.cor};border-color:${clf.cor}44">${clf.emoji} ${clf.label} — ${clf.descricao}</span>`;
  } else {
    div.innerHTML = '';
  }
}

export const pularOCR = (): void => {
  state.imagemSelecionada = null;
  document.getElementById('ocr-result-badge')?.classList.add('hidden');
  document.getElementById('ocr-preview-img')?.classList.add('hidden');
  mostrarStep('form');
};

interface FormAfericaoValores {
  sys: number;
  dia: number;
  pul: number;
  dtStr: string;
}

function exibirErroFormAfericao(msg: string): null {
  const errEl = document.getElementById('form-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
  return null;
}

function validarFormAfericao(): FormAfericaoValores | null {
  const sys = Number((document.getElementById('f-sys') as HTMLInputElement)?.value);
  const dia = Number((document.getElementById('f-dia') as HTMLInputElement)?.value);
  const pul = Number((document.getElementById('f-pul') as HTMLInputElement)?.value);
  const dtStr = (document.getElementById('f-datetime') as HTMLInputElement)?.value;

  if (!sys || !dia || !pul || !dtStr) {
    return exibirErroFormAfericao('Preencha todos os campos.');
  }
  if (sys <= dia) {
    return exibirErroFormAfericao('Sistólica deve ser maior que diastólica.');
  }

  document.getElementById('form-error')?.classList.add('hidden');
  return { sys, dia, pul, dtStr };
}

function processarUploadImagemBackground(uid: string, id: string, file: File): void {
  comprimirImagem(file, 0.6)
    .then(compressed => uploadImagemAfericao(uid, compressed))
    .then(imageUrl => {
      import('firebase/firestore').then(({ updateDoc, doc }) => {
        import('../firebase').then(({ db }) => {
          updateDoc(doc(db, 'bp_readings', id), { image_url: imageUrl });
        });
      });
    })
    .catch(err => logger.error('[Storage] Erro no upload em background:', err));
}

async function processarFeedbackIABackground(uid: string, id: string, leitura: BpReading): Promise<void> {
  if (!state.userProfile) return;
  try {
    const historico = await buscarAfericoes(uid, 30);
    const feedback = await gerarFeedbackIA(leitura, state.userProfile, historico);
    await atualizarFeedbackIA(id, feedback);
    carregarDashboard();
    mostrarToast('Análise de IA disponível!', 'info');
  } catch (err) {
    logger.error('Erro ao gerar feedback da IA:', err);
  }
}

function alternarEstadoBotaoSalvar(salvando: boolean): void {
  const btn = document.getElementById('btn-salvar') as HTMLButtonElement;
  const iconEl = document.getElementById('btn-salvar-icon');
  if (btn) btn.disabled = salvando;
  if (iconEl) {
    iconEl.innerHTML = salvando
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  }
}

export const salvarAfericaoModal = async (): Promise<void> => {
  const currentUser = state.currentUser;
  if (!currentUser) return;

  const valores = validarFormAfericao();
  if (!valores) return;

  alternarEstadoBotaoSalvar(true);

  try {
    const leitura: Omit<BpReading, 'id'> = {
      user_id: currentUser.uid,
      sys: valores.sys,
      dia: valores.dia,
      pul: valores.pul,
      data_hora_afericao: new Date(valores.dtStr),
    };

    const id = await salvarAfericao(leitura);
    mostrarToast('Aferição salva! Processando anexos...', 'success');
    fecharModalAfericao();
    carregarDashboard();

    if (state.imagemSelecionada) {
      processarUploadImagemBackground(currentUser.uid, id, state.imagemSelecionada);
    }

    processarFeedbackIABackground(currentUser.uid, id, { ...leitura, id });
  } catch (err) {
    logger.error(err);
    mostrarToast('Erro ao salvar aferição.', 'error');
  } finally {
    alternarEstadoBotaoSalvar(false);
  }
};

function preencherCamposOCR(resultado: { sys?: number; dia?: number; pul?: number; data_hora?: Date | string }): void {
  if (resultado.sys) (document.getElementById('f-sys') as HTMLInputElement).value = String(resultado.sys);
  if (resultado.dia) (document.getElementById('f-dia') as HTMLInputElement).value = String(resultado.dia);
  if (resultado.pul) (document.getElementById('f-pul') as HTMLInputElement).value = String(resultado.pul);
  if (resultado.data_hora) {
    const dt = resultado.data_hora instanceof Date ? resultado.data_hora : new Date(resultado.data_hora);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    (document.getElementById('f-datetime') as HTMLInputElement).value = dt.toISOString().slice(0, 16);
  }
  atualizarPreviewClassificacao();
}

function atualizarBadgeConfiancaOCR(confianca: 'alta' | 'media' | 'baixa', modeloUsado?: string): void {
  const badge = document.getElementById('ocr-confidence-badge');
  if (!badge) return;
  badge.className = `ocr-confidence ${confianca}`;
  const labels: Record<string, string> = {
    alta: 'Alta confiança',
    media: 'Confiança média',
    baixa: 'Baixa confiança — verifique!'
  };
  badge.textContent = labels[confianca] || 'Verifique os valores';
  if (modeloUsado) {
    badge.title = `Modelo usado: ${modeloUsado}`;
  }
}

function configurarPreviewUploadOCR(url: string): void {
  mostrarStep('ocr');
  const prevEl = document.getElementById('image-preview') as HTMLImageElement;
  if (prevEl) prevEl.src = url;
  document.getElementById('image-preview-container')?.classList.remove('hidden');
  document.getElementById('ocr-loading')?.classList.remove('hidden');
}

function exibirResultadoVisualOCR(url: string): void {
  mostrarStep('form');
  const fPrev = document.getElementById('form-preview') as HTMLImageElement;
  if (fPrev) fPrev.src = url;
  document.getElementById('ocr-preview-img')?.classList.remove('hidden');
  document.getElementById('ocr-result-badge')?.classList.remove('hidden');
}

async function processarUploadImagemOCR(file: File): Promise<void> {
  state.imagemSelecionada = file;
  const url = criarUrlPreview(file);
  configurarPreviewUploadOCR(url);

  try {
    const base64 = await arquivoParaBase64(file);
    const mimeType = obterMimeType(file);
    const resultado = await processarImagemOCR(base64, mimeType);

    exibirResultadoVisualOCR(url);
    atualizarBadgeConfiancaOCR(resultado.confianca, resultado.modelo_usado);
    preencherCamposOCR(resultado);
  } catch {
    exibirResultadoVisualOCR(url);
    atualizarBadgeConfiancaOCR('baixa');
    mostrarToast('OCR indisponível. Preencha os valores manualmente.', 'error');
  }
}

export const inicializarEventosModais = (): void => {
  document.getElementById('file-input')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await processarUploadImagemOCR(file);
    }
  });

  const uploadZone = document.getElementById('upload-zone');
  uploadZone?.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone?.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) {
      state.imagemSelecionada = file;
      const input = document.getElementById('file-input') as HTMLInputElement;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }
  });

  ['f-sys', 'f-dia', 'f-pul'].forEach(id => document.getElementById(id)?.addEventListener('input', atualizarPreviewClassificacao));

  document.getElementById('modal-afericao')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-afericao')) {
      fecharModalAfericao();
    }
  });
};

window.abrirModalAfericao = abrirModalAfericao;
window.fecharModalAfericao = fecharModalAfericao;
window.pularOCR = pularOCR;
window.salvarAfericaoModal = salvarAfericaoModal;
