import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { formatarDataHora } from '../types';
import { mostrarToast } from './ui-utils';

export interface DadosVisualizacaoLaudo {
  titulo?: string;
  conteudoMarkdown: string;
  nomePaciente: string;
  dataGeracao?: Date | string;
  diasAnalisados?: number;
  periodoTexto?: string;
  modeloUsado?: string;
  detalhesClinicos?: {
    idade?: number;
    sexo?: string;
    peso?: number;
    altura?: number;
  };
}

export function abrirLaudoEmNovaJanela(dados: DadosVisualizacaoLaudo): Window | null {
  const novaJanela = window.open('', '_blank');
  if (!novaJanela) {
    mostrarToast('O navegador bloqueou a abertura da janela. Por favor, permita popups.', 'error');
    return null;
  }

  const dataFormatada = dados.dataGeracao
    ? formatarDataHora(dados.dataGeracao instanceof Date ? dados.dataGeracao : new Date(dados.dataGeracao))
    : formatarDataHora(new Date());

  const periodoTexto = dados.periodoTexto || (dados.diasAnalisados ? `${dados.diasAnalisados} dias` : 'Período Completo');
  const parsedMarkdown = marked.parse(dados.conteudoMarkdown);
  const conteudoHtml = DOMPurify.sanitize(parsedMarkdown as string);

  const htmlDocumento = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Laudo Clínico - ${dados.nomePaciente} | KardIA</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; line-height: 1.6; }
    .card { background: #1e293b; border-radius: 12px; padding: 24px; max-width: 800px; margin: 0 auto; border: 1px solid #334155; }
    h1 { font-size: 20px; color: #6366f1; margin: 0 0 8px; }
    .meta { font-size: 13px; color: #94a3b8; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #334155; }
    .btn { background: #6366f1; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-bottom: 16px; }
    @media print { .no-print { display: none; } body { background: #fff; color: #000; } .card { border: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="no-print" style="display:flex; justify-content:space-between; align-items:center;">
      <button class="btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
      <button class="btn" style="background:#475569" onclick="window.close()">✕ Fechar</button>
    </div>
    <h1>${dados.titulo || 'Laudo Clínico Integrado'} - ${dados.nomePaciente}</h1>
    <div class="meta">
      Data de Emissão: <strong>${dataFormatada}</strong> · Período: <strong>${periodoTexto}</strong> · Modelo: <strong>${dados.modeloUsado || 'Gemini Flash'}</strong>
    </div>
    <div class="content">${conteudoHtml}</div>
  </div>
</body>
</html>`;

  novaJanela.document.open();
  novaJanela.document.write(htmlDocumento);
  novaJanela.document.close();
  return novaJanela;
}
