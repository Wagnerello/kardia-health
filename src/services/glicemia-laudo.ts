import { logger } from '../services/logger';
import {
  collection,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { GlicemiaReading, UserProfile, Medication, BpReading } from '../types';
import { classificarImc } from '../types';
import { comFallback, genAI, ANALISE_MODELS } from './ai-config';

export interface GerarLaudoIntegradoOptions {
  afericoesPressao: BpReading[];
  leiturasGlicemia: GlicemiaReading[];
  perfil: UserProfile;
  medicacoes?: Medication[];
  dias?: number;
}

async function coletarAguaLaudoIntegrado(uid: string): Promise<string> {
  const { buscarAguaDoDia } = await import('./agua');
  const aguaLogs: Array<{ data: string, amount: number }> = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const waterLog = await buscarAguaDoDia(uid, dateStr);
    if (waterLog && waterLog.amount_ml > 0) {
      aguaLogs.push({ data: d.toLocaleDateString('pt-BR'), amount: waterLog.amount_ml });
    }
  }
  return aguaLogs.length > 0
    ? aguaLogs.map(a => `- ${a.data}: ${a.amount} mL`).join('\n')
    : 'Nenhum registro de consumo de água recente.';
}

async function coletarPesoLaudoIntegrado(uid: string, fallbackPeso?: number): Promise<string> {
  const { buscarHistoricoPeso } = await import('./auth');
  const pesos = await buscarHistoricoPeso(uid);
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);
  const pesosPeriodo = pesos.filter(p => p.data >= dataLimite);
  return pesosPeriodo.length > 0
    ? pesosPeriodo.map(p => `- ${p.data.toLocaleDateString('pt-BR')}: ${p.peso} kg`).join('\n')
    : `- Peso atual: ${fallbackPeso || 0} kg`;
}

interface DadosPromptLaudoIntegrado {
  perfil: UserProfile;
  pressaoTexto: string;
  glicemiaTexto: string;
  medText: string;
  aguaTexto: string;
  pesoTexto: string;
  imcTexto: string;
}

function montarPromptLaudoIntegradoTexto(dados: DadosPromptLaudoIntegrado): string {
  const { perfil, pressaoTexto, glicemiaTexto, medText, aguaTexto, pesoTexto, imcTexto } = dados;
  return `Você é um médico cardiologista e endocrinologista sênior.
Elabore um LAUDO MÉDICO INTEGRADO avaliando a saúde cardiovascular e o controle metabólico (glicemia) do paciente.
O laudo deve correlacionar ambos os aspectos (risco cardiovascular em pacientes diabéticos, síndrome metabólica, impacto da pressão no controle metabólico, etc.).
RESPONDA SEMPRE EM PORTUGUÊS DO BRASIL.

DADOS DO PACIENTE:
- Nome: ${perfil.nome}
- Idade: ${perfil.idade} anos
- Sexo: ${perfil.sexo}
- Histórico clínico: Hipertenso e Diabético
- Altura cadastrada: ${perfil.altura ? `${perfil.altura} cm` : 'Não informada'}
- Índice de Massa Corporal (IMC) Atual: ${imcTexto}

EVOLUÇÃO DO PESO RECENTE (últimos 30 dias):
${pesoTexto}

CONSUMO DE ÁGUA RECENTE (últimos 30 dias):
${aguaTexto}

MEDICAÇÕES REGISTRADAS:
${medText}

ÚLTIMAS MEDIÇÕES DE PRESSÃO ARTERIAL (Sistólica/Diastólica):
${pressaoTexto || 'Sem registros de pressão.'}

ÚLTIMAS MEDIÇÕES DE GLICEMIA (Glicose no sangue):
${glicemiaTexto || 'Sem registros de glicemia.'}

ESTRUTURA DO LAUDO (use formatação Markdown profissional):
1. **Resumo Executivo Integrado**: Análise curta combinando o estado da pressão e da glicose do paciente.
2. **Avaliação Cardiovascular**: Análise das tendências de pressão arterial.
3. **Avaliação Metabólica**: Análise das tendências da glicemia.
4. **Fatores de Risco e Correlações**: Como o diabetes, a hipertensão, o peso e os níveis de hidratação (água) estão interagindo no risco geral de saúde deste paciente.
5. **Recomendações e Conduta Médica**: Orientações de estilo de vida, monitoramento e quando buscar suporte médico emergencial ou consulta.

GUARDRAILS DE SEGURANÇA (OBRIGATÓRIO):
- JAMAIS dê diagnósticos médicos precipitados ou faça previsões catastróficas.
- Não cause espanto ou pânico no usuário. Mantenha um tom profissional, acolhedor, leve e encorajador.
- Analise a hidratação com ponderação: lembre-se que os dados podem estar incompletos dependendo da hora do dia que o paciente inseriu as informações.
- Baseie as recomendações em evidências científicas (diretrizes SBD, SBC, OMS). Escreva de forma clara e legível.`;
}

