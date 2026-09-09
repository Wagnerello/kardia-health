# Changelog Técnico (Memória Contínua)

Todas as alterações técnicas relevantes deste projeto são documentadas aqui no momento em que ocorrem, de forma granular por commit, independente de cortes de release.

## [Unreleased]

## [2.1.1] - 2026-09-09
- [ui/ux] Correções completas da auditoria técnica Impeccable no módulo de Perfil e Medicações: contenção de largura do botão `+ Nova Medicação` (eliminando o esticamento indevido de `.btn-primary` em cabeçalhos flexbox)
- [ui/ux] Redesign ergonômico do cabeçalho de perfil (`.profile-header`) com layout compacto, avatar com glassmorphism e badges pill (Idade, Peso, Altura, Sexo)
- [a11y] Acessibilidade WAI-ARIA completa: touch targets >= 44x44px nos botões de edição e exclusão de medicamentos com `aria-label`, suporte semântico a abas (`role="tablist"`, `role="tab"`, `role="tabpanel"`) e diálogo acessível (`role="dialog"`)
- [ux] Formatação clínica amigável para dosagens ("500 mg", "686 mg") e frequências de medicação ("1x ao dia"), além de badges com tipografia e contraste adequados
- [theming] Adição do token `--surface: #ffffff;` e preservação estrita do tema claro original da aplicação

## [2.1.0] - 2026-09-09
- [feat] Atualização do motor de Inteligência Artificial para Gemini 2.5 Flash (`gemini-2.5-flash`, `gemini-flash-latest`, `gemini-3.5-flash-lite`) e fallback resiliente multi-modelo Groq (`groq/compound`, `qwen/qwen3.8-27b`)
- [ui/ux] Refatoração completa com base na auditoria Impeccable: eliminação de anti-patterns de IA (*AI slop*), paleta clínica profissional e acessibilidade com conformidade WCAG AA (contraste >= 4.5:1)
- [ui/ux] Hierarquia tipográfica consistente, normalização de tamanhos mínimos de fonte (>= 12px) e desaceleração suave de animações (sem layout thrashing)
- [quality] Manutenção de 100% dos Quality Gates verdes: 0 erros e 0 warnings no ESLint, 0 erros no TypeScript e 31/31 testes unitários passando

## [2.0.0] - 2026-08-25
- [feat] Lançamento inicial Open Source do KardIA Health v2.0 com suporte a pressão, glicemia, hidratação, medicamentos, IMC e IA — Refs: SYSTEM_SPEC
