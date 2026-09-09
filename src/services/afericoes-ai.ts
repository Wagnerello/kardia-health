import { logger } from '../services/logger';
/**
 * Motor de IA para feedback imediato e análise de aferições de pressão arterial.
 */
import type { BpReading, UserProfile, Medication } from '../types';
import { classificarImc } from '../types';
import { comFallback, genAI, ANALISE_MODELS } from './ai-config';

export interface PromptAnaliseOptions {
  leitura: BpReading;
  perfil: UserProfile;
  historico: BpReading[];
  medicacoes?: Medication[];
  aguaBebida?: number;
  pesoHistorico?: number;
}

function formatarHistoricoPrompt(historico: BpReading[]): string {
  const historicoOrdenado = [...historico]
    .sort((a, b) => a.data_hora_afericao.getTime() - b.data_hora_afericao.getTime())
    .slice(-20);

  return historicoOrdenado
    .map(h => {
      const data = h.data_hora_afericao.toLocaleDateString('pt-BR');
      const hora = h.data_hora_afericao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${data} ${hora}: SYS ${h.sys}, DIA ${h.dia}, PUL ${h.pul}`;
    })
    .join('\n');
}

function formatarMedicacoesPrompt(medicacoes: Medication[] = []): string {
  const medsAtivas = medicacoes.filter(m => {
    if (!m.ativa) return false;
    if (m.tipo === 'Temporario' && m.data_fim && new Date() > m.data_fim) return false;
    return true;
  });
  if (medsAtivas.length === 0) return '';
  return '\nMEDICAÇÕES/SUPLEMENTOS EM USO:\n' + medsAtivas.map(m => `- ${m.nome} (${m.dosagem}) - ${m.frequencia} [${m.tipo}]`).join('\n');
}

function formatarPerfilClinicoPrompt(perfil: UserProfile, pesoNum: number): { condicoesTexto: string; imcTexto: string } {
  const condicoes: string[] = [];
  if (perfil.hipertenso) condicoes.push('Hipertenso(a)');
  if (perfil.diabetico) condicoes.push('Diabético(a)');
  if (perfil.fumante) condicoes.push('Fumante');
  if (perfil.sedentario) condicoes.push('Sedentário(a)');
  if (perfil.usaMedicacao) condicoes.push('Usa medicação para pressão');
  
  const condicoesTexto = condicoes.length > 0 ? `\n- Histórico Clínico: ${condicoes.join(', ')}` : '';
  let imcTexto = '';
  if (perfil.altura && pesoNum > 0) {
    const imcVal = pesoNum / ((perfil.altura / 100) * (perfil.altura / 100));
    const imcClf = classificarImc(pesoNum, perfil.altura, perfil.idade, perfil.sexo);
    imcTexto = `\n- Altura cadastrada: ${perfil.altura} cm\n- IMC calculado: ${imcVal.toFixed(1)} kg/m² (${imcClf.label} - ${imcClf.descricao})`;
  }
  return { condicoesTexto, imcTexto };
}

// Gerar Prompt de Análise OMS
export function montarPromptAnalise(options: PromptAnaliseOptions): string {
  const { leitura, perfil, historico, medicacoes = [], aguaBebida = 0, pesoHistorico } = options;
  const historicoTexto = formatarHistoricoPrompt(historico);
  const medText = formatarMedicacoesPrompt(medicacoes);

  const sexo = perfil.sexo === 'masculino' ? 'masculino' : perfil.sexo === 'feminino' ? 'feminino' : 'não informado';
  const pesoFinal = pesoHistorico || perfil.peso || '?';
  const pesoNum = typeof pesoFinal === 'number' ? pesoFinal : Number(pesoFinal) || 0;
  const metaAguaPrompt = pesoNum > 0 ? pesoNum * 35 : 2000;
  const { condicoesTexto, imcTexto } = formatarPerfilClinicoPrompt(perfil, pesoNum);

  return `Você é um médico especialista assistente de saúde cardiovascular.
Forneça uma análise amigável, clara e encorajadora para a aferição de pressão arterial a seguir.

DADOS DO PACIENTE:
- Nome: ${perfil.nome} (${sexo}, ${perfil.idade} anos, ${pesoFinal} kg${imcTexto}${condicoesTexto}${medText})
- Água registrada no dia: ${aguaBebida} mL (Meta diária: ${Math.round(metaAguaPrompt)} mL)

AFERIÇÃO ATUAL:
- Pressão: ${leitura.sys}/${leitura.dia} mmHg
- Pulso: ${leitura.pul} BPM
- Data/Hora: ${leitura.data_hora_afericao.toLocaleString('pt-BR')}
${historicoTexto ? `\nHISTÓRICO RECENTE:\n${historicoTexto}` : ''}

REGRAS OBRIGATÓRIAS DE RESPOSTA:
1. Classifique a pressão segundo a OMS (Normal: abaixo de 120/80; Elevada: 120-129/abaixo de 80; Hipertensão Estágio 1: 130-139/80-89; Hipertensão Estágio 2: 140/90 ou superior; Crise: 180/120 ou superior).
2. Comente brevemente o nível de hidratação e tendência das leituras (se houver histórico).
3. Dê recomendações simples, leves e motivadoras.
4. NUNCA utilize os caracteres de menor "<" ou maior ">" (escreva sempre "abaixo de" ou "acima de").
5. Escreva de 3 a 5 frases completas e acolhedoras. NUNCA pare no meio da frase.`;
}

function obterMensagemHipertensaoOuCrise(sys: number, dia: number): string {
  if (sys >= 180 || dia >= 120) {
    return `⚠️ CRISE HIPERTENSIVA! Sua pressão (${sys}/${dia} mmHg) está em nível de emergência. Procure atendimento médico imediatamente. Não espere, vá agora para a UPA ou pronto-socorro.`;
  }
  if (sys >= 140 || dia >= 90) {
    const estagio = (sys >= 160 || dia >= 100) ? '2' : '1';
    return `Sua pressão está em Hipertensão Estágio ${estagio} (${sys}/${dia} mmHg), acima do limite da OMS. Recomendamos consultar seu médico para avaliação. Reduza o sódio, evite álcool e faça exercícios leves diariamente.`;
  }
  if (sys >= 130 || dia >= 80) {
    return `Sua pressão está no limiar da Hipertensão Estágio 1 (${sys}/${dia} mmHg). Atenção à dieta com menos sal, beba bastante água e diminua o estresse. Uma consulta médica preventiva é recomendada.`;
  }
  return '';
}

function obterMensagemFaixaPressao(sys: number, dia: number): string {
  const msgAlta = obterMensagemHipertensaoOuCrise(sys, dia);
  if (msgAlta) return msgAlta;

  if (sys >= 120 && dia < 80) {
    return `Pressão ligeiramente elevada (${sys}/${dia} mmHg) — categoria "Elevada" pela OMS. Mantenha hábitos saudáveis: menos sódio, mais atividade física e boa hidratação. Monitore com frequência.`;
  }
  if (sys < 90 || dia < 60) {
    return `Sua pressão está baixa (${sys}/${dia} mmHg). Mantenha-se hidratado, evite levantar bruscamente e descanse. Se sentir tontura, fraqueza ou desmaio, consulte um médico.`;
  }
  return '';
}

// Feedback local (fallback sem API)
export const gerarFeedbackLocal = (leitura: BpReading): string => {
  const { sys, dia, pul } = leitura;
  const msgFaixa = obterMensagemFaixaPressao(sys, dia);
  if (msgFaixa) {
    return msgFaixa;
  }

  const dicaPulso = (sys - dia) > 60
    ? ' Atenção: sua pressão de pulso está um pouco elevada, vale mencionar ao médico.'
    : '';
  return `Ótimo! Pressão normal (${sys}/${dia} mmHg) e pulso de ${pul} bpm — dentro dos parâmetros ideais da OMS. Continue com seus hábitos saudáveis.${dicaPulso}`;
};

async function carregarContextoPaciente(perfil: UserProfile, leitura: BpReading) {
  const { buscarMedications } = await import('./medications');
  const { buscarAguaDoDia } = await import('./agua');
  const { buscarHistoricoPeso } = await import('./peso');

  const dateStr = leitura.data_hora_afericao.toISOString().split('T')[0];
  const waterLog = await buscarAguaDoDia(perfil.uid, dateStr);
  const aguaBebida = waterLog ? waterLog.amount_ml : 0;

  const pesos = await buscarHistoricoPeso(perfil.uid);
  const pesoEntrada = pesos
    .filter(p => p.data.getTime() <= leitura.data_hora_afericao.getTime())
    .pop();
  const pesoHistorico = pesoEntrada ? pesoEntrada.peso : perfil.peso;

  const medicacoes = await buscarMedications(perfil.uid);
  return { medicacoes, aguaBebida, pesoHistorico };
}

interface FallbackAiResult {
  text?: string;
  modelName?: string;
}

// Gerar Feedback de IA (com fallback em cascata)
export const gerarFeedbackIA = async (
  leitura: BpReading,
  perfil: UserProfile,
  historico: BpReading[]
): Promise<string> => {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!geminiApiKey) {
    logger.warn('[IA] Nenhuma chave de API configurada. Usando feedback local.');
    return gerarFeedbackLocal(leitura);
  }

  const { medicacoes, aguaBebida, pesoHistorico } = await carregarContextoPaciente(perfil, leitura);
  const prompt = montarPromptAnalise({ leitura, perfil, historico, medicacoes, aguaBebida, pesoHistorico });

  try {
    const resultado = await comFallback<FallbackAiResult | string>(ANALISE_MODELS, async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.4 },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (!text || text.length < 20) {
        throw new Error('Resposta vazia ou inválida do modelo.');
      }
      return { text, modelName };
    }, prompt);

    const textFinal = typeof resultado === 'string' ? resultado : resultado?.text;
    logger.debug('[IA DEBUG] Texto gerado:', textFinal?.slice(0, 200));

    if (textFinal && textFinal.length >= 20) {
      logger.info('[IA Análise] Análise gerada com sucesso.');
      return textFinal;
    }
    throw new Error('Texto de feedback inválido ou muito curto.');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[IA Análise] Todos os modelos falharam. Usando fallback local.', msg);
    return gerarFeedbackLocal(leitura);
  }
};
