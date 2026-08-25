import { describe, it, expect } from 'vitest';
import { classificarPressao, classificarGlicemia, classificarImc, formatarData, formatarDataHora } from './types';

describe('Matriz de Testes Clínicos e Schemas (types.ts)', () => {
  describe('1. Classificação de Pressão Arterial (OMS / SBC / AHA)', () => {
    it('deve classificar como Normal quando SYS < 120 e DIA < 80', () => {
      const result = classificarPressao(118, 76);
      expect(result.label).toBe('Normal');
      expect(result.emoji).toBe('🟢');
    });

    it('deve classificar como Pressão Elevada quando SYS 120-129 e DIA < 80', () => {
      const result = classificarPressao(125, 78);
      expect(result.label).toBe('Pressão Elevada');
      expect(result.emoji).toBe('🟡');
    });

    it('deve classificar como Hipertensão Estágio 1 quando SYS 130-139 ou DIA 80-89', () => {
      const result1 = classificarPressao(135, 75);
      const result2 = classificarPressao(118, 85);
      expect(result1.label).toBe('Hipertensão Estágio 1');
      expect(result2.label).toBe('Hipertensão Estágio 1');
    });

    it('deve classificar como Hipertensão Estágio 2 quando SYS >= 140 ou DIA >= 90', () => {
      const result = classificarPressao(145, 92);
      expect(result.label).toBe('Hipertensão Estágio 2');
      expect(result.emoji).toBe('🔴');
    });

    it('deve classificar como Crise Hipertensiva quando SYS >= 180 ou DIA >= 120', () => {
      const result1 = classificarPressao(185, 100);
      const result2 = classificarPressao(150, 125);
      expect(result1.label).toBe('Crise Hipertensiva');
      expect(result2.label).toBe('Crise Hipertensiva');
      expect(result1.emoji).toBe('🚨');
    });

    it('deve classificar como Pressão Baixa quando SYS < 90 ou DIA < 60', () => {
      const result = classificarPressao(85, 55);
      expect(result.label).toBe('Pressão Baixa');
      expect(result.emoji).toBe('🔵');
    });
  });

  describe('2. Classificação de Glicemia (SBD / ADA)', () => {
    it('deve detectar Hipoglicemia imediata (< 70 mg/dL) independente do momento', () => {
      const result = classificarGlicemia(65, 'jejum');
      expect(result.label).toBe('Hipoglicemia');
      expect(result.emoji).toBe('🚨');
    });

    it('deve avaliar glicemia em Jejum corretamente', () => {
      expect(classificarGlicemia(85, 'jejum').label).toBe('Normal');
      expect(classificarGlicemia(110, 'jejum').label).toBe('Pré-Diabetes');
      expect(classificarGlicemia(130, 'jejum').label).toBe('Hiperglicemia (Diabetes)');
    });

    it('deve avaliar glicemia Pós-Prandial corretamente', () => {
      expect(classificarGlicemia(120, 'pos_prandial').label).toBe('Normal');
      expect(classificarGlicemia(160, 'pos_prandial').label).toBe('Pré-Diabetes');
      expect(classificarGlicemia(210, 'pos_prandial').label).toBe('Hiperglicemia (Diabetes)');
    });
  });

  describe('3. Antropometria e 3 Curvas de IMC', () => {
    it('deve lidar com dados incompletos ou inválidos de peso e altura', () => {
      expect(classificarImc(0, 170, 30, 'masculino').label).toBe('Dados Incompletos');
      expect(classificarImc(70, 0, 30, 'feminino').label).toBe('Dados Incompletos');
    });

    it('deve aplicar a Curva de Adultos (19 a 59 anos)', () => {
      // IMC = 70 / (1.75^2) = 22.86 (Eutrofia)
      const normal = classificarImc(70, 175, 35, 'masculino');
      expect(normal.label).toBe('Peso Saudável (Eutrofia)');

      // IMC = 95 / (1.75^2) = 31.02 (Obesidade Grau I)
      const obeso = classificarImc(95, 175, 35, 'masculino');
      expect(obeso.label).toBe('Obesidade Grau I');
    });

    it('deve aplicar a Curva de Idosos (>= 60 anos, OPAS/SBC)', () => {
      // Idoso com IMC 24 está em Eutrofia (faixa 22 a 27)
      const idosoNormal = classificarImc(65, 165, 68, 'feminino');
      expect(idosoNormal.label).toBe('Peso Adequado (Eutrofia)');
    });
  });

  describe('4. Utilitários de Formatação de Data', () => {
    it('deve formatar data no padrão pt-BR (DD/MM/AAAA)', () => {
      const data = new Date(2026, 7, 25, 14, 30);
      const str = formatarData(data);
      expect(str).toContain('25/08/2026');
    });

    it('deve formatar data e hora no padrão pt-BR', () => {
      const data = new Date(2026, 7, 25, 14, 30);
      const str = formatarDataHora(data);
      expect(str).toContain('25/08/2026');
      expect(str).toContain('14:30');
    });
  });
});
