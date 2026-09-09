import { escapeHtml } from './ui-utils';
import { formatarDataHora, classificarPressao, classificarImc, type UserProfile, type BpReading, type GlicemiaReading } from '../types';
import type { SavedLaudo } from '../services/laudos';

export function gerarHtmlHeaderPaciente(perfil: UserProfile | null, nome: string): string {
  const email = perfil?.email || '--';
  const idade = perfil?.idade ? `${perfil.idade} anos` : '--';
  const sexo = perfil?.sexo ? (perfil.sexo === 'masculino' ? 'Masculino' : perfil.sexo === 'feminino' ? 'Feminino' : perfil.sexo) : '--';
  const peso = perfil?.peso ? `${perfil.peso} kg` : '--';
  const altura = perfil?.altura ? `${perfil.altura} cm` : '--';

  let imcBadge = '<span class="badge" style="background:var(--bg-card2); color:var(--text-muted);">IMC: --</span>';
  if (perfil?.peso && perfil?.altura) {
    const alturaMetros = perfil.altura / 100;
    const imcValor = perfil.peso / (alturaMetros * alturaMetros);
    const imcInfo = classificarImc(perfil.peso, perfil.altura, perfil.idade, perfil.sexo);
    imcBadge = `<span class="badge" style="background:${imcInfo.cor}22; color:${imcInfo.cor}; border:1px solid ${imcInfo.cor}44; font-weight:700;">IMC: ${imcValor.toFixed(1)} (${imcInfo.label})</span>`;
  }

  const condicoes: string[] = [];
  if (perfil?.hipertenso) condicoes.push('<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444;">Hipertenso</span>');
  if (perfil?.diabetico) condicoes.push('<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b;">Diabético</span>');
  if (perfil?.fumante) condicoes.push('<span class="badge" style="background:rgba(107,114,128,0.15); color:var(--text-muted);">Fumante</span>');
  if (perfil?.sedentario) condicoes.push('<span class="badge" style="background:rgba(139,92,246,0.15); color:#8b5cf6;">Sedentário</span>');
  if (perfil?.usaMedicacao) condicoes.push('<span class="badge" style="background:rgba(14,165,233,0.15); color:#0ea5e9;">Usa Medicação</span>');

  return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg, var(--primary), var(--accent)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
          ${nome.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h3 style="margin:0; font-size:18px; font-weight:700; color:var(--text);">${escapeHtml(nome)}</h3>
            <span class="badge" style="background:var(--primary); color:#fff; font-size:11px;">${perfil?.plano || 'Gratuito'}</span>
          </div>
          <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
            📧 ${escapeHtml(email)} · 🎂 ${idade} · ⚧ ${sexo}
          </div>
        </div>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="btn btn-secondary btn-small" onclick="exportarHistoricoCompletoAdminPDF()" title="Exportar histórico do paciente em PDF" style="display:flex; align-items:center; gap:6px;">
          📄 Exportar PDF do Paciente
        </button>
        <button class="btn btn-primary btn-small" onclick="focarGeradorLaudoAdmin()" title="Gerar Laudo Clínico com IA" style="display:flex; align-items:center; gap:6px;">
          🤖 Novo Laudo IA
        </button>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); flex-wrap:wrap;">
      <span style="font-size:12px; color:var(--text-muted); font-weight:600;">Sinais & Condições:</span>
      <span style="font-size:12px; color:var(--text);">⚖️ ${peso} · 📏 ${altura}</span>
      ${imcBadge}
      ${condicoes.length > 0 ? condicoes.join(' ') : '<span style="font-size:12px; color:var(--text-muted);">Sem comorbidades declaradas</span>'}
    </div>
  `;
}

export function gerarCardsListaLaudos(laudos: SavedLaudo[]): string {
  if (laudos.length === 0) {
    return `
      <div class="empty-state" style="padding:32px 16px; text-align:center; background:var(--bg-card2); border-radius:12px; border:1px dashed var(--border);">
        <div style="font-size:32px; margin-bottom:8px;">📋</div>
        <h4 style="margin:0 0 6px; font-size:15px; color:var(--text);">Nenhum laudo clínico registrado</h4>
        <p style="font-size:13px; color:var(--text-muted); margin:0 0 16px;">Gere uma análise com Inteligência Artificial médica ou adicione um parecer clínico manual.</p>
      </div>
    `;
  }

  return laudos.map(l => {
    const dt = formatarDataHora(l.data_geracao);
    const inativo = l.ativo === false;
    const preview = l.conteudo.replace(/[#*`_~>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) + '...';
    const borderCor = inativo ? 'var(--danger)' : 'var(--primary)';
    const statusBadge = inativo
      ? '<span style="background:var(--danger); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">INATIVO</span>'
      : '<span style="background:var(--primary); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">ATIVO</span>';

    return `
      <div class="card" style="padding:14px 16px; margin-bottom:12px; border-left:4px solid ${borderCor}; background:var(--bg-card2);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px; font-weight:700; color:var(--text);">${dt}</span>
              <span style="font-size:12px; color:var(--primary-light); font-weight:600;">· ${escapeHtml(l.periodo_texto || 'Período Completo')}</span>
              ${statusBadge}
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
              🤖 Modelo/Autor: <strong>${escapeHtml(l.modelo_usado || 'Gemini Flash')}</strong>
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <button class="btn btn-primary btn-small" onclick="visualizarLaudoAdminInline('${l.id}')" title="Visualizar laudo completo formatado" style="padding:4px 8px; font-size:12px;">👁️ Visualizar</button>
            <button class="btn btn-secondary btn-small" onclick="abrirEditorLaudoAdmin('${l.id}')" title="Editar / Adicionar anotações" style="padding:4px 8px; font-size:12px;">✏️ Editar</button>
            <button class="btn btn-ghost btn-small" onclick="exportarLaudoAdminParaPDF('${l.id}')" title="Exportar laudo em PDF" style="padding:4px 8px; font-size:12px;">📄 PDF</button>
            ${!inativo ? `
              <button class="btn btn-ghost btn-small" onclick="inativarLaudoAdminUI('${l.id}')" title="Inativar laudo" style="padding:4px 8px; font-size:12px; color:var(--warning);">⏸️ Inativar</button>
            ` : `
              <button class="btn btn-ghost btn-small" onclick="reativarLaudoAdminUI('${l.id}')" title="Reativar laudo" style="padding:4px 8px; font-size:12px; color:var(--accent);">▶️ Reativar</button>
            `}
            <button class="btn btn-danger btn-small" onclick="excluirLaudoAdminPermanenteUI('${l.id}')" title="Excluir definitivamente" style="padding:4px 8px; font-size:12px;">🗑️</button>
          </div>
        </div>
        <p style="font-size:13px; color:var(--text-muted); margin:0; line-height:1.5;">${escapeHtml(preview)}</p>
      </div>
    `;
  }).join('');
}

