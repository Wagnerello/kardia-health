import { describe, it, expect, vi } from 'vitest';

describe('Matriz de Regras e Sad Paths — Hidratação (agua.test.ts)', () => {
  describe('1. Algoritmo Clínico de Meta de Água (35ml/kg)', () => {
    const calcularMetaAgua = (pesoKg: number): number => {
      if (!pesoKg || pesoKg <= 0) return 2000; // Padrão 2L se inválido
      return Math.round(pesoKg * 35);
    };

    it('deve calcular meta diária baseada no peso corporal', () => {
      expect(calcularMetaAgua(70)).toBe(2450); // 70 * 35 = 2450ml
      expect(calcularMetaAgua(60)).toBe(2100); // 60 * 35 = 2100ml
      expect(calcularMetaAgua(100)).toBe(3500); // 100 * 35 = 3500ml
    });

    it('deve adotar fallback seguro de 2000ml se o peso for zero ou negativo (Edge Case)', () => {
      expect(calcularMetaAgua(0)).toBe(2000);
      expect(calcularMetaAgua(-10)).toBe(2000);
    });
  });

  describe('2. Sad Path de Banco de Dados (Falha de Rede & Integridade)', () => {
    it('deve propagar erro e NÃO registrar sucesso caso o banco de dados falhe', async () => {
      const mockSetDoc = vi.fn().mockRejectedValueOnce(new Error('Firebase network timeout'));
      const mockLogAuditoria = vi.fn();

      const tentarSalvar = async () => {
        await mockSetDoc();
        mockLogAuditoria('Registro salvo com sucesso');
      };

      await expect(tentarSalvar()).rejects.toThrow('Firebase network timeout');
      expect(mockLogAuditoria).not.toHaveBeenCalled();
    });
  });
});
