import { logger } from '../services/logger';
import type { UserProfile, BpReading } from '../types';
import { comFallback, genAI, ANALISE_MODELS } from './ai-config';
import { buscarAfericoes } from './afericoes';
import {
  buscarLaudos,
  atualizarLaudo,
  criarLaudoManual,
  inativarLaudo,
  reativarLaudo,
  excluirLaudoPermanente,
  persistirLaudoGerado,
  type SavedLaudo,
  type FiltroPeriodoLaudo
} from './laudos-storage';

export {
  buscarLaudos,
  atualizarLaudo,
  criarLaudoManual,
  inativarLaudo,
  reativarLaudo,
  excluirLaudoPermanente,
  persistirLaudoGerado,
  type SavedLaudo,
  type FiltroPeriodoLaudo
};

function calcularTextoImcLaudo(perfil: UserProfile): string {
  if (!perfil.altura || !perfil.peso) return 'IMC não calculado (altura não informada)';
  const alturaM = perfil.altura / 100;
  const imcVal = (perfil.peso / (alturaM * alturaM)).toFixed(1);
  const imc = parseFloat(imcVal);

  if (imc < 18.5) return `${imcVal} kg/m² (Abaixo do peso ideal pela OMS)`;
  if (imc < 25) return `${imcVal} kg/m² (Peso saudável / Normal pela OMS)`;
  if (imc < 30) return `${imcVal} kg/m² (Sobrepeso / Pré-obesidade pela OMS)`;
  if (imc < 35) return `${imcVal} kg/m² (Obesidade Grau I pela OMS)`;
  if (imc < 40) return `${imcVal} kg/m² (Obesidade Grau II / Severa pela OMS)`;
  return `${imcVal} kg/m² (Obesidade Grau III / Mórbida pela OMS)`;
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

async function coletarAguaLaudo(uid: string, dtInicio: Date, dtFim: Date): Promise<string> {
  const { buscarAguaDoDia } = await import('./agua');
  const aguaLogs: Array<{ data: string; amount: number }> = [];
  
  const tempDate = new Date(dtInicio);
  let iteracoes = 0;
  while (tempDate <= dtFim && iteracoes < 365) {
    const dateStr = tempDate.toISOString().split('T')[0];
    const waterLog = await buscarAguaDoDia(uid, dateStr);
    if (waterLog && waterLog.amount_ml > 0) {
      aguaLogs.push({ data: tempDate.toLocaleDateString('pt-BR'), amount: waterLog.amount_ml });
    }
    tempDate.setDate(tempDate.getDate() + 1);
    iteracoes++;
  }

  return aguaLogs.length > 0
    ? aguaLogs.map(a => `- ${a.data}: ${a.amount} mL`).join('\n')
    : 'Nenhum registro de consumo de água no período selecionado.';
}

async function coletarPesoLaudo(uid: string, perfil: UserProfile, dtInicio: Date, dtFim: Date): Promise<string> {
  const { buscarHistoricoPeso } = await import('./peso');
  const pesos = await buscarHistoricoPeso(uid);
  const pesosPeriodo = pesos.filter(p => p.data >= dtInicio && p.data <= dtFim);
  return pesosPeriodo.length > 0
    ? pesosPeriodo.map(p => `- ${p.data.toLocaleDateString('pt-BR')}: ${p.peso} kg`).join('\n')
    : `- Peso atual: ${perfil.peso} kg`;
}

async function coletarGlicemiaLaudo(uid: string, dtInicio: Date, dtFim: Date): Promise<string> {
  const { buscarGlicemias } = await import('./glicemia');
  try {
    const glicemias = await buscarGlicemias(uid, 3650);
    const glicemiasFiltradas = glicemias.filter(g => {
      const dt = new Date(g.data_hora_afericao);
      return dt >= dtInicio && dt <= dtFim;
    });

    if (glicemiasFiltradas && glicemiasFiltradas.length > 0) {
      return glicemiasFiltradas.map(g => `- ${new Date(g.data_hora_afericao).toLocaleString('pt-BR')}: ${g.valor} mg/dL (${g.momento || 'Glicemia'})`).join('\n');
    }
  } catch (errGlic) {
    logger.warn('[Laudo IA] Erro ao carregar glicemia para laudo:', errGlic);
  }
  return 'Sem registros de glicemia no período selecionado.';
}

interface DadosPromptLaudo {
  perfil: UserProfile;
  periodoTexto: string;
  imcTexto: string;
  medText: string;
  aguaTexto: string;
  pesoTexto: string;
  glicemiaTexto: string;
  historico: BpReading[];
}

function montarPromptLaudoIntegrado(dados: DadosPromptLaudo): string {
  const { perfil, periodoTexto, imcTexto, medText, aguaTexto, pesoTexto, glicemiaTexto, historico } = dados;
  const condicoes: string[] = [];
  if (perfil.hipertenso) condicoes.push('Hipertenso(a)');
  if (perfil.diabetico) condicoes.push('Diabético(a)');
  if (perfil.fumante) condicoes.push('Fumante');
  if (perfil.sedentario) condicoes.push('Sedentário(a)');
  if (perfil.usaMedicacao) condicoes.push('Usa medicação contínua');
  const historicoClinicoText = condicoes.length > 0 ? `\nHistórico Clínico Declarado: ${condicoes.join(', ')}` : '\nNenhuma comorbidade prévia declarada.';

  return `Você é um médico cardiologista e endocrinologista experiente. Diretrizes OMS, SBC, SBD.
Responda em Português do Brasil com base estritamente no histórico.

PERÍODO ANALISADO: ${periodoTexto}
DADOS DO PACIENTE:
- Nome: ${perfil.nome}, ${perfil.idade} anos, ${perfil.sexo}
- Peso: ${perfil.peso} kg, Altura: ${perfil.altura ? perfil.altura + ' cm' : 'N/I'}
- IMC: ${imcTexto}${historicoClinicoText}${medText}

EVOLUÇÃO DO PESO: ${pesoTexto}
ÁGUA CONSUMIDA: ${aguaTexto}
GLICEMIA: ${glicemiaTexto}
AFERIÇÕES DE PRESSÃO ARTERIAL:
${historico.map(a => `- ${a.data_hora_afericao.toLocaleString('pt-BR')}: ${a.sys}/${a.dia} mmHg, Pulso: ${a.pul} bpm`).join('\n')}

ESTRUTURA DO LAUDO (Markdown):
1. **Resumo do Quadro Geral**: Avaliação da PA (médias/picos) correlacionada com glicemia e IMC.
2. **Análise Cruzada**: Hidratação vs Pressão, IMC/Peso vs Controle metabólico, alinhamento com medicações.
3. **Conduta e Estilo de Vida**: Recomendações práticas (meta de água em L, sódio, dieta, atividade física).
4. **Conduta Médica Sugerida (OMS/SBC)**: Classificação de risco e orientação sobre urgência/rotina.

Aviso final: Este laudo é gerado por IA como apoio à saúde e NÃO substitui consulta médica presencial.`;
}

export type ProgressoCallback = (etapa: number, total: number, mensagem: string) => void;

function calcularIntervaloDatasLaudo(periodo: number | FiltroPeriodoLaudo): { dtInicio: Date; dtFim: Date; diasCalculados: number; periodoTexto: string } {
  let dtInicio: Date;
  let dtFim: Date = new Date();
  let diasCalculados: number = 30;
  let periodoTexto: string = 'Últimos 30 dias';

  if (typeof periodo === 'number') {
    diasCalculados = periodo;
    dtInicio = new Date();
    dtInicio.setDate(dtInicio.getDate() - periodo);
    periodoTexto = `Últimos ${periodo} dias (${dtInicio.toLocaleDateString('pt-BR')} a ${dtFim.toLocaleDateString('pt-BR')})`;
  } else if (periodo.dataInicio && periodo.dataFim) {
    dtInicio = typeof periodo.dataInicio === 'string' ? new Date(`${periodo.dataInicio}T00:00:00`) : new Date(periodo.dataInicio);
    dtFim = typeof periodo.dataFim === 'string' ? new Date(`${periodo.dataFim}T23:59:59.999`) : new Date(periodo.dataFim);
    diasCalculados = Math.max(1, Math.ceil((dtFim.getTime() - dtInicio.getTime()) / (1000 * 60 * 60 * 24)));
    periodoTexto = `${dtInicio.toLocaleDateString('pt-BR')} até ${dtFim.toLocaleDateString('pt-BR')} (${diasCalculados} dias)`;
  } else if (periodo.dataInicio) {
    dtInicio = typeof periodo.dataInicio === 'string' ? new Date(`${periodo.dataInicio}T00:00:00`) : new Date(periodo.dataInicio);
    diasCalculados = Math.max(1, Math.ceil((dtFim.getTime() - dtInicio.getTime()) / (1000 * 60 * 60 * 24)));
    periodoTexto = `A partir de ${dtInicio.toLocaleDateString('pt-BR')} (${diasCalculados} dias)`;
  } else {
    const d = periodo.dias || 30;
    diasCalculados = d;
    dtInicio = new Date();
    dtInicio.setDate(dtInicio.getDate() - d);
    periodoTexto = `Últimos ${d} dias`;
  }

  return { dtInicio, dtFim, diasCalculados, periodoTexto };
}

// Gerar Laudo de Conduta OMS Integrado
export const gerarRelatorioCondutaOMS = async (
  uid: string,
  perfil: UserProfile,
  periodo: number | FiltroPeriodoLaudo = 30,
  onProgresso?: ProgressoCallback
): Promise<{ text: string; modelName: string; periodoTexto: string; diasAnalisados: number }> => {
  const { dtInicio, dtFim, diasCalculados, periodoTexto } = calcularIntervaloDatasLaudo(periodo);

  onProgresso?.(1, 4, `Coletando histórico (${periodoTexto})...`);
  const todasAfericoes = await buscarAfericoes(uid, 3650);
  const historico = todasAfericoes.filter(a => a.data_hora_afericao >= dtInicio && a.data_hora_afericao <= dtFim);

  if (!historico || historico.length === 0) {
    throw new Error(`Não há aferições registradas no período selecionado (${periodoTexto}) para gerar o laudo.`);
  }

  onProgresso?.(2, 4, 'Cruzando sinais vitais (Glicemia, Hidratação, IMC e Medicamentos)...');
  const [medText, aguaTexto, pesoTexto, glicemiaTexto] = await Promise.all([
    coletarMedicacoesLaudo(uid),
    coletarAguaLaudo(uid, dtInicio, dtFim),
    coletarPesoLaudo(uid, perfil, dtInicio, dtFim),
    coletarGlicemiaLaudo(uid, dtInicio, dtFim)
  ]);

  const imcTexto = calcularTextoImcLaudo(perfil);
  const prompt = montarPromptLaudoIntegrado({ perfil, periodoTexto, imcTexto, medText, aguaTexto, pesoTexto, glicemiaTexto, historico });

  onProgresso?.(3, 4, 'Processando raciocínio cardiovascular com IA Médica...');
  const resultado = await comFallback<{ text: string; modelName: string }>(
    ANALISE_MODELS, 
    async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { maxOutputTokens: 8000, temperature: 0.3 },
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (!text || text.length < 50) throw new Error('Resposta inválida ou vazia.');
      return { text, modelName };
    },
    prompt
  );

  onProgresso?.(4, 4, 'Formatando laudo estruturado...');
  await persistirLaudoGerado(uid, resultado.text, resultado.modelName, diasCalculados, periodoTexto);

  return {
    text: resultado.text,
    modelName: resultado.modelName,
    periodoTexto,
    diasAnalisados: diasCalculados
  };
};