export function gerarTabelaAfericoesHtml(afericoes: BpReading[]): string {
  if (afericoes.length === 0) {
    return `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">Nenhuma aferição registrada.</td></tr>`;
  }

  return afericoes.map(a => {
    const dt = formatarDataHora(a.data_hora_afericao);
    const clf = classificarPressao(a.sys, a.dia);
    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:10px 12px; font-size:13px; color:var(--text); font-weight:600;">${dt}</td>
        <td style="padding:10px 12px; font-size:14px; font-weight:800; color:var(--primary-light);">${a.sys} <span style="font-size:11px; font-weight:400; color:var(--text-muted);">mmHg</span></td>
        <td style="padding:10px 12px; font-size:14px; font-weight:800; color:var(--accent);">${a.dia} <span style="font-size:11px; font-weight:400; color:var(--text-muted);">mmHg</span></td>
        <td style="padding:10px 12px; font-size:13px; font-weight:700; color:var(--warning);">❤️ ${a.pul} <span style="font-size:11px; font-weight:400; color:var(--text-muted);">BPM</span></td>
        <td style="padding:10px 12px;">
          <span class="badge" style="background:${clf.cor}22; color:${clf.cor}; border:1px solid ${clf.cor}44; font-size:11px; font-weight:700;">${clf.label}</span>
        </td>
      </tr>
    `;
  }).join('');
}

export function gerarGlicemiasHtml(glicemias: GlicemiaReading[]): string {
  if (glicemias.length === 0) {
    return `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:13px;">Sem registros de glicemia para este paciente.</div>`;
  }

  return glicemias.slice(0, 20).map(g => {
    const dt = formatarDataHora(new Date(g.data_hora_afericao));
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-card2); border-radius:8px; margin-bottom:6px; border:1px solid var(--border);">
        <div>
          <span style="font-size:13px; font-weight:700; color:var(--text);">${dt}</span>
          <span style="font-size:12px; color:var(--text-muted);">· ${escapeHtml(g.momento || 'Glicemia')}</span>
        </div>
        <span style="font-size:15px; font-weight:800; color:var(--warning);">${g.valor} mg/dL</span>
      </div>
    `;
  }).join('');
}
