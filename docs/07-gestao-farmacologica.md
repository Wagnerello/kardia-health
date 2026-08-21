# 💊 Especificação 07: Gestão Farmacológica e Acompanhamento de Medicações

> **Documento:** Caderno de Especificação Técnica do Módulo de Medicamentos e Suplementos  
> **Sistema:** KardIA — Assistente de Saúde Preventiva  
> **Versão:** 2.0.0  
> **Classificação:** Documento Técnico Oficial  

---

## 1. Visão Geral do Módulo

O módulo farmacológico permite o registro minucioso de todos os medicamentos prescritos, suplementos e fitoterápicos em uso pelo paciente. A lista ativa de medicamentos é injetada automaticamente no contexto de todos os motores de Inteligência Artificial do KardIA para que a IA correlacione a eficácia terapêutica das doses com os picos pressóricos e as oscilações glicêmicas registradas.

---

## 2. Modelo de Dados da Medicação (`Medication`)

```typescript
// Localização: pressao-app/src/types.ts
export interface Medication {
  id?: string;                // Identificador do documento na coleção 'user_medications'
  user_id: string;           // UID do paciente
  nome: string;              // Nome comercial ou princípio ativo (Ex: Losartana Potássica)
  dosagem: string;           // Concentração posológica (Ex: 50mg, 10 UI, 500mg)
  frequencia: string;        // Intervalo de administração (Ex: 1x ao dia pela manhã, 12/12h)
  tipo: 'Continuo' | 'Temporario'; // Regime de tratamento
  ativa: boolean;            // Status da prescrição
  data_inicio?: Date;        // Data de início da administração
  data_fim?: Date;           // Data calculada de término (para uso temporário)
  data_criacao: Date;        // Timestamp de cadastro no sistema
}
```

---

## 3. Regimes Terapêuticos e Regras de Vigência

### 3.1. Uso Contínuo (`tipo: 'Continuo'`)
- Indicado para doenças crônicas não transmissíveis (DCNT), como Hipertensão Arterial Sistêmica e Diabetes Mellitus.
- Não possui data de encerramento programada. Permanece ativo até que o paciente ou o médico altere o status manualmente.

### 3.2. Uso Temporário (`tipo: 'Temporario'`)
- Indicado para infecções, inflamações agudas ou ciclos suplementares (ex.: Amoxicilina 875mg por 7 dias, Prednisona 20mg por 5 dias).
- A interface solicita a **Data de Início** e a **Duração em Dias**, calculando automaticamente:
$$\text{data\_fim} = \text{data\_inicio} + (\text{duracao\_dias} \times 86.400.000\text{ ms})$$

---

## 4. Algoritmo de Filtragem de Medicações Ativas

Para garantir que a IA não considere tratamentos já finalizados, a função de montagem de prompt aplica o seguinte filtro:

```typescript
// Localização: pressao-app/src/services/afericoes.ts
const medsAtivas = medicacoes.filter(m => {
  if (!m.ativa) return false;
  if (m.tipo === 'Temporario' && m.data_fim && new Date() > m.data_fim) {
    return false; // Medicamento temporário com prazo expirado
  }
  return true;
});
```

---

## 5. Injeção de Contexto Farmacológico na Inteligência Artificial

Quando o paciente registra uma aferição de pressão ou glicose, o texto formatado das medicações ativas é inserido no prompt enviado ao Google Gemini ou Groq:

```text
MEDICAÇÕES/SUPLEMENTOS EM USO:
- Losartana Potássica (50mg) - 1x ao dia pela manhã [Continuo]
- Anlodipino (5mg) - 1x ao dia à noite [Continuo]
- Metformina XR (500mg) - 2x ao dia após refeições [Continuo]
```

### 5.1. Análise Cruzada de Efeitos Farmacológicos
A IA avalia:
1. **Picos no Horário do Fim da Dose:** Se a pressão sobe no final da tarde antes da tomada noturna, a IA sugere levar esse dado para discussão médica sobre ajuste de posologia.
2. **Interações Farmacológicas Adversas:** Medicamentos que aumentam a pressão arterial (ex: anti-inflamatórios não esteroides - AINEs ou descongestionantes nasais) são identificados caso o paciente os cadastre como uso temporário.
