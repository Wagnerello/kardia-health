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

export type BpClassification = 'normal' | 'elevada' | 'hipertensao_1' | 'hipertensao_2' | 'crise';

export interface BpClassificationInfo {
  label: string;
  cor: string;
  corTexto: string;
  descricao: string;
  emoji: string;
}

// Classificação baseada nas diretrizes da OMS/ACC/AHA
export const classificarPressao = (sys: number, dia: number): BpClassificationInfo => {
  if (sys >= 180 || dia >= 120) {
    return {
      label: 'Crise Hipertensiva',
      cor: '#7B0D1E',
      corTexto: '#FFD6D6',
      descricao: '🚨 Emergência — procure a UPA agora',
      emoji: '🚨'
    };
  } else if (sys >= 140 || dia >= 90) {
    return {
      label: 'Hipertensão Estágio 2',
      cor: '#C62828',
      corTexto: '#FFEBEE',
      descricao: '🔴 Muito alta — busque seu médico em breve',
      emoji: '🔴'
    };
  } else if (sys >= 130 || dia >= 80) {
    return {
      label: 'Hipertensão Estágio 1',
      cor: '#E53935',
      corTexto: '#FFEBEE',
      descricao: '🟠 Pressão alta — consulta médica recomendada',
      emoji: '🟠'
    };
  } else if (sys >= 120 && dia < 80) {
    return {
      label: 'Pressão Elevada',
      cor: '#F57C00',
      corTexto: '#FFF8E1',
      descricao: '🟡 Atenção — monitore com frequência',
      emoji: '🟡'
    };
  } else if (sys < 90 || dia < 60) {
    return {
      label: 'Pressão Baixa',
      cor: '#1565C0',
      corTexto: '#E3F2FD',
      descricao: '🔵 Pressão baixa — hidrate-se e descanse',
      emoji: '🔵'
    };
  } else {
    return {
      label: 'Normal',
      cor: '#2E7D32',
      corTexto: '#E8F5E9',
      descricao: '🟢 Ótimo — dentro do ideal pela OMS',
      emoji: '🟢'
    };
  }
};

export const formatarDataHora = (data: Date): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
};

export const formatarData = (data: Date): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data);
};

