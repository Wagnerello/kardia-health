import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reportError, getRecentErrors, clearErrorBuffer, initTelemetry } from './telemetry';

describe('Serviço de Telemetria e Monitoramento Frontend', () => {
  beforeEach(() => {
    clearErrorBuffer();
    vi.restoreAllMocks();
  });

  it('deve registrar um erro estruturado no buffer com timestamp e contexto', () => {
    const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    const err = new Error('Falha de conexão com Firestore');
    const result = reportError(err, 'afericoes.salvar');

    expect(result.message).toBe('Falha de conexão com Firestore');
    expect(result.context).toBe('afericoes.salvar');
    expect(result.timestamp).toBeDefined();

    const recent = getRecentErrors();
    expect(recent.length).toBe(1);
    expect(recent[0].message).toBe('Falha de conexão com Firestore');
    expect(spyConsole).toHaveBeenCalled();
  });

  it('deve limitar o buffer de erros ao tamanho máximo de 50', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    for (let i = 0; i < 60; i++) {
      reportError(new Error(`Erro ${i}`), `test-${i}`);
    }

    const recent = getRecentErrors();
    expect(recent.length).toBe(50);
    expect(recent[0].message).toBe('Erro 59'); // O mais recente primeiro
  });

  it('deve inicializar listeners globais de erro no window sem falhar', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    initTelemetry();

    expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });
});
