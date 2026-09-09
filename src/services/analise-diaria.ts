import { logger } from '../services/logger';
import { db } from '../firebase';
import { collection, query, where, doc, setDoc, getDocs } from 'firebase/firestore';
import { genAI, ANALISE_MODELS, comFallback } from './ai-config';
import { buscarAguaDoDia } from './agua';

export interface AnaliseDiaria {
  id?: string;
  user_id: string;
  data_str: string; // "DD/MM/YYYY" format
  feedback: string;
  atualizado_em: string;
}

export interface AnaliseRecordItem {
  timestamp: string | number | Date;
  tipo: 'pressao' | 'glicemia' | 'peso' | string;
  sys?: number;
  dia?: number;
  pul?: number;
  valor?: number;
  momento?: string;
  peso?: number;
  original?: {
    sys?: number;
    dia?: number;
    pul?: number;
    valor?: number;
    momento?: string;
    peso?: number;
  };
}

/**
 * Busca todas as análises diárias do usuário
 */
export async function buscarAnalisesDiarias(userId: string): Promise<AnaliseDiaria[]> {
  try {
    const q = query(collection(db, 'analises_diarias'), where('user_id', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AnaliseDiaria));
  } catch (err) {
    logger.warn('[analise-diaria] Erro ao buscar análises diárias, pode ser falta de índice:', err);
    return [];
  }
}

/**
 * Salva ou atualiza a análise de um dia específico
 */
export async function salvarAnaliseDiaria(analise: AnaliseDiaria): Promise<void> {
  const docId = `${analise.user_id}_${analise.data_str.replace(/\//g, '-')}`;
  const docRef = doc(db, 'analises_diarias', docId);
  await setDoc(docRef, analise);
}

function formatarLinhaRegistro(r: AnaliseRecordItem): string {
  const orig = r.original || {};
  let linha = `- ${new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}: `;
  if (r.tipo === 'pressao') {
    linha += `Pressão Arterial ${(orig.sys ?? r.sys)}x${(orig.dia ?? r.dia)} mmHg, Pulso ${(orig.pul ?? r.pul)} bpm.`;
  } else if (r.tipo === 'glicemia') {
    linha += `Glicemia ${(orig.valor ?? r.valor)} mg/dL (Momento: ${(orig.momento ?? r.momento)}).`;
  } else if (r.tipo === 'peso') {
    linha += `Peso ${(orig.peso ?? r.peso)} kg.`;
  }
  return linha;
}

/**
 * Gera um feedback unificado para o dia usando Gemini
 * @param records Lista combinada de registros do dia
 * @param dataStr Data no formato "DD/MM/YYYY"
 * @param userId ID do usuário
 */
export async function gerarAnaliseDiariaIA(records: AnaliseRecordItem[], dataStr: string, userId: string): Promise<string> {
  // Buscar água consumida no respectivo dia
  const dateParts = dataStr.split('/');
  const dateStringYMD = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // YYYY-MM-DD
  const waterLog = await buscarAguaDoDia(userId, dateStringYMD).catch(() => null);
  const aguaMl = waterLog ? waterLog.amount_ml : 0;

  const linhas = records.map(formatarLinhaRegistro).join('\n');

  const prompt = `
Você é o KardIA, um assistente virtual de saúde. O usuário quer um resumo das suas aferições no dia ${dataStr}.
Abaixo estão todas as medições (pressão, glicemia, peso, etc.) registradas neste dia:

- Consumo de água: ${aguaMl} mL.
${linhas}

Por favor, faça um resumo clínico leve, direto e humanizado sobre este dia. 
Comente se houve estabilidade, chame a atenção para algum pico (se houver) e dê uma orientação geral.
Mantenha o tom encorajador e não faça diagnósticos médicos, lembrando sempre que é um assistente virtual.
Seja breve (máximo de 2 parágrafos curtos). Use **negritos** para destacar pontos importantes.
Atenção: Não utilize emojis ou símbolos semelhantes em hipótese alguma na sua resposta.
  `.trim();

  const resultado = await comFallback<{ text: string; modelName?: string } | string>(
    ANALISE_MODELS,
    async (modelName) => {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    },
    prompt
  );

  const text = typeof resultado === 'string'
    ? resultado
    : (resultado as { text?: string })?.text || String(resultado);

  const analise: AnaliseDiaria = {
    user_id: userId,
    data_str: dataStr,
    feedback: text,
    atualizado_em: new Date().toISOString()
  };

  await salvarAnaliseDiaria(analise);
  return text;
}
