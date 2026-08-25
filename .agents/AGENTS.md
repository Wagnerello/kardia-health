# Regras de Governança de Commit, Memória Técnica, Versionamento e Changelog

<RULE[commit_and_changelog_policy]>
1. **NUNCA EXECUTAR COMMIT OU PUSH AUTOMATICAMENTE**:
   - É estritamente proibido realizar git commit ou git push por iniciativa própria ou atos de proatividade.
   - O commit e push somente devem ser executados quando o USUÁRIO pedir ou der o comando explícito (ex: "faça o commit", "pode commitar").

2. **CONVENTIONAL COMMITS OBRIGATÓRIO**:
   - Toda mensagem de commit DEVE seguir o padrão Conventional Commits: `<tipo>(<escopo opcional>): <descrição curta>`.
   - Tipos permitidos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `security`, `ci`, `build`, `UI`, `design`.
   - O hook `commit-msg` (commitlint) bloqueia qualquer commit fora do padrão.

3. **MEMÓRIA TÉCNICA É INDEPENDENTE DE VERSIONAMENTO**:
   - Todo commit, COM OU SEM bump de versão, gera obrigatoriamente uma entrada em `docs/CHANGELOG_TECH.md`, na seção `## [Unreleased]`.
   - Essa entrada é gerada automaticamente pelo hook `post-commit` a partir da mensagem de commit, arquivos alterados e referências a regras clínicas ou itens de segurança.
   - Esta etapa NUNCA é opcional e NUNCA depende de decisão do usuário. A decisão do usuário afeta apenas o corte de release, nunca o registro do que foi feito.

4. **PERGUNTA OBRIGATÓRIA SOBRE CORTE DE RELEASE**:
   - Sempre que o usuário solicitar um commit, a IA deve perguntar se aquele commit também deve cortar uma release (promover `## [Unreleased]` para uma nova versão SemVer + `CHANGELOG.md` de negócio) ou se deve permanecer acumulando em `## [Unreleased]`.

5. **FLUXO DE LANÇAMENTO, AUDITORIA DE SEGURANÇA E CHANGELOG**:
   - **AUDITORIA DE SEGURANÇA OBRIGATÓRIA (SECURITY GATE)**:
     - Antes de qualquer commit e push, é obrigatório executar a suíte completa de testes e a auditoria estática (`npm run audit:all` ou `node scripts/audit-esteira.mjs .`).
     - A análise deve verificar:
       a) Suíte completa de testes unitários passando 100% sem erros (`npm test`).
       b) Regras de acesso e autorização (Firestore Security Rules, RBAC).
       c) Exposição de segredos, tokens ou chaves de API (checagem por regex + `.gitignore`).
       d) Validação e sanitização de dados de entrada contra XSS e injeções.
       e) `npm audit --audit-level=high` sem vulnerabilidades pendentes.
     - Se houver qualquer vulnerabilidade ou teste quebrado, o problema DEVE ser corrigido antes do commit.
   - Ao cortar uma release:
     a) Realizar e aprovar a suíte de testes unitários e o Security Gate.
     b) Incrementar a versão no `package.json` seguindo SemVer.
     c) Promover o conteúdo de `docs/CHANGELOG_TECH.md` (`## [Unreleased]`) para `## [vX.Y.Z] - AAAA-MM-DD`.
     d) Traduzir para linguagem amigável de negócio no topo do `CHANGELOG.md`.
     e) Reabrir `## [Unreleased]` vazia no changelog técnico.
</RULE[commit_and_changelog_policy]>

<RULE[technical_memory_policy]>
1. **`docs/CHANGELOG_TECH.md` É FONTE DE VERDADE TÉCNICA**:
   - Memória técnica primária com granularidade por commit.
   - Formato obrigatório da entrada:
     `- [<tipo>] <descrição técnica> (commit: <hash>) — Refs: <RN-XXX | REQ-SXX | spec>`
2. **PROIBIDO REESCREVER HISTÓRICO**:
   - Entradas promovidas para versões lançadas nunca são alteradas retroativamente.
</RULE[technical_memory_policy]>

<RULE[unit_testing_and_anti_regression_policy]>
1. **TESTES UNITÁRIOS OBRIGATÓRIOS A CADA NOVA IMPLEMENTAÇÃO**:
   - Toda nova funcionalidade, utilitário, cálculo clínico ou correção de bug DEVE vir acompanhada de testes unitários automatizados (`*.test.ts`).
   - Cobertura obrigatória de Happy Paths, Sad Paths e Edge Cases.
2. **PROTEÇÃO ANTI-REGRESSÃO**:
   - Nunca submeter alterações sem rodar `npm test`.
   - Se quebrar qualquer teste pré-existente, a alteração é inválida até correção.
</RULE[unit_testing_and_anti_regression_policy]>

<RULE[human_copywriting_and_anti_slop_policy]>
1. **PROIBIDO USO DE CLICHÊS DE IA (ANTI-AI SLOP)**:
   - Landing Pages, modais, UI e `CHANGELOG.md` não devem conter escrita robótica ou adjetivos vazios ("robusto", "revolucionário", "divisor de águas", "mergulhar fundo", "empoderar", "cutting-edge").
   - `docs/CHANGELOG_TECH.md` é estritamente técnico e objetivo.
2. **VOZ ATIVA E DADOS REAIS**:
   - Sempre priorizar métricas, nomes claros de botões e valor prático para o usuário final.
</RULE[human_copywriting_and_anti_slop_policy]>
