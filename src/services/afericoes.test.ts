import { describe, it, expect } from 'vitest';
import { classificarPressao } from '../types';

describe('Matriz de Edge Cases & Limites Clínicos — Cardiovascular (afericoes.test.ts)', () => {
  it('deve calcular corretamente a Pressão de Pulso (PP = SYS - DIA)', () => {
    const sys = 150;
    const dia = 80;
    const pressaoDePulso = sys - dia;
    
    expect(pressaoDePulso).toBe(70);
    // PP >= 60 mmHg é marcador clínico de rigidez arterial
    expect(pressaoDePulso).toBeGreaterThanOrEqual(60);
  });

  it('deve tratar valores limítrofes exatos (Bordas de Classificação)', () => {
    // Exatamente no limite de 120/80
    expect(classificarPressao(120, 79).label).toBe('Pressão Elevada');
    expect(classificarPressao(119, 79).label).toBe('Normal');

    // Exatamente no limite de 140/90 (Hipertensão Estágio 2)
    expect(classificarPressao(140, 89).label).toBe('Hipertensão Estágio 2');
    expect(classificarPressao(139, 90).label).toBe('Hipertensão Estágio 2');
  });

  it('deve sinalizar Crise Hipertensiva imediatamente mesmo se apenas uma das medidas atingir o limiar', () => {
    // Sistólica em crise (>= 180), diastólica em estágio 1
    const criseSys = classificarPressao(180, 85);
    expect(criseSys.label).toBe('Crise Hipertensiva');
    expect(criseSys.emoji).toBe('🚨');

    // Diastólica em crise (>= 120), sistólica normal
    const criseDia = classificarPressao(115, 120);
    expect(criseDia.label).toBe('Crise Hipertensiva');
    expect(criseDia.emoji).toBe('🚨');
  });

  it('deve lidar com casos de Pressão Baixa extrema (ex: 70/40 mmHg)', () => {
    const baixa = classificarPressao(70, 40);
    expect(baixa.label).toBe('Pressão Baixa');
    expect(baixa.emoji).toBe('🔵');
  });
});
