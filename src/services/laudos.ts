import { logger } from '../services/logger';
/**
 * Serviço de Laudos Clínicos e Relatórios de Conduta OMS Integrados.
 */
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { UserProfile, BpReading } from '../types';
import { comFallback, genAI, ANALISE_MODELS } from './ai-config';
import { parseFirestoreDate } from './utils';
import { buscarAfericoes } from './afericoes';

export interface SavedLaudo {
  id: string;
  user_id: string;
  conteudo: string;
  modelo_usado?: string;
  dias_analisados?: number;
  data_geracao: Date;
  ativo?: boolean;
}

// Buscar Laudos do Usuário
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
    logger.error('[laudos] Erro ao buscar laudos:', err);
    return [];
  }
};

// Inativar Laudo (Soft Delete)
export const inativarLaudo = async (laudoId: string): Promise<void> => {
  try {
    const laudoRef = doc(db, 'laudos', laudoId);
    await updateDoc(laudoRef, {
      ativo: false,
      data_inativacao: new Date()
    });
  } catch (err) {
    logger.error('[laudos] Erro ao inativar laudo:', err);
    throw err;
  }
};

function calcularTextoImcLaudo(perfil: UserProfile): string {
  if (!perfil.altura || !perfil.peso) return 'IMC não calculado (altura não informada)';
  const alturaM = perfil.altura / 100;
  const imcVal = (perfil.peso / (alturaM * alturaM)).toFixed(1);
  const imc = parseFloat(imcVal);
  let classif = 'Obesidade Grau III';
  if (imc < 18.5) classif = 'Abaixo do peso';
  else if (imc < 25) classif = 'Peso normal';
  else if (imc < 30) classif = 'Sobrepeso';
  else if (imc < 35) classif = 'Obesidade Grau I';
  else if (imc < 40) classif = 'Obesidade Grau II';
  return `${imcVal} kg/m² (${classif})`;
}

async function coletarMedicacoesLaudo(uid: string): Promise<string> {
  const { buscarMedications } = await import('./medications');
  const medicacoes = await buscarMedications(uid);
  const medsAtivas = medicacoes.filter(m => {
    if (!m.ativa) return false;
    if (m.tipo === 'Temporario' && m.data_fim && new Date() > m.data_fim) return false;
    return true;
  });
  if (medsAtivas.length === 0) return '';
  return '\n\nMEDICAÇÕES/SUPLEMENTOS EM USO:\n' + medsAtivas.map(m => `- ${m.nome} (${m.dosagem}) - ${m.frequencia} [${m.tipo}]`).join('\n');
}

async function coletarAguaLaudo(uid: string, dias: number): Promise<string> {
  const { buscarAguaDoDia } = await import('./agua');
  const aguaLogs: Array<{ data: string; amount: number }> = [];
  for (let i = 0; i < dias; i++) {
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
    : 'Nenhum registro de consumo de água no período.';
}

async function coletarPesoLaudo(uid: string, perfil: UserProfile, dias: number): Promise<string> {
  const { buscarHistoricoPeso } = await import('./peso');
  const pesos = await buscarHistoricoPeso(uid);
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);
  const pesosPeriodo = pesos.filter(p => p.data >= dataLimite);
  return pesosPeriodo.length > 0
    ? pesosPeriodo.map(p => `- ${p.data.toLocaleDateString('pt-BR')}: ${p.peso} kg`).join('\n')
    : `- Peso atual: ${perfil.peso} kg`;
}

async function coletarGlicemiaLaudo(uid: string, dias: number): Promise<string> {
  const { buscarGlicemias } = await import('./glicemia');
  try {
    const glicemias = await buscarGlicemias(uid, dias);
    if (glicemias && glicemias.length > 0) {
      return glicemias.map(g => `- ${new Date(g.data_hora_afericao).toLocaleString('pt-BR')}: ${g.valor} mg/dL (${g.momento || 'Glicemia'})`).join('\n');
    }
  } catch (errGlic) {
    logger.warn('[Laudo IA] Erro ao carregar glicemia para laudo:', errGlic);
  }
  return 'Sem registros de glicemia no período.';
}

interface DadosPromptLaudo {
  perfil: UserProfile;
  dias: number;
  imcTexto: string;
  medText: string;
  aguaTexto: string;
  pesoTexto: string;
  glicemiaTexto: string;
  historico: BpReading[];
}

function montarPromptLaudoIntegrado(dados: DadosPromptLaudo): string {
  const { perfil, dias, imcTexto, medText, aguaTexto, pesoTexto, glicemiaTexto, historico } = dados;
  const condicoes: string[] = [];
  if (perfil.hipertenso) condicoes.push('Hipertenso(a)');
  if (perfil.diabetico) condicoes.push('Diabético(a)');
  if (perfil.fumante) condicoes.push('Fumante');
  if (perfil.sedentario) condicoes.push('Sedentário(a)');
  if (perfil.usaMedicacao) condicoes.push('Usa medicação contínua');
  const historicoClinicoText = condicoes.length > 0 ? `\nHistórico Clínico Declarado: ${condicoes.join(', ')}` : '\nNenhuma comorbidade prévia declarada.';

  return `Você é um médico especialista em cardiologia e endocrinologia, seguindo rigorosamente as diretrizes da Organização Mundial da Saúde (OMS), SBC e SBD.
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
}

async function persistirLaudoGerado(uid: string, conteudo: string, modeloUsado: string, dias: number): Promise<void> {
  try {
    await addDoc(collection(db, 'laudos'), {
      user_id: uid,
      conteudo,
      modelo_usado: modeloUsado,
      dias_analisados: dias,
      data_geracao: new Date(),
      ativo: true
    });
  } catch (dbErr) {
    logger.error('[IA Laudo] Erro ao salvar laudo no banco:', dbErr);
  }
}

// Gerar Laudo de Conduta OMS Integrado
export const gerarRelatorioCondutaOMS = async (uid: string, perfil: UserProfile, dias: number): Promise<string> => {
  const historico = await buscarAfericoes(uid, dias);
  if (!historico || historico.length === 0) {
    return "Não há aferições suficientes no período selecionado para gerar um laudo.";
  }

  const [medText, aguaTexto, pesoTexto, glicemiaTexto] = await Promise.all([
    coletarMedicacoesLaudo(uid),
    coletarAguaLaudo(uid, dias),
    coletarPesoLaudo(uid, perfil, dias),
    coletarGlicemiaLaudo(uid, dias)
  ]);

  const imcTexto = calcularTextoImcLaudo(perfil);
  const prompt = montarPromptLaudoIntegrado({ perfil, dias, imcTexto, medText, aguaTexto, pesoTexto, glicemiaTexto, historico });

  try {
    const resultado = await comFallback<{ text: string; modelName: string }>(
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

    logger.info(`[IA Laudo] Modelo usado: ${resultado.modelName}`);
    await persistirLaudoGerado(uid, resultado.text, resultado.modelName, dias);
    return resultado.text;
  } catch (error: unknown) {
    logger.error('[IA Laudo] Erro:', error);
    return "Desculpe, ocorreu um erro ao gerar o laudo da IA. Verifique sua conexão e tente novamente mais tarde.";
  }
};
