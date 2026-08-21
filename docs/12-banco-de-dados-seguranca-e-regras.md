# 🗄️ Especificação 12: Modelagem de Banco de Dados, Segurança e Regras

> **Documento:** Caderno de Especificação de Esquemas NoSQL, Índices e Regras de Segurança  
> **Sistema:** KardIA — Assistente de Saúde Preventiva  
> **Versão:** 2.0.0  
> **Classificação:** Documento Técnico Oficial  

---

## 1. Visão Geral do Banco de Dados

O KardIA utiliza o **Cloud Firestore** como banco de dados NoSQL de documentos estruturados, distribuído globalmente com replicação multirregião. A arquitetura segue o princípio de **Isolamento de Dados por Tenant (User ID)**, onde nenhum usuário tem permissão para ler, alterar ou enumerar documentos pertencentes a outro paciente, exceto o Super Usuário autorizado por Custom Claims criptografadas.

---

## 2. Dicionário Completo de Coleções do Firestore

```
Cloud Firestore/
├── users/                # Perfis cadastrais e anamnese médica
├── bp_readings/          # Aferições de pressão arterial e pulso
├── glicemia_readings/    # Medições de glicemia capilar e momentos
├── water_logs/           # Registros de hidratação diária
├── user_medications/     # Prescrições farmacológicas e suplementos
├── weight_history/       # Histórico temporal de pesagens corporais
├── laudos/               # Laudos médicos gerados por IA e relatórios
├── analises_diarias/     # Resumos clínicos consolidados por dia
├── admin_logs/           # Auditoria imutável de operações do Super Admin
└── config/               # Configurações globais e broadcast do sistema
```

---

### 2.1. Coleção `/users/{userId}`
- **ID do Documento:** `userId` (UID idêntico ao UID do Firebase Authentication).
- **Campos:**
  - `uid` (string): Identificador único do paciente.
  - `email` (string): E-mail de cadastro.
  - `nome` (string): Nome completo do usuário.
  - `sexo` (string): `'masculino' | 'feminino' | 'outro'`.
  - `idade` (number): Idade em anos.
  - `peso` (number): Peso atual em kg.
  - `altura` (number, opcional): Estatura em cm.
  - `nascimento` (string, YYYY-MM-DD): Data de nascimento.
  - `role` (string): `'ADMIN' | 'USER'`.
  - `plano` (string): `'Gratuito' | 'Premium' | 'Ouro'`.
  - `status` (string): `'Pendente' | 'Ativo' | 'Suspenso' | 'Inativo'`.
  - `hipertenso` (boolean): Flag de hipertensão.
  - `diabetico` (boolean): Flag de diabetes.
  - `fumante` (boolean): Flag de tabagismo.
  - `sedentario` (boolean): Flag de sedentarismo.
  - `usaMedicacao` (boolean): Flag de uso contínuo de fármacos.
  - `termos_aceitos` (boolean): Flag de consentimento LGPD.
  - `termos_aceitos_em` (string): Timestamp ISO do aceite.
  - `termos_versao` (string): Versão dos termos (ex: `'1.0'`).
  - `data_criacao` (Timestamp): Data/hora de registro no banco.

---

### 2.2. Coleção `/bp_readings/{readingId}`
- **ID do Documento:** Auto-gerado pelo Firestore.
- **Campos:**
  - `user_id` (string): UID do paciente.
  - `sys` (number): Pressão Sistólica em mmHg ($60 \text{ a } 300$).
  - `dia` (number): Pressão Diastólica em mmHg ($40 \text{ a } 200$).
  - `pul` (number): Pulso em BPM ($30 \text{ a } 250$).
  - `data_hora_afericao` (Timestamp): Momento da medição.
  - `image_url` (string, opcional): URL da foto do medidor digital.
  - `ai_feedback` (string, opcional): Parecer gerado pela IA.
  - `grupo_id` (string, opcional): Chave de agrupamento de tripla medição.

---

