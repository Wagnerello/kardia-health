/**
 * Serviço de aferições de pressão arterial.
 * Inclui análise IA de evolução com base nas diretrizes da OMS,
 * com fallback automático de modelos.
 */
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { BpReading, UserProfile, Medication } from '../types';
import { classificarImc } from '../types';
import { comFallback, genAI, ANALISE_MODELS } from './ai-config';
import { parseFirestoreDate } from './utils';

export interface SavedLaudo {
  id: string;
  user_id: string;
  conteudo: string;
  modelo_usado?: string;
  dias_analisados?: number;
  data_geracao: Date;
  ativo?: boolean;
}

// ── Auxiliar para Base64 ─────────────────────────────────────────
const converterArquivoParaBase64DataUrl = (arquivo: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(arquivo);
  });
};

// ── Upload de imagem ────────────────────────────────────────────
export const uploadImagemAfericao = async (uid: string, arquivo: File): Promise<string> => {
  // Se estiver rodando localmente (localhost ou 127.0.0.1), faz o bypass do Firebase Storage
  // para evitar erros de CORS e retries que travam a aplicação.
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.startsWith('192.168.'))
  ) {
    console.info('[Storage] Rodando localmente. Ignorando Firebase Storage (CORS) e gerando Base64 local.');
    return await converterArquivoParaBase64DataUrl(arquivo);
  }

  try {
    const nomeArquivo = `${Date.now()}_${arquivo.name}`;
    const storageRef = ref(storage, `bp_images/${uid}/${nomeArquivo}`);
    const snapshot = await uploadBytes(storageRef, arquivo);
    return await getDownloadURL(snapshot.ref);
  } catch (error: any) {
    console.warn('[Storage] Erro no upload. Usando fallback para Base64 local...', error);
    return await converterArquivoParaBase64DataUrl(arquivo);
  }
};

// ── Salvar leitura no Firestore ─────────────────────────────────
export const salvarAfericao = async (leitura: Omit<BpReading, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'bp_readings'), {
    ...leitura,
    data_hora_afericao: Timestamp.fromDate(leitura.data_hora_afericao),
  });
  return docRef.id;
};

// ── Atualizar feedback da IA ────────────────────────────────────
export const atualizarFeedbackIA = async (id: string, feedback: string): Promise<void> => {
  await updateDoc(doc(db, 'bp_readings', id), {
    ai_feedback: feedback,
  });
};

// ── Buscar aferições dos últimos N dias ────────────────────────
export const buscarAfericoes = async (uid: string, dias: number = 30): Promise<BpReading[]> => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  try {
    const q = query(
      collection(db, 'bp_readings'),
      where('user_id', '==', uid),
      where('data_hora_afericao', '>=', Timestamp.fromDate(dataLimite)),
      orderBy('data_hora_afericao', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        data_hora_afericao: parseFirestoreDate(data.data_hora_afericao || data.data_hora || data.timestamp),
      };
    }) as BpReading[];
  } catch (err) {
    console.warn('[afericoes] Consulta indexada falhou. Usando fallback local por user_id...', err);
    try {
      const fallbackQuery = query(
        collection(db, 'bp_readings'),
        where('user_id', '==', uid)
      );
      const snap = await getDocs(fallbackQuery);
      const leituras: BpReading[] = [];
      snap.forEach(d => {
        const data = d.data();
        const dataHora = parseFirestoreDate(data.data_hora_afericao || data.data_hora || data.timestamp);
        if (dataHora >= dataLimite) {
          leituras.push({
            id: d.id,
            user_id: data.user_id,
            sys: data.sys,
            dia: data.dia,
            pul: data.pul,
            data_hora_afericao: dataHora,
            ai_feedback: data.ai_feedback,
            image_url: data.image_url || data.imagem_url,
          });
        }
      });
      return leituras.sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime());
    } catch (fallbackErr) {
      console.error('[afericoes] Erro no fallback de buscarAfericoes:', fallbackErr);
      return [];
    }
  }
};

