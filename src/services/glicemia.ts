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
} from 'firebase/firestore';
import { db } from '../firebase';
import type { GlicemiaReading, UserProfile, Medication, BpReading } from '../types';
import { classificarImc } from '../types';
import { comFallback, genAI, ANALISE_MODELS } from './ai-config';
import { parseFirestoreDate } from './utils';

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

// Buscar leituras de glicemia dos últimos N dias
export const buscarGlicemias = async (uid: string, dias: number = 30): Promise<GlicemiaReading[]> => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  const processDocs = (snapDocs: any[]): GlicemiaReading[] => {
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
  };

  try {
    const q = query(
      collection(db, 'glicemia_readings'),
      where('user_id', '==', uid),
      orderBy('data_hora_afericao', 'desc'),
      limit(100)
    );

    const snap = await getDocs(q);
    return processDocs(snap.docs);
  } catch (err) {
    console.warn('[glicemia] Consulta indexada falhou. Usando fallback local por user_id...', err);
    try {
      const fallbackQuery = query(
        collection(db, 'glicemia_readings'),
        where('user_id', '==', uid)
      );
      const snap = await getDocs(fallbackQuery);
      return processDocs(snap.docs);
    } catch (fallbackErr) {
      console.error('[glicemia] Erro no fallback de buscarGlicemias:', fallbackErr);
      return [];
    }
  }
};

