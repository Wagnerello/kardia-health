# 🩺 Especificação 03: Monitoramento Cardiovascular e Pressão Arterial

> **Documento:** Caderno de Especificação Clínica e Técnica do Módulo Cardiovascular  
> **Sistema:** KardIA — Assistente de Saúde Preventiva  
> **Versão:** 2.0.0  
> **Classificação:** Documento Técnico Oficial  

---

## 1. Visão Geral do Módulo

O módulo cardiovascular é o componente central do KardIA, projetado para rastrear, calcular estatísticas, classificar em tempo real e emitir pareceres preditivos sobre a pressão arterial e a frequência cardíaca do paciente, seguindo rigorosamente as diretrizes da **Organização Mundial da Saúde (OMS)**, da **Sociedade Brasileira de Cardiologia (SBC)** e do **American College of Cardiology / American Heart Association (ACC/AHA)**.

---

## 2. Modelo de Dados da Aferição (`BpReading`)

```typescript
// Localização: pressao-app/src/types.ts
export interface BpReading {
  id?: string;               // Identificador único do documento no Firestore
  user_id: string;          // UID do paciente autenticado (ForeignKey)
  sys: number;              // Pressão Sistólica em mmHg (Ex: 120)
  dia: number;              // Pressão Diastólica em mmHg (Ex: 80)
  pul: number;              // Frequência Cardíaca em Batimentos por Minuto / BPM (Ex: 72)
  data_hora_afericao: Date; // Timestamp da realização da medição
  image_url?: string;       // URL da fotografia do aparelho (Firebase Storage ou Base64)
  ai_feedback?: string;     // Parecer clínico emitido pela IA generativa
  grupo_id?: string;        // Identificador para agrupar medições triplas consecutivas
}
```

---

## 3. Matriz de Classificação Clínica (OMS / SBC / ACC / AHA)

A função pura `classificarPressao(sys: number, dia: number)` avalia os valores sistólicos e diastólicos de forma não linear e retorna a classificação com respectiva paleta cromática de segurança:

```typescript
// Localização: pressao-app/src/types.ts
export const classificarPressao = (sys: number, dia: number): BpClassificationInfo => {
  if (sys >= 180 || dia >= 120) {
    return {
      label: 'Crise Hipertensiva',
      cor: '#7B0D1E',
      corTexto: '#FFD6D6',
      descricao: '🚨 Emergência — procure a UPA agora',
      emoji: '🚨'
    };
  } else if (sys >= 140 || dia >= 90) {
    return {
      label: 'Hipertensão Estágio 2',
      cor: '#C62828',
      corTexto: '#FFEBEE',
      descricao: '🔴 Muito alta — busque seu médico em breve',
      emoji: '🔴'
    };
  } else if (sys >= 130 || dia >= 80) {
    return {
      label: 'Hipertensão Estágio 1',
      cor: '#E53935',
      corTexto: '#FFEBEE',
      descricao: '🟠 Pressão alta — consulta médica recomendada',
      emoji: '🟠'
    };
  } else if (sys >= 120 && dia < 80) {
    return {
      label: 'Pressão Elevada',
      cor: '#F57C00',
      corTexto: '#FFF8E1',
      descricao: '🟡 Atenção — monitore com frequência',
      emoji: '🟡'
    };
  } else if (sys < 90 || dia < 60) {
    return {
      label: 'Pressão Baixa',
      cor: '#1565C0',
      corTexto: '#E3F2FD',
      descricao: '🔵 Pressão baixa — hidrate-se e descanse',
      emoji: '🔵'
    };
  } else {
    return {
      label: 'Normal',
      cor: '#2E7D32',
      corTexto: '#E8F5E9',
      descricao: '🟢 Ótimo — dentro do ideal pela OMS',
      emoji: '🟢'
    };
  }
};
```

### 3.1. Tabela Resumo dos Critérios Diagnósticos

