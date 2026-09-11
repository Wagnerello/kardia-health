import { describe, it, expect } from 'vitest';
import { obterDicaPressao, obterDicaGlicemia, obterDicaHidratacao } from './dicas';
import type { ContextoSaude } from './dicas';
import type { BpReading, GlicemiaReading, UserProfile, DailyWaterLog } from '../types';

describe('Motor de Recomendações e Dicas Clínicas (dicas.ts)', () => {
  const perfilBase: UserProfile = {
    uid: 'u1',
    data_criacao: new Date(),
    nome: 'João Silva',
    idade: 45,
    sexo: 'masculino',
    peso: 80,
    altura: 175,
    hipertenso: true,
    diabetico: false,
    fumante: false,
    sedentario: false,
    usaMedicacao: false,
    role: 'USER',
    status: 'Ativo'
  };

  describe('Dicas de Pressão Arterial', () => {
    it('deve emitir alerta clínico se a última pressão indicar crise ou hipertensão', () => {
      const pressaoAlta: BpReading = {
        id: '1',
        user_id: 'u1',
        sys: 165,
        dia: 105,
        pul: 82,
        data_hora_afericao: new Date()
      };

      const ctx: ContextoSaude = {
        userProfile: perfilBase,
        ultimaPressao: pressaoAlta,
        ultimaGlicemia: null,
        aguaHoje: 1000,
        metaAgua: 2000
      };

      const dica = obterDicaPressao(ctx);
      expect(dica.titulo).toContain('Atenção (Alerta IA)');
      expect(dica.texto).toContain('pressão alta');
    });

    it('deve alertar sobre regularidade se o usuário faz uso contínuo de medicação', () => {
      const pressaoNormal: BpReading = {
        id: '2',
        user_id: 'u1',
        sys: 118,
        dia: 78,
        pul: 70,
        data_hora_afericao: new Date()
      };

      const ctx: ContextoSaude = {
        userProfile: { ...perfilBase, usaMedicacao: true },
        ultimaPressao: pressaoNormal,
        ultimaGlicemia: null,
        aguaHoje: 1000,
        metaAgua: 2000
      };

      const dica = obterDicaPressao(ctx);
      expect(dica.titulo).toContain('Lembrete Médico');
      expect(dica.texto).toContain('medicação sempre no mesmo horário');
    });

    it('deve fornecer dica preventiva padrão para usuário com pressão normal e sem medicação', () => {
      const pressaoNormal: BpReading = {
        id: '3',
        user_id: 'u1',
        sys: 115,
        dia: 75,
        pul: 72,
        data_hora_afericao: new Date()
      };

      const ctx: ContextoSaude = {
        userProfile: { ...perfilBase, usaMedicacao: false },
        ultimaPressao: pressaoNormal,
        ultimaGlicemia: null,
        aguaHoje: 1000,
        metaAgua: 2000
      };

      const dica = obterDicaPressao(ctx);
      expect(dica.titulo).toContain('Dica de Saúde');
      expect(dica.texto.length).toBeGreaterThan(20);
    });
  });

  describe('Dicas de Glicemia', () => {
    it('deve emitir alerta glicêmico se a medição estiver elevada', () => {
      const glicemiaAlta: GlicemiaReading = {
        id: '1',
        user_id: 'u1',
        valor: 185,
        momento: 'jejum',
        data_hora_afericao: new Date()
      };

      const ctx: ContextoSaude = {
        userProfile: perfilBase,
        ultimaPressao: null,
        ultimaGlicemia: glicemiaAlta,
        aguaHoje: 1000,
        metaAgua: 2000
      };

      const dica = obterDicaGlicemia(ctx);
      expect(dica.titulo).toContain('Alerta Glicêmico');
      expect(dica.texto).toContain('acima do esperado');
    });

    it('deve fornecer dica de manutenção quando a glicemia estiver normal', () => {
      const glicemiaNormal: GlicemiaReading = {
        id: '2',
        user_id: 'u1',
        valor: 92,
        momento: 'jejum',
        data_hora_afericao: new Date()
      };

      const ctx: ContextoSaude = {
        userProfile: perfilBase,
        ultimaPressao: null,
        ultimaGlicemia: glicemiaNormal,
        aguaHoje: 1000,
        metaAgua: 2000
      };

      const dica = obterDicaGlicemia(ctx);
      expect(dica.titulo).toContain('Dica de Saúde');
      expect(dica.texto.length).toBeGreaterThan(15);
    });
  });

  describe('Dicas de Hidratação', () => {
    it('deve identificar tendência semanal crítica com 4 ou mais dias sem registro', () => {
      const historicoSemanal: DailyWaterLog[] = [
        { id: '1', user_id: 'u1', date_string: '2026-09-01', amount_ml: 0, meta_ml: 2000 },
        { id: '2', user_id: 'u1', date_string: '2026-09-02', amount_ml: 0, meta_ml: 2000 },
        { id: '3', user_id: 'u1', date_string: '2026-09-03', amount_ml: 0, meta_ml: 2000 },
        { id: '4', user_id: 'u1', date_string: '2026-09-04', amount_ml: 0, meta_ml: 2000 },
        { id: '5', user_id: 'u1', date_string: '2026-09-05', amount_ml: 500, meta_ml: 2000 },
        { id: '6', user_id: 'u1', date_string: '2026-09-06', amount_ml: 500, meta_ml: 2000 },
        { id: '7', user_id: 'u1', date_string: '2026-09-07', amount_ml: 500, meta_ml: 2000 }
      ];

      const ctx: ContextoSaude = {
        userProfile: perfilBase,
        ultimaPressao: null,
        ultimaGlicemia: null,
        aguaHoje: 200,
        metaAgua: 2000,
        historicoAgua7d: historicoSemanal
      };

      const dica = obterDicaHidratacao(ctx);
      expect(dica.titulo).toContain('Alerta de Hidratação Semanal');
      expect(dica.texto).toContain('baixa ingestão de água');
    });

    it('deve parabenizar o usuário quando atingir a meta em 5 ou mais dias na semana', () => {
      const historicoExcelente: DailyWaterLog[] = [
        { id: '1', user_id: 'u1', date_string: '2026-09-01', amount_ml: 2200, meta_ml: 2000 },
        { id: '2', user_id: 'u1', date_string: '2026-09-02', amount_ml: 2100, meta_ml: 2000 },
        { id: '3', user_id: 'u1', date_string: '2026-09-03', amount_ml: 2000, meta_ml: 2000 },
        { id: '4', user_id: 'u1', date_string: '2026-09-04', amount_ml: 2500, meta_ml: 2000 },
        { id: '5', user_id: 'u1', date_string: '2026-09-05', amount_ml: 2300, meta_ml: 2000 },
        { id: '6', user_id: 'u1', date_string: '2026-09-06', amount_ml: 1200, meta_ml: 2000 },
        { id: '7', user_id: 'u1', date_string: '2026-09-07', amount_ml: 1500, meta_ml: 2000 }
      ];

      const ctx: ContextoSaude = {
        userProfile: perfilBase,
        ultimaPressao: null,
        ultimaGlicemia: null,
        aguaHoje: 1800,
        metaAgua: 2000,
        historicoAgua7d: historicoExcelente
      };

      const dica = obterDicaHidratacao(ctx);
      expect(dica.titulo).toContain('Excelente Tendência Semanal');
      expect(dica.texto).toContain('Parabéns');
    });

    it('deve incentivar o início do dia quando progressoHoje for 0', () => {
      const ctx: ContextoSaude = {
        userProfile: perfilBase,
        ultimaPressao: null,
        ultimaGlicemia: null,
        aguaHoje: 0,
        metaAgua: 2000,
        historicoAgua7d: []
      };

      const dica = obterDicaHidratacao(ctx);
      expect(dica.titulo).toContain('Hora de começar');
      expect(dica.texto).toContain('Você ainda não registrou consumo de água hoje');
    });

    it('deve parabenizar quando atingir 100% da meta de água diária', () => {
      const ctx: ContextoSaude = {
        userProfile: perfilBase,
        ultimaPressao: null,
        ultimaGlicemia: null,
        aguaHoje: 2200,
        metaAgua: 2000,
        historicoAgua7d: []
      };

      const dica = obterDicaHidratacao(ctx);
      expect(dica.titulo).toContain('Parabéns');
      expect(dica.texto).toContain('Você atingiu sua meta diária');
    });
  });
});
