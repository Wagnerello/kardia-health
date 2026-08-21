/**
 * Serviço de OCR para leitura de medidores de pressão arterial.
 * Usa o Google Gemini com fallback automático de modelos.
 */
import { comFallback, genAI, OCR_MODELS } from './ai-config';

export interface OcrResult {
  sys?: number;
  dia?: number;
  pul?: number;
  data_hora?: Date;
  confianca: 'alta' | 'media' | 'baixa';
  texto_bruto?: string;
  modelo_usado?: string;
}

const PROMPT_OCR = `Analise esta imagem de um medidor de pressão arterial digital (esfigmomanômetro).

REGRAS IMPORTANTES:
- Ignore reflexos, brilhos, sombras e artefatos visuais.
- Foque APENAS nos números mostrados no visor LCD/LED.
- SYS (sistólica): o número maior, normalmente no topo ou à esquerda. Geralmente entre 90 e 200.
- DIA (diastólica): o número menor. Geralmente entre 50 e 130.
- PUL (pulso/BPM): frequência cardíaca. Geralmente entre 40 e 180.
- Se o medidor mostrar um símbolo de batimento irregular (arritmia), ignore-o para os valores numéricos.
- Não confunda o símbolo "AVG" ou "M" (memória) com um número.

Retorne SOMENTE um JSON válido (sem markdown, sem texto extra) com esta estrutura exata:
{
  "sys": número ou null,
  "dia": número ou null,
  "pul": número ou null,
  "data_hora": "string ISO ou null (apenas se o aparelho mostrar data/hora)",
  "confianca": "alta" | "media" | "baixa"
}

Critérios de confiança:
- "alta": imagem nítida, todos os 3 valores claramente visíveis e plausíveis
- "media": imagem com alguma distorção ou 1 valor duvidoso
- "baixa": imagem muito borrada, reflexo intenso ou valores implausíveis`;

/**
 * Processa uma imagem com OCR usando Gemini (com fallback automático).
 */
export const processarImagemOCR = async (imagemBase64: string, mimeType: string = 'image/jpeg'): Promise<OcrResult> => {
  try {
    const resultado = await comFallback(OCR_MODELS, async (modelName) => {
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent([
        PROMPT_OCR,
        {
          inlineData: {
            data: imagemBase64,
            mimeType: mimeType as any,
          },
        },
      ]);

      const text = result.response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanText);

      return { data, modelName, rawText: text };
    });

    return {
      sys: resultado.data.sys ?? undefined,
      dia: resultado.data.dia ?? undefined,
      pul: resultado.data.pul ?? undefined,
      data_hora: resultado.data.data_hora ? new Date(resultado.data.data_hora) : undefined,
      confianca: resultado.data.confianca || 'media',
      texto_bruto: resultado.rawText,
      modelo_usado: resultado.modelName,
    };

  } catch (error: any) {
    console.error('[OCR] Todos os modelos falharam:', error);
    return {
      confianca: 'baixa',
      texto_bruto: String(error?.message || error),
    };
  }
};

/**
 * Converte um arquivo de imagem para base64.
 */
export const arquivoParaBase64 = (arquivo: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(arquivo);
  });
};

/**
 * Retorna o MIME type do arquivo para passar ao Gemini corretamente.
 */
export const obterMimeType = (arquivo: File): string => {
  const mime = arquivo.type || 'image/jpeg';
  const suportados = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  return suportados.includes(mime) ? mime : 'image/jpeg';
};

/**
 * Extrai URL de preview da imagem.
 */
export const criarUrlPreview = (arquivo: File): string => {
  return URL.createObjectURL(arquivo);
};

/**
 * Comprime a imagem antes do envio para reduzir custo de tokens.
 */
export const comprimirImagem = (arquivo: File, qualidade: number = 0.85): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      const maxW = 1280;
      const ratio = Math.min(maxW / img.width, maxW / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], arquivo.name, { type: 'image/jpeg' }));
          } else {
            resolve(arquivo);
          }
        },
        'image/jpeg',
        qualidade
      );
    };

    img.onerror = () => {
      resolve(arquivo); // Retorna original se falhar ao carregar no canvas
    };

    img.src = URL.createObjectURL(arquivo);
  });
};