| Faixa Clínica | Sistólica (SYS) | Diastólica (DIA) | Nível de Urgência / Conduta | Cor Semântica |
| :--- | :--- | :--- | :--- | :--- |
| **Normal (Ideal OMS)** | $< 120\text{ mmHg}$ | **e** $< 80\text{ mmHg}$ | Manter estilo de vida saudável e monitoramento preventivo. | `#2E7D32` (Verde) |
| **Pressão Elevada** | $120 \text{ a } 129\text{ mmHg}$ | **e** $< 80\text{ mmHg}$ | Atenção com ingestão de sódio e atividade física regular. | `#F57C00` (Laranja/Amarelo) |
| **Hipertensão Estágio 1** | $130 \text{ a } 139\text{ mmHg}$ | **ou** $80 \text{ a } 89\text{ mmHg}$ | Recomendada reavaliação médica e acompanhamento semanal. | `#E53935` (Laranja Forte) |
| **Hipertensão Estágio 2** | $\ge 140\text{ mmHg}$ | **ou** $\ge 90\text{ mmHg}$ | Acompanhamento médico estrito e avaliação medicamentosa. | `#C62828` (Vermelho) |
| **Crise Hipertensiva** | $\ge 180\text{ mmHg}$ | **ou** $\ge 120\text{ mmHg}$ | **Risco Iminente:** Buscar atendimento emergencial (UPA/PS). | `#7B0D1E` (Bordô Alerta) |
| **Pressão Baixa (Hipotensão)**| $< 90\text{ mmHg}$ | **ou** $< 60\text{ mmHg}$ | Hidratação oral imediata, repouso e vigilância para tonturas. | `#1565C0` (Azul) |

---

## 4. Parâmetros Complementares e Hemodinâmica

### 4.1. Pressão de Pulso ($\text{PP}$)
A pressão de pulso é calculada pela fórmula $\text{PP} = \text{SYS} - \text{DIA}$.
- $\text{PP} \le 60\text{ mmHg}$: Elasticidade vascular preservada.
- $\text{PP} > 60\text{ mmHg}$: Indica rigidez da parede aórtica e aumento da velocidade da onda de pulso (VOP), comum em idosos e pacientes hipertensos de longa data. O KardIA sinaliza automaticamente esse achado nos feedbacks da IA.

### 4.2. Protocolo de Aferição Recomendado (OMS / SBC)
1. Repouso prévio de 5 minutos em ambiente calmo e com bexiga vazia.
2. Braço posicionado na altura do coração e apoiado em superfície plana.
3. Não ter consumido café, álcool ou tabaco nos 30 minutos anteriores.
4. **Tripla Medição:** Realizar 3 aferições consecutivas com intervalo de 1 a 2 minutos entre elas; o sistema agrupa os registros através de um `grupo_id` único para calcular a média representativa.

---

## 5. Algoritmos Estatísticos e Médias Móveis

A função `calcularMedias(afericoes: BpReading[])` calcula as médias aritméticas arredondadas para apresentação rápida no Dashboard:

$$\text{Média SYS} = \text{round}\left(\frac{\sum \text{sys}_i}{N}\right), \quad \text{Média DIA} = \text{round}\left(\frac{\sum \text{dia}_i}{N}\right), \quad \text{Média PUL} = \text{round}\left(\frac{\sum \text{pul}_i}{N}\right)$$

---

## 6. Visualização Gráfica e Séries Temporais (Chart.js)

O gráfico principal `bp-chart` renderiza até 90 dias de histórico com três curvas simultâneas e eixos calibrados para legibilidade clínica:
- **Linha Azul/Verde:** Sistólica (`borderColor: '#2563eb'`, `tension: 0.3`).
- **Linha Roxa/Rosa:** Diastólica (`borderColor: '#9333ea'`, `tension: 0.3`).
- **Linha Âmbar:** Pulso / BPM (`borderColor: '#d97706'`, `borderDash: [5, 5]`).
- **Faixas de Referência:** Linhas horizontais pontilhadas nos limites $120\text{ mmHg}$ (SYS) e $80\text{ mmHg}$ (DIA).
