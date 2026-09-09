# Changelog Técnico (Memória Contínua)

Todas as alterações técnicas relevantes deste projeto são documentadas aqui no momento em que ocorrem, de forma granular por commit, independente de cortes de release.

## [Unreleased]
- [refactor] Decomposição e refatoração arquitetural de módulos gigantes (UI e Services) para cumprir teto de 350 linhas por arquivo — Refs: Quality Gates
- [quality] Burndown de 100% dos warnings de ESLint (de 338 para 0), tipagem estrita TypeScript e remoção de tipos any residuais — Refs: ESLint Burndown
- [feat] Instalação de regras customizadas de Quality Gate (max-lines, max-statements, max-params, complexity) e esteira de auditoria automatizada — Refs: Quality Gates
- [test] Expansão da matriz canônica de testes Vitest com cobertura de resiliência, sanitização e telemetria — Refs: Vitest Matrix
- [security] Hardening de headers HTTP (HSTS/CSP), sanitização XSS e proteção serverless com Cloud Functions — Refs: 007-audit
- [docs] Adiciona especificações completas do sistema (SDD) na pasta docs e atualiza README — Refs: docs/01..13

## [2.0.0] - 2026-08-25
- [feat] Lançamento inicial Open Source do KardIA Health v2.0 com suporte a pressão, glicemia, hidratação, medicamentos, IMC e IA — Refs: SYSTEM_SPEC
