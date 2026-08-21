import type { BpReading, GlicemiaReading, UserProfile, DailyWaterLog } from '../types';
import { classificarPressao, classificarGlicemia } from '../types';

export interface ContextoSaude {
  userProfile: UserProfile | null;
  ultimaPressao: BpReading | null;
  ultimaGlicemia: GlicemiaReading | null;
  aguaHoje: number;
  metaAgua: number;
  historicoAgua7d?: DailyWaterLog[];
}

export interface Dica {
  titulo: string;
  texto: string;
  icone: string;
}

// ── Dicas de Pressão ───────────────────────────────────────────
export function obterDicaPressao(ctx: ContextoSaude): Dica {
  const icon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
  
  if (ctx.ultimaPressao) {
    const clf = classificarPressao(ctx.ultimaPressao.sys, ctx.ultimaPressao.dia);
    if (clf.label.includes('Crise') || clf.label.includes('Hipertensão')) {
      return {
        titulo: 'Atenção (Alerta IA):',
        texto: 'Sua última medição indicou pressão alta. Tente repousar, faça exercícios de respiração e evite consumo de sódio nas próximas horas.',
        icone: icon
      };
    }
  }

  if (ctx.userProfile && (ctx.userProfile as any).usaMedicacao) {
    return {
      titulo: 'Lembrete Médico:',
      texto: 'A eficácia do controle pressórico depende muito da regularidade. Tente tomar sua medicação sempre no mesmo horário todos os dias.',
      icone: icon
    };
  }

  const dicasManutencao = [
    'Afira sua pressão 2x ao dia (manhã e noite), sempre em repouso, com 3 medições consecutivas de 1 min de intervalo (Dica OMS).',
    'O controle do estresse é fundamental. Práticas diárias de relaxamento, como a meditação ou caminhada, ajudam.',
    'Reduzir a ingestão de sal e aumentar potássio (como banana e abacate) é uma estratégia natural para proteger suas artérias.',
    'A qualidade do sono afeta diretamente a pressão arterial. Evite telas 1 hora antes de dormir para melhorar seu descanso.'
  ];
  const dica = dicasManutencao[Math.floor(Math.random() * dicasManutencao.length)];

  return { titulo: 'Dica de Saúde:', texto: dica, icone: icon };
}

// ── Dicas de Glicemia ──────────────────────────────────────────
export function obterDicaGlicemia(ctx: ContextoSaude): Dica {
  const icon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-13-7-13S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>';
  
  if (ctx.ultimaGlicemia) {
    const clf = classificarGlicemia(ctx.ultimaGlicemia.valor, ctx.ultimaGlicemia.momento);
    if (clf.label.includes('Hiperglicemia') || clf.label.includes('Pré-Diabetes')) {
      return {
        titulo: 'Alerta Glicêmico:',
        texto: 'Sua última medição esteve acima do esperado. Revise sua última refeição e beba muita água para ajudar os rins.',
        icone: icon
      };
    }
  }

  const dicasManutencao = [
    'Monitore sua glicemia frequentemente nos horários indicados, como em jejum e 2h após as refeições (Dica SBD).',
    'Fibras lentificam a absorção do açúcar. Adicione aveia, chia ou vegetais folhosos nas suas refeições.',
    'O exercício físico atua como uma "insulina natural", ajudando suas células a absorver a glicose do sangue.',
    'Picos de estresse liberam cortisol, o que eleva naturalmente a glicose no sangue, mesmo sem comer doce.'
  ];
  const dica = dicasManutencao[Math.floor(Math.random() * dicasManutencao.length)];

  return { titulo: 'Dica de Saúde:', texto: dica, icone: icon };
}

// ── Dicas de Hidratação ────────────────────────────────────────
export function obterDicaHidratacao(ctx: ContextoSaude): Dica {
  const icon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>';
  
  const progressoHoje = ctx.aguaHoje / ctx.metaAgua;
  const hist = ctx.historicoAgua7d || [];

  // Análise dos últimos 7 dias (se houver histórico)
  if (hist.length > 0) {
    const total7d = hist.reduce((sum, h) => sum + (h.amount_ml || 0), 0);
    const media7d = Math.round(total7d / hist.length);
    const diasMetaAtingida = hist.filter(h => h.amount_ml >= h.meta_ml && h.meta_ml > 0).length;
    const diasSemRegistro = hist.filter(h => (h.amount_ml || 0) === 0).length;

    // Alerta de baixíssima hidratação na semana (mais da metade dos dias sem registro ou consumo crítico)
    if (diasSemRegistro >= 4 || media7d < ctx.metaAgua * 0.4) {
      return {
        titulo: 'Alerta de Hidratação Semanal:',
        texto: `Sua média dos últimos 7 dias é de apenas ${media7d} mL/dia. A baixa ingestão de água prejudica os rins e afeta o controle da pressão arterial.`,
        icone: icon
      };
    }

    // Alerta de inconsistência (se a meta foi atingida em poucos dias)
    if (diasMetaAtingida <= 2 && progressoHoje < 0.5) {
      return {
        titulo: 'Consistência de Hidratação:',
        texto: `Você atingiu a meta em apenas ${diasMetaAtingida} de 7 dias nesta semana. Tente manter uma garrafa por perto para criar regularidade diária.`,
        icone: icon
      };
    }

    // Elogio de excelente desempenho semanal
    if (diasMetaAtingida >= 5) {
      return {
        titulo: 'Excelente Tendência Semanal!',
        texto: `Parabéns! Você atingiu a meta de água em ${diasMetaAtingida} dos últimos 7 dias (média de ${(media7d / 1000).toFixed(1)} L/dia). Excelente para sua circulação!`,
        icone: icon
      };
    }
  }

  // Fallbacks baseados na ingestão do dia atual
  if (progressoHoje === 0) {
    return {
      titulo: 'Hora de começar:',
      texto: 'Você ainda não registrou consumo de água hoje. Beba um copo agora mesmo! Seu corpo agradece.',
      icone: icon
    };
  } else if (progressoHoje < 0.5) {
    return {
      titulo: 'Atenção (Hidratação):',
      texto: 'Você ainda não atingiu nem metade da sua meta diária de água. Mantenha a garrafinha por perto.',
      icone: icon
    };
  } else if (progressoHoje >= 1) {
    return {
      titulo: 'Parabéns!',
      texto: 'Você atingiu sua meta diária! Manter essa hidratação constante é vital para o funcionamento saudável do corpo.',
      icone: icon
    };
  }

  const dicasManutencao = [
    'A hidratação adequada é vital para o controle da pressão arterial. Beba água regularmente, ao longo de todo o dia.',
    'Não espere sentir sede para beber água. A sede já é um sinal precoce de desidratação leve.',
    'A água compõe cerca de 60% do seu corpo. Manter o nível de água ajuda o coração a bombear o sangue com facilidade.',
    'Se você tem dificuldade em beber água pura, tente saborizar naturalmente com rodelas de limão ou hortelã.'
  ];
  const dica = dicasManutencao[Math.floor(Math.random() * dicasManutencao.length)];

  return { titulo: 'Dica de Saúde:', texto: dica, icone: icon };
}
