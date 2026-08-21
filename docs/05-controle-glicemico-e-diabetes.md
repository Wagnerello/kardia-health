# 🩸 Especificação 05: Controle Glicêmico e Gestão do Diabetes

> **Documento:** Caderno de Especificação Clínica do Módulo Metabólico e Glicêmico  
> **Sistema:** KardIA — Assistente de Saúde Preventiva  
> **Versão:** 2.0.0  
> **Classificação:** Documento Técnico Oficial  

---

## 1. Visão Geral do Módulo

O módulo de controle glicêmico do KardIA foi projetado para pacientes com Diabetes Mellitus (Tipo 1 e Tipo 2), Pré-Diabetes, Síndrome Metabólica ou em acompanhamento preventivo. Ele permite o registro segmentado por momentos do ciclo alimentar e circadiano, cruzando os níveis de glicose com a hidratação, medicações hipoglicemiantes e histórico cardiovascular.

---

## 2. Modelo de Dados da Glicemia (`GlicemiaReading`)

```typescript
// Localização: pressao-app/src/types.ts
export interface GlicemiaReading {
  id?: string;               // Identificador do documento no Firestore
  user_id: string;          // UID do paciente
  valor: number;            // Concentração de glicose no sangue em mg/dL (Ex: 95)
  momento: 'jejum' | 'pos_prandial' | 'antes_dormir' | 'aleatorio'; // Momento fisiológico
  data_hora_afericao: Date; // Momento do teste
  ai_feedback?: string;     // Parecer endocrinológico emitido pela IA
  hba1c?: number;           // Valor opcional de Hemoglobina Glicada (%)
}
```

---

## 3. Matriz de Classificação Clínica (SBD / ADA)

A função `classificarGlicemia(valor, momento)` aplica os critérios diagnósticos da **Sociedade Brasileira de Diabetes (SBD)** e da **American Diabetes Association (ADA)**:

```typescript
// Localização: pressao-app/src/types.ts
export const classificarGlicemia = (
  valor: number,
  momento: 'jejum' | 'pos_prandial' | 'antes_dormir' | 'aleatorio'
): GlicemiaClassificationInfo => {
  // Hipoglicemia tem prioridade absoluta em qualquer momento
  if (valor < 70) {
    return {
      label: 'Hipoglicemia',
      cor: '#D32F2F',
      corTexto: '#FFEBEE',
      descricao: '🚨 Muito baixa! Consuma 15g de carboidrato rápido imediatamente',
      emoji: '🚨'
    };
  }

  if (momento === 'jejum') {
    if (valor >= 126) {
      return {
        label: 'Hiperglicemia (Diabetes)',
        cor: '#C62828',
        corTexto: '#FFEBEE',
        descricao: '🔴 Valor elevado para jejum — consulte seu médico',
        emoji: '🔴'
      };
    } else if (valor >= 100) {
      return {
        label: 'Pré-Diabetes',
        cor: '#F57C00',
        corTexto: '#FFF8E1',
        descricao: '🟡 Atenção — glicemia de jejum alterada',
        emoji: '🟡'
      };
    } else {
      return {
        label: 'Normal',
        cor: '#2E7D32',
        corTexto: '#E8F5E9',
        descricao: '🟢 Excelente — valor ideal para jejum (< 100 mg/dL)',
        emoji: '🟢'
      };
    }
  } else if (momento === 'pos_prandial') {
    if (valor >= 200) {
      return {
        label: 'Hiperglicemia (Diabetes)',
        cor: '#C62828',
        corTexto: '#FFEBEE',
        descricao: '🔴 Valor elevado pós-refeição (≥ 200 mg/dL)',
        emoji: '🔴'
      };
    } else if (valor >= 140) {
      return {
        label: 'Pré-Diabetes',
        cor: '#F57C00',
        corTexto: '#FFF8E1',
        descricao: '🟡 Atenção — tolerância diminuída à glicose',
        emoji: '🟡'
      };
    } else {
      return {
        label: 'Normal',
        cor: '#2E7D32',
        corTexto: '#E8F5E9',
        descricao: '🟢 Excelente — valor ideal pós-prandial (< 140 mg/dL)',
        emoji: '🟢'
      };
    }
  } else {
    // Aleatório ou Antes de Dormir
    if (valor >= 200) {
      return {
        label: 'Hiperglicemia',
        cor: '#C62828',
        corTexto: '#FFEBEE',
        descricao: '🔴 Valor muito alto — hidrate-se e monitore',
        emoji: '🔴'
      };
    } else if (valor >= 140) {
      return {
        label: 'Elevada',
        cor: '#F57C00',
        corTexto: '#FFF8E1',
        descricao: '🟡 Atenção — acima do ideal para o momento',
        emoji: '🟡'
      };
    } else {
      return {
        label: 'Normal',
        cor: '#2E7D32',
        corTexto: '#E8F5E9',
        descricao: '🟢 Ideal — dentro do esperado para o momento',
        emoji: '🟢'
      };
    }
  }
};
```

---

## 4. Tabela de Metas Glicêmicas Estratificadas

| Momento Fisiológico | Normal (Sem Diabetes) | Meta Alvo (Diabético Adulto) | Alerta de Atenção | Alerta Crítico |
| :--- | :--- | :--- | :--- | :--- |
| **Jejum (≥ 8h)** | $70 \text{ a } 99\text{ mg/dL}$ | $80 \text{ a } 130\text{ mg/dL}$ | $100 \text{ a } 125\text{ mg/dL}$ (Pré-DM) | $< 70$ ou $\ge 126\text{ mg/dL}$ |
| **Pós-Prandial (2h)**| $< 140\text{ mg/dL}$ | $< 180\text{ mg/dL}$ | $140 \text{ a } 199\text{ mg/dL}$ | $\ge 200\text{ mg/dL}$ |
| **Antes de Dormir** | $90 \text{ a } 139\text{ mg/dL}$ | $100 \text{ a } 140\text{ mg/dL}$ | $140 \text{ a } 199\text{ mg/dL}$ | $< 80$ (risco noturno) ou $\ge 200$ |

---

## 5. Injeção de Contexto Farmacológico na IA

Ao gerar o feedback endocrinológico (`gerarFeedbackGlicemiaIA`), o sistema filtra da coleção `/user_medications` os fármacos relacionados ao metabolismo de carboidratos:

- **Biguanidas:** Metformina, Glifage.
- **Sulfonilureias:** Gliclazida (Diamicron), Glimepirida, Glipizida.
- **Inibidores de SGLT2:** Empagliflozina (Jardiance), Dapagliflozina (Forxiga).
- **Agonistas de GLP-1:** Liraglutida (Victoza/Saxenda), Semaglutida (Ozempic/Rybelsus).
- **Insulinas:** NPH, Regular, Glargina (Lantus), Degludeca (Tresiba), Lispro (Humalog), Aspart (NovoRapid).

### Guardrails Éticos Obrigatórios:
1. **Sem Alarmismo:** Nunca emitir diagnósticos catastróficos imediatos (ex: "você sofrerá amputação").
2. **Ponderação Circadiana:** Ao analisar hidratação matinal, reconhecer que medições feitas no início do dia refletem volume ingerido até aquele momento, não o total diário.
3. **Protocolo de Hipoglicemia (< 70 mg/dL):** Orientar a regra dos 15g de carboidrato simples (1 colher de sopa de açúcar na água ou 150ml de suco integral) e nova medição após 15 minutos.
