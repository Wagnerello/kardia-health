import type { User } from 'firebase/auth';
import type { UserProfile, BpReading, GlicemiaReading, Medication } from '../types';
import type { Chart } from 'chart.js';

export interface AppState {
  currentUser: User | null;
  userProfile: UserProfile | null;
  aguaHoje: number;
  metaAgua: number;
  afericoes: BpReading[];
  glicemias: GlicemiaReading[];
  medications: Medication[];
  usuariosCadastrados: UserProfile[];
  bpChart: Chart | null;
  glicemiaChart: Chart | null;
  waterChart: Chart | null;
  adminGrowthChart: Chart | null;
  imagemSelecionada: File | null;
  medicacaoEditandoId: string | null;
  listaFiltradaUsuariosAdmin: UserProfile[];
  adminTargetUserUid: string | null;
  adminTargetUserPerfil: UserProfile | null;
}

export const state: AppState = {
  currentUser: null,
  userProfile: null,
  aguaHoje: 0,
  metaAgua: 2000,
  afericoes: [],
  glicemias: [],
  medications: [],
  usuariosCadastrados: [],
  bpChart: null,
  glicemiaChart: null,
  waterChart: null,
  adminGrowthChart: null,
  imagemSelecionada: null,
  medicacaoEditandoId: null,
  listaFiltradaUsuariosAdmin: [],
  adminTargetUserUid: null,
  adminTargetUserPerfil: null,
};
