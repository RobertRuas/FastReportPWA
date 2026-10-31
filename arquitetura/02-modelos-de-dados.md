# 02 — Modelos de Dados

Todos os schemas e entidades do sistema. Servem como contrato para o novo app.

---

## 1. Mapa de Organização (Organization Map)

Template JSON embarcado na app que define a estrutura de classificação.

```json
{
  "id": "inspection-t24",
  "version": 1,
  "name": {
    "pt": "Inspeção T1–T24",
    "en": "Inspection T1–T24"
  },
  "fileNamePattern": "{project}_{slot}_{index}.jpeg",
  "inboxFolder": "Inbox",
  "slots": [ /* ver Slot */ ]
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único do mapa (ex: `"inspection-t24"`) |
| `version` | number | Versão do schema do mapa (atualmente 1) |
| `name` | `{ pt, en }` | Nome localizado do mapa |
| `fileNamePattern` | string | Template de nome de ficheiro. Variáveis: `{project}`, `{slot}`, `{index}` |
| `inboxFolder` | string | Nome da pasta inbox (sempre `"Inbox"`) |
| `slots` | Slot[] | Lista de destinos de classificação |

---

## 2. Slot

Destino de classificação dentro de um mapa.

```json
{
  "id": "c12-t01",
  "folder": "T01",
  "group": "C12",
  "hotkeys": ["1"],
  "expectedCount": 7,
  "unlimited": false,
  "isInbox": false,
  "isTrash": false
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | Sim | ID único dentro do mapa (ex: `"inbox"`, `"t1"`, `"c12-t01"`) |
| `folder` | string | Sim | Nome da pasta no filesystem (ex: `"T01"`, `"General"`, `"Inbox"`) |
| `group` | string | Não | Grupo hierárquico pai (ex: `"C12"`, `"C25"`) |
| `hotkeys` | string[] | Sim | Atalhos de teclado (ex: `["1"]`, `["cmd+backspace"]`) |
| `expectedCount` | number\|null | Não | Nº de fotos esperadas. `null` = sem limite |
| `unlimited` | boolean | Sim | Se aceita qualquer quantidade. `true` se `expectedCount` ausente |
| `isInbox` | boolean | Sim | Se é o slot de entrada |
| `isTrash` | boolean | Sim | Se é a lixeira |

**Tipos especiais de slot:**

| Tipo | Regra |
|------|-------|
| Inbox | Sempre 1 por mapa. Não pode ter grupo. Destino de fotos importadas. |
| General | Slot genérico. Hotkey `0` ou `G`. |
| Trash | Lixeira virtual. Hotkey `cmd+backspace`. Não pode ter grupo. Fotos excluídas da exportação. |
| Group Bucket | Slot que representa um grupo inteiro (ex: `C12`). Porta de entrada para sub-slots. |

**Caminhos derivados do slot:**

| Derivação | Sem grupo | Com grupo |
|-----------|-----------|-----------|
| Caminho da pasta | `{folder}` → `"T01"` | `{group}/{folder}` → `"C12/T01"` |
| File token (nome de ficheiro) | `{folder}` → `"T01"` | `{group}_{folder}` → `"C12_T01"` |

---

## 3. Projeto (Project)

Unidade de trabalho = conjunto de fotos organizadas por um mapa.

### 3.1 Metadata Persistida — `fastreport.json`

Ficheiro JSON na raiz do projeto. Formato canônico para compatibilidade entre plataformas.

```json
{
  "schemaVersion": 1,
  "mapId": "inspection-t24",
  "displayName": "Inspeção Ponte X",
  "createdAt": "2026-10-30T10:00:00Z"
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `schemaVersion` | number | Versão do schema. Deve ser ≥ 1 |
| `mapId` | string | ID do mapa usado. Não pode ser vazio |
| `displayName` | string | Nome de exibição do projeto. Não pode ser vazio |
| `createdAt` | string | Data de criação em ISO 8601 |

> **Legacy:** versão anterior usava `.fastreport.json` (hidden). Migrar automaticamente para `fastreport.json` se encontrado.

### 3.2 Projeto em Runtime

```
Projeto
├── id             string     // Identificador único (prefixo 'p' + timestamp_base36 + random)
├── name           string     // Nome de exibição
├── slug           string     // Nome normalizado para ficheiros (ver Slug)
├── mapId          string     // Referência ao mapa usado
├── createdAt      string     // ISO 8601
├── updatedAt      string     // ISO 8601 — atualizado a cada alteração
├── exportedAt     string?    // ISO 8601 quando exportado; null se não exportado ou alterado depois
├── photos         Photo[]    // Array ordenado de todas as fotos
└── undo           UndoEntry[] // Pilha de undo (runtime only)
```

---

## 4. Foto (Photo)

Pertence a um projeto. Cada foto está num slot específico.

```
Foto
├── id       string   // Identificador único (prefixo 'f' + timestamp_base36 + random)
├── slot     string   // ID do slot onde está (ex: "inbox", "t1", "c12-t01", "trash")
├── w        number   // Largura em pixels
├── h        number   // Altura em pixels
└── bytes    number   // Tamanho em bytes do JPEG
```

### 4.1 Blob da Foto (armazenamento separado)

```
PhotoBlob
├── id          string   // Mesmo ID da foto
├── projectId   string   // FK para o projeto
├── full        Blob     // JPEG completo (≤1024px, qualidade 85%)
└── thumb       Blob     // Miniatura JPEG (256px largura, qualidade 75%)
```

---

## 5. Configurações do Utilizador (Settings)

| Chave | Tipo | Padrão | Valores Possíveis | Descrição |
|-------|------|--------|-------------------|-----------|
| `cols` | string\|number | `'auto'` | `'auto'`, 3–8 | Colunas de miniaturas na grelha |
| `langPref` | string | `'auto'` | `'auto'`, `'pt'`, `'en'` | Idioma preferido |
| `theme` | string | `'auto'` | `'auto'`, `'light'`, `'dark'` | Tema visual |
| `ui` | number | `1` | 0.9, 1, 1.1, 1.2 | Escala da interface |
| `zipLayout` | string | `'folders'` | `'folders'`, `'flat'` | Layout padrão de exportação ZIP |
| `maxDimension` | number | `1024` | 256–4096 | Dimensão máxima das fotos importadas |
| `jpegQuality` | number | `0.85` | 0.4–1.0 | Qualidade JPEG na conversão |

---

## 6. Delivery Ledger — `fastreport-delivery.json`

Registo de quais fotos foram marcadas como "entregues" para o relatório.

```json
{
  "schemaVersion": 1,
  "placed": [
    {
      "inodeID": 12345678,
      "relativePath": "T01/Inspecao_T01_1.jpeg"
    }
  ]
}
```

Tracking duplo: inode (sobrevive a renomeações) + path relativo (fallback).

---

## 7. Undo Entry

```
UndoEntry
├── type       'move' | 'image'
├── photoId    string           // ID da foto afetada
├── fromSlot   string           // Slot de origem (para type 'move')
├── toSlot     string           // Slot de destino (para type 'move')
├── prevFull   Blob?            // Blob anterior (para type 'image')
└── prevThumb  Blob?            // Thumbnail anterior (para type 'image')
```

---

## 8. Slug (Normalização de Nome)

Algoritmo para gerar o slug do projeto:

1. Decomposição Unicode NFD → remover combining marks (Inspeção → Inspecao)
2. Caracteres não `[a-zA-Z0-9]` → underscore
3. Colapsar underscores múltiplos → um só
4. Trim underscores no início e fim

| Input | Slug |
|-------|------|
| Inspeção 1 | `Inspecao_1` |
| Torre Eólica - Dia 3 | `Torre_Eolica_Dia_3` |
| Retrofit C12/C25 | `Retrofit_C12_C25` |

---

## 9. Padrão de Nome de Ficheiro

**Template:** `{project}_{slot}_{index}.jpeg`

| Variável | Fonte | Exemplo |
|----------|-------|---------|
| `{project}` | Slug do projeto | `Inspecao_1` |
| `{slot}` | File token do slot | `T10`, `C12_T01` |
| `{index}` | Sequencial com gap-fill | `1`, `2`, `3` |

**Extensão:** sempre `.jpeg` (lowercase)

**Exemplos completos:**
- `Inspecao_1_T10_5.jpeg` — projeto "Inspeção 1", slot T10, 5ª foto
- `Retrofit_C12_T01_3.jpeg` — projeto "Retrofit", grupo C12, slot T01, 3ª foto
- `Torre_B_General_1.jpeg` — projeto "Torre B", slot General, 1ª foto

**Regra de índice (gap-filling):**
1. Listar índices existentes no slot
2. Encontrar primeiro gap: se existem 1, 2, 4 → próximo é 3
3. Se sem gaps → max + 1
4. Se slot vazio → 1

---

## 10. Estrutura de Pastas do Projeto

### Projeto sem grupos (inspection-t24)

```
{nome_do_projeto}/
├── fastreport.json
├── Inbox/
│   └── *.jpeg
├── General/
│   └── *.jpeg
├── Trash/
│   └── *.jpeg
├── T1/
│   └── *.jpeg
├── T2/
├── ...
└── T24/
```

### Projeto com grupos (tendons-retrofit)

```
{nome_do_projeto}/
├── fastreport.json
├── Inbox/
├── General/
├── Trash/
├── C12/
│   ├── T01/
│   ├── T02/
│   ├── ...
│   └── T24/
└── C25/
    ├── T01/
    ├── T02/
    ├── ...
    └── T24/
```

---

## 11. Estrutura do ZIP de Exportação

### Layout "com pastas" (compatível com reimportação)

```
{nome_projeto}.zip
└── {nome_projeto}/
    ├── fastreport.json
    ├── Inbox/
    │   └── *.jpeg
    ├── General/
    │   └── *.jpeg
    ├── T1/
    │   └── *.jpeg
    └── ...
```

- Espelha a estrutura de pastas do projeto
- Inclui `fastreport.json` para permitir reimportação
- Fotos na lixeira são **excluídas**
- ZIP sem compressão (método STORE — JPEGs já são comprimidos)

### Layout "só fotos" (flat)

```
{nome_projeto}.zip
└── {nome_projeto}/
    └── *.jpeg (nomes com deduplicação: -2, -3...)
```

- Todas as fotos numa única pasta
- Nomes finais com sufixo de deduplicação se houver colisão
- Sem `fastreport.json` — não pode ser reimportado como projeto
