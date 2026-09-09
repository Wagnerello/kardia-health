import type { BpReading } from './types';
import type { AnaliseRecordItem } from './services/analise-diaria';

export interface ModalConfirmacaoOpts {
  textoBtn?: string;
  corBtn?: string;
}

declare global {
  interface Window {
    // Utilitários de UI
    mostrarToast: (msg: string, tipo?: 'success' | 'error' | 'info') => void;
    escapeHtml: (unsafe: string | null | undefined) => string;
    mostrarTela: (id: string) => void;

    // Funções de Navegação e Autenticação
    mostrarPagina: (pag: string) => void;
    mostrarTab: (tab: string) => void;
    mostrarAbaDashboard: (aba: string) => void;
    mostrarAbaPerfil: (aba: string) => void;
    toggleFabMenu: () => void;
    toggleAvatarMenu: () => void;
    abrirTermosNoMenu: () => void;
    fecharTermosNoMenu: () => void;
    fazerLogout: () => Promise<void>;
    aceitarTermosUsuario: () => Promise<void>;
    _termsNextStep?: string;

    // Modais e Registros
    abrirModalAfericao: () => void;
    fecharModalAfericao: () => void;
    abrirModalOcr: () => void;
    fecharModalOcr: () => void;
    pularOCR: () => void;
    abrirModalGlicemia: () => void;
    fecharModalGlicemia: () => void;
    abrirModalPeso: () => void;
    fecharModalPeso: () => void;
    abrirModalAgua: () => void;
    fecharModalAgua: () => void;
    abrirModalMedicacao: (id?: string) => void;
    fecharModalMedicacao: () => void;
    abrirModalEscolhaRegistro: () => void;
    fecharModalEscolhaRegistro: () => void;
    abrirPressaoDeEscolha: () => void;
    abrirGlicemiaDeEscolha: () => void;
    abrirPesoDeEscolha: () => void;
    abrirModalConfirmacao: (titulo: string, msg: string, onConfirm: () => void, opts?: ModalConfirmacaoOpts) => void;
    fecharModalConfirmacao: () => void;
    executarConfirmacaoModal: () => void;

    // Salvar e Ações
    salvarAfericaoModal: () => Promise<void>;
    salvarGlicemiaModal: () => Promise<void>;
    salvarMedicacaoModal: () => Promise<void>;
    salvarPerfilModal: () => Promise<void>;
    salvarAlturaLegada: () => Promise<void>;
    adicionarAgua: (amount: number) => Promise<void>;
    adicionarAguaPersonalizada: () => void;
    adicionarAguaModalPersonalizada: () => Promise<void>;
    navegarSemanaAgua: (dir: number) => Promise<void>;
    toggleWaterHistory: () => void;
    atualizarUIWaterCard: () => void;
    registrarPesoRapido: () => Promise<void>;
    excluirRegistroPeso: (id: string) => Promise<void>;
    iniciarOcr: () => Promise<void>;

    // Histórico e IA
    carregarHistorico: () => Promise<void>;
    toggleHistoricoMesGroup: (groupId: string) => void;
    verDetalhe: (id: string) => void;
    reprocessarIADoDia: (dataStr: string) => Promise<void>;
    reprocessarIADaAfericao: (id: string) => Promise<void>;
    reprocessarIAsEmLoteAdmin: () => Promise<void>;
    abrirModalDetalheAnalise: (id: string) => Promise<void>;
    fecharModalDetalheAnalise: () => void;
    histDataGroups?: Record<string, AnaliseRecordItem[]>;

    // Laudos e PDF
    carregarLaudos: () => Promise<void>;
    toggleLaudosMesGroup: (groupId: string) => void;
    gerarLaudoTela: () => Promise<void>;
    abrirModalVisualizarLaudo: (id: string) => Promise<void>;
    abrirModalUltimoLaudo: () => Promise<void>;
    fecharModalVisualizarLaudo: () => void;
    copiarLaudoModalAtual: () => void;
    inativarLaudoModalAtual: () => void;
    inativarLaudoUI: (id: string, cb?: () => Promise<void>) => void;
    exportarLaudoParaPDF: () => Promise<void>;
    exportarLaudoModalParaPDF: () => Promise<void>;
    exportarLaudoPorIdParaPDF: (id: string) => Promise<void>;
    exportarHistoricoParaPDF: () => Promise<void>;
    exportarHistoricoAdminParaPDF: () => Promise<void>;

    // Medicamentos, IMC, Água, Glicemia
    carregarMedications: () => Promise<void>;
    editarMedicacao: (id: string) => void;
    editarMedicationId: (id: string) => void;
    excluirMedicacaoUI: (id: string) => void;
    excluirMedicationId: (id: string) => void;
    alternarStatusMedicacao: (id: string) => Promise<void>;
    toggleMedicationDates: () => void;
    carregarImcPage: () => Promise<void>;
    carregarGlicemiaPage: () => Promise<void>;
    carregarHistoricoAgua: () => Promise<void>;
    carregarDashboard: () => Promise<void>;
    carregarPerfil: () => Promise<void>;
    renderizarGrafico: (readings: BpReading[]) => void;
    calcularMetaAguaPerfil: () => void;

    // Admin
    carregarAdmin: () => Promise<void>;
    mostrarSubAbaAdmin: (subAba: 'overview' | 'users' | 'logs' | 'config') => void;
    renderizarCardsUsuariosAdmin: () => void;
    renderizarTabelaUsuariosAdmin: () => void;
    filtrarTabelaUsuariosAdmin: () => void;
    alterarPlanoUsuarioAdmin: (uid: string, plano: string, email: string) => Promise<void>;
    alterarStatusUsuarioAdmin: (uid: string, status: string, email: string) => Promise<void>;
    alterarRoleUsuarioAdmin: (uid: string, role: string, email: string) => Promise<void>;
    excluirUsuarioAdmin: (uid: string, nome: string, email: string) => Promise<void>;
    abrirDetalhesUsuarioAdmin: (uid: string) => void;
    fecharModalAdminUserDetail: () => void;
    abrirHistoricoUsuarioAdmin: (uid: string, nome: string) => Promise<void>;
    fecharHistoricoUsuarioAdmin: () => void;
    gerarLaudoDoUsuarioAdmin: () => Promise<void>;
    carregarLogsAdminUI: () => Promise<void>;
    salvarConfiguracoesAdminUI: () => Promise<void>;
    adminLeiturasCache?: BpReading[];
  }
}

export {};