### 2.3. Coleção `/glicemia_readings/{readingId}`
- **ID do Documento:** Auto-gerado pelo Firestore.
- **Campos:**
  - `user_id` (string): UID do paciente.
  - `valor` (number): Glicemia em mg/dL ($20 \text{ a } 600$).
  - `momento` (string): `'jejum' | 'pos_prandial' | 'antes_dormir' | 'aleatorio'`.
  - `data_hora_afericao` (Timestamp): Momento do teste.
  - `ai_feedback` (string, opcional): Parecer endocrinológico da IA.
  - `hba1c` (number, opcional): Hemoglobina glicada em %.

---

### 2.4. Coleção `/water_logs/{logId}`
- **ID do Documento:** `${user_id}_${date_string}` (ex: `uid123_2026-08-21`).
- **Campos:**
  - `user_id` (string): UID do paciente.
  - `date_string` (string): Data no formato YYYY-MM-DD.
  - `amount_ml` (number): Volume total consumido no dia em mL.
  - `meta_ml` (number): Meta hídrica diária calculada em mL.

---

### 2.5. Coleção `/user_medications/{medId}`
- **Campos:** `user_id`, `nome`, `dosagem`, `frequencia`, `tipo` (`'Continuo' | 'Temporario'`), `ativa` (boolean), `data_inicio` (Timestamp), `data_fim` (Timestamp), `data_criacao` (Timestamp).

---

### 2.6. Coleção `/laudos/{laudoId}`
- **Campos:** `user_id`, `conteudo` (Markdown), `modelo_usado` (string), `dias_analisados` (number), `data_geracao` (Timestamp), `ativo` (boolean).

---

### 2.7. Coleção `/weight_history/{weightId}`
- **Campos:** `user_id`, `peso` (number em kg), `data` (Timestamp).

---

### 2.8. Coleção `/admin_logs/{logId}`
- **Campos:** `acao` (string), `detalhe` (string), `alvo_uid` (string), `alvo_email` (string), `admin_uid` (string), `admin_email` (string), `timestamp` (Timestamp).

---

### 2.9. Coleção `/config/global`
- **Campos:** `mensagem_global` (string), `mensagem_ativa` (boolean), `bloquear_cadastros` (boolean), `manutencao` (boolean).

---

## 3. Regras de Segurança do Firestore (`firestore.rules`)

```javascript
// Localização: pressao-app/firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Função para verificar se o usuário é admin via Custom Claims
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }

    // Usuários podem ler e escrever seus próprios documentos
    match /users/{userId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }
    
    // Aferições de pressão
    match /bp_readings/{readingId} {
      allow read, update, delete: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    // Registros de Água
    match /water_logs/{logId} {
      allow read, update, delete: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    // Aferições de glicemia
    match /glicemia_readings/{readingId} {
      allow read, update, delete: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    // Medicações e Suplementos
    match /user_medications/{medId} {
      allow read, update, delete: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    // Laudos
    match /laudos/{laudoId} {
      allow read, update, delete: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    // Histórico de peso
    match /weight_history/{weightId} {
      allow read, update, delete: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    // Análises diárias da IA
    match /analises_diarias/{analiseId} {
      allow read, update, delete: if request.auth != null && (request.auth.uid == resource.data.user_id || isAdmin());
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    // Logs de atividade do Admin (apenas admin lê e escreve)
    match /admin_logs/{logId} {
      allow read, write: if isAdmin();
    }

    // Configurações globais do sistema
    match /config/{configId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
```

---

## 4. Regras do Cloud Storage (`storage.rules`)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /bp_images/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.admin == true);
    }
  }
}
```

---

## 5. Índices Compostos do Firestore (`firestore.indexes.json`)

Para consultas ordenadas por data com filtro de `user_id`, os seguintes índices estão declarados:

```json
{
  "indexes": [
    {
      "collectionGroup": "bp_readings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "data_hora_afericao", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "glicemia_readings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "data_hora_afericao", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "weight_history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "data", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "admin_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```
