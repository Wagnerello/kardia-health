import { describe, it, expect, vi, beforeEach } from 'vitest';
import { salvarHistoricoPeso, excluirPeso, buscarHistoricoPeso } from './peso';
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
    setDoc: vi.fn().mockResolvedValue(undefined),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn(),
    query: vi.fn().mockReturnValue('query-ref'),
    where: vi.fn(),
    orderBy: vi.fn(),
    Timestamp
  };
});

describe('Serviço de Histórico e Controle de Peso (peso.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve salvar um registro de peso com data retroativa corretamente', async () => {
    const dataRetroativa = new Date('2026-09-01T10:00:00Z');
    await salvarHistoricoPeso('user-123', 75.5, dataRetroativa);

    expect(firestore.setDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({
        user_id: 'user-123',
        peso: 75.5,
        data: expect.objectContaining({ seconds: Math.floor(dataRetroativa.getTime() / 1000) })
      }),
      { merge: true }
    );
  });

  it('deve salvar um registro com id específico para atualização se fornecido', async () => {
    await salvarHistoricoPeso('user-123', 76.0, new Date(), 'custom-peso-id');
    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'weight_history', 'custom-peso-id');
  });

  it('deve excluir um registro de peso chamando deleteDoc', async () => {
    await excluirPeso('peso-id-999');
    expect(firestore.deleteDoc).toHaveBeenCalledWith('doc-ref');
  });

  it('deve buscar histórico ordenado e converter documentos em lista de pesos', async () => {
    const mockDocs = [
      { id: 'p1', data: () => ({ peso: 80, data: new Date('2026-09-01') }) },
      { id: 'p2', data: () => ({ peso: 79.2, data: new Date('2026-09-08') }) }
    ];

    (firestore.getDocs as any).mockResolvedValueOnce({
      docs: mockDocs
    });

    const resultado = await buscarHistoricoPeso('user-123');
    expect(resultado.length).toBe(2);
    expect(resultado[0].peso).toBe(80);
    expect(resultado[1].peso).toBe(79.2);
  });

  it('deve acionar o fallback gracioso se a query com orderBy falhar por falta de índice', async () => {
    // Primeira chamada falha (ex: Missing or insufficient index)
    (firestore.getDocs as any).mockRejectedValueOnce(new Error('Requires index'));

    // Segunda chamada (fallbackQuery) obtém sucesso
    const mockFallbackDocs = [
      { id: 'p2', data: () => ({ peso: 79.2, data: new Date('2026-09-08') }) },
      { id: 'p1', data: () => ({ peso: 80, data: new Date('2026-09-01') }) }
    ];
    (firestore.getDocs as any).mockResolvedValueOnce({
      docs: mockFallbackDocs
    });

    const resultado = await buscarHistoricoPeso('user-123');
    expect(resultado.length).toBe(2);
    // Deve vir ordenado em ordem crescente pela data local
    expect(resultado[0].peso).toBe(80);
    expect(resultado[1].peso).toBe(79.2);
  });
});