function calcularTextoImcIntegrado(perfil: UserProfile): string {
  if (!perfil.altura || !perfil.peso) {
    return 'Não calculado (dados de altura indisponíveis no perfil).';
  }
  const imcVal = perfil.peso / ((perfil.altura / 100) * (perfil.altura / 100));
  const imcClf = classificarImc(perfil.peso, perfil.altura, perfil.idade, perfil.sexo);
  return `${imcVal.toFixed(1)} kg/m² (Classificação: ${imcClf.label} - ${imcClf.descricao})`;
}

async function persistirLaudoIntegrado(uid: string, laudoTexto: string, modeloUsado: string, dias: number) {
  if (!laudoTexto || !uid) return;
  try {
    await addDoc(collection(db, 'laudos'), {
      user_id: uid,
      conteudo: laudoTexto,
      modelo_usado: modeloUsado,
      dias_analisados: dias,
      data_geracao: new Date(),
      ativo: true
    });
  } catch (dbErr) {
    logger.error('[IA Laudo Integrado] Erro ao salvar laudo no banco:', dbErr);
  }
}

// Gerar Laudo Médico Integrado (Hipertensão + Diabetes)
export const gerarLaudoIntegradoIA = async (options: GerarLaudoIntegradoOptions): Promise<string> => {
  const { afericoesPressao, leiturasGlicemia, perfil, medicacoes = [], dias = 30 } = options;

  const ultimasPressao = [...afericoesPressao]
    .sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime())
    .slice(0, 10);
  const ultimasGlicemia = [...leiturasGlicemia]
    .sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime())
    .slice(0, 10);

  const pressaoTexto = ultimasPressao.map(p => `- ${p.data_hora_afericao.toLocaleDateString('pt-BR')}: ${p.sys}/${p.dia} mmHg, Pulso: ${p.pul} BPM`).join('\n');
  const glicemiaTexto = ultimasGlicemia.map(g => `- ${g.data_hora_afericao.toLocaleDateString('pt-BR')}: ${g.valor} mg/dL (${g.momento})`).join('\n');
  const medText = medicacoes.length > 0
    ? medicacoes.map(m => `- ${m.nome} (${m.dosagem}) - ${m.frequencia} [${m.ativa ? 'Ativa' : 'Inativa'}]`).join('\n')
    : 'Nenhuma medicação registrada.';

  const [aguaTexto, pesoTexto] = await Promise.all([
    coletarAguaLaudoIntegrado(perfil.uid),
    coletarPesoLaudoIntegrado(perfil.uid, perfil.peso)
  ]);

  const imcTexto = calcularTextoImcIntegrado(perfil);
  const prompt = montarPromptLaudoIntegradoTexto({ perfil, pressaoTexto, glicemiaTexto, medText, aguaTexto, pesoTexto, imcTexto });

  const res = await comFallback<{ text: string; modelName: string }>(ANALISE_MODELS, async (modelo: string) => {
    const model = genAI.getGenerativeModel({
      model: modelo,
      generationConfig: { maxOutputTokens: 8000, temperature: 0.3 }
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    if (!text || text.length < 50) throw new Error('Resposta inválida ou vazia.');
    return { text, modelName: modelo };
  }, prompt);

  const laudoTexto = res?.text || '';
  const modeloUsado = res?.modelName || 'Gemini Integrado';

  await persistirLaudoIntegrado(perfil.uid, laudoTexto, modeloUsado, dias);
  return laudoTexto;
};