// ── Buscar últimas N aferições ─────────────────────────────────
export const buscarUltimasAfericoes = async (uid: string, qtd: number = 10): Promise<BpReading[]> => {
  try {
    const q = query(
      collection(db, 'bp_readings'),
      where('user_id', '==', uid),
      orderBy('data_hora_afericao', 'desc'),
      limit(qtd)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        data_hora_afericao: parseFirestoreDate(data.data_hora_afericao || data.data_hora || data.timestamp),
      };
    }) as BpReading[];
  } catch (err) {
    console.warn('[afericoes] buscarUltimasAfericoes indexada falhou. Usando fallback local...', err);
    try {
      const fallbackQuery = query(
        collection(db, 'bp_readings'),
        where('user_id', '==', uid)
      );
      const snap = await getDocs(fallbackQuery);
      const leituras: BpReading[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          data_hora_afericao: parseFirestoreDate(data.data_hora_afericao || data.data_hora || data.timestamp),
        } as BpReading;
      });
      return leituras
        .sort((a, b) => b.data_hora_afericao.getTime() - a.data_hora_afericao.getTime())
        .slice(0, qtd);
    } catch (fallbackErr) {
      console.error('[afericoes] Erro no fallback de buscarUltimasAfericoes:', fallbackErr);
      return [];
    }
  }
};

// ── Buscar Laudos do Usuário ────────────────────────────────────
export const buscarLaudos = async (uid: string, incluirInativos: boolean = false): Promise<SavedLaudo[]> => {
  try {
    const q = query(
      collection(db, 'laudos'),
      where('user_id', '==', uid)
    );
    const snap = await getDocs(q);
    let laudos: SavedLaudo[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        user_id: data.user_id,
        conteudo: data.conteudo || '',
        modelo_usado: data.modelo_usado,
        dias_analisados: data.dias_analisados,
        data_geracao: parseFirestoreDate(data.data_geracao),
        ativo: data.ativo !== false,
      };
    });

    if (!incluirInativos) {
      laudos = laudos.filter(l => l.ativo !== false);
    }

    return laudos.sort((a, b) => b.data_geracao.getTime() - a.data_geracao.getTime());
  } catch (err) {
    console.error('[laudos] Erro ao buscar laudos:', err);
    return [];
  }
};

// ── Inativar Laudo (Soft Delete) ───────────────────────────────
export const inativarLaudo = async (laudoId: string): Promise<void> => {
  try {
    const ref = doc(db, 'laudos', laudoId);
    await updateDoc(ref, {
      ativo: false,
      data_inativacao: new Date()
    });
  } catch (err) {
    console.error('[laudos] Erro ao inativar laudo:', err);
    throw err;
  }
};

// ── Calcular médias ────────────────────────────────────────────
export const calcularMedias = (afericoes: BpReading[]): { sys: number; dia: number; pul: number } | null => {
  if (afericoes.length === 0) return null;

  const soma = afericoes.reduce((acc, a) => ({
    sys: acc.sys + a.sys,
    dia: acc.dia + a.dia,
    pul: acc.pul + a.pul,
  }), { sys: 0, dia: 0, pul: 0 });

  return {
    sys: Math.round(soma.sys / afericoes.length),
    dia: Math.round(soma.dia / afericoes.length),
    pul: Math.round(soma.pul / afericoes.length),
  };
};

