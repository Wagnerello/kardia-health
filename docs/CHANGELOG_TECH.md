# Changelog Técnico (Memória Contínua)

Todas as alterações técnicas relevantes deste projeto são documentadas aqui no momento em que ocorrem, de forma granular por commit, independente de cortes de release.

## [Unreleased]

## [2.3.1] - 2026-09-11
- [fix] Resolução da regressão no botão "Novo Registro" impedindo abertura de modais
- [feat] Suporte a registros retroativos de Água e Peso com novos seletores de data/hora
- [test] Inclusão de 78 testes de contrato de interface para blindagem anti-regressão de eventos onclick
- [chore] Sincronização do package-lock.json e correção da esteira CI em ambientes ESM
- [chore] resolve merge conflicts in changelog and version (commit: 16e1fdd) — Refs: auto

## [2.3.0] - 2026-09-09
- [ui/ux] Refatoração da sidebar desktop: botão primário `+ Novo Registro` movido para o topo (padrão SaaS — Lei de Fitts), eliminando risco de missclick com o botão `Sair`
- [ui/ux] Seção `Conta` (Meu Perfil + Sair) ancorada no rodapé da sidebar com divisor visual elegante e isolamento seguro
- [ui/ux] Botão `Sair` com feedback visual dedicado em vermelho suave (hover state `#fef2f2`) para ação destrutiva
- [ui/ux] Abas do Dashboard (Hidratação, IMC e Peso, Pressão Arterial, Glicemia) redesenhadas com padrão `Expandable Icon Tabs`: ícone SVG compacto quando inativa, expansão animada `cubic-bezier` com ícone + texto ao ativar
- [ui/ux] Eliminação total da scrollbar horizontal nas abas do Dashboard mobile (`overflow: hidden` + `flex: 0 0 auto`)
- [ui/ux] Escopo CSS isolado via classe modificadora `.dashboard-tab-switcher--icon` — abas de Perfil e Admin não afetadas
- [ui/ux] Redesign completo do cabeçalho de Filtros do Histórico: componentes separados em um card com `flex-direction: column` para melhor respiração visual, espaçamento de touch targets e correção de padding inferior do layout
- [quality] 31/31 testes unitários passando

## [2.2.0] - 2026-09-09
- [feat] implementar hardening de firestore, telemetria de erros e meta tags seo (commit: 5e1839d) — Refs: auto
- [test] Implementa matriz canônica completa com 28 testes (Happy Paths, Sad Paths, Sanitização XSS e Edge Cases) — Refs: arquitetura.md §4.4
- [security] Hardening de headers HTTP (HSTS/CSP) e proteção serverless com Cloud Functions — Refs: 007-audit
- [feat] Instalação da esteira de qualidade, governança SDD, Vitest e hooks Husky — Refs: arquitetura.md §11
- [docs] Adiciona especificações completas do sistema (SDD) na pasta docs e atualiza README — Refs: docs/01..13

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
