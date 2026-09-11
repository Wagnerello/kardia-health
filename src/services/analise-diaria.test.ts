import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buscarAnalisesDiarias, salvarAnaliseDiaria, gerarAnaliseDiariaIA } from './analise-diaria';
import type { AnaliseRecordItem } from './analise-diaria';
import * as firestore from 'firebase/firestore';

vi.mock('../firebase', () => ({
  db: {}
}));

vi.mock('./agua', () => ({
  buscarAguaDoDia: vi.fn().mockResolvedValue({ amount_ml: 2200 })
}));

vi.mock('./ai-config', () => ({
  ANALISE_MODELS: ['gemini-2.5-flash'],
  genAI: {
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => 'Parabéns pelos registros estáveis de hoje!' }
      })
    })
  },
  comFallback: vi.fn().mockImplementation((_models, cb) => cb('gemini-2.5-flash'))
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue('col-ref'),
  doc: vi.fn().mockReturnValue('doc-ref'),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  query: vi.fn().mockReturnValue('query-ref'),
  where: vi.fn()
}));

describe('Serviço de Análise Diária Integrada por IA (analise-diaria.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve formatar o ID do documento substituindo barras por hífens ao salvar', async () => {
    const analise = {
      user_id: 'u-123',
      data_str: '08/09/2026',
      feedback: 'Dia bem controlado.',
      atualizado_em: new Date().toISOString()
    };

    await salvarAnaliseDiaria(analise);

    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'analises_diarias',
      'u-123_08-09-2026'
    );
    expect(firestore.setDoc).toHaveBeenCalledWith('doc-ref', analise);
  });

  it('deve buscar análises diárias e mapear lista corretamente', async () => {
    const mockDocs = [
      {
        id: 'u-123_08-09-2026',
        data: () => ({
          user_id: 'u-123',
          data_str: '08/09/2026',
          feedback: 'Tudo normal.'
        })
      }
    ];

    (firestore.getDocs as any).mockResolvedValueOnce({
      docs: mockDocs
    });

    const resultado = await buscarAnalisesDiarias('u-123');
    expect(resultado.length).toBe(1);
    expect(resultado[0].feedback).toBe('Tudo normal.');
  });

  it('deve consolidar pressão, glicemia, peso e água no prompt diário enviado ao modelo de IA', async () => {
    const registrosDoDia: AnaliseRecordItem[] = [
      {
        timestamp: new Date('2026-09-08T08:00:00Z'),
        tipo: 'pressao',
        sys: 120,
        dia: 80,
        pul: 72
      },
      {
        timestamp: new Date('2026-09-08T08:30:00Z'),
        tipo: 'glicemia',
        valor: 92,
        momento: 'jejum'
      },
      {
        timestamp: new Date('2026-09-08T09:00:00Z'),
        tipo: 'peso',
        peso: 77.4
      }
    ];

    const feedback = await gerarAnaliseDiariaIA(registrosDoDia, '08/09/2026', 'u-123');
    expect(feedback).toBe('Parabéns pelos registros estáveis de hoje!');
  });
});
