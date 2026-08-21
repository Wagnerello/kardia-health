# 📚 KardIA — Documentação e Especificações Técnicas Completas do Sistema

> **Status do Projeto:** Produção / Open Source (GPL / MIT)  
> **Versão do Sistema:** v2.0.0  
> **Padrão de Engenharia:** Spec-Driven Development (SDD) & Privacy by Design (LGPD)  
> **Data de Compilação:** Julho / Agosto de 2026  

---

## 🩺 1. Visão Geral do KardIA

O **KardIA** é um ecossistema inteligente de saúde preventiva, monitoramento cardiovascular, controle metabólico e gestão clínica individualizada. O sistema combina prontuário pessoal de saúde, visão computacional para leitura automática de aparelhos médicos (esfigmomanômetros digitais e glicosímetros), inteligência artificial generativa multidisciplinar com diretrizes clínicas (OMS, SBC, SBD e ADA), e ferramentas de geração de relatórios e laudos médicos para apresentação em consultas.

Toda a arquitetura do KardIA foi desenvolvida sob os preceitos de **Spec-Driven Development (SDD)**, garantindo que cada funcionalidade, regra médica, cálculo de risco, fluxo de tela e mecanismo de contingência esteja rigorosamente documentado e alinhado aos mais altos padrões de engenharia de software e segurança da informação.

---

## 🗂️ 2. Estrutura Modular das Especificações

A documentação do KardIA está dividida em 13 cadernos de especificação técnica e funcional detalhada, sem resumos, cobrindo todos os fluxos de ponta a ponta:

| Arquivo de Especificação | Módulo / Domínio | Principais Tópicos Cobertos |
| :--- | :--- | :--- |
| [`01-arquitetura-e-visao-geral.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/01-arquitetura-e-visao-geral.md) | **Arquitetura e Visão Geral** | C4 Architecture, Tech Stack, Resiliência, Offline-First, LGPD e PWA. |
| [`02-autenticacao-e-perfil-de-usuario.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/02-autenticacao-e-perfil-de-usuario.md) | **Autenticação, RBAC e Perfil** | Firebase Auth, Google Popup, LGPD Scroll Lock 95%, Anamnese e Ciclo de Vida. |
| [`03-monitoramento-cardiovascular.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/03-monitoramento-cardiovascular.md) | **Monitoramento Cardiovascular** | SYS/DIA/PUL, Diretrizes OMS/SBC/AHA, Pressão de Pulso, Gráficos Chart.js e Médias. |
| [`04-visao-computacional-ocr.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/04-visao-computacional-ocr.md) | **Visão Computacional & OCR** | Canvas Compression, Pipeline Multimodal Gemini, Extração JSON e Fallbacks. |
| [`05-controle-glicemico-e-diabetes.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/05-controle-glicemico-e-diabetes.md) | **Controle Glicêmico & Diabetes** | Momentos fisiológicos, Diretrizes SBD/ADA, Hipoglicemia, HbA1c e Gráficos. |
| [`06-gestao-de-hidratacao.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/06-gestao-de-hidratacao.md) | **Gestão de Hidratação** | Cálculo 35ml/kg, Atalhos rápidos de volume, Offset semanal e Indicadores. |
| [`07-gestao-farmacologica.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/07-gestao-farmacologica.md) | **Gestão Farmacológica** | Uso Contínuo vs Temporário, Posologia, Prazos e Injeção de Contexto na IA. |
| [`08-antropometria-e-historico-de-peso.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/08-antropometria-e-historico-de-peso.md) | **Antropometria & IMC** | 3 Curvas OMS (Jovens, Adultos e Idosos OPAS), Histórico de Peso e Reavaliação. |
| [`09-motor-de-inteligencia-artificial.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/09-motor-de-inteligencia-artificial.md) | **Motor de Inteligência Artificial** | Cascata Gemini 2.0 -> 1.5 -> Groq Llama 3.3 -> Local, Prompts e Guardrails. |
| [`10-exportacao-e-laudos-medicos.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/10-exportacao-e-laudos-medicos.md) | **Laudos Médicos & PDF** | Relatórios Integrados OMS, Exportação com html2pdf.js, Soft-Delete e Markdown. |
| [`11-painel-administrativo-super-user.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/11-painel-administrativo-super-user.md) | **Painel Super Usuário (Admin)** | Custom Claims, KPIs em tempo real, Gestão de Usuários, Logs e Broadcast. |
| [`12-banco-de-dados-seguranca-e-regras.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/12-banco-de-dados-seguranca-e-regras.md) | **Banco de Dados & Segurança** | Modelagem Firestore, Regras de Segurança, Índices e Cloud Functions. |
| [`13-design-system-ui-ux.md`](file:///c:/Users/wagner.msilva/Desktop/PROJETOS/pressao/docs/13-design-system-ui-ux.md) | **Design System & UI/UX** | Paleta Cromática de Saúde, Componentes, Modais, Toasts e Responsividade. |

---

## 🏛️ 3. Glossário Clínico e Tecnológico do Ecossistema

- **SYS (Pressão Arterial Sistólica):** Pico de pressão no leito arterial durante a contração ventricular (sístole). Medido em milímetros de mercúrio (mmHg).
- **DIA (Pressão Arterial Diastólica):** Pressão residual nas artérias durante o relaxamento ventricular (diástole). Medido em mmHg.
- **PUL (Frequência Cardíaca / Pulso):** Batimentos cardíacos por minuto (BPM).
- **PP (Pressão de Pulso):** Diferença aritmética entre a pressão sistólica e a diastólica (`SYS - DIA`). Valores $> 60\text{ mmHg}$ indicam enrijecimento arterial aumentado.
- **Glicemia Capilar:** Concentração de glicose no sangue medida em miligramas por decilitro (mg/dL).
- **HbA1c (Hemoglobina Glicada):** Indicador de controle glicêmico médio dos últimos 90 a 120 dias expresso em porcentagem (%).
- **IMC (Índice de Massa Corporal):** Relação entre massa (kg) e o quadrado da estatura (m²): $\text{IMC} = \frac{\text{peso}}{\text{altura}^2}$.
- **Eutrofia:** Estado nutricional ideal ou peso adequado correspondente à faixa etária segundo critérios médicos internacionais.
- **Custom Claims:** Atributos criptografados anexados ao JSON Web Token (JWT) do Firebase Authentication para validação stateless de privilégios de Super Usuário (`admin: true`).
- **Soft-Delete:** Inativação lógica de registros preservando o histórico de auditoria médica sem exclusão destrutiva física.
