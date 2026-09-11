import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

declare global {
  interface Window {
    abrirModalEscolhaRegistro: () => void;
    fecharModalEscolhaRegistro: () => void;
    abrirPressaoDeEscolha: () => void;
    abrirGlicemiaDeEscolha: () => void;
    abrirAguaDeEscolha: () => void;
    abrirPesoDeEscolha: () => void;
  }
}

// Mock do Firebase para ambiente de teste jsdom
vi.mock('../firebase', () => ({
  auth: { currentUser: { uid: 'test-user-123', email: 'test@kardia.app' } },
  db: {},
  storage: {},
  default: {}
}));

// Mock dos serviços externos
vi.mock('../services/auth', () => ({
  observarAutenticacao: vi.fn(),
  buscarPerfilUsuario: vi.fn().mockResolvedValue({
    uid: 'test-user-123',
    nome: 'Paciente Teste',
    role: 'USER',
    status: 'Ativo'
  }),
  salvarPerfilUsuario: vi.fn().mockResolvedValue(undefined),
  processarRedirectGoogle: vi.fn(),
  TERMOS_VERSAO_ATUAL: '2.0.0'
}));

vi.mock('../services/afericoes', () => ({
  buscarAfericoes: vi.fn().mockResolvedValue([]),
  salvarAfericao: vi.fn().mockResolvedValue('new-id'),
  uploadImagemAfericao: vi.fn().mockResolvedValue('http://fake-img'),
  atualizarFeedbackIA: vi.fn().mockResolvedValue(undefined),
  gerarFeedbackIA: vi.fn().mockResolvedValue('feedback mock')
}));

vi.mock('../services/glicemia', () => ({
  buscarGlicemias: vi.fn().mockResolvedValue([]),
  salvarGlicemia: vi.fn().mockResolvedValue('new-glic-id'),
  gerarFeedbackGlicemiaIA: vi.fn().mockResolvedValue('glic mock'),
  atualizarFeedbackGlicemiaIA: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../services/agua', () => ({
  buscarHistoricoAgua: vi.fn().mockResolvedValue([]),
  buscarAguaDoDia: vi.fn().mockResolvedValue(null),
  salvarAguaDoDia: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../services/peso', () => ({
  buscarHistoricoPeso: vi.fn().mockResolvedValue([]),
  salvarHistoricoPeso: vi.fn().mockResolvedValue(undefined),
  excluirPeso: vi.fn().mockResolvedValue(undefined)
}));

