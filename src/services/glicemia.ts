import { logger } from '../services/logger';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { GlicemiaReading, UserProfile, Medication } from '../types';
import { classificarImc } from '../types';
import { comFallback, genAI, ANALISE_MODELS } from './ai-config';
import { parseFirestoreDate } from './utils';

export * from './glicemia-laudo';

// Salvar leitura de glicemia no Firestore
export const salvarGlicemia = async (leitura: Omit<GlicemiaReading, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'glicemia_readings'), {
    ...leitura,
    data_hora_afericao: Timestamp.fromDate(leitura.data_hora_afericao),
  });
  return docRef.id;
};

// Atualizar feedback da IA
export const atualizarFeedbackGlicemiaIA = async (id: string, feedback: string): Promise<void> => {
  await updateDoc(doc(db, 'glicemia_readings', id), {
    ai_feedback: feedback,
  });
};

function processarDocsGlicemia(snapDocs: QueryDocumentSnapshot[], dataLimite: Date): GlicemiaReading[] {
  const leituras: GlicemiaReading[] = [];
  snapDocs.forEach(d => {
    const data = d.data();
    const dataHora = parseFirestoreDate(data.data_hora_afericao);

    if (dataHora >= dataLimite) {
      leituras.push({
        id: d.id,
        user_id: data.user_id,
        valor: data.valor,
        momento: data.momento,
        data_hora_afericao: dataHora,
        ai_feedback: data.ai_feedback,
        hba1c: data.hba1c
      });
    }
  });
  return leituras.sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime());
}

// Buscar leituras de glicemia dos últimos N dias
export const buscarGlicemias = async (uid: string, dias: number = 30): Promise<GlicemiaReading[]> => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  try {
    const q = query(
      collection(db, 'glicemia_readings'),
      where('user_id', '==', uid),
      orderBy('data_hora_afericao', 'desc'),
      limit(100)
    );

    const snap = await getDocs(q);
    return processarDocsGlicemia(snap.docs, dataLimite);
  } catch (err) {
    logger.warn('[glicemia] Consulta indexada falhou. Usando fallback local por user_id...', err);
    try {
      const fallbackQuery = query(
        collection(db, 'glicemia_readings'),
        where('user_id', '==', uid)
      );
      const snap = await getDocs(fallbackQuery);
      return processarDocsGlicemia(snap.docs, dataLimite);
    } catch (fallbackErr) {
      logger.error('[glicemia] Erro no fallback de buscarGlicemias:', fallbackErr);
      return [];
    }
  }
};

export interface PromptGlicemiaOptions {
  leitura: GlicemiaReading;
  perfil: UserProfile;
  historico: GlicemiaReading[];
  medicacoes?: Medication[];
  aguaBebida?: number;
  pesoHistorico?: number;
}

function filtrarMedicacoesDiabetes(medicacoes: Medication[] = []): string {
  const nomesDiabetes = ['metform', 'insulin', 'gliclaz', 'glipiz', 'empaglif', 'dapaglif', 'liraglut', 'semaglut'];
  const medsDiabetes = medicacoes.filter(m => {
    if (!m.ativa) return false;
    const nomeLower = m.nome.toLowerCase();
    return nomesDiabetes.some(d => nomeLower.includes(d));
  });

  return medsDiabetes.length > 0
    ? '\nMEDICAÇÕES PARA DIABETES EM USO:\n' + medsDiabetes.map(m => `- ${m.nome} (${m.dosagem})`).join('\n')
    : '';
}

