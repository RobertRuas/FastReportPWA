# 03 — Mapas de Organização

Os mapas são o coração do sistema. Definem toda a estrutura de classificação de um projeto.

---

## 1. Conceito

Um Mapa de Organização é um template JSON reutilizável que define:
- Quais pastas/slots existem
- Como estão hierarquicamente organizados (grupos)
- Quantas fotos são esperadas em cada slot
- Quais atalhos de teclado mapeiam para cada slot
- Como os ficheiros devem ser nomeados

O mapa é escolhido na **criação** do projeto e **nunca muda** depois.

---

## 2. Mapa: Inspeção T1–T24 (`inspection-t24`)

**Propósito:** Inspeção genérica de estruturas com até 24 pontos de inspeção (torres eólicas, pilares de pontes, etc.)

**Características:**
- 27 slots totais: Inbox + General + Trash + T1 a T24
- Estrutura plana (sem grupos)
- Todos os slots são `unlimited` (sem contagem esperada)
- Hotkeys diretas: `1` → T1, `2` → T2, ..., `24` → T24

### Slots

| ID | Pasta | Hotkey | Especial |
|----|-------|--------|----------|
| `inbox` | Inbox | — | isInbox |
| `general` | General | 0, G | — |
| `trash` | Trash | cmd+backspace | isTrash |
| `t1` | T1 | 1 | — |
| `t2` | T2 | 2 | — |
| `t3` | T3 | 3 | — |
| ... | ... | ... | ... |
| `t24` | T24 | 24 | — |

### Exemplo de nome de ficheiro

`Inspecao_Ponte_X_T5_3.jpeg` → projeto "Inspeção Ponte X", slot T5, 3ª foto

---

## 3. Mapa: Retrofit de Tendões (`tendons-retrofit`)

**Propósito:** Retrofit de cabos/tendões em duas secções (C12 e C25), cada uma com 24 pontos de inspeção.

**Características:**
- 53 slots totais
- Estrutura **hierárquica com grupos**: C12 e C25
- Cada grupo tem T01–T24 como sub-slots
- `expectedCount: 7` por sub-slot T (indica ao utilizador quantas fotos devem ser tiradas)
- Hotkeys com escopo de grupo

### Slots

| ID | Pasta | Grupo | Hotkey | expectedCount | Especial |
|----|-------|-------|--------|---------------|----------|
| `inbox` | Inbox | — | — | — | isInbox |
| `general` | General | — | 0, G | — | — |
| `trash` | Trash | — | cmd+backspace | — | isTrash |
| `c12` | C12 | — | 12 | — | Group Bucket |
| `c25` | C25 | — | 25 | — | Group Bucket |
| `c12-t01` | T01 | C12 | 1 | 7 | — |
| `c12-t02` | T02 | C12 | 2 | 7 | — |
| ... | ... | C12 | ... | 7 | — |
| `c12-t24` | T24 | C12 | 24 | 7 | — |
| `c25-t01` | T01 | C25 | 1 | 7 | — |
| `c25-t02` | T02 | C25 | 2 | 7 | — |
| ... | ... | C25 | ... | 7 | — |
| `c25-t24` | T24 | C25 | 24 | 7 | — |

### Estrutura hierárquica

```
tendons-retrofit
├── Inbox (especial)
├── General (especial)
├── Trash (especial)
├── C12 (group bucket)
│   ├── C12/T01 (expectedCount: 7)
│   ├── C12/T02 (expectedCount: 7)
│   ├── ...
│   └── C12/T24 (expectedCount: 7)
└── C25 (group bucket)
    ├── C25/T01 (expectedCount: 7)
    ├── C25/T02 (expectedCount: 7)
    ├── ...
    └── C25/T24 (expectedCount: 7)
```

### Hotkeys com escopo de grupo

O mesmo número resolve para slots diferentes dependendo do grupo ativo:

| Contexto | Input "1" resolve para | Input "25" resolve para |
|----------|------------------------|-------------------------|
| Global (sem grupo) | — | Grupo C25 |
| Dentro de C12 | C12/T01 | Muda para grupo C25 |
| Dentro de C25 | C25/T01 | — (já está em C25) |

### Exemplo de nome de ficheiro

`Retrofit_Cabo_Y_C12_T01_3.jpeg` → projeto "Retrofit Cabo Y", grupo C12, slot T01, 3ª foto

---

