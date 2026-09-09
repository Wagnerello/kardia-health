import { APP_VERSION } from '../version';

export function criarWrapperPDF(): HTMLDivElement {
  const w = document.createElement('div');
  w.className = 'pdf-report-wrapper';
  w.style.cssText = [
    '--primary:#4338ca', '--primary-dark:#312e81', '--primary-light:#6366f1',
    '--accent:#10b981', '--accent-dark:#059669',
    '--bg:#f8fafc', '--bg-card:#ffffff', '--bg-card2:#f1f5f9',
    '--bg-input:#f8fafc', '--border:#e2e8f0',
    '--text:#1e293b', '--text-muted:#64748b',
    '--danger:#ef4444', '--warning:#f59e0b', '--success:#10b981',
    '--normal-color:#10b981', '--elevated-color:#f59e0b',
    '--hyper1-color:#ef4444', '--hyper2-color:#dc2626',
    '--crisis-color:#991b1b', '--low-color:#6366f1',
    'background:#ffffff', 'color:#1e293b',
    'width:800px', 'box-sizing:border-box'
  ].join(';');
  return w;
}

export function obterBadgePDF(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('normal')) return `<span class="pdf-badge pdf-badge-normal">${label}</span>`;
  if (l.includes('elevad')) return `<span class="pdf-badge pdf-badge-elevada">${label}</span>`;
  if (l.includes('crise')) return `<span class="pdf-badge pdf-badge-crise">${label}</span>`;
  return `<span class="pdf-badge pdf-badge-hiper">${label}</span>`;
}

export function gerarHTMLCabecalhoPDF(titulo: string, subtitulo: string, nomePaciente: string, extraInfo?: string[]): string {
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const infoExtra = extraInfo ? extraInfo.map(info => `
    <div class="pdf-patient-field">
      <span class="pdf-patient-label">${info.split(':')[0]}</span>
      <span class="pdf-patient-value">${info.split(':').slice(1).join(':').trim()}</span>
    </div>`).join('') : '';

  return `
    <div class="pdf-report-header">
      <div class="pdf-report-brand">
        <div class="pdf-report-brand-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <div>
          <div class="pdf-report-brand-name">KardIA</div>
          <div class="pdf-report-brand-tagline">Monitoramento Inteligente de Saúde</div>
        </div>
      </div>
      <div class="pdf-report-meta">
        <div class="pdf-report-meta-title">${titulo}</div>
        <div class="pdf-report-meta-date">${subtitulo}</div>
        <div class="pdf-report-meta-date" style="margin-top:4px">${agora}</div>
      </div>
    </div>
    <div class="pdf-patient-box">
      <div class="pdf-patient-field">
        <span class="pdf-patient-label">Paciente</span>
        <span class="pdf-patient-value">${nomePaciente || 'Não informado'}</span>
      </div>
      ${infoExtra}
    </div>`;
}

export function gerarHTMLRodapePDF(): string {
  return `
    <div class="pdf-disclaimer">
      ⚠️ <strong>Aviso importante:</strong> Este relatório é gerado automaticamente com auxílio de Inteligência Artificial
      com base nos dados registrados pelo usuário. Não substitui avaliação, diagnóstico ou tratamento médico profissional.
      Consulte sempre um médico ou especialista de saúde qualificado.
    </div>
    <div class="pdf-report-footer">
      <span>Gerado por <strong>KardIA</strong> — Plataforma de Monitoramento de Saúde</span>
      <span>KardIA ${APP_VERSION} • kardia.app</span>
    </div>`;
}

export async function salvarPDF(wrapper: HTMLDivElement, filename: string): Promise<void> {
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;overflow:hidden;height:0;z-index:-9999;';
  container.appendChild(wrapper);
  document.body.appendChild(container);
  
  await new Promise(r => setTimeout(r, 100));
  
  const html2pdf = (await import('html2pdf.js')).default;
  await html2pdf().set({
    margin: 0,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff', 
      logging: false, 
      scrollX: 0, 
      scrollY: 0 
    },
    jsPDF: { unit: 'px', format: [800, wrapper.scrollHeight + 40], orientation: 'portrait' }
  }).from(wrapper).save();
  
  document.body.removeChild(container);
}

export const SPINNER_SVG = (w = 14) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    style="animation:spin 1s linear infinite">
    <path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/>
    <path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/>
    <path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/>
  </svg>`;

export const PDF_ICON = (w = 14) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>`;

