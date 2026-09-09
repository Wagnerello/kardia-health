// Tipos de dados do sistema

export interface UserProfile {
  uid: string;
  email?: string;
  nome: string;
  sexo: 'masculino' | 'feminino' | 'outro';
  idade: number;
  peso: number;
  altura?: number; // em cm
  data_criacao: Date;
  role?: 'ADMIN' | 'USER';
  plano?: 'Gratuito' | 'Premium' | 'Ouro';
  status?: 'Pendente' | 'Ativo' | 'Suspenso' | 'Inativo';
  hipertenso?: boolean;
  diabetico?: boolean;
  fumante?: boolean;
  sedentario?: boolean;
  usaMedicacao?: boolean;
  nascimento?: string;
  termos_aceitos?: boolean;
  termos_aceitos_em?: string;
  termos_versao?: string;
}

export interface BpReading {
  id?: string;
  user_id: string;
  sys: number;           // Pressão Sistólica (mmHg)
  dia: number;           // Pressão Diastólica (mmHg)
  pul: number;           // Pulso (BPM)
  data_hora_afericao: Date;
  image_url?: string;    // URL da imagem no Firebase Storage
  ai_feedback?: string;  // Feedback da IA
  grupo_id?: string;     // Para agrupar medições consecutivas
}

export interface DailyWaterLog {
  id?: string;
  user_id: string;
  date_string: string; // YYYY-MM-DD
  amount_ml: number;
  meta_ml: number;
}

export interface PesoLog {
  id?: string;
  user_id?: string;
  peso: number;
  data: Date;
}

export interface Medication {
  id?: string;
  user_id: string;
  nome: string;
  dosagem: string;
  frequencia: string;
  tipo: 'Continuo' | 'Temporario';
  ativa: boolean;
  data_inicio?: Date;
  data_fim?: Date;
  data_criacao: Date;
}

export interface GlicemiaReading {
  id?: string;
  user_id: string;
  valor: number;            // mg/dL
  momento: 'jejum' | 'pos_prandial' | 'antes_dormir' | 'aleatorio';
  data_hora_afericao: Date;
  ai_feedback?: string;
  hba1c?: number;           // Opcional
}

// Re-exportações de classificações e formatações para manter compatibilidade total
export * from './classificacao';
