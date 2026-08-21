# 🛡️ Especificação 11: Painel Administrativo de Super Usuário (Admin)

> **Documento:** Caderno de Especificação Técnica do Módulo de Gestão Administrativa e Governança  
> **Sistema:** KardIA — Assistente de Saúde Preventiva  
> **Versão:** 2.0.0  
> **Classificação:** Documento Técnico Oficial  

---

## 1. Visão Geral do Módulo

O painel de **Super Usuário (Admin)** fornece governança completa sobre todos os usuários cadastrados, métricas de crescimento do SaaS em tempo real, auditoria de segurança (logs), gestão de assinaturas/planos, ferramentas de reprocessamento de inteligência artificial em lote e controles globais de sistema (modo de manutenção e mensagens broadcast).

---

## 2. Autenticação e Elevação de Privilégios (Custom Claims)

A segurança administrativa do KardIA opera no nível do protocolo criptográfico do Firebase Authentication através de **Custom Claims** anexadas ao token JWT:

```mermaid
graph LR
    Dev["Desenvolvedor / DevOps"] -->|Executa CLI com Service Account| Script["set_admin_claim.js"]
    Script -->|admin.auth().setCustomUserClaims(uid, {admin: true})| FirebaseAuth["Firebase Auth Engine"]
    FirebaseAuth -->|Emite JWT com claim admin: true| Token["Token JWT do Super Admin"]
    Token -->|Validado em request.auth.token.admin == true| FirestoreRules["Regras do Firestore (firestore.rules)"]
```

### 2.1. Script de Atribuição de Administrador (`set_admin_claim.js`)
```javascript
// Localização: set_admin_claim.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = 'UID_DO_SUPER_ADMIN';

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Sucesso! Custom claim 'admin' definido para o usuário ${uid}`);
    process.exit(0);
  });
```

---

## 3. Sub-Módulos do Painel Administrativo

A interface administrativa é dividida em 4 sub-abas gerenciadas pela função `mostrarSubAbaAdmin(aba)`:

```
Painel Admin/
├── 1. Visão Geral (KPIs & Métricas de Negócio)
├── 2. Gestão de Usuários (Tabela/Cards, Modais de Gestão, RBAC)
├── 3. Logs de Auditoria (Registro de Ações Administrativas)
└── 4. Configurações Globais (Broadcast, Bloqueio de Cadastros, Manutenção)
```

---

### 3.1. Sub-Aba 1: Visão Geral e KPIs em Tempo Real

Apresenta indicadores consolidados de telemetria e tração da plataforma:

1. **Total de Usuários:** Contagem absoluta de perfis cadastrados na coleção `/users`.
2. **Usuários Ativos:** Usuários com `status: 'Ativo'`.
3. **Total de Aferições:** Obtido via `getCountFromServer(collection(db, 'bp_readings'))` de forma econômica e instantânea sem download dos documentos.
4. **Assinantes Premium / Ouro:** Usuários com planos pagos ativos.
5. **Novos Cadastros (7 dias):** Usuários cuja `data_criacao` ocorreu nos últimos 7 dias.
6. **Gráfico de Crescimento (`admin-chart-growth`):** Gráfico em `Chart.js` agrupando os novos cadastros por semana ao longo das últimas 8 semanas.

---

### 3.2. Sub-Aba 2: Gestão de Usuários e Acessos

Permite a localização rápida e o gerenciamento de qualquer conta no sistema com filtros reativos por:
- Busca textual em tempo real por **Nome** ou **E-mail**.
- Filtro por **Status** (`Todos`, `Ativo`, `Pendente`, `Suspenso`, `Inativo`).
- Filtro por **Plano** (`Todos`, `Gratuito`, `Premium`, `Ouro`).

#### Ações Disponíveis por Usuário:
- **Alteração de Status (`alterarStatusAdmin`):** Suspender ou inativar contas com aplicação imediata de bloqueio no próximo carregamento de tela do usuário.
- **Alteração de Plano (`atualizarPlanoUsuario`):** Concessão manual de acesso a planos `Gratuito`, `Premium` ou `Ouro`.
- **Alteração de Função (`atualizarFuncaoUsuario`):** Promover a `ADMIN` ou rebaixar a `USER`.
- **Acesso ao Histórico do Usuário:** Visualização do modal de histórico do paciente com capacidade de gerar laudos e exportar PDFs em nome do paciente para suporte técnico.
- **Reprocessamento em Lote de IA (`reprocessarIAsEmLoteAdmin`):** Reexecuta a análise de IA para todas as aferições do paciente que estejam sem feedback ou com erros anteriores.
- **Exclusão em Cascata LGPD (`excluirDadosUsuario`):** Apaga permanentemente todas as aferições de pressão, registros de glicemia, hidratação e o próprio documento do usuário no Firestore, atendendo ao Direito ao Esquecimento da LGPD.

---

### 3.3. Sub-Aba 3: Logs de Atividade e Auditoria (`AdminLog`)

Toda ação executada por qualquer administrador é registrada atomicamente na coleção `/admin_logs`:

```typescript
// Localização: pressao-app/src/services/auth.ts
export interface AdminLog {
  id?: string;
  acao: string;          // Ex: "ALTERAR_STATUS", "EXCLUIR_USUARIO", "CONFIG_SISTEMA"
  detalhe: string;       // Descrição pormenorizada da alteração realizada
  alvo_uid?: string;     // UID do usuário afetado (se aplicável)
  alvo_email?: string;   // E-mail do usuário afetado
  admin_uid: string;     // UID do Super Admin que executou a ação
  admin_email: string;   // E-mail do Super Admin
  timestamp: Date;       // Timestamp da operação
}
```

---

### 3.4. Sub-Aba 4: Configurações Globais do Sistema (`SystemConfig`)

Gerencia as variáveis de controle operacional persistidas no documento `/config/global`:

```typescript
// Localização: pressao-app/src/services/auth.ts
export interface SystemConfig {
  mensagem_global: string;     // Mensagem de aviso exibida no topo do painel
  mensagem_ativa: boolean;     // Toggle de exibição do banner de broadcast
  bloquear_cadastros: boolean; // Impede novos registros mantendo apenas logins existentes
  manutencao: boolean;         // Bloqueia acesso de usuários comuns exibindo aviso de manutenção
}
```
