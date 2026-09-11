import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buscarMedications, salvarMedication, atualizarMedication, excluirMedication } from './medications';
import * as firestore from 'firebase/firestore';

vi.mock('../firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue('col-ref'),
  doc: vi.fn().mockReturnValue('doc-ref'),
  addDoc: vi.fn().mockResolvedValue({ id: 'med-id-123' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  query: vi.fn().mockReturnValue('query-ref'),
  where: vi.fn()
}));

describe('Serviço de Medicações (medications.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve salvar uma medicação e retornar seu id', async () => {
    const novaMed = {
      user_id: 'u1',
      nome: 'Losartana',
      dosagem: '50mg',
      frequencia: '1x ao dia',
      tipo: 'Continuo' as const,
      ativa: true,
      data_criacao: new Date()
    };

    const id = await salvarMedication(novaMed);
    expect(id).toBe('med-id-123');
    expect(firestore.addDoc).toHaveBeenCalledWith('col-ref', novaMed);
  });

  it('deve atualizar dados de uma medicação existente', async () => {
    await atualizarMedication('med-123', { dosagem: '100mg', ativa: false });
    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'user_medications', 'med-123');
    expect(firestore.updateDoc).toHaveBeenCalledWith('doc-ref', { dosagem: '100mg', ativa: false });
  });

  it('deve excluir uma medicação pelo id', async () => {
    await excluirMedication('med-123');
    expect(firestore.deleteDoc).toHaveBeenCalledWith('doc-ref');
  });

  it('deve buscar medicações e ordenar de forma decrescente por data de criação', async () => {
    const dataAntiga = new Date('2026-08-01');
    const dataNova = new Date('2026-09-01');

    const mockDocs = [
      {
        id: 'm1',
        data: () => ({
          user_id: 'u1',
          nome: 'Atenolol',
          dosagem: '25mg',
          data_criacao: { toDate: () => dataAntiga }
        })
      },
      {
        id: 'm2',
        data: () => ({
          user_id: 'u1',
          nome: 'Enalapril',
          dosagem: '10mg',
          data_criacao: { toDate: () => dataNova }
        })
      }
    ];

    (firestore.getDocs as any).mockResolvedValueOnce({
      docs: mockDocs
    });

    const lista = await buscarMedications('u1');
    expect(lista.length).toBe(2);
    // m2 é mais nova, deve vir primeiro
    expect(lista[0].id).toBe('m2');
    expect(lista[1].id).toBe('m1');
  });
});
