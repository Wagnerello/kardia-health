/**
 * Configuração centralizada dos modelos de IA (Google Gemini)
 * com mecanismo de fallback automático em cascata.
 *
 * Estratégia de seleção de modelos (Julho 2026):
 *  - gemini-3.5-flash → Primário: visão + raciocínio, alta qualidade
 *  - gemini-3.1-pro   → Fallback: raciocínio avançado, mais lento
 *  - gemini-3.1-flash-lite → Fallback econômico: rápido e barato
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

export const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// ── Modelos para OCR/Visão ───────────────────────────────────────
export const OCR_MODELS = [
  'gemini-2.0-flash',       // Estável com visão
  'gemini-1.5-flash',       // Fallback leve com visão
];

// ── Modelos para Análise/Raciocínio ─────────────────────────────
// Somente texto. O Groq (Llama) é acionado automaticamente se todos falharem.
export const ANALISE_MODELS = [
  'gemini-2.0-flash',       // Primário estável
  'gemini-1.5-flash',       // Fallback leve e rápido
];

// ── Erros que devem acionar o fallback ─────────────────────────
// Inclui: sem cota (429), modelo indisponível (503/404), timeout

/**
 * Realiza uma chamada de fallback para a API do Groq usando o modelo Llama-3.3-70b-versatile.
 * NOTA DE SEGURANÇA: O uso do Groq via client-side expoem a VITE_GROQ_API_KEY no bundle.
 * Idealmente, esta chamada deve ser migrada para uma Cloud Function no futuro.
 */
async function chamarGroqFallback(prompt: string): Promise<string> {
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

  // Tenta o Groq como último fallback se o prompt de texto for fornecido
  if (prompt) {
    try {
      const text = await chamarGroqFallback(prompt);
      // Se a função esperava um objeto { text, modelName }, formata adequadamente
      return { text, modelName: 'groq/llama-3.3-70b-versatile' } as unknown as T;
    } catch (groqErr: any) {
      console.error('[IA] Fallback do Groq também falhou:', groqErr?.message);
      ultimoErro = groqErr;
    }
  }

  throw ultimoErro || new Error('[IA] Todos os modelos e fallbacks falharam. Verifique sua conexão ou chave de API.');
}

