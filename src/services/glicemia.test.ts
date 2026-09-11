import { describe, it, expect, vi, beforeEach } from 'vitest';
import { salvarGlicemia, atualizarFeedbackGlicemiaIA, buscarGlicemias } from './glicemia';
import * as firestore from 'firebase/firestore';

vi.mock('../firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => {
  class Timestamp {
    seconds: number;
    constructor(seconds = 0) {
      this.seconds = seconds;
    }
    toDate() {
      return new Date(this.seconds * 1000);
    }
    static fromDate(d: Date) {
      return new Timestamp(Math.floor(d.getTime() / 1000));
    }
  }

  return {
    collection: vi.fn().mockReturnValue('col-ref'),
    doc: vi.fn().mockReturnValue('doc-ref'),
    addDoc: vi.fn().mockResolvedValue({ id: 'new-glic-id' }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn(),
    query: vi.fn().mockReturnValue('query-ref'),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    Timestamp
  };
});

describe('Serviço de Glicemia (glicemia.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve salvar uma leitura de glicemia no Firestore e retornar o ID', async () => {
    const dataHora = new Date('2026-09-08T14:30:00Z');
    const leitura = {
      user_id: 'user-123',
      valor: 110,
      momento: 'pos_prandial' as const,
      data_hora_afericao: dataHora
    };

    const id = await salvarGlicemia(leitura);

    expect(id).toBe('new-glic-id');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      'col-ref',
      expect.objectContaining({
        user_id: 'user-123',
        valor: 110,
        momento: 'pos_prandial'
      })
    );
  });

  it('deve atualizar o feedback de IA de uma leitura de glicemia existente', async () => {
    await atualizarFeedbackGlicemiaIA('glic-123', 'Seus níveis pós-prandiais estão controlados.');

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'glicemia_readings', 'glic-123');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      'doc-ref',
      { ai_feedback: 'Seus níveis pós-prandiais estão controlados.' }
    );
  });

  it('deve buscar glicemias e filtrar apenas as que estão dentro do período especificado', async () => {
    const hoje = new Date();
    const dataRecente = new Date(hoje.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 dias atrás
    const dataAntiga = new Date(hoje.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 dias atrás

    const mockDocs = [
      {
        id: 'g1',
        data: () => ({
          user_id: 'user-123',
          valor: 95,
          momento: 'jejum',
          data_hora_afericao: dataRecente
        })
      },
      {
        id: 'g2',
        data: () => ({
          user_id: 'user-123',
          valor: 140,
          momento: 'pos_prandial',
          data_hora_afericao: dataAntiga
        })
      }
    ];

    (firestore.getDocs as any).mockResolvedValueOnce({
      docs: mockDocs
    });

    const resultado = await buscarGlicemias('user-123', 30);

    // g2 está com mais de 30 dias, então deve ser filtrado
    expect(resultado.length).toBe(1);
    expect(resultado[0].id).toBe('g1');
    expect(resultado[0].valor).toBe(95);
  });

  it('deve acionar o fallback unindexed quando a query ordenada falhar', async () => {
    (firestore.getDocs as any).mockRejectedValueOnce(new Error('Missing index'));

    const agora = new Date();
    const mockFallbackDocs = [
      {
        id: 'fb-1',
        data: () => ({
          user_id: 'user-123',
          valor: 102,
          momento: 'jejum',
          data_hora_afericao: agora
        })
      }
    ];

    (firestore.getDocs as any).mockResolvedValueOnce({
      docs: mockFallbackDocs
    });

    const resultado = await buscarGlicemias('user-123', 15);
    expect(resultado.length).toBe(1);
    expect(resultado[0].valor).toBe(102);
  });
});
