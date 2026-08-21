<div align="center">

# ❤️ KardIA — Assistente de Saúde Preventiva 
(Open Source)

**Plataforma Inteligente de Monitoramento Cardiovascular, Metabólico e Gestão Preventiva de Saúde com Inteligência Artificial.**

[![Open Source](https://img.shields.io/badge/Open%20Source-GPL%20%2F%20MIT-brightgreen?style=for-the-badge&logo=open-source-initiative&logoColor=white)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Google Gemini & Groq](https://img.shields.io/badge/AI-Gemini%20%26%20Groq-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![LGPD Compliant](https://img.shields.io/badge/LGPD-Conforme-2E7D32?style=for-the-badge)](https://www.gov.br/anpd)

</div>

---

## 📖 A História por Trás do KardIA: Do Susto ao Propósito

> *"Como uma emergência em casa me fez criar o KardIA e o que aprendi aplicando SDD e IA na prática 🩺💻"*

Tudo começou quando a pressão arterial da minha esposa começou a oscilar de forma imprevisível. Em um momento estava tudo bem; poucas horas depois, víamos picos altíssimos que nos deixavam em alerta total.

Quem já passou por isso conhece a angústia: anotações soltas em pedaços de papel, conversas perdidas no WhatsApp, o medo constante de esquecer um detalhe crucial na consulta e a dúvida se aquilo era um pico isolado ou o início de uma tendência perigosa.

Diante desse cenário, percebi duas verdades fundamentais:
1. **Cadernos e notas soltas não oferecem a clareza, a rapidez e a segurança que a saúde exige.**
2. **Como desenvolvedor de software, eu tinha a capacidade técnica e a responsabilidade de construir uma solução real, precisa e sob medida.**

Foi assim que nasceu o **KardIA**. 

Decidi abrir o código deste projeto como **Open Source** para que outras famílias, pacientes e profissionais de saúde possam se beneficiar de uma tecnologia preventiva confiável, humana e acessível.

---

## 🛠️ Engenharia de Software: SDD e Inteligência Artificial Responsável

Tratando-se de dados vitais e de saúde humana, o sistema não podia ser feito no improviso. Para garantir máxima confiabilidade e robustez desde o primeiro dia, adotei **Spec-Driven Development (SDD)**: cada detalhe da arquitetura, das regras clínicas e do tratamento de exceções foi especificado antes da codificação.

### 🌟 Destaques da Implementação:

* 🔹 **IA Alinhada às Diretrizes Médicas (OMS & SBC)**: Integração com fallback inteligente de alta velocidade entre **Google Gemini** e **Groq**. O sistema correlaciona pressão arterial, glicemia, hidratação, IMC e medicamentos, emitindo pareceres preventivos pautados nas diretrizes da **OMS**, da **Sociedade Brasileira de Cardiologia (SBC)** e da **Sociedade Brasileira de Diabetes (SBD)**.
* 🔹 **Arquitetura Resiliente & Offline-First**: Rotinas de contingência local para que nenhuma medição seja perdida durante oscilações de conexão ou instabilidades de rede.
* 🔹 **Privacidade e LGPD por Design**: Criptografia de ponta a ponta, regras granulares de acesso no Firebase (RBAC) e consentimento de termos em conformidade rigorosa com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
* 🔹 **UX/UI Humanizada & Anti-Stress**: Interface desenvolvida para acolher o paciente e reduzir a ansiedade em momentos de crise, com hierarquia visual clara, cores terapêuticas e cards intuitivos.
* 🔹 **Impacto Clínico Real**: Nas consultas médicas, o paciente apresenta relatórios estruturados em PDF, com médias quinzenais, desvios-padrão e gráficos de tendência.

---

## 🚀 Funcionalidades do Ecossistema

### 🩺 1. Monitoramento Cardiovascular Completo
- Registro de Pressão Sistólica (SYS), Diastólica (DIA) e Pulso (BPM).
- Classificação instantânea pelas diretrizes **OMS / SBC / ACC / AHA**:
  - 🟢 **Normal**: < 120 / < 80 mmHg
  - 🟡 **Pressão Elevada**: 120–129 / < 80 mmHg
  - 🟠 **Hipertensão Estágio 1**: 130–139 ou 80–89 mmHg
  - 🔴 **Hipertensão Estágio 2**: ≥ 140 ou ≥ 90 mmHg
  - 🚨 **Crise Hipertensiva**: ≥ 180 ou ≥ 120 mmHg (alertas imediatos de emergência)

### 📸 2. Leitura Automática por Foto (OCR com IA)
- O paciente fotografa a tela do aparelho digital de pressão ou glicosímetro.
- A visão computacional extrai os valores automaticamente, reduzindo erros de digitação.

### 🩸 3. Controle Glicêmico & Diabetes
- Registro segmentado por momentos: *Jejum*, *Pós-prandial*, *Antes de Dormir* e *Aleatório*.
- Alertas para **Hipoglicemia** (< 70 mg/dL), **Pré-Diabetes** e **Hiperglicemia** (padrão SBD/ADA).

### 💧 4. Rastreamento Inteligente de Hidratação
- Cálculo da meta diária com base no peso corporal (ex: 35ml/kg).
- Registro rápido de ingestão com gráficos semanais de aderência à meta.

### 💊 5. Gestão Farmacológica
- Cadastro de medicamentos de uso **Contínuo** ou **Temporário**.
- Controle de posologia, frequência e horários das doses.

### ⚖️ 6. Cálculo Estratificado de IMC
- Três curvas distintas de classificação:
  1. **Crianças e Adolescentes (< 19 anos)**: Percentis de crescimento da OMS.
  2. **Adultos (19 a 59 anos)**: Faixas clássicas da OMS.
  3. **Idosos (≥ 60 anos)**: Critérios adaptados OMS/OPAS (eutrofia entre 22 e 27 kg/m²).

### 📄 7. Exportação de Laudo Médico em PDF
- Geração instantânea de relatório médico estruturado com `html2pdf.js` para apresentação em consultas e prontuários.

### 🛡️ 8. Painel Administrativo (Super Usuário)
- Painel para gestão de usuários, liberação de acessos, planos e logs de auditoria do sistema.

---

## 🛠️ Stack Tecnológico

* **Frontend**: TypeScript, Vite, HTML5 Semântico, Vanilla CSS Moderno (Design System dedicado).
* **Visualização de Dados & Documentos**: Chart.js, Marked, DOMPurify, html2pdf.js.
* **Backend Serverless**: Firebase Authentication, Cloud Firestore, Cloud Storage, Firebase Cloud Functions (Node.js).
* **Motores de IA**: Google Gemini API (`@google/generative-ai`) e Groq SDK.

---

## 📂 Estrutura do Projeto

```
kardia-health/
├── .gitignore                   # Proteção rigorosa de credenciais e builds
├── .env.example                 # Modelo limpo de variáveis de ambiente
├── LICENSE                      # Licença MIT com Medical Disclaimer
├── SECURITY.md                  # Política de segurança e reporte de vulnerabilidades
├── README.md                    # Documentação do ecossistema
├── index.html                   # Aplicação SPA e Landing Page
├── package.json                 # Configuração de scripts e dependências
├── tsconfig.json                # Configuração do TypeScript
├── functions/                   # Cloud Functions seguras (Node.js)
│   ├── index.js                 # Integração de IA serverless
│   └── package.json
└── src/
    ├── firebase.ts              # Conexão e inicialização dos serviços Firebase
    ├── types.ts                 # Tipagens e classificações médicas (OMS/SBC/SBD)
    ├── style.css                # Design System responsivo e temas
    ├── main.ts                  # Controladores da aplicação e fluxo de telas
    └── services/                # Regras de negócio e comunicação com APIs
        ├── afericoes.ts         # Módulo de pressão arterial
        ├── glicemia.ts          # Módulo de controle de glicose
        ├── agua.ts              # Módulo de hidratação
        ├── medications.ts       # Módulo farmacológico
        ├── auth.ts              # Autenticação e RBAC
        ├── ocr.ts               # Reconhecimento óptico de caracteres
        └── analise-diaria.ts    # Pareceres preditivos de IA
```

---

## ⚙️ Instalação e Execução Local

### Pré-requisitos
- **Node.js**: Versão 18 ou superior.
- **NPM** ou gerenciador de pacotes equivalente.
- Projeto configurado no [Firebase Console](https://console.firebase.google.com/).

### Passo a Passo

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/Wagnerello/kardia-health.git
   cd kardia-health
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Configurar as Variáveis de Ambiente:**
   Copie o arquivo `.env.example` para `.env` e preencha com suas chaves:
   ```bash
   cp .env.example .env
   ```

4. **Rodar em modo de desenvolvimento:**
   ```bash
   npm run dev
   ```

5. **Build de Produção:**
   ```bash
   npm run build
   ```

---

## 🔒 Segurança e Privacidade (LGPD)

- O KardIA foi concebido seguindo o princípio de **Privacy by Design**.
- Nenhum dado médico é comercializado ou compartilhado para fins publicitários.
- As chamadas de IA utilizam dados anonimizados estritamente voltados à assistência preventiva.

---

## 📄 Licença e Isenção de Responsabilidade

Este projeto está sob a licença **MIT** com aditivo de responsabilidade médica — consulte o arquivo [LICENSE](LICENSE) para detalhes completos.

> ⚠️ **Aviso Médico Legal**: O KardIA é uma ferramenta de suporte ao monitoramento preventivo e **NÃO substitui consulta médica, diagnóstico clínico ou prescrição terapêutica**. Em caso de emergência ou crise hipertensiva, procure imediatamente atendimento médico especializado.