// ── Gerar Prompt de Análise OMS ────────────────────────────────
function montarPromptAnalise(
  leitura: BpReading,
  perfil: UserProfile,
  historico: BpReading[],
  medicacoes: Medication[] = [],
  aguaBebida: number = 0,
  pesoHistorico?: number
): string {
  // Formatar histórico por data decrescente (mais antigo → mais recente, para o modelo ver a tendência)
  const historicoOrdenado = [...historico]
    .sort((a, b) => a.data_hora_afericao.getTime() - b.data_hora_afericao.getTime())
    .slice(-20); // Máx 20 aferições para economizar tokens

  const historicoTexto = historicoOrdenado
    .map(h => {
      const data = h.data_hora_afericao.toLocaleDateString('pt-BR');
      const hora = h.data_hora_afericao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${data} ${hora}: SYS ${h.sys}, DIA ${h.dia}, PUL ${h.pul}`;
    })
    .join('\n');

  const idade = perfil.idade;
  const sexo = perfil.sexo === 'masculino' ? 'masculino' : perfil.sexo === 'feminino' ? 'feminino' : 'não informado';

  let medText = '';
  const medsAtivas = medicacoes.filter(m => {
    if (!m.ativa) return false;
    if (m.tipo === 'Temporario' && m.data_fim && new Date() > m.data_fim) return false;
    return true;
  });
  if (medsAtivas.length > 0) {
    medText = '\nMEDICAÇÕES/SUPLEMENTOS EM USO:\n' + medsAtivas.map(m => `- ${m.nome} (${m.dosagem}) - ${m.frequencia} [${m.tipo}]`).join('\n');
  }

  let condicoes = [];
  if (perfil.hipertenso) condicoes.push('Hipertenso(a)');
  if (perfil.diabetico) condicoes.push('Diabético(a)');
  if (perfil.fumante) condicoes.push('Fumante');
  if (perfil.sedentario) condicoes.push('Sedentário(a)');
  if (perfil.usaMedicacao) condicoes.push('Usa medicação para pressão');
  
  const historicoClinicoText = condicoes.length > 0 ? `\n- Histórico Clínico: ${condicoes.join(', ')}` : '';
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

  return `Você é um médico especialista assistente de saúde cardiovascular.
Forneça uma análise amigável, clara e encorajadora para a aferição de pressão arterial a seguir.

DADOS DO PACIENTE:
- Nome: ${perfil.nome} (${sexo}, ${idade} anos, ${pesoFinal} kg${imcText}${historicoClinicoText}${medText})
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

// ── Gerar Feedback de IA (com fallback em cascata) ──────────────
export const gerarFeedbackIA = async (
  leitura: BpReading,
  perfil: UserProfile,
  historico: BpReading[]
): Promise<string> => {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.warn('[IA] Nenhuma chave de API configurada. Usando feedback local.');
    return gerarFeedbackLocal(leitura);
  }

  // Import dinâmico de serviços
  const { buscarMedications } = await import('./medications');
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

  const medicacoes = await buscarMedications(perfil.uid);
  const prompt = montarPromptAnalise(leitura, perfil, historico, medicacoes, aguaBebida, pesoHistorico);


  try {
    const resultado = await comFallback(ANALISE_MODELS, async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.4,
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      if (!text || text.length < 20) {
        throw new Error('Resposta vazia ou inválida do modelo.');
      }

      return { text, modelName };
    });

    const textFinal = typeof resultado === 'string' ? resultado : resultado?.text;
    console.log('[IA DEBUG] Texto gerado (comprimento:', textFinal?.length, '):', JSON.stringify(textFinal?.slice(0, 200)));

    if (textFinal && textFinal.length >= 20) {
      console.info('[IA Análise] Análise gerada com sucesso.');
      return textFinal;
    }
    throw new Error('Texto de feedback inválido ou muito curto.');

  } catch (error: any) {
    console.error('[IA Análise] Todos os modelos falharam. Usando fallback local.', error?.message);
    return gerarFeedbackLocal(leitura);
  }
};



// ── Feedback local (fallback sem API) ──────────────────────────
const gerarFeedbackLocal = (leitura: BpReading): string => {
  const { sys, dia, pul } = leitura;
  const pressaoPulso = sys - dia;

  if (sys >= 180 || dia >= 120) {
    return `⚠️ CRISE HIPERTENSIVA! Sua pressão (${sys}/${dia} mmHg) está em nível de emergência. Procure atendimento médico imediatamente. Não espere, vá agora para a UPA ou pronto-socorro.`;
  } else if (sys >= 140 || dia >= 90) {
    return `Sua pressão está em Hipertensão Estágio ${sys >= 160 || dia >= 100 ? '2' : '1'} (${sys}/${dia} mmHg), acima do limite da OMS. Recomendamos consultar seu médico para avaliação. Reduza o sódio, evite álcool e faça exercícios leves diariamente.`;
  } else if (sys >= 130 || dia >= 80) {
    return `Sua pressão está no limiar da Hipertensão Estágio 1 (${sys}/${dia} mmHg). Atenção à dieta com menos sal, beba bastante água e diminua o estresse. Uma consulta médica preventiva é recomendada.`;
  } else if (sys >= 120 && dia < 80) {
    return `Pressão ligeiramente elevada (${sys}/${dia} mmHg) — categoria "Elevada" pela OMS. Mantenha hábitos saudáveis: menos sódio, mais atividade física e boa hidratação. Monitore com frequência.`;
  } else if (sys < 90 || dia < 60) {
    return `Sua pressão está baixa (${sys}/${dia} mmHg). Mantenha-se hidratado, evite levantar bruscamente e descanse. Se sentir tontura, fraqueza ou desmaio, consulte um médico.`;
  } else {
    const dicaPulso = pressaoPulso > 60
      ? ' Atenção: sua pressão de pulso está um pouco elevada, vale mencionar ao médico.'
      : '';
    return `Ótimo! Pressão normal (${sys}/${dia} mmHg) e pulso de ${pul} bpm — dentro dos parâmetros ideais da OMS. Continue com seus hábitos saudáveis.${dicaPulso}`;
  }
};

// ── Gerar Laudo de Conduta OMS Integrado ─────────────────────────────
export const gerarRelatorioCondutaOMS = async (uid: string, perfil: UserProfile, dias: number): Promise<string> => {
  const historico = await buscarAfericoes(uid, dias);
  
  if (!historico || historico.length === 0) {
    return "Não há aferições suficientes no período selecionado para gerar um laudo.";
  }

  const { buscarMedications } = await import('./medications');
  const { buscarAguaDoDia } = await import('./agua');
  const { buscarHistoricoPeso } = await import('./auth');
  const { buscarGlicemias } = await import('./glicemia');

  const medicacoes = await buscarMedications(uid);
  let medText = '';
  const medsAtivas = medicacoes.filter(m => {
    if (!m.ativa) return false;
    if (m.tipo === 'Temporario' && m.data_fim && new Date() > m.data_fim) return false;
    return true;
  });
  if (medsAtivas.length > 0) {
    medText = '\n\nMEDICAÇÕES/SUPLEMENTOS EM USO:\n' + medsAtivas.map(m => `- ${m.nome} (${m.dosagem}) - ${m.frequencia} [${m.tipo}]`).join('\n');
  }

  // Obter logs de consumo de água no período do laudo
  const aguaLogs: Array<{ data: string, amount: number }> = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const waterLog = await buscarAguaDoDia(uid, dateStr);
    if (waterLog && waterLog.amount_ml > 0) {
      aguaLogs.push({ data: d.toLocaleDateString('pt-BR'), amount: waterLog.amount_ml });
    }
  }
  const aguaTexto = aguaLogs.length > 0
    ? aguaLogs.map(a => `- ${a.data}: ${a.amount} mL`).join('\n')
    : 'Nenhum registro de consumo de água no período.';

  // Obter evolução de peso e IMC
  const pesos = await buscarHistoricoPeso(uid);
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);
  const pesosPeriodo = pesos.filter(p => p.data >= dataLimite);
  const pesoTexto = pesosPeriodo.length > 0
    ? pesosPeriodo.map(p => `- ${p.data.toLocaleDateString('pt-BR')}: ${p.peso} kg`).join('\n')
    : `- Peso atual: ${perfil.peso} kg`;

  let imcTexto = 'IMC não calculado (altura não informada)';
  if (perfil.altura && perfil.peso) {
    const alturaM = perfil.altura / 100;
    const imcVal = (perfil.peso / (alturaM * alturaM)).toFixed(1);
    let classif = '';
    const imc = parseFloat(imcVal);
    if (imc < 18.5) classif = 'Abaixo do peso';
    else if (imc < 25) classif = 'Peso normal';
    else if (imc < 30) classif = 'Sobrepeso';
    else if (imc < 35) classif = 'Obesidade Grau I';
    else if (imc < 40) classif = 'Obesidade Grau II';
    else classif = 'Obesidade Grau III';
    imcTexto = `${imcVal} kg/m² (${classif})`;
  }

  // Obter registros de glicemia no período
  let glicemiaTexto = 'Sem registros de glicemia no período.';
  try {
    const glicemias = await buscarGlicemias(uid, dias);
    if (glicemias && glicemias.length > 0) {
      glicemiaTexto = glicemias.map(g => `- ${new Date(g.data_hora_afericao).toLocaleString('pt-BR')}: ${g.valor} mg/dL (${g.momento || 'Glicemia'})`).join('\n');
    }
  } catch (errGlic) {
    console.warn('[Laudo IA] Erro ao carregar glicemia para laudo:', errGlic);
  }

  let condicoes = [];
  if (perfil.hipertenso) condicoes.push('Hipertenso(a)');
  if (perfil.diabetico) condicoes.push('Diabético(a)');
  if (perfil.fumante) condicoes.push('Fumante');
  if (perfil.sedentario) condicoes.push('Sedentário(a)');
  if (perfil.usaMedicacao) condicoes.push('Usa medicação contínua');
  
  const historicoClinicoText = condicoes.length > 0 ? `\nHistórico Clínico Declarado: ${condicoes.join(', ')}` : '\nNenhuma comorbidade prévia declarada.';

  const prompt = `Você é um médico especialista em cardiologia e endocrinologia, seguindo rigorosamente as diretrizes da Organização Mundial da Saúde (OMS), SBC e SBD.
Analise de forma INTEGRADA e MULTIDISCIPLINAR todo o histórico de saúde do paciente nos últimos ${dias} dias.
RESPONDA SEMPRE EM PORTUGUÊS DO BRASIL. NÃO INVENTE DADOS QUE NÃO ESTEJAM NO HISTÓRICO.

DADOS CLÍNICOS E PERFIL DO PACIENTE:
- Nome: ${perfil.nome}
- Idade: ${perfil.idade} anos
- Sexo: ${perfil.sexo}
- Altura: ${perfil.altura ? perfil.altura + ' cm' : 'Não informada'}
- Peso Atual: ${perfil.peso} kg
- Índice de Massa Corporal (IMC): ${imcTexto}
- ${historicoClinicoText}${medText}

EVOLUÇÃO DO PESO NO PERÍODO:
${pesoTexto}

CONSUMO DIÁRIO DE ÁGUA REGISTRADO NO PERÍODO:
${aguaTexto}

REGISTROS DE GLICEMIA (GLICOSE):
${glicemiaTexto}

HISTÓRICO DE AFERIÇÕES DE PRESSÃO ARTERIAL (SISTÓLICA/DIASTÓLICA - PULSO):
${historico.map(a => `- ${a.data_hora_afericao.toLocaleString('pt-BR')}: ${a.sys}/${a.dia} mmHg, Pulso: ${a.pul} bpm`).join('\n')}

INSTRUÇÕES E ESTRUTURA DO LAUDO DE CONDUTA INTEGRADO (em Markdown):
Elabore um "Relatório de Conduta Clínica Integrada" correlacionando TODOS os marcadores acima:

1. **Resumo do Quadro Geral de Saúde**: Avalie a pressão arterial (médias, picos e variabilidade) e correlacione com o estado glicêmico e o IMC do paciente.
2. **Análise de Fatores Cruzados (Hidratação, Peso e Medicações)**:
   - Qual a relação entre a hidratação diária reportada e a oscilação da pressão arterial?
   - Como o IMC e a variação de peso impactam o controle cardiovascular e metabólico?
   - As medicações registradas estão alinhadas aos achados das aferições?
3. **Conduta Alimentar e de Estilo de Vida**: Recomendações práticas e personalizadas (ex: ingestão meta de água em litros segundo IMC/OMS, controle de sódio e carboidratos, atividade física recomendada).
4. **Conduta Médica Sugerida (OMS/SBC/SBD)**: Classificação do risco geral e orientação clara sobre o nível de urgência médica (manter acompanhamento de rotina ou buscar atendimento médico imediato/especializado).

Lembre-se: O tom deve ser altamente profissional, técnico e ao mesmo tempo acolhedor. Exiba sempre um aviso final de que este laudo é uma análise automatizada de apoio e NÃO substitui uma consulta médica presencial. Use negritos e emojis sutilmente.`;

  try {
    const resultado = await comFallback(
      ANALISE_MODELS, 
      async (modelName) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.3 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (!text || text.length < 50) throw new Error('Resposta inválida.');
        return { text, modelName };
      },
      prompt
    );
    console.info(`[IA Laudo] Modelo usado: ${resultado.modelName}`);
    
    try {
      await addDoc(collection(db, 'laudos'), {
        user_id: uid,
        conteudo: resultado.text,
        modelo_usado: resultado.modelName,
        dias_analisados: dias,
        data_geracao: new Date(),
        ativo: true
      });
    } catch (dbErr) {
      console.error('[IA Laudo] Erro ao salvar laudo no banco:', dbErr);
    }

    return resultado.text;
  } catch (error: any) {
    console.error('[IA Laudo] Erro:', error);
    return "Desculpe, ocorreu um erro ao gerar o laudo da IA. Verifique sua conexão e tente novamente mais tarde.";
  }
};

