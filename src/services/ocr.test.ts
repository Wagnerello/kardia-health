import { describe, it, expect, vi } from 'vitest';
import { obterMimeType, processarImagemOCR } from './ocr';

// Mock de ai-config
vi.mock('./ai-config', () => ({
  OCR_MODELS: ['gemini-2.5-flash'],
  genAI: {
    getGenerativeModel: vi.fn()
  },
  comFallback: vi.fn()
}));

describe('Serviço de OCR e Processamento de Imagem (ocr.ts)', () => {
  describe('obterMimeType', () => {
    it('deve retornar o mime type suportado do arquivo', () => {
      const fPng = new File([''], 'test.png', { type: 'image/png' });
      expect(obterMimeType(fPng)).toBe('image/png');

      const fWebp = new File([''], 'test.webp', { type: 'image/webp' });
      expect(obterMimeType(fWebp)).toBe('image/webp');
    });

    it('deve aplicar fallback para image/jpeg quando o tipo for desconhecido', () => {
      const fDesconhecido = new File([''], 'test.bin', { type: 'application/octet-stream' });
      expect(obterMimeType(fDesconhecido)).toBe('image/jpeg');
    });
  });

  describe('processarImagemOCR', () => {
    it('deve extrair valores de pressão e pulso com sucesso do JSON do modelo', async () => {
      const { comFallback } = await import('./ai-config');
      (comFallback as any).mockImplementationOnce(async (_models: any, _callback: any) => {
        return {
          data: {
            sys: 128,
            dia: 82,
            pul: 74,
            confianca: 'alta'
          },
          modelName: 'gemini-2.5-flash',
          rawText: '{"sys": 128, "dia": 82, "pul": 74, "confianca": "alta"}'
        };
      });

      const resultado = await processarImagemOCR('fake-base64', 'image/jpeg');

      expect(resultado.sys).toBe(128);
      expect(resultado.dia).toBe(82);
      expect(resultado.pul).toBe(74);
      expect(resultado.confianca).toBe('alta');
      expect(resultado.modelo_usado).toBe('gemini-2.5-flash');
    });

    it('deve retornar confiança baixa e não quebrar a aplicação quando o OCR falhar', async () => {
      const { comFallback } = await import('./ai-config');
      (comFallback as any).mockRejectedValueOnce(new Error('Quota exceeded / Foto ilegível'));

      const resultado = await processarImagemOCR('fake-base64');

      expect(resultado.confianca).toBe('baixa');
      expect(resultado.texto_bruto).toContain('Quota exceeded');
      expect(resultado.sys).toBeUndefined();
    });
  });
});