describe('Contrato de Interface & DOM Binding (index.html ↔ window)', () => {
  let htmlContent: string;

  beforeAll(async () => {
    const htmlPath = path.resolve(process.cwd(), 'index.html');
    htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    document.body.innerHTML = htmlContent;

    // Inicializa a aplicação e registra todas as funções no window
    await import('../main');
  });

  it('deve extrair todos os onclicks do index.html e garantir que 100% existem no window', () => {
    // Regex para extrair nomes de funções chamadas em onclick="nomeFuncao(...)"
    const onclickRegex = /onclick\s*=\s*["']\s*([a-zA-Z0-9_$]+)\s*\(/g;
    const funcoesEncontradas = new Set<string>();
    let match;

    while ((match = onclickRegex.exec(htmlContent)) !== null) {
      funcoesEncontradas.add(match[1]);
    }

    expect(funcoesEncontradas.size).toBeGreaterThan(15);

    const funcoesFaltando: string[] = [];
    funcoesEncontradas.forEach(fnName => {
      // Ignorar funções puramente inline como togglePassword
      if (fnName === 'togglePassword') return;

      if (typeof (window as any)[fnName] !== 'function' && typeof (globalThis as any)[fnName] !== 'function') {
        funcoesFaltando.push(fnName);
      }
    });

    expect(
      funcoesFaltando,
      `As seguintes funções chamadas em onclick no index.html não estão definidas no window: ${funcoesFaltando.join(', ')}`
    ).toEqual([]);
  });

  it('deve garantir que o botão principal Novo Registro abre o modal de escolha', () => {
    const modalEscolha = document.getElementById('modal-escolha-registro');
    expect(modalEscolha).not.toBeNull();

    // Garante que o modal começa oculto
    modalEscolha?.classList.add('hidden');

    expect(typeof window.abrirModalEscolhaRegistro).toBe('function');
    window.abrirModalEscolhaRegistro();

    // Deve ter removido a classe 'hidden'
    expect(modalEscolha?.classList.contains('hidden')).toBe(false);

    // E fechar deve re-adicionar 'hidden'
    expect(typeof window.fecharModalEscolhaRegistro).toBe('function');
    window.fecharModalEscolhaRegistro();
    expect(modalEscolha?.classList.contains('hidden')).toBe(true);
  });

  it('deve garantir que todos os modais de registro existem no DOM e possuem botão de fechar', () => {
    const modaisObrigatorios = [
      'modal-escolha-registro',
      'modal-afericao',
      'modal-glicemia',
      'modal-agua',
      'modal-peso',
      'modal-medicacao'
    ];

    modaisObrigatorios.forEach(modalId => {
      const el = document.getElementById(modalId);
      expect(el, `Modal #${modalId} deve existir no index.html`).not.toBeNull();
      const btnClose = el?.querySelector('.modal-close');
      expect(btnClose, `Modal #${modalId} deve ter um botão com classe .modal-close`).not.toBeNull();
    });
  });

  it('deve alternar corretamente a abertura de pressão a partir da escolha', () => {
    const modalEscolha = document.getElementById('modal-escolha-registro');
    const modalAfericao = document.getElementById('modal-afericao');

    modalEscolha?.classList.remove('hidden');
    modalAfericao?.classList.add('hidden');

    window.abrirPressaoDeEscolha();

    expect(modalEscolha?.classList.contains('hidden')).toBe(true);
    expect(modalAfericao?.classList.contains('hidden')).toBe(false);
  });

  it('deve alternar corretamente a abertura de glicemia a partir da escolha', () => {
    const modalEscolha = document.getElementById('modal-escolha-registro');
    const modalGlicemia = document.getElementById('modal-glicemia');

    modalEscolha?.classList.remove('hidden');
    modalGlicemia?.classList.add('hidden');

    window.abrirGlicemiaDeEscolha();

    expect(modalEscolha?.classList.contains('hidden')).toBe(true);
    expect(modalGlicemia?.classList.contains('hidden')).toBe(false);
  });

  it('deve alternar corretamente a abertura de água a partir da escolha e inicializar a data', () => {
    const modalEscolha = document.getElementById('modal-escolha-registro');
    const modalAgua = document.getElementById('modal-agua');
    const inputDataAgua = document.getElementById('water-modal-date') as HTMLInputElement;

    modalEscolha?.classList.remove('hidden');
    modalAgua?.classList.add('hidden');

    window.abrirAguaDeEscolha();

    expect(modalEscolha?.classList.contains('hidden')).toBe(true);
    expect(modalAgua?.classList.contains('hidden')).toBe(false);
    expect(inputDataAgua?.value).toBeTruthy();
  });

  it('deve alternar corretamente a abertura de peso a partir da escolha e inicializar a data/hora', () => {
    const modalEscolha = document.getElementById('modal-escolha-registro');
    const modalPeso = document.getElementById('modal-peso');
    const inputDatetimePeso = document.getElementById('peso-modal-datetime') as HTMLInputElement;

    modalEscolha?.classList.remove('hidden');
    modalPeso?.classList.add('hidden');

    window.abrirPesoDeEscolha();

    expect(modalEscolha?.classList.contains('hidden')).toBe(true);
    expect(modalPeso?.classList.contains('hidden')).toBe(false);
    expect(inputDatetimePeso?.value).toBeTruthy();
  });
});
