# 💧 Especificação 06: Gestão e Rastreamento Inteligente de Hidratação

> **Documento:** Caderno de Especificação Técnica do Módulo de Hidratação  
> **Sistema:** KardIA — Assistente de Saúde Preventiva  
> **Versão:** 2.0.0  
> **Classificação:** Documento Técnico Oficial  

---

## 1. Visão Geral do Módulo

A hidratação é uma variável crítica no controle da volemia, débito cardíaco, resistência vascular periférica e função renal. O KardIA monitora o consumo hídrico diário do paciente, calcula metas individualizadas com base na massa corporal e correlaciona a ingestão de líquidos diretamente com a oscilação da pressão arterial e a concentração glicêmica.

---

## 2. Modelo de Dados da Hidratação (`DailyWaterLog`)

```typescript
// Localização: pressao-app/src/types.ts
export interface DailyWaterLog {
  id?: string;          // Formato: `${user_id}_${date_string}`
  user_id: string;      // UID do paciente
  date_string: string;  // Data no formato ISO local YYYY-MM-DD (Ex: 2026-08-21)
  amount_ml: number;    // Volume total consumido no dia em mililitros (mL)
  meta_ml: number;      // Meta calculada para o paciente em mL (Ex: 2625)
}
```

### 2.1. Idempotência e Prevenção de Duplicidade
A função `salvarAguaDoDia` utiliza o padrão de documento com chave composta determinística:
$$\text{Document ID} = \text{UID} + \text{"\_"} + \text{YYYY-MM-DD}$$
Isso garante que múltiplas adições ao longo do mesmo dia atualizem o mesmo registro com `setDoc(..., { merge: true })`, eliminando concorrência e duplicidade.

---

## 3. Algoritmo de Cálculo da Meta Hídrica Personalizada

A meta de consumo hídrico é calculada dinamicamente com base no peso corporal mais recente do paciente, seguindo as diretrizes de medicina preventiva da OMS:

$$\text{Meta Diária (mL)} = \begin{cases} \text{Peso (kg)} \times 35, & \text{se Peso } > 0 \\ 2000\text{ mL}, & \text{se Peso não informado} \end{cases}$$

### Exemplos Práticos:
- **Paciente de 60 kg:** $60 \times 35 = 2.100\text{ mL/dia}$ (~8,4 copos de 250ml)
- **Paciente de 75 kg:** $75 \times 35 = 2.625\text{ mL/dia}$ (~10,5 copos)
- **Paciente de 90 kg:** $90 \times 35 = 3.150\text{ mL/dia}$ (~12,6 copos)

---

## 4. Histórico Deslizante com Offset (`buscarHistoricoAgua`)

Para renderizar o gráfico e calcular médias sem lacunas temporais, a função `buscarHistoricoAgua` consulta todos os registros do usuário e preenche em memória os dias sem apontamento com `amount_ml: 0`:

```typescript
// Localização: pressao-app/src/services/agua.ts
export async function buscarHistoricoAgua(
  uid: string,
  limitDays: number = 7,
  offsetDays: number = 0
): Promise<DailyWaterLog[]> {
  const q = query(collection(db, 'water_logs'), where('user_id', '==', uid));
  const querySnapshot = await getDocs(q);
  const logsMap = new Map<string, DailyWaterLog>();
  
  querySnapshot.docs.forEach(doc => {
    const data = doc.data() as DailyWaterLog;
    logsMap.set(data.date_string, { id: doc.id, ...data });
  });

  const result: DailyWaterLog[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - offsetDays);

  for (let i = 0; i < limitDays; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (logsMap.has(dateStr)) {
      result.push(logsMap.get(dateStr)!);
    } else {
      result.push({
        id: `${uid}_${dateStr}`,
        user_id: uid,
        date_string: dateStr,
        amount_ml: 0,
        meta_ml: 2000
      });
    }
  }

  return result; // Ordenado decrescente (mais recente primeiro)
}
```

---

## 5. Visualização e Gráficos do Módulo (Dashboard)

1. **Card Principal do Dia:**
   - Exibição de volume atual versus meta (Ex: `1750 / 2625 ml`).
   - Barra de progresso com transição CSS suave (`transition: width 0.3s ease;`).
   - Botões de adição rápida: `+200ml` (copo americano), `+300ml` (caneca), `+500ml` (garrafinha) e modal para inserção de valor livre.
2. **Gráfico de Barras `water-history-chart`:**
   - Renderiza os 7 dias da janela ativa.
   - Barras com cores condicionais: azul translúcido quando $< 100\%$ da meta e azul sólido vibrante quando $\ge 100\%$.
   - Controles de navegação temporal: botão `btn-water-prev-week` (retroceder 7 dias) e `btn-water-next-week` (avançar).
3. **Indicadores Agregados:**
   - **Média Diária:** Volume médio em mL/dia na janela.
   - **Dias de Meta Atingida:** Contagem de dias com cumprimento de 100%+.
   - **Volume Total:** Somatório total em Litros consumidos no período.
