# 🔒 Política de Segurança e Divulgação Responsável — KardIA

A segurança das informações e a privacidade dos dados de saúde dos usuários são prioridades absolutas no ecossistema **KardIA**.

---

## 📋 Versões Suportadas

Apenas a versão mais recente em produção recebe atualizações de segurança e patches ativos.

| Versão | Suporte Ativo |
| :--- | :--- |
| `2.x` (Atual) | :white_check_mark: Sim |
| `1.x` | :x: Descontinuada |

---

## 🚨 Como Reportar uma Vulnerabilidade

Se você identificar qualquer falha de segurança, vulnerabilidade ou exposição indevida de dados neste repositório:

1. **NÃO crie uma Issue pública no GitHub.**
2. Envie um relatório detalhado diretamente para o responsável técnico:
   - **E-mail**: `suportekardia@gmail.com` ou `wagnertecno@gmail.com`
   - **Assunto**: `[SEGURANÇA] Relato de Vulnerabilidade - KardIA`
3. Inclua no seu relatório:
   - Descrição detalhada da vulnerabilidade;
   - Passos reprodutíveis (Proof of Concept - PoC);
   - Possível impacto na segurança ou privacidade dos usuários;
   - Sugestão de mitigação (caso aplicável).

Responderemos ao seu relato em até **48 horas úteis** com uma avaliação e o prazo estimado para resolução.

---

## 🛡️ Diretrizes para Contribuidores e Desenvolvedores

Para manter o repositório seguro e público sem riscos:

1. **Nunca comite chaves de API ou segredos:**
   - Mantenha chaves do Firebase, Gemini, Groq ou Cloud Vision exclusivamente no arquivo local `.env` ou `.env.local` (ambos ignorados pelo `.gitignore`).
   - O arquivo `serviceAccountKey.json` do Firebase Admin **nunca** deve ser versionado no Git.
2. **Conformidade LGPD:**
   - Todo fluxo de manipulação de dados de saúde deve respeitar os princípios de necessidade, finalidade e anonimização/pseudonimização.
3. **Regras de Segurança do Firebase:**
   - Todas as regras do Firestore (`firestore.rules`) e Storage (`storage.rules`) devem manter validação de autenticação (`request.auth != null`) e permissões granulares por UID e Claims (`request.auth.token.admin == true`).
