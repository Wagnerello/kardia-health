# Changelog Técnico (Memória Contínua)

Todas as alterações técnicas relevantes deste projeto são documentadas aqui no momento em que ocorrem, de forma granular por commit, independente de cortes de release.

## [Unreleased]
- [test] Implementa matriz canônica completa com 28 testes (Happy Paths, Sad Paths, Sanitização XSS e Edge Cases) — Refs: arquitetura.md §4.4
- [security] Hardening de headers HTTP (HSTS/CSP) e proteção serverless com Cloud Functions — Refs: 007-audit
- [feat] Instalação da esteira de qualidade, governança SDD, Vitest e hooks Husky — Refs: arquitetura.md §11
- [docs] Adiciona especificações completas do sistema (SDD) na pasta docs e atualiza README — Refs: docs/01..13

## [2.0.0] - 2026-08-25
- [feat] Lançamento inicial Open Source do KardIA Health v2.0 com suporte a pressão, glicemia, hidratação, medicamentos, IMC e IA — Refs: SYSTEM_SPEC
