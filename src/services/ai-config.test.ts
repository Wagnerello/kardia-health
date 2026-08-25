import { describe, it, expect, vi } from 'vitest';
import { comFallback, executarViaCloudFunction } from './ai-config';

// Mock do Firebase Functions
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn((_functions, _name) => {
    return vi.fn(async (payload) => {
      if (!payload?.prompt) {
        throw new Error('Prompt inválido');
      }
      if (payload.prompt.includes('SIMULAR_ERRO_CLOUDFUNCTION')) {
        throw new Error('Cloud function indisponível (503)');
      }
      return {
        data: {
          result: `Resultado seguro gerado via Cloud Function: ${payload.prompt}`,
          provider: 'gemini',
          model: 'gemini-2.0-flash'
        }
      };
    });
  })
}));

describe('Matriz de Sad Paths & Resiliência — Motor de IA (ai-config.ts)', () => {
  it('deve realizar fallback para o segundo modelo se o primário falhar com erro 503/429', async () => {
    const modelos = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    
    const executor = vi.fn()
      .mockRejectedValueOnce(new Error('503 Service Unavailable / Cota excedida'))
      .mockResolvedValueOnce({ text: 'Análise gerada com sucesso pelo modelo reserva' });

    const resultado = await comFallback<{ text: string }>(modelos, executor);

    expect(executor).toHaveBeenCalledTimes(2);
    expect(resultado.text).toBe('Análise gerada com sucesso pelo modelo reserva');
  });

  it('deve interromper cascata e lançar erro claro se a chave de API for inválida (401/403)', async () => {
    const modelos = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    
    const apiError = new Error('API key not valid. Please pass a valid API key.');
    (apiError as any).status = 401;

    const executor = vi.fn().mockRejectedValue(apiError);

    await expect(comFallback(modelos, executor))
      .rejects.toThrow(/API key/i);

    // Não deve tentar os demais modelos para poupar recursos em caso de chave inválida
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('deve lançar exceção segura quando todos os modelos da cascata falharem', async () => {
    const modelos = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    
    const executor = vi.fn()
      .mockRejectedValue(new Error('Network error / Offline'));

    await expect(comFallback(modelos, executor))
      .rejects.toThrow('Network error / Offline');

    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('deve executar com sucesso via Cloud Function primária quando prompt for fornecido', async () => {
    const modelos = ['gemini-2.0-flash'];
    const executor = vi.fn();

    const resultado = await comFallback<{ text: string; modelName: string }>(
      modelos,
      executor,
      'Analise a pressão arterial: 120x80'
    );

    expect(resultado.text).toContain('Resultado seguro gerado via Cloud Function');
    expect(resultado.modelName).toBe('gemini/gemini-2.0-flash (server-side)');
    // Não precisa acionar executor do cliente
    expect(executor).not.toHaveBeenCalled();
  });

  it('deve fazer fallback para o cliente se a Cloud Function falhar', async () => {
    const modelos = ['gemini-2.0-flash'];
    const executor = vi.fn().mockResolvedValue({ text: 'Análise gerada localmente no cliente' });

    const resultado = await comFallback<{ text: string }>(
      modelos,
      executor,
      'SIMULAR_ERRO_CLOUDFUNCTION'
    );

    expect(executor).toHaveBeenCalledTimes(1);
    expect(resultado.text).toBe('Análise gerada localmente no cliente');
  });

  it('deve chamar executarViaCloudFunction diretamente e retornar resultado estruturado', async () => {
    const res = await executarViaCloudFunction('Glicemia em jejum 95 mg/dL');
    expect(res.text).toContain('Glicemia em jejum 95 mg/dL');
    expect(res.modelName).toBe('gemini/gemini-2.0-flash (server-side)');
  });
});