// Gerar Prompt de Análise de Glicemia
export function montarPromptGlicemia(opts: PromptGlicemiaOptions): string {
  const { leitura, perfil, historico, medicacoes = [], aguaBebida = 0, pesoHistorico } = opts;
  const historicoOrdenado = [...historico]
    .sort((a, b) => a.data_hora_afericao.getTime() - b.data_hora_afericao.getTime())
    .slice(-20);

  const historicoTexto = historicoOrdenado
    .map(h => `- ${h.data_hora_afericao.toLocaleDateString('pt-BR')}: ${h.valor} mg/dL (${h.momento})`)
    .join('\n');

  const medText = filtrarMedicacoesDiabetes(medicacoes);
  const pesoFinal = pesoHistorico || perfil.peso || '?';
  const pesoNum = typeof pesoFinal === 'number' ? pesoFinal : Number(pesoFinal) || 0;
  const metaAguaPrompt = pesoNum > 0 ? pesoNum * 35 : 2000;

  let imcText = '';
  if (perfil.altura && pesoNum > 0) {
    const imcVal = pesoNum / ((perfil.altura / 100) * (perfil.altura / 100));
    const imcClf = classificarImc(pesoNum, perfil.altura, perfil.idade, perfil.sexo);
    imcText = `\n- Altura cadastrada: ${perfil.altura} cm\n- IMC calculado: ${imcVal.toFixed(1)} kg/m² (${imcClf.label} - ${imcClf.descricao})`;
  }

  return `Você é um endocrinologista experiente. Analise a leitura de glicemia do paciente.
RESPONDA SEMPRE EM PORTUGUÊS DO BRASIL. NÃO USE ASTERISCOS OU NEGRITOS. Máximo de 4 frases curtas.

DADOS DO PACIENTE:
- Nome: ${perfil.nome}
- Idade: ${perfil.idade} anos
- Peso registrado na data da aferição: ${pesoFinal} kg${imcText}${medText}
- Água consumida no dia desta aferição: ${aguaBebida} mL (Meta diária personalizada: ${Math.round(metaAguaPrompt)} mL)

LEITURA ATUAL:
- Valor: ${leitura.valor} mg/dL
- Momento: ${leitura.momento} (jejum, pos_prandial, etc.)
- Data/Hora: ${leitura.data_hora_afericao.toLocaleString('pt-BR')}

HISTÓRICO RECENTE:
${historicoTexto || 'Nenhum histórico anterior disponível.'}

ANÁLISE SOLICITADA:
1. Classifique a glicemia atual com base nas diretrizes da SBD (Jejum ideal <100mg/dL, Pré-diabetes 100-125, Diabetes ≥126. Pós-prandial ideal <140mg/dL, Pré-diabetes 140-199, Diabetes ≥200. Hipoglicemia <70mg/dL para qualquer momento).
2. Forneça uma orientação rápida de alimentação ou cuidados conforme o momento registrado. Analise o consumo de água, mas ATENÇÃO: o valor reflete o que foi bebido ATÉ a hora da aferição. Se a aferição for cedo, NÃO faça alertas alarmistas sobre desidratação, pois o usuário ainda tem o resto do dia para beber água.
3. Se houver hipoglicemia (<70) ou hiperglicemia muito alta (ex: >250), recomende atendimento médico com segurança e tranquilidade.

GUARDRAILS DE SEGURANÇA (OBRIGATÓRIO):
- JAMAIS dê diagnósticos médicos precipitados ou faça previsões catastróficas (ex: "isso vai causar amputação", "pode causar desidratação grave").
- Não cause espanto ou pânico no usuário. Mantenha um tom acolhedor, leve e encorajador.
- Considere sempre o histórico do paciente antes de tirar conclusões dramáticas.`;
}

// Gerar Feedback de Glicemia isolado
export const gerarFeedbackGlicemiaIA = async (
  leitura: GlicemiaReading,
  perfil: UserProfile,
  historico: GlicemiaReading[],
  medicacoes: Medication[] = []
): Promise<string> => {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!geminiApiKey) {
    logger.warn('[IA Glicemia] Nenhuma chave de API configurada. Usando fallback básico em português.');
    return `Olá, ${perfil.nome}. Sua glicemia atual é de ${leitura.valor} mg/dL (${leitura.momento}). Mantenha uma alimentação equilibrada e o monitoramento regular conforme orientação médica.`;
  }

  const { buscarAguaDoDia } = await import('./agua');
  const { buscarHistoricoPeso } = await import('./auth');

  const dateStr = leitura.data_hora_afericao.toISOString().split('T')[0];
  const waterLog = await buscarAguaDoDia(perfil.uid, dateStr);
  const aguaBebida = waterLog ? waterLog.amount_ml : 0;

  const pesos = await buscarHistoricoPeso(perfil.uid);
  const pesoEntrada = pesos
    .filter(p => p.data.getTime() <= leitura.data_hora_afericao.getTime())
    .pop();
  const pesoHistorico = pesoEntrada ? pesoEntrada.peso : perfil.peso;

  const prompt = montarPromptGlicemia({ leitura, perfil, historico, medicacoes, aguaBebida, pesoHistorico });

  try {
    const resultado = await comFallback<{ text: string; modelName: string }>(ANALISE_MODELS, async (modelo: string) => {
      const model = genAI.getGenerativeModel({ model: modelo });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      if (!text || text.length < 20) throw new Error('Texto de feedback muito curto.');
      return { text, modelName: modelo };
    }, prompt);

    if (resultado.text && resultado.text.length >= 20) {
      return resultado.text;
    }
    throw new Error('Retorno inválido ou vazio.');
  } catch (err: unknown) {
    logger.error('[IA Glicemia] Todos os modelos falharam. Usando fallback básico.', err);
    return `Olá, ${perfil.nome}. Sua glicemia atual é de ${leitura.valor} mg/dL (${leitura.momento}). Mantenha uma alimentação equilibrada e o monitoramento regular conforme orientação médica.`;
  }
};
