import { describe, it, expect } from 'vitest';
import { combinarRegistrosPDF, calcularEstatisticasPDF, gerarHtmlGridStatsPDF } from './pdf-report-builder';
import type { BpReading, GlicemiaReading, PesoLog, DailyWaterLog } from '../types';

describe('Builder de Relatórios e Unificação PDF (pdf-report-builder.ts)', () => {
  const mockAfericoes: BpReading[] = [
    {
      id: 'a1',
      user_id: 'u1',
      sys: 120,
      dia: 80,
      pul: 72,
      data_hora_afericao: new Date('2026-09-05T08:00:00Z')
    },
    {
      id: 'a2',
      user_id: 'u1',
      sys: 130,
      dia: 85,
      pul: 75,
      data_hora_afericao: new Date('2026-09-07T08:00:00Z')
    }
  ];

  const mockGlicemias: GlicemiaReading[] = [
    {
      id: 'g1',
      user_id: 'u1',
      valor: 95,
      momento: 'jejum',
      data_hora_afericao: new Date('2026-09-06T07:30:00Z')
    }
  ];

  const mockPesos: PesoLog[] = [
    {
      id: 'p1',
      peso: 81.5,
      data: new Date('2026-09-04T07:00:00Z')
    },
    {
      id: 'p2',
      peso: 80.8,
      data: new Date('2026-09-08T07:00:00Z')
    }
  ];

  describe('combinarRegistrosPDF', () => {
    it('deve unificar pressão, glicemia e peso em ordem cronológica crescente', () => {
      const combinados = combinarRegistrosPDF({
        afericoes: mockAfericoes,
        glicemias: mockGlicemias,
        pesos: mockPesos
      });

      expect(combinados.length).toBe(5);
      // O primeiro deve ser o peso do dia 04
      expect(combinados[0].tipo).toBe('peso');
      expect(combinados[0].id).toBe('p1');

      // O segundo deve ser a pressão do dia 05
      expect(combinados[1].tipo).toBe('pressao');
      expect(combinados[1].id).toBe('a1');

      // O terceiro deve ser a glicemia do dia 06
      expect(combinados[2].tipo).toBe('glicemia');
      expect(combinados[2].id).toBe('g1');

      // O último deve ser o peso do dia 08
      expect(combinados[4].tipo).toBe('peso');
      expect(combinados[4].id).toBe('p2');
    });

    it('deve filtrar registros por data inicial e data final quando fornecidas', () => {
      const combinados = combinarRegistrosPDF({
        afericoes: mockAfericoes,
        glicemias: mockGlicemias,
        pesos: mockPesos,
        dtInicioInput: '2026-09-06',
        dtFimInput: '2026-09-07'
      });

      // Apenas glicemia do dia 06 e pressão do dia 07 devem estar inclusos
      expect(combinados.length).toBe(2);
      expect(combinados.map(c => c.id)).toEqual(['g1', 'a2']);
    });
  });

  describe('calcularEstatisticasPDF', () => {
    it('deve calcular médias de pressão, glicemia e último peso corretamente', () => {
      const mockAgua: DailyWaterLog[] = [
        { id: 'w1', user_id: 'u1', date_string: '2026-09-05', amount_ml: 2000, meta_ml: 2000 },
        { id: 'w2', user_id: 'u1', date_string: '2026-09-06', amount_ml: 3000, meta_ml: 2000 }
      ];

      const stats = calcularEstatisticasPDF({
        afericoes: mockAfericoes,
        glicemias: mockGlicemias,
        pesos: mockPesos,
        aguaLogs: mockAgua,
        total: 5
      });

      // Média Sys: (120 + 130) / 2 = 125
      expect(stats.mediaSys).toBe(125);
      // Média Dia: (80 + 85) / 2 = 83 (arredondado de 82.5)
      expect(stats.mediaDia).toBe(83);
      // Média Glicemia: 95
      expect(stats.mediaGlicemia).toBe(95);
      // Último Peso: 80.8kg
      expect(stats.ultimoPeso).toBe('80.8kg');
      // Média de água: (2000 + 3000) / 2 = 2500ml = 2.5L
      expect(stats.mediaAguaL).toBe('2.5L');
      expect(stats.total).toBe(5);
    });

    it('deve retornar traços ("--") quando as listas estiverem vazias', () => {
      const stats = calcularEstatisticasPDF({
        afericoes: [],
        glicemias: [],
        pesos: [],
        aguaLogs: [],
        total: 0
      });

      expect(stats.mediaSys).toBe('--');
      expect(stats.mediaDia).toBe('--');
      expect(stats.mediaGlicemia).toBe('--');
      expect(stats.ultimoPeso).toBe('--');
      expect(stats.mediaAguaL).toBe('--');
      expect(stats.total).toBe(0);
    });
  });

  describe('gerarHtmlGridStatsPDF', () => {
    it('deve gerar o grid de estatísticas contendo os valores calculados', () => {
      const html = gerarHtmlGridStatsPDF({
        total: 10,
        countPressao: 4,
        mediaSys: 120,
        mediaDia: 80,
        countGlicemia: 3,
        mediaGlicemia: 90,
        ultimoPeso: '75kg',
        mediaAguaL: '2.1L'
      });

      expect(html).toContain('120<span class="pdf-stat-unit">/</span>80');
      expect(html).toContain('90<span class="pdf-stat-unit">mg/dL</span>');
      expect(html).toContain('75kg');
      expect(html).toContain('2.1L');
      expect(html).toContain('10');
    });
  });
});