// Gerar Prompt de Análise de Glicemia
function montarPromptGlicemia(
  leitura: GlicemiaReading,
  perfil: UserProfile,
  historico: GlicemiaReading[],
  medicacoes: Medication[] = [],
  aguaBebida: number = 0,
  pesoHistorico?: number
): string {
  const historicoOrdenado = [...historico]
    .sort((a, b) => a.data_hora_afericao.getTime() - b.data_hora_afericao.getTime())
    .slice(-20);

  const historicoTexto = historicoOrdenado
    .map(h => {
      const data = h.data_hora_afericao.toLocaleDateString('pt-BR');
      return `${data}: ${h.valor} mg/dL (${h.momento})`;
    })
    .join('\n');

  const medsDiabetes = medicacoes.filter(m => m.ativa && (m.nome.toLowerCase().includes('metform') || m.nome.toLowerCase().includes('insulin') || m.nome.toLowerCase().includes('gliclaz') || m.nome.toLowerCase().includes('glipiz') || m.nome.toLowerCase().includes('empaglif') || m.nome.toLowerCase().includes('dapaglif') || m.nome.toLowerCase().includes('liraglut') || m.nome.toLowerCase().includes('semaglut')));

  const medText = medsDiabetes.length > 0 
    ? '\nMEDICAÇÕES PARA DIABETES EM USO:\n' + medsDiabetes.map(m => `- ${m.nome} (${m.dosagem})`).join('\n')
    : '';

  const pesoFinal = pesoHistorico || perfil.peso || '?';
  const pesoNum = typeof pesoFinal === 'number' ? pesoFinal : Number(pesoFinal) || 0;
  const metaAguaPrompt = pesoNum > 0 ? pesoNum * 35 : 2000;

  // Calcular IMC e Classificação OMS
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
    console.warn('[IA Glicemia] Nenhuma chave de API configurada. Usando fallback básico em português.');
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

  const prompt = montarPromptGlicemia(leitura, perfil, historico, medicacoes, aguaBebida, pesoHistorico);

  try {
    const resultado = await comFallback(ANALISE_MODELS, async (modelo: string) => {
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
  } catch (err: any) {
    console.error('[IA Glicemia] Todos os modelos falharam. Usando fallback básico.', err);
    return `Olá, ${perfil.nome}. Sua glicemia atual é de ${leitura.valor} mg/dL (${leitura.momento}). Mantenha uma alimentação equilibrada e o monitoramento regular conforme orientação médica.`;
  }
};


// Gerar Laudo Médico Integrado (Hipertensão + Diabetes)
export const gerarLaudoIntegradoIA = async (
  afericoesPressao: BpReading[],
  leiturasGlicemia: GlicemiaReading[],
  perfil: UserProfile,
  medicacoes: Medication[] = [],
  dias: number = 30
): Promise<string> => {
  // Ordenar séries
  const ultimasPressao = [...afericoesPressao]
    .sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime())
    .slice(0, 10);

  const ultimasGlicemia = [...leiturasGlicemia]
    .sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime())
    .slice(0, 10);

  const pressaoTexto = ultimasPressao.map(p => {
    return `- ${p.data_hora_afericao.toLocaleDateString('pt-BR')}: ${p.sys}/${p.dia} mmHg, Pulso: ${p.pul} BPM`;
  }).join('\n');

  const glicemiaTexto = ultimasGlicemia.map(g => {
    return `- ${g.data_hora_afericao.toLocaleDateString('pt-BR')}: ${g.valor} mg/dL (${g.momento})`;
  }).join('\n');

  const medText = medicacoes.length > 0
    ? medicacoes.map(m => `- ${m.nome} (${m.dosagem}) - ${m.frequencia} [${m.ativa ? 'Ativa' : 'Inativa'}]`).join('\n')
    : 'Nenhuma medicação registrada.';

  // Buscar logs de hidratação (últimos 30 dias por padrão para laudo integrado)
  const { buscarAguaDoDia } = await import('./agua');
  const aguaLogs: Array<{ data: string, amount: number }> = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const waterLog = await buscarAguaDoDia(perfil.uid, dateStr);
    if (waterLog && waterLog.amount_ml > 0) {
      aguaLogs.push({ data: d.toLocaleDateString('pt-BR'), amount: waterLog.amount_ml });
    }
  }
  const aguaTexto = aguaLogs.length > 0
    ? aguaLogs.map(a => `- ${a.data}: ${a.amount} mL`).join('\n')
    : 'Nenhum registro de consumo de água recente.';

  // Buscar histórico de peso
  const { buscarHistoricoPeso } = await import('./auth');
  const pesos = await buscarHistoricoPeso(perfil.uid);
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);
  const pesosPeriodo = pesos.filter(p => p.data >= dataLimite);
  const pesoTexto = pesosPeriodo.length > 0
    ? pesosPeriodo.map(p => `- ${p.data.toLocaleDateString('pt-BR')}: ${p.peso} kg`).join('\n')
    : `- Peso atual: ${perfil.peso} kg`;

  // Calcular dados de IMC
  let imcTexto = 'Não calculado (dados de altura indisponíveis no perfil).';
  if (perfil.altura && perfil.peso) {
    const imcVal = perfil.peso / ((perfil.altura / 100) * (perfil.altura / 100));
    const imcClf = classificarImc(perfil.peso, perfil.altura, perfil.idade, perfil.sexo);
    imcTexto = `${imcVal.toFixed(1)} kg/m² (Classificação: ${imcClf.label} - ${imcClf.descricao})`;
  }

  const prompt = `Você é um médico cardiologista e endocrinologista sênior.
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

  const res = await comFallback(ANALISE_MODELS, async (modelo: string) => {
    const model = genAI.getGenerativeModel({ model: modelo });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { text: response.text().trim(), modelName: modelo };
  }, prompt);

  const laudoTexto = (res && typeof res === 'object' && (res as any).text) ? (res as any).text : String(res || '');
  const modeloUsado = (res && typeof res === 'object' && (res as any).modelName) ? (res as any).modelName : 'Gemini Integrado';

  if (laudoTexto && perfil?.uid) {
    try {
      await addDoc(collection(db, 'laudos'), {
        user_id: perfil.uid,
        conteudo: laudoTexto,
        modelo_usado: modeloUsado,
        dias_analisados: dias,
        data_geracao: new Date(),
        ativo: true
      });
    } catch (dbErr) {
      console.error('[IA Laudo Integrado] Erro ao salvar laudo no banco:', dbErr);
    }
  }

  return laudoTexto;
};
