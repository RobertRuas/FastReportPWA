# 05 — Regras de Negócio

Todas as validações, restrições, comportamentos e invariantes do sistema.

---

## 1. Regras de Projeto

### 1.1 Criação

| Regra | Detalhe |
|-------|---------|
| Nome obrigatório | Deve gerar um slug válido com ≥1 caractere alfanumérico |
| Nome sem duplicatas | Case-insensitive, comparado pelo slug |
| Nome de pasta seguro | Max 255 chars; sem `/`, `:`, `..`, ponto no início ou final |
| Mapa obrigatório | Deve selecionar um mapa válido |
| Mapa imutável | Uma vez escolhido, não pode ser alterado |
| Estrutura criada | Todas as pastas dos slots (incluindo aninhadas) são criadas na hora |
| Metadata escrita | `fastreport.json` com schemaVersion, mapId, displayName, createdAt |
| Storage persistence | Solicita ao browser proteção do storage |

### 1.2 Abertura

| Regra | Detalhe |
|-------|---------|
| Metadata obrigatória | Projeto deve conter `fastreport.json` |
| Legacy suportado | `.fastreport.json` → migrar para `fastreport.json` automaticamente |
| Metadata válida | schemaVersion ≥ 1, mapId e displayName não vazios |
| Mapa deve existir | O mapId deve corresponder a um mapa no catálogo |

### 1.3 Eliminação

| Regra | Detalhe |
|-------|---------|
| Confirmação obrigatória | Alert dialog com ação destrutiva |
| Aviso se não exportado | Mensagem diferente: "As fotos vão perder-se" |
| Remoção completa | Metadata + todos os blobs + URLs em memória |

### 1.4 Timestamps

| Evento | updatedAt | exportedAt |
|--------|-----------|------------|
| Criar projeto | Agora | null |
| Importar fotos | Agora | **null** (zera se tinha valor) |
| Mover foto (triagem/revisão) | Agora | **null** (zera se tinha valor) |
| Editar foto (rodar/espelhar/crop) | Agora | **null** (zera se tinha valor) |
| Exportar ZIP | Agora | Agora |
| Importar ZIP | Agora | Agora (já estava exportado) |

---

## 2. Regras de Fotos

### 2.1 Importação

| Regra | Detalhe |
|-------|---------|
| Formatos aceites | JPEG, PNG, HEIC, HEIF, TIFF, GIF, BMP, WebP |
| Conversão universal | Qualquer formato → JPEG padronizado |
| Dimensão máxima | ≤1024px (configurável 256–4096) na maior dimensão |
| Qualidade JPEG | 85% (configurável 0.4–1.0) |
| Thumbnail | 256px de largura, JPEG 75% |
| Orientação EXIF | Normalizada automaticamente |
| Destino | Sempre Inbox (classificação vem depois) |
| Originais | Nunca são apagados pela app |
| Ordenação | Natural por nome (IMG_2 antes de IMG_10) |
| Não-imagens | Ignoradas silenciosamente |

### 2.2 Classificação (Triagem)

| Regra | Detalhe |
|-------|---------|
| Uma por vez | Foto apresentada individualmente |
| Navegação sequencial | Pode avançar/voltar/saltar |
| Classificação imediata | Toque no botão → foto move instantaneamente |
| Undo | Cada move é reversível (pilha ilimitada na sessão) |
| Fim da triagem | Quando inbox esvazia |
| Haptic feedback | Ao classificar |
| Wake Lock | Ecrã não desliga durante a triagem |

### 2.3 Edição

| Operação | Comportamento |
|----------|---------------|
| Rodar 90° CW | Reescreve a imagem no storage |
| Espelhar horizontal | Reescreve a imagem no storage |
| Crop livre | Coordenadas normalizadas (0–1), mínimo 5% da imagem, handles nos cantos |

- Todas as edições são **destrutivas no storage** (substituem o blob)
- O blob anterior é guardado na pilha de undo
- Re-encode como JPEG após edição

### 2.4 Movimentação

| Regra | Detalhe |
|-------|---------|
| Entre qualquer par de slots | Inclusivamente de/para lixeira |
| Via triagem | Classificação por botão |
| Via revisão | Drag-and-drop entre slots |
| Via viewer | Menu "Mover para" com grid de slots |
| Cada move registra undo | Reversível |
| Timestamps atualizados | updatedAt agora, exportedAt zerado |

### 2.5 Lixeira

| Regra | Detalhe |
|-------|---------|
| Fotos visíveis | Com opacidade reduzida |
| Excluídas da exportação | Não vão no ZIP |
| "Limpar lixeira" | Eliminação permanente com confirmação |
| Remove undo entries | Associadas às fotos eliminadas |

---

## 3. Regras de Nomeação de Ficheiros

### 3.1 Padrão

`{projectSlug}_{slotToken}_{index}.jpeg`

### 3.2 Componentes

| Componente | Fonte | Regras |
|------------|-------|--------|
| `projectSlug` | `slugify(nome)` | NFD → strip diacríticos, non-alnum → `_`, colapsar `_`, trim |
| `slotToken` | `folder` ou `group_folder` | Sem grupo: `"T01"`. Com grupo: `"C12_T01"` |
| `index` | Sequencial com gap-fill | ≥ 1, preenche buracos na sequência |