## 4. Navegação Entre Grupos na Triagem

Quando o mapa tem grupos, a triagem usa um segmented control (ou seletor) para indicar o grupo ativo:

1. **Sem grupo selecionado (global):** Botões mostram os groups buckets (C12, C25) e slots sem grupo (General, Trash)
2. **Com grupo selecionado (ex: C12):** Botões mostram os T-slots desse grupo (T01–T24)
3. **Para trocar de grupo:** Tocar no segmented control ou (no teclado) digitar a hotkey do outro grupo

Regras de resolução:
- Dentro de C12, input "25" → muda para grupo C25 (porque "25" é hotkey do bucket C25)
- Dentro de C12, Enter vazio → move para o group bucket C12/
- Input que não corresponde a nenhum slot → nada acontece

---

## 5. Indicadores Visuais por Slot

| Indicador | Condição | Visual |
|-----------|----------|--------|
| Contagem normal | `count < expectedCount` ou `unlimited` | Número simples |
| Completo | `count == expectedCount` | Badge verde / "cheio" |
| Excedente | `count > expectedCount` | Badge laranja de aviso |
| Vazio | `count == 0` | Placeholder tracejado |
| Lixeira | `isTrash == true` | Opacidade reduzida nas fotos |

---

## 6. JSON Completo — inspection-t24

```json
{
  "id": "inspection-t24",
  "version": 1,
  "name": { "pt": "Inspeção T1–T24", "en": "Inspection T1–T24" },
  "fileNamePattern": "{project}_{slot}_{index}.jpeg",
  "inboxFolder": "Inbox",
  "slots": [
    { "id": "inbox", "folder": "Inbox", "hotkeys": [], "unlimited": true, "isInbox": true, "isTrash": false },
    { "id": "general", "folder": "General", "hotkeys": ["0", "G"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "trash", "folder": "Trash", "hotkeys": ["cmd+backspace"], "unlimited": true, "isInbox": false, "isTrash": true },
    { "id": "t1", "folder": "T1", "hotkeys": ["1"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t2", "folder": "T2", "hotkeys": ["2"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t3", "folder": "T3", "hotkeys": ["3"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t4", "folder": "T4", "hotkeys": ["4"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t5", "folder": "T5", "hotkeys": ["5"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t6", "folder": "T6", "hotkeys": ["6"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t7", "folder": "T7", "hotkeys": ["7"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t8", "folder": "T8", "hotkeys": ["8"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t9", "folder": "T9", "hotkeys": ["9"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t10", "folder": "T10", "hotkeys": ["10"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t11", "folder": "T11", "hotkeys": ["11"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t12", "folder": "T12", "hotkeys": ["12"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t13", "folder": "T13", "hotkeys": ["13"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t14", "folder": "T14", "hotkeys": ["14"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t15", "folder": "T15", "hotkeys": ["15"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t16", "folder": "T16", "hotkeys": ["16"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t17", "folder": "T17", "hotkeys": ["17"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t18", "folder": "T18", "hotkeys": ["18"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t19", "folder": "T19", "hotkeys": ["19"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t20", "folder": "T20", "hotkeys": ["20"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t21", "folder": "T21", "hotkeys": ["21"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t22", "folder": "T22", "hotkeys": ["22"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t23", "folder": "T23", "hotkeys": ["23"], "unlimited": true, "isInbox": false, "isTrash": false },
    { "id": "t24", "folder": "T24", "hotkeys": ["24"], "unlimited": true, "isInbox": false, "isTrash": false }
  ]
}
```

---

## 7. Validação de Mapas

Um mapa é válido se satisfaz **todas** estas condições:

1. Tem **pelo menos 1 slot**
2. Tem **exatamente 1 slot** com `isInbox: true`
3. O slot Inbox **não tem grupo**
4. O slot Trash (se existir) **não tem grupo**
5. **Nenhum slot** é `isInbox: true` E `isTrash: true` ao mesmo tempo
6. **Sem IDs de slot duplicados**
7. **Sem hotkeys duplicadas no mesmo escopo** (global ou dentro do mesmo grupo)
8. Nomes de pasta são **seguros**: sem `..`, sem `/`, sem `:`, sem ponto no início
9. `inboxFolder` corresponde ao `folder` do slot inbox real
10. Hotkeys iguais em **grupos diferentes** são permitidas (ex: "1" em C12 e "1" em C25)
