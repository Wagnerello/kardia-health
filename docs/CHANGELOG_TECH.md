# Changelog Técnico (Memória Contínua)

Todas as alterações técnicas relevantes deste projeto são documentadas aqui no momento em que ocorrem, de forma granular por commit, independente de cortes de release.

## [Unreleased]

## [2.1.0] - 2026-09-09
- [feat] Atualização do motor de Inteligência Artificial para Gemini 2.5 Flash (`gemini-2.5-flash`, `gemini-flash-latest`, `gemini-3.5-flash-lite`) e fallback resiliente multi-modelo Groq (`groq/compound`, `qwen/qwen3.8-27b`)
- [ui/ux] Refatoração completa com base na auditoria Impeccable: eliminação de anti-patterns de IA (*AI slop*), paleta clínica profissional e acessibilidade com conformidade WCAG AA (contraste >= 4.5:1)
- [ui/ux] Hierarquia tipográfica consistente, normalização de tamanhos mínimos de fonte (>= 12px) e desaceleração suave de animações (sem layout thrashing)
- [quality] Manutenção de 100% dos Quality Gates verdes: 0 erros e 0 warnings no ESLint, 0 erros no TypeScript e 31/31 testes unitários passando

## [2.0.0] - 2026-08-25
- [feat] Lançamento inicial Open Source do KardIA Health v2.0 com suporte a pressão, glicemia, hidratação, medicamentos, IMC e IA — Refs: SYSTEM_SPEC
