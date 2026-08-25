/**
 * Configuração centralizada dos modelos de IA (Google Gemini)
 * com suporte a execução Server-Side (Cloud Functions) e
 * mecanismo de fallback automático em cascata (Gemini -> Groq).
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// ── Modelos para OCR/Visão ───────────────────────────────────────
export const OCR_MODELS = [
  'gemini-2.0-flash',       // Estável com visão
  'gemini-1.5-flash',       // Fallback leve com visão
];

// ── Modelos para Análise/Raciocínio ─────────────────────────────
export const ANALISE_MODELS = [
  'gemini-2.0-flash',       // Primário estável
  'gemini-1.5-flash',       // Fallback leve e rápido
];

/**
 * Tenta executar a análise via Cloud Function (Backend Server-Side Seguro).
 * Se o backend responder, a execução é feita sem expor chaves no cliente.
 */
export async function executarViaCloudFunction(
  prompt: string,
  imageBase64?: string,
  mimeType?: string
): Promise<{ text: string; modelName: string }> {
  const callable = httpsCallable<
    { prompt: string; imageBase64?: string; mimeType?: string },
    { result: string; provider: string; model: string }
  >(functions, 'analyzeData');

  const response = await callable({ prompt, imageBase64, mimeType });
  if (response.data?.result) {
    return {
      text: response.data.result,
      modelName: `${response.data.provider}/${response.data.model} (server-side)`,
    };
  }
  throw new Error('Resposta vazia da Cloud Function.');
}

/**
 * Realiza uma chamada de fallback para a API do Groq usando o modelo Llama-3.3-70b-versatile.
 */
export async function chamarGroqFallback(prompt: string): Promise<string> {
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || '';
  if (!groqApiKey) {
    throw new Error('Chave do Groq não configurada.');
  }

  console.info('[IA] Tentando fallback com Groq (llama-3.3-70b-versatile)...');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Erro na API do Groq: ${response.statusText} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text || text.length < 20) {
    throw new Error('Resposta do Groq vazia ou muito curta.');
  }
  return text;
}

/**
 * Executa uma chamada Gemini com fallback automático em cascata.
 * 1. Se prompt for fornecido, tenta executar primeiro via Cloud Function (Server-Side).
 * 2. Se a Cloud Function não estiver disponível, tenta a cascata de modelos Gemini no cliente.
 * 3. Se todos os modelos do Gemini falharem, tenta usar o Groq como fallback final de texto.
 *
 * @param modelos Lista de models a tentar, em ordem de prioridade
 * @param executor Função que recebe o nome do modelo e retorna a Promise
 * @param prompt Opcional. Prompt original para ser enviado à Cloud Function ou Groq
 * @returns O resultado do primeiro provedor/modelo que responder com sucesso
 */
export async function comFallback<T>(
  modelos: string[],
  executor: (modelName: string) => Promise<T>,
  prompt?: string
): Promise<T> {
  // 1. Camada Primária: Server-Side Cloud Function (quando prompt estiver presente)
  if (prompt && typeof prompt === 'string' && prompt.length > 0) {
    try {
      console.info('[IA] Tentando execução via Cloud Function (server-side)...');
      const cfResult = await executarViaCloudFunction(prompt);
      console.info('[IA] Sucesso via Cloud Function server-side!');
      return cfResult as unknown as T;
    } catch (cfErr: any) {
      console.warn('[IA] Cloud Function indisponível ou offline. Ativando cascata do cliente:', cfErr?.message);
    }
  }

  // 2. Cascata Local do Cliente (Google Gemini)
  let ultimoErro: Error | null = null;

  for (const modelName of modelos) {
    try {
      console.info(`[IA] Tentando modelo: ${modelName}`);
      const resultado = await executor(modelName);
      console.info(`[IA] Sucesso com modelo: ${modelName}`);
      return resultado;
    } catch (err: any) {
      ultimoErro = err;
      const status = err?.status || err?.httpErrorCode || 0;
      const msg = err?.message?.toLowerCase() || '';

      const isApiKeyError = status === 401 || (status === 403 && (msg.includes('api key') || msg.includes('apikey')));
      if (isApiKeyError) {
        console.error(`[IA] Erro fatal de chave de API no modelo ${modelName}. Tentando fallback geral.`);
        break;
      }

      console.warn(`[IA] Modelo ${modelName} falhou (${err?.message?.slice(0, 80)}). Tentando fallback...`);
    }
  }

  // 3. Fallback Final de Texto (Groq / Llama)
  if (prompt) {
    try {
      const text = await chamarGroqFallback(prompt);
      return { text, modelName: 'groq/llama-3.3-70b-versatile' } as unknown as T;
    } catch (groqErr: any) {
      console.error('[IA] Fallback do Groq também falhou:', groqErr?.message);
      ultimoErro = groqErr;
    }
  }

  throw ultimoErro || new Error('[IA] Todos os modelos e fallbacks falharam. Verifique sua conexão ou chave de API.');
}


