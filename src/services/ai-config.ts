import { logger } from '../services/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// ── Modelos para OCR/Visão ───────────────────────────────────────
export const OCR_MODELS = [
  'gemini-2.5-flash',       // Primário multimodal moderno e de alta precisão
  'gemini-flash-latest',    // Fallback sempre atualizado
  'gemini-3.5-flash-lite',  // Fallback ultra-rápido de alta resiliência
];

// ── Modelos para Análise/Raciocínio ─────────────────────────────
// Somente texto. O Groq é acionado automaticamente se todos falharem.
export const ANALISE_MODELS = [
  'gemini-2.5-flash',       // Primário de alta acurácia médica
  'gemini-flash-latest',    // Fallback sempre atualizado
  'gemini-3.5-flash-lite',  // Fallback leve e rápido
];

// ── Erros que devem acionar o fallback ─────────────────────────
// Inclui: sem cota (429), modelo indisponível (503/404), timeout

const GROQ_FALLBACK_MODELS = ['groq/compound', 'qwen/qwen3.8-27b', 'groq/compound-mini'];

async function enviarRequisicaoGroq(prompt: string, modelo: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Erro na API do Groq (${modelo}): ${response.statusText} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text || text.length < 10) {
    throw new Error(`Resposta do Groq (${modelo}) vazia ou muito curta.`);
  }
  return text;
}

/**
 * Realiza uma chamada de fallback para a API do Groq com modelos atualizados.
 * NOTA DE SEGURANÇA: O uso do Groq via client-side expõe a VITE_GROQ_API_KEY no bundle.
 * Idealmente, esta chamada deve ser migrada para uma Cloud Function no futuro.
 */
async function chamarGroqFallback(prompt: string): Promise<{ text: string; modelName: string }> {
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || '';
  if (!groqApiKey) {
    throw new Error('Chave do Groq não configurada.');
  }

  let ultimoErroGroq: Error | null = null;
  for (const modeloGroq of GROQ_FALLBACK_MODELS) {
    try {
      logger.info(`[IA] Tentando fallback com Groq (${modeloGroq})...`);
      const text = await enviarRequisicaoGroq(prompt, modeloGroq, groqApiKey);
      return { text, modelName: `groq/${modeloGroq}` };
    } catch (err) {
      ultimoErroGroq = err instanceof Error ? err : new Error(String(err));
      logger.warn(`[IA] Modelo Groq ${modeloGroq} falhou. Tentando próximo se houver...`);
    }
  }

  throw ultimoErroGroq || new Error('Todos os modelos do Groq falharam.');
}

interface CustomErrorLike {
  status?: number;
  httpErrorCode?: number;
  message?: string;
}

function extrairDetalhesErro(err: unknown): { status: number; message: string; isFatalApiKey: boolean } {
  const custom = (err && typeof err === 'object' ? err : {}) as CustomErrorLike;
  const status = custom.status || custom.httpErrorCode || 0;
  const message = (err instanceof Error ? err.message : custom.message || String(err)).toLowerCase();
  const isFatalApiKey = status === 401 || (status === 403 && (message.includes('api key') || message.includes('apikey')));
  return { status, message, isFatalApiKey };
}

async function tentarExecutarFallbackGroq<T>(prompt: string): Promise<T> {
  const resultado = await chamarGroqFallback(prompt);
  return resultado as unknown as T;
}

/**
 * Executa uma chamada Gemini com fallback automático em cascata.
 * Se o modelo primário falhar com erro recuperável, tenta o próximo.
 * Se todos os modelos do Gemini falharem, tenta usar o Groq como fallback final de texto.
 *
 * @param modelos Lista de models a tentar, em ordem de prioridade
 * @param executor Função que recebe o nome do modelo e retorna a Promise
 * @param prompt Opcional. Prompt original para ser enviado ao Groq se o Gemini falhar
 * @returns O resultado do primeiro modelo que responder com sucesso
 */
export async function comFallback<T>(
  modelos: string[],
  executor: (modelName: string) => Promise<T>,
  prompt?: string
): Promise<T> {
  let ultimoErro: Error | null = null;

  for (const modelName of modelos) {
    try {
      logger.info(`[IA] Tentando modelo: ${modelName}`);
      const resultado = await executor(modelName);
      logger.info(`[IA] Sucesso com modelo: ${modelName}`);
      return resultado;
    } catch (err: unknown) {
      ultimoErro = err instanceof Error ? err : new Error(String(err));
      const { isFatalApiKey, message } = extrairDetalhesErro(err);

      if (isFatalApiKey) {
        logger.error(`[IA] Erro fatal de chave de API no modelo ${modelName}. Tentando fallback geral.`);
        break;
      }
      logger.warn(`[IA] Modelo ${modelName} falhou (${message.slice(0, 80)}). Tentando fallback...`);
    }
  }

  if (prompt) {
    try {
      return await tentarExecutarFallbackGroq<T>(prompt);
    } catch (groqErr: unknown) {
      const msg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      logger.error('[IA] Fallback do Groq também falhou:', msg);
      ultimoErro = groqErr instanceof Error ? groqErr : new Error(msg);
    }
  }

  throw ultimoErro || new Error('[IA] Todos os modelos e fallbacks falharam. Verifique sua conexão ou chave de API.');
}
