import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  atualizarFuncaoUsuario,
  atualizarPlanoUsuario,
  atualizarStatusUsuario,
  excluirDadosUsuario,
  registrarLogAdmin,
  obterTodosUsuarios
} from './admin';
import * as firestore from 'firebase/firestore';

vi.mock('../firebase', () => ({
  auth: {
    currentUser: { uid: 'admin-root', email: 'admin@kardia.health' }
  },
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
    updateDoc: vi.fn().mockResolvedValue(undefined),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn(),
    query: vi.fn().mockReturnValue('query-ref'),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn().mockReturnValue('server-timestamp'),
    Timestamp
  };
});

describe('Serviços Administrativos e Governança RBAC (admin.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve atualizar o papel/role do usuário para ADMIN ou USER', async () => {
    await atualizarFuncaoUsuario('user-456', 'ADMIN');
    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'users', 'user-456');
    expect(firestore.updateDoc).toHaveBeenCalledWith('doc-ref', { role: 'ADMIN' });
  });

  it('deve atualizar o plano do usuário', async () => {
    await atualizarPlanoUsuario('user-456', 'Premium');
    expect(firestore.updateDoc).toHaveBeenCalledWith('doc-ref', { plano: 'Premium' });
  });

  it('deve atualizar o status do usuário (ex: Suspenso, Ativo)', async () => {
    await atualizarStatusUsuario('user-456', 'Suspenso');
    expect(firestore.updateDoc).toHaveBeenCalledWith('doc-ref', { status: 'Suspenso' });
  });

  it('deve excluir todas as aferições e a conta do usuário na exclusão administrativa', async () => {
    const mockSnapshots = {
      docs: [
        { id: 'bp-1' },
        { id: 'bp-2' }
      ]
    };
    (firestore.getDocs as any).mockResolvedValueOnce(mockSnapshots);

    await excluirDadosUsuario('user-to-delete');

    // Deve deletar as duas aferições + o usuário
    expect(firestore.deleteDoc).toHaveBeenCalledTimes(3);
  });

  it('deve registrar log de auditoria associado ao admin logado', async () => {
    await registrarLogAdmin('ALTERAR_STATUS', 'Status alterado para Inativo', 'user-456', 'user@test.com');

    expect(firestore.setDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({
        acao: 'ALTERAR_STATUS',
        detalhe: 'Status alterado para Inativo',
        alvo_uid: 'user-456',
        alvo_email: 'user@test.com',
        admin_uid: 'admin-root',
        admin_email: 'admin@kardia.health'
      })
    );
  });

  it('deve mapear corretamente os dados dos usuários cadastrados em obterTodosUsuarios', async () => {
    const mockUserDocs = [
      {
        data: () => ({
          uid: 'u-1',
          email: 'paciente1@kardia.com',
          nome: 'Maria Silva',
          role: 'USER',
          status: 'Ativo',
          hipertenso: true,
          diabetico: false,
          data_criacao: new Date('2026-09-01')
        })
      }
    ];

    (firestore.getDocs as any).mockResolvedValueOnce({
      docs: mockUserDocs
    });

    const usuarios = await obterTodosUsuarios();
    expect(usuarios.length).toBe(1);
    expect(usuarios[0].nome).toBe('Maria Silva');
    expect(usuarios[0].hipertenso).toBe(true);
    expect(usuarios[0].diabetico).toBe(false);
  });
});
