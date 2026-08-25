import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';

describe('Matriz de Sanitização e Proteção contra XSS (Edge Cases & Segurança)', () => {
  it('deve neutralizar tags <script> maliciosas em campos de texto livre', () => {
    const payloadMalicioso = '<script>alert("hacked")</script>Losartana 50mg';
    const sanitizado = DOMPurify.sanitize(payloadMalicioso);
    
    expect(sanitizado).not.toContain('<script>');
    expect(sanitizado).toBe('Losartana 50mg');
  });

  it('deve remover manipuladores de eventos inline (onerror, onload, onclick)', () => {
    const payloadComEvento = '<img src="x" onerror="alert(1)">Pressão alta após almoço';
    const sanitizado = DOMPurify.sanitize(payloadComEvento);

    expect(sanitizado).not.toContain('onerror');
  });

  it('deve permitir formatação de texto inofensiva (negrito, itálico) mas bloquear iframes', () => {
    const payloadIframe = '<b>Aferição:</b> <iframe src="http://evil.com"></iframe>';
    const sanitizado = DOMPurify.sanitize(payloadIframe);

    expect(sanitizado).toContain('<b>Aferição:</b>');
    expect(sanitizado).not.toContain('<iframe');
  });

  it('deve lidar com strings gigantes (10.000 caracteres) sem travar a execução', () => {
    const stringGigante = 'A'.repeat(10000);
    const inicio = Date.now();
    const sanitizado = DOMPurify.sanitize(stringGigante);
    const tempo = Date.now() - inicio;

    expect(sanitizado.length).toBe(10000);
    expect(tempo).toBeLessThan(100); // Execução em menos de 100ms
  });
});