export interface DailyWaterLog {
  id?: string;
  user_id: string;
  date_string: string; // YYYY-MM-DD
  amount_ml: number;
  meta_ml: number;
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

export interface GlicemiaClassificationInfo {
  label: string;
  cor: string;
  corTexto: string;
  descricao: string;
  emoji: string;
}

// Classificação baseada na Sociedade Brasileira de Diabetes (SBD) e ADA
export const classificarGlicemia = (valor: number, momento: 'jejum' | 'pos_prandial' | 'antes_dormir' | 'aleatorio'): GlicemiaClassificationInfo => {
  if (valor < 70) {
    return {
      label: 'Hipoglicemia',
      cor: '#D32F2F',
      corTexto: '#FFEBEE',
      descricao: '🚨 Muito baixa! Consuma açúcar imediatamente',
      emoji: '🚨'
    };
  }

  if (momento === 'jejum') {
    if (valor >= 126) {
      return {
        label: 'Hiperglicemia (Diabetes)',
        cor: '#C62828',
        corTexto: '#FFEBEE',
        descricao: '🔴 Valor elevado para jejum — fale com seu médico',
        emoji: '🔴'
      };
    } else if (valor >= 100) {
      return {
        label: 'Pré-Diabetes',
        cor: '#F57C00',
        corTexto: '#FFF8E1',
        descricao: '🟡 Atenção — valor ligeiramente elevado',
        emoji: '🟡'
      };
    } else {
      return {
        label: 'Normal',
        cor: '#2E7D32',
        corTexto: '#E8F5E9',
        descricao: '🟢 Excelente — valor ideal para jejum',
        emoji: '🟢'
      };
    }
  } else if (momento === 'pos_prandial') {
    if (valor >= 200) {
      return {
        label: 'Hiperglicemia (Diabetes)',
        cor: '#C62828',
        corTexto: '#FFEBEE',
        descricao: '🔴 Valor elevado pós-refeição — monitore',
        emoji: '🔴'
      };
    } else if (valor >= 140) {
      return {
        label: 'Pré-Diabetes',
        cor: '#F57C00',
        corTexto: '#FFF8E1',
        descricao: '🟡 Atenção — valor ligeiramente elevado pós-refeição',
        emoji: '🟡'
      };
    } else {
      return {
        label: 'Normal',
        cor: '#2E7D32',
        corTexto: '#E8F5E9',
        descricao: '🟢 Excelente — valor ideal pós-refeição',
        emoji: '🟢'
      };
    }
  } else {
    // aleatório ou antes de dormir
    if (valor >= 200) {
      return {
        label: 'Hiperglicemia',
        cor: '#C62828',
        corTexto: '#FFEBEE',
        descricao: '🔴 Valor muito alto — beba água e monitore',
        emoji: '🔴'
      };
    } else if (valor >= 140) {
      return {
        label: 'Elevada',
        cor: '#F57C00',
        corTexto: '#FFF8E1',
        descricao: '🟡 Atenção — acima do ideal para o momento',
        emoji: '🟡'
      };
    } else {
      return {
        label: 'Normal',
        cor: '#2E7D32',
        corTexto: '#E8F5E9',
        descricao: '🟢 Ideal — dentro do esperado para o momento',
        emoji: '🟢'
      };
    }
  }
};

export interface ImcClassificationInfo {
  label: string;
  cor: string;
  corTexto: string;
  descricao: string;
  emoji: string;
}

export const classificarImc = (peso: number, alturaCm: number, idadeAnos: number, _sexo: 'masculino' | 'feminino' | 'outro'): ImcClassificationInfo => {
  if (!peso || !alturaCm || peso <= 0 || alturaCm <= 0) {
    return {
      label: 'Dados Incompletos',
      cor: '#64748b',
      corTexto: '#f8fafc',
      descricao: 'Cadastre seu peso e altura para calcular o IMC.',
      emoji: 'ℹ️'
    };
  }

  const alturaM = alturaCm / 100;
  const imc = peso / (alturaM * alturaM);

  // 1. Crianças e Adolescentes (até 19 anos) - Curvas de Crescimento da OMS aproximadas
  if (idadeAnos < 19) {
    if (imc < 14) {
      return {
        label: 'Desnutrição / Baixo Peso',
        cor: '#1565C0',
        corTexto: '#E3F2FD',
        descricao: 'Abaixo do percentil 3 para a idade (Curva de Crescimento OMS)',
        emoji: '🔵'
      };
    } else if (imc < 21) {
      return {
        label: 'Peso Adequado (Eutrofia)',
        cor: '#2E7D32',
        corTexto: '#E8F5E9',
        descricao: 'Entre o percentil 3 e 85 para a idade (Ideal OMS)',
        emoji: '🟢'
      };
    } else if (imc < 25) {
      return {
        label: 'Sobrepeso / Risco',
        cor: '#F57C00',
        corTexto: '#FFF8E1',
        descricao: 'Entre o percentil 85 e 97 para a idade (Monitore com pediatra/médico)',
        emoji: '🟡'
      };
    } else {
      return {
        label: 'Obesidade Infantil/Juvenil',
        cor: '#C62828',
        corTexto: '#FFEBEE',
        descricao: 'Acima do percentil 97 para a idade (Acompanhamento profissional recomendado)',
        emoji: '🔴'
      };
    }
  }

  // 2. Idosos (60 anos ou mais) - Critérios OMS/OPAS para Idosos
  if (idadeAnos >= 60) {
    if (imc <= 22) {
      return {
        label: 'Baixo Peso (Idoso)',
        cor: '#1565C0',
        corTexto: '#E3F2FD',
        descricao: 'IMC ≤ 22 — recomendada atenção nutricional para a idade',
        emoji: '🔵'
      };
    } else if (imc < 27) {
      return {
        label: 'Peso Adequado (Eutrofia)',
        cor: '#2E7D32',
        corTexto: '#E8F5E9',
        descricao: 'IMC entre 22 e 27 — faixa ideal para idosos (OMS/OPAS)',
        emoji: '🟢'
      };
    } else {
      return {
        label: 'Sobrepeso / Obesidade',
        cor: '#C62828',
        corTexto: '#FFEBEE',
        descricao: 'IMC ≥ 27 — acima do recomendado para idosos',
        emoji: '🔴'
      };
    }
  }

  // 3. Adultos (19 a 59 anos) - Classificação Padrão da OMS
  if (imc < 18.5) {
    return {
      label: 'Baixo Peso',
      cor: '#1565C0',
      corTexto: '#E3F2FD',
      descricao: 'Abaixo do peso ideal (IMC < 18.5)',
      emoji: '🔵'
    };
  } else if (imc < 25) {
    return {
      label: 'Peso Saudável (Eutrofia)',
      cor: '#2E7D32',
      corTexto: '#E8F5E9',
      descricao: 'Parabéns! Peso ideal para a sua saúde (IMC 18.5 - 24.9)',
      emoji: '🟢'
    };
  } else if (imc < 30) {
    return {
      label: 'Sobrepeso',
      cor: '#F57C00',
      corTexto: '#FFF8E1',
      descricao: 'Sobrepeso (IMC 25 - 29.9) — atenção com alimentação e atividades',
      emoji: '🟡'
    };
  } else if (imc < 35) {
    return {
      label: 'Obesidade Grau I',
      cor: '#E53935',
      corTexto: '#FFEBEE',
      descricao: 'Obesidade Grau I (IMC 30 - 34.9) — importante iniciar controle',
      emoji: '🟠'
    };
  } else if (imc < 40) {
    return {
      label: 'Obesidade Grau II',
      cor: '#C62828',
      corTexto: '#FFEBEE',
      descricao: 'Obesidade Grau II (IMC 35 - 39.9) — risco de comorbidades elevado',
      emoji: '🔴'
    };
  } else {
    return {
      label: 'Obesidade Grau III',
      cor: '#7B0D1E',
      corTexto: '#FFD6D6',
      descricao: 'Obesidade Grave (IMC ≥ 40) — busque acompanhamento multiprofissional',
      emoji: '🚨'
    };
  }
};