import type { BpReading } from '../types';

interface LinhasGradeOpts {
  minV: number;
  maxV: number;
  gY: (v: number) => number;
  px: number;
  w: number;
}

function gerarLinhasGradeSVG(opts: LinhasGradeOpts): string {
  const { minV, maxV, gY, px, w } = opts;
  const gridVals = [80, 90, 100, 120, 130, 140, 160].filter(v => v >= minV && v <= maxV);
  return gridVals.map(v => {
    const y = gY(v);
    const isRef = v === 120 || v === 80;
    return `
      <line x1="${px}" y1="${y}" x2="${w - px}" y2="${y}"
        stroke="${isRef ? '#c7d2fe' : '#e2e8f0'}" stroke-width="${isRef ? 1.2 : 0.8}" stroke-dasharray="4,3"/>
      <text x="${px - 5}" y="${y + 3.5}" text-anchor="end" font-size="8.5" fill="#94a3b8">${v}</text>`;
  }).join('');
}

function gerarLegendaSVG(PX: number, legendY: number): string {
  return `
    <rect x="${PX}" y="${legendY - 7}" width="8" height="8" rx="2" fill="#6366f1"/>
    <text x="${PX + 11}" y="${legendY}" font-size="9" fill="#475569">Sistólica</text>
    <rect x="${PX + 70}" y="${legendY - 7}" width="8" height="8" rx="2" fill="#10b981"/>
    <text x="${PX + 83}" y="${legendY}" font-size="9" fill="#475569">Diastólica</text>
    <rect x="${PX + 152}" y="${legendY - 7}" width="8" height="4" rx="1" fill="#f59e0b"/>
    <text x="${PX + 164}" y="${legendY}" font-size="9" fill="#475569">Pulso</text>
  `;
}

export function gerarSVGGrafico(leituras: BpReading[]): string {
  if (leituras.length < 2) return '';

  const W = 676;
  const H = 180;
  const PX = 44;
  const PY = 18;
  const chartW = W - PX * 2;
  const chartH = H - PY * 2 - 22;

  const sorted = [...leituras].sort((a, b) => a.data_hora_afericao.getTime() - b.data_hora_afericao.getTime());
  const n = sorted.length;

  const allVals = sorted.flatMap(a => [a.sys, a.dia, a.pul]);
  const maxV = Math.max(...allVals) + 15;
  const minV = Math.max(0, Math.min(...allVals) - 15);
  const range = maxV - minV || 1;

  const gX = (i: number) => PX + (i / Math.max(n - 1, 1)) * chartW;
  const gY = (v: number) => PY + ((maxV - v) / range) * chartH;

  const polyline = (series: number[], color: string, dash = '') =>
    `<polyline points="${series.map((v, i) => `${gX(i)},${gY(v)}`).join(' ')}"
      fill="none" stroke="${color}" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round"
      ${dash ? `stroke-dasharray="${dash}"` : ''} />`;

  const dots = (series: number[], color: string) =>
    series.map((v, i) => `<circle cx="${gX(i)}" cy="${gY(v)}" r="3" fill="${color}" stroke="#fff" stroke-width="1.2"/>`).join('');

  const step = Math.ceil(n / 6);
  const xLabels = sorted
    .filter((_, i) => i === 0 || i === n - 1 || i % step === 0)
    .map((a) => {
      const i = sorted.indexOf(a);
      const label = a.data_hora_afericao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return `<text x="${gX(i)}" y="${PY + chartH + 12}" text-anchor="middle" font-size="8" fill="#94a3b8">${label}</text>`;
    }).join('');

  return `
    <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:12px 8px 6px;margin-bottom:20px;">
      <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;">
        <rect width="${W}" height="${H}" fill="#f8fafc" rx="0"/>
        ${gerarLinhasGradeSVG({ minV, maxV, gY, px: PX, w: W })}
        ${polyline(sorted.map(a => a.sys), '#6366f1')}
        ${polyline(sorted.map(a => a.dia), '#10b981')}
        ${polyline(sorted.map(a => a.pul), '#f59e0b', '5,3')}
        ${dots(sorted.map(a => a.sys), '#6366f1')}
        ${dots(sorted.map(a => a.dia), '#10b981')}
        ${dots(sorted.map(a => a.pul), '#f59e0b')}
        ${xLabels}
        ${gerarLegendaSVG(PX, H - 8)}
      </svg>
    </div>`;
}
