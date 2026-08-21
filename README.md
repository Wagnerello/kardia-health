<div align="center">

# ❤️ KardIA — Assistente de Saúde Preventiva SaaS

**Plataforma Inteligente de Monitoramento Cardiovascular, Metabólico e Gestão Preventiva de Saúde com Inteligência Artificial.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![LGPD Compliant](https://img.shields.io/badge/LGPD-Conforme-2E7D32?style=for-the-badge)](https://www.gov.br/anpd)

</div>

---

## 📌 Visão Geral do Projeto

O **KardIA** é um SaaS de saúde preventiva de alto padrão visual e técnico, projetado para capacitar pacientes no acompanhamento de indicadores vitais e facilitar a comunicação com profissionais da saúde. O sistema combina **inteligência artificial generativa**, **visão computacional (OCR)** e **métricas de saúde baseadas em diretrizes médicas internacionais (OMS, ACC/AHA, SBD e ADA)**.

A plataforma foi construída com foco absoluto em **experiência do usuário (UX/UI Premium)**, oferecendo uma landing page de alta conversão, painel intuitivo para o paciente e um **Painel Administrativo (Super Usuário)** completo para gestão de planos, status de contas e auditoria.

---

## 🎯 Pilares e Regras Arquiteturais

O desenvolvimento e a governança do projeto seguem premissas rigorosas:

1. **Idioma de Operação**: Todo o código, comentários, documentação e interface são estritamente mantidos em **Português do Brasil (pt-BR)**.
2. **Design SaaS Premium & UX Humanizada**:
   - Paleta de cores harmoniosa, desenhada especialmente para o nicho de saúde e bem-estar (tons de azul clínico, verde esmeralda para normalidade, âmbar/vermelho para alertas e fundo suave de alto contraste).
   - Microanimações fluidas, tipografia moderna e design responsivo (Mobile-First / PWA-Ready).
3. **Landing Page Persuasiva & Conversão**:
   - Área de entrada com copywriting convincente, destacando benefícios imediatos, segurança de dados e credibilidade médica.
   - Fluxo de autenticação (Login / Cadastro) integrado e elegante.
4. **Painel de Super Usuário (Admin)**:
   - Módulo administrativo exclusivo com controle de acesso baseado em papéis (RBAC - *Role-Based Access Control*).
   - Gestão de usuários, aprovação de contas (Pendente, Ativo, Suspenso), atribuição de planos (Gratuito, Premium, Ouro) e monitoramento de métricas do sistema.
5. **Privacidade e Conformidade LGPD**:
   - Termos de Uso e Política de Privacidade interativos, com leitura obrigatória via scroll progressivo antes da aceitação.
   - Registro de consentimento com timestamp e versão para auditoria legal (Art. 7º e 11 da LGPD).
6. **Política Estrita de Versionamento**:
   - Commits e pushes são realizados exclusivamente sob solicitação e após validação e testes dos fluxos.

---

## 🚀 Funcionalidades Principais

### 🩺 1. Monitoramento Cardiovascular (Pressão Arterial e Pulso)
- Registro rápido de Pressão Sistólica (SYS), Diastólica (DIA) e Frequência Cardíaca (PUL).
- Classificação automática em tempo real pelas diretrizes da **OMS / ACC / AHA**:
  - 🟢 **Normal**: < 120 / < 80 mmHg
  - 🟡 **Pressão Elevada**: 120–129 / < 80 mmHg
  - 🟠 **Hipertensão Estágio 1**: 130–139 ou 80–89 mmHg
  - 🔴 **Hipertensão Estágio 2**: ≥ 140 ou ≥ 90 mmHg
  - 🚨 **Crise Hipertensiva**: ≥ 180 ou ≥ 120 mmHg (com alertas de emergência imediata)

### 📸 2. Leitura Automática por Câmera / Foto (OCR com IA)
- O paciente pode tirar uma foto do monitor digital de pressão.
- A IA extrai automaticamente os valores de Sistólica, Diastólica e Pulso, eliminando erros de digitação manual.

### 🩸 3. Controle Glicêmico & Diabetes
- Registro e classificação de glicemia capilar conforme a **Sociedade Brasileira de Diabetes (SBD)** e **ADA**:
  - Contextos de aferição: *Jejum*, *Pós-prandial*, *Antes de Dormir* e *Aleatório*.
  - Detecção precoce de **Hipoglicemia** (< 70 mg/dL), **Pré-Diabetes** e **Hiperglicemia**.

### 💧 4. Rastreamento Inteligente de Hidratação
- Cálculo dinâmico de meta hídrica diária baseada no peso corporal do paciente.
- Adição rápida de copos (200ml, 350ml, 500ml) com visualização em barra de progresso diária e navegação pelo histórico semanal.

### 💊 5. Gestão de Medicamentos
- Cadastro de medicações de uso **Contínuo** ou **Temporário**.
- Definição de dosagem, horários, frequência e controle de status (ativo/inativo).

### ⚖️ 6. Cálculo Estratificado de IMC
- Algoritmo especializado com 3 curvas distintas de interpretação:
  1. **Crianças e Adolescentes (< 19 anos)**: Curvas de percentil de crescimento da OMS.
  2. **Adultos (19 a 59 anos)**: Faixas padrão da OMS (Baixo peso, Eutrofia, Sobrepeso, Obesidade I, II e III).
  3. **Idosos (≥ 60 anos)**: Critérios adaptados da OMS/OPAS (eutrofia entre 22 e 27 kg/m²).

### 🤖 7. Análises de Saúde & Feedback Preventivo com IA (Google Gemini)
- Cruzamento de dados de pressão, glicemia, peso, medicações e histórico recente.
- Emissão de pareceres informativos e educativos com linguagem clara e acolhedora, auxiliando na identificação de padrões e gatilhos de oscilação.

### 📄 8. Exportação de Relatórios Médicos em PDF
- Geração instantânea de laudos completos e formatados profissionalmente para apresentação em consultas médicas, utilizando `html2pdf.js`.

### 🛡️ 9. Painel Administrativo (Super Usuário)
- Visão geral com KPIs de usuários cadastrados, ativos e pendentes.
- Tabela com filtros avançados por plano e status.
- Modais administrativos para aprovar, suspender, alterar planos e editar perfis.

---

## 🛠️ Arquitetura e Tecnologias

```
pressao/
├── CLAUDE.md                    # Diretrizes e governança de IA
├── firestore.rules              # Regras de segurança granulares do Firestore
├── firestore.indexes.json       # Índices compostos para consultas otimizadas
├── set_admin_claim.js           # Script seguro para atribuição de Custom Claims Admin
└── pressao-app/                 # Aplicação Frontend + Cloud Functions
    ├── index.html               # SPA com Landing Page, Modais e Telas do App
    ├── package.json             # Dependências e scripts do projeto
    ├── tsconfig.json            # Configuração do TypeScript
    ├── functions/               # Firebase Cloud Functions (Node.js)
    │   ├── index.js             # Endpoints seguros e integração com Gemini SDK
    │   └── package.json
    └── src/
        ├── firebase.ts          # Inicialização e exportação dos serviços Firebase
        ├── types.ts             # Interfaces TypeScript e funções de classificação médica
        ├── style.css            # Design System (Tokens, Temas, Componentes, Responsividade)
        ├── main.ts              # Controladores de tela, eventos e orquestração da SPA
        └── services/            # Camada de serviços e regras de negócio
            ├── afericoes.ts     # CRUD e cálculos de pressão arterial
            ├── glicemia.ts      # CRUD e cálculos de glicose
            ├── agua.ts          # Rastreamento de ingestão de água
            ├── medications.ts   # Gestão de tratamentos farmacológicos
            ├── auth.ts          # Autenticação, perfis e controle RBAC
            ├── ocr.ts           # Reconhecimento óptico de imagens
            └── analise-diaria.ts# Geração de resumos e relatórios com IA
```


---

## 📚 Especificações Técnicas Detalhadas (Pasta `/docs`)

Para especificações exaustivas de cada funcionalidade, esquemas NoSQL, diretrizes clínicas da OMS/SBC/SBD e arquitetura de IA sem resumos, consulte a pasta [`docs/`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/pressao-app/docs/README.md):

- 🏗️ [`01-arquitetura-e-visao-geral.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/01-arquitetura-e-visao-geral.md) — Arquitetura C4, Tech Stack e Resiliência.
- 🔐 [`02-autenticacao-e-perfil-de-usuario.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/02-autenticacao-e-perfil-de-usuario.md) — Firebase Auth, Google Popup, LGPD Scroll Lock 95% e Anamnese.
- 🩺 [`03-monitoramento-cardiovascular.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/03-monitoramento-cardiovascular.md) — Classificações OMS/SBC/ACC/AHA e Pressão de Pulso.
- 📸 [`04-visao-computacional-ocr.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/04-visao-computacional-ocr.md) — OCR Multimodal com IA Gemini.
- 🩸 [`05-controle-glicemico-e-diabetes.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/05-controle-glicemico-e-diabetes.md) — Gestão de Glicose e Diretrizes SBD/ADA.
- 💧 [`06-gestao-de-hidratacao.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/06-gestao-de-hidratacao.md) — Meta Diária (35ml/kg) e Histórico Semanal.
- 💊 [`07-gestao-farmacologica.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/07-gestao-farmacologica.md) — Fármacos Contínuos vs Temporários e IA.
- ⚖️ [`08-antropometria-e-historico-de-peso.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/08-antropometria-e-historico-de-peso.md) — 3 Curvas de IMC e Histórico de Peso.
- 🤖 [`09-motor-de-inteligencia-artificial.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/09-motor-de-inteligencia-artificial.md) — Cascata Gemini/Groq e Prompts Clínicos.
- 📄 [`10-exportacao-e-laudos-medicos.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/10-exportacao-e-laudos-medicos.md) — Relatórios e Laudos em PDF com `html2pdf.js`.
- 🛡️ [`11-painel-administrativo-super-user.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/11-painel-administrativo-super-user.md) — Custom Claims, Gestão e Auditoria Admin.
- 🗄️ [`12-banco-de-dados-seguranca-e-regras.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/12-banco-de-dados-seguranca-e-regras.md) — Esquemas Firestore e Regras de Segurança.
- 🎨 [`13-design-system-ui-ux.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/13-design-system-ui-ux.md) — Tokens de Design e Psicologia de Cores.

---


## ⚙️ Instalação e Execução Local

### Pré-requisitos
- **Node.js**: Versão 18.x ou superior instalada.
- **NPM** ou **Yarn**.
- Conta e projeto configurados no [Google Firebase Console](https://console.firebase.google.com/).

### Passo a Passo

1. **Clonar ou acessar o diretório do projeto:**
   ```bash
   cd c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/pressao-app
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Configurar as Variáveis de Ambiente:**
   Crie um arquivo `.env` na pasta `pressao-app/` baseado no `.env.example`:
   ```env
   # Firebase Config
   VITE_FIREBASE_API_KEY=sua_api_key
   VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=seu_projeto_id
   VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
   VITE_FIREBASE_APP_ID=seu_app_id

   # Google AI & Vision APIs
   VITE_GEMINI_API_KEY=sua_chave_gemini
   VITE_GOOGLE_VISION_API_KEY=sua_chave_vision
   ```

4. **Executar o Servidor de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a aplicação no navegador pelo endereço informado no terminal (normalmente `http://localhost:5173`).

---

## 🔐 Configuração do Super Usuário (Admin)

Para conceder privilégios de **Super Usuário** com acesso ao Painel Admin:

1. Acesse o Firebase Console > **Configurações do Projeto** > **Contas de Serviço** e clique em **Gerar nova chave privada**.
2. Salve o arquivo JSON como `serviceAccountKey.json` na raiz do repositório (`pressao/`).
3. Abra o arquivo [set_admin_claim.js](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/set_admin_claim.js) e insira o `UID` do usuário desejado na constante:
   ```javascript
   const uid = 'UID_DO_USUARIO_AQUI';
   ```
4. Execute o script via Node.js na raiz:
   ```bash
   node set_admin_claim.js
   ```
5. O usuário precisará realizar logout e login novamente para carregar as novas permissões no token JWT.

---

## 📦 Deploy e Manutenção de Serviços

### Deploy do Frontend (Firebase Hosting):
```bash
cd pressao-app
npm run build
firebase deploy --only hosting
```

### Deploy das Regras de Segurança e Índices do Firestore:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Deploy das Cloud Functions:
```bash
cd pressao-app/functions
npm install
firebase functions:config:set gemini.key="SUA_CHAVE_GEMINI"
firebase deploy --only functions
```

---

## 🔒 Segurança e Privacidade (LGPD)

- **Criptografia em Trânsito**: Todas as requisições utilizam HTTPS e TLS 1.3.
- **Regras Firestore com RBAC**: Leitura e escrita de prontuários, aferições e logs restritas estritamente ao próprio paciente e a administradores autenticados.
- **Tratamento Ético de Dados Médicos**: Nenhum dado clínico é comercializado. Dados enviados aos modelos de IA são anonimizados e restritos ao propósito de assistência pessoal informativa.

---

## 📄 Licença

Este projeto é de uso proprietário e confidencial. Todos os direitos reservados.
