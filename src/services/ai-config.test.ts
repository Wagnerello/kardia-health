import { describe, it, expect, vi } from 'vitest';
import { comFallback } from './ai-config';

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
    
    const apiError = Object.assign(new Error('API key not valid. Please pass a valid API key.'), { status: 401 });

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
});