### 3.3 Gap-Filling

1. Listar índices existentes no slot
2. Encontrar primeiro gap: se existem {1, 2, 4} → próximo é **3**
3. Se sem gaps → max + 1
4. Se slot vazio → **1**

### 3.4 Extensão

Sempre `.jpeg` (lowercase), independente do formato original.

---

## 4. Regras de Validação

### 4.1 Validação de Mapa

| # | Regra | Erro |
|---|-------|------|
| 1 | ≥ 1 slot | `noSlots` |
| 2 | Exatamente 1 slot Inbox | `noInbox` / `multipleInbox` |
| 3 | Inbox não pode ter grupo | `inboxInGroup` |
| 4 | Trash não pode ter grupo | `trashInGroup` |
| 5 | Nenhum slot é Inbox E Trash | `inboxIsTrash` |
| 6 | Sem IDs de slot duplicados | `duplicateId` |
| 7 | Sem hotkeys duplicadas no mesmo escopo | `duplicateHotkey` |
| 8 | Nomes de pasta seguros | `unsafeFolder` |
| 9 | inboxFolder = folder do slot inbox | `inboxFolderMismatch` |
| 10 | Hotkeys iguais em grupos diferentes: OK | — |

### 4.2 Validação de Nome de Projeto

| # | Regra | Erro |
|---|-------|------|
| 1 | Não vazio após trim | `empty` |
| 2 | Max 255 caracteres | `tooLong` |
| 3 | Sem `/` | `invalid` |
| 4 | Sem `:` | `invalid` |
| 5 | Sem `..` | `invalid` |
| 6 | Não começar com `.` | `invalid` |
| 7 | Não terminar com `.` | `invalid` |
| 8 | Slug resultante ≥ 1 char alfanumérico | `invalid` |
| 9 | Não duplicado (case-insensitive por slug) | `alreadyExists` |

### 4.3 Validação de Metadata

| # | Regra | Erro |
|---|-------|------|
| 1 | schemaVersion ≥ 1 | `metadataCorrupt` |
| 2 | mapId não vazio | `metadataCorrupt` |
| 3 | displayName não vazio | `metadataCorrupt` |

### 4.4 Validação de Nome de Ficheiro

| # | Regra |
|---|-------|
| 1 | Partes não vazias após substituição |
| 2 | Index ≥ 1 |
| 3 | Resultado não contém separadores de path (/ ou \) |

---

## 5. Regras de Exportação

### 5.1 ZIP com Pastas

| Regra | Detalhe |
|-------|---------|
| Estrutura espelha o mapa | Pastas = slots, subpastas = grupos |
| Inclui fastreport.json | Para compatibilidade e reimportação |
| Fotos da lixeira excluídas | Não vão no ZIP |
| Fotos do inbox incluídas | Na pasta Inbox (com aviso ao utilizador) |
| Sem compressão | Método STORE (JPEGs já são comprimidos) |
| Nomes finais | `{slug}_{token}_{index}.jpeg` |

### 5.2 ZIP Flat (só fotos)

| Regra | Detalhe |
|-------|---------|
| Pasta única | Todas as fotos juntas |
| Deduplicação de nomes | Sufixo -2, -3... se houver colisão |
| Sem fastreport.json | Não pode ser reimportado |
| Fotos da lixeira excluídas | — |

### 5.3 Importação de ZIP

| Regra | Detalhe |
|-------|---------|
| Requer fastreport.json | Para identificar mapa e metadata |
| Mapa deve existir | Se mapId não existe → rejeita |
| Nomes duplicados | Adiciona sufixo " (2)" |
| JPEGs preservados | Sem re-encode se já são JPEG válidos |
| Marca como exportado | `exportedAt` = agora |

---

## 6. Regras de Estado da Exportação

O estado "exportado" é um indicador para o utilizador saber se precisa re-exportar:

| Estado | Condição | Indicador Visual |
|--------|----------|------------------|
| Não exportado | `exportedAt == null` | Badge laranja |
| Exportado | `exportedAt != null` | Badge verde |
| Modificado após exportar | Qualquer alteração zera `exportedAt` | Badge laranja |

Na tela Home, se **qualquer** projeto não está exportado, aparece um aviso geral.

---

## 7. Regras Implícitas (Cross-Cutting)

1. **Toda escrita no storage é atómica** — temp → replace, nunca escrita parcial
2. **Debounce de 250ms** nas escritas de metadata para evitar writes excessivos
3. **Save imediato** em momentos críticos: criação, importação final, exportação
4. **Boot lê tudo** numa única operação: projetos + blobs + settings
5. **URLs de objetos** são criados na boot e revogados ao apagar
6. **Storage persistence** solicitada ao criar ou importar fotos
7. **Nomes de pastas no filesystem/ZIP sempre em inglês** (Inbox, General, Trash, T01, C12)
8. **UI traduzível** — apenas labels e mensagens mudam de idioma
9. **IDs com prefixo** — projetos: `p`, fotos: `f` + timestamp base36 + random
