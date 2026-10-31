# 04 — Fluxos de Trabalho

Cada workflow passo a passo, com pré-condições, regras e tratamento de erros.

---

## 1. Criar Projeto

```
Utilizador → Escolhe mapa → Define nome → Criar
```

### Passos

1. Listar mapas válidos do catálogo
2. Utilizador seleciona um mapa (primeiro mapa pré-selecionado)
3. Utilizador digita o nome do projeto
   - Input com autocapitalização de palavras
   - Placeholder dinâmico com data de hoje (ex: "Inspeção 30 Out")
   - Preview do nome de ficheiro gerado em tempo real
4. Validar mapa (ver Regras de Negócio)
5. Validar nome (ver Regras de Negócio)
6. Verificar que não existe projeto com mesmo slug (case-insensitive)
7. Criar estrutura de pastas/storage segundo os slots do mapa
8. Escrever `fastreport.json` com metadata
9. Solicitar storage persistence ao browser
10. Adicionar aos projetos recentes / abrir o projeto

### Erros Possíveis

| Erro | Causa |
|------|-------|
| `invalidMap` | Mapa não passa validação |
| `alreadyExists` | Já existe projeto com o mesmo slug |
| `empty` | Nome vazio |
| `invalid` | Caracteres proibidos no nome |
| `tooLong` | Nome > 255 caracteres |

---

## 2. Abrir Projeto (a partir de ZIP ou storage)

```
Utilizador → Seleciona projeto → Ler metadata → Resolver mapa → Carregar fotos
```

### Passos

1. Ler metadata do projeto
2. Procurar `fastreport.json`
3. Se não encontrar → procurar `.fastreport.json` (legacy) → migrar
4. Validar metadata: `schemaVersion ≥ 1`, `mapId` e `displayName` não vazios
5. Encontrar mapa correspondente por `mapId`
6. Se mapa não encontrado → erro
7. Carregar todas as fotos organizadas por slot
8. Abrir na tab Inbox se há fotos pendentes, senão na tab Revisão

### Erros Possíveis

| Erro | Causa |
|------|-------|
| `metadataNotFound` | Nem `fastreport.json` nem legacy existe |
| `metadataCorrupt` | JSON inválido ou campos obrigatórios vazios |
| `mapNotFound` | `mapId` não corresponde a nenhum mapa no catálogo |

---

## 3. Importar Fotos

```
Utilizador → Escolhe/tira fotos → Pipeline de conversão → Inbox
```

### Passos

1. Utilizador escolhe fotos da galeria OU tira foto com a câmera
2. Filtrar por tipos suportados: JPEG, PNG, HEIC, HEIF, TIFF, GIF, BMP, WebP
3. Ordenar naturalmente por nome (IMG_2 antes de IMG_10)
4. Para cada ficheiro:
   a. Ler imagem original
   b. Normalizar orientação EXIF
   c. Redimensionar para ≤ maxDimension (padrão 1024px), mantendo proporção
   d. Comprimir como JPEG (qualidade padrão 0.85)
   e. Gerar thumbnail (256px largura, qualidade 75%)
   f. Guardar no storage, adicionar ao slot Inbox
5. Mostrar progresso (x de total) com overlay de loading
6. Atualizar `updatedAt`, zerar `exportedAt`

### Regras

- **Originais nunca são apagados** — a importação é uma cópia
- **Inbox é o único destino** — classificação vem depois
- **Escrita atómica** — temp file → replace (evita corrupção)
- **Ficheiros não-imagem** — ignorados silenciosamente

### Estatísticas de Importação

| Campo | Significado |
|-------|-------------|
| `attempted` | Total de ficheiros processados |
| `imported` | Importados com sucesso |
| `converted` | Que precisaram de conversão de formato |
| `skipped` | Não-imagem, ignorados |
| `failed` | Erros por ficheiro |

---

## 4. Triagem (Fluxo Central)

```
Foto do Inbox → Classificar → Mover para slot → Próxima foto → Repetir
```

### Entrada na Triagem

- Botão "Iniciar triagem" na tab Inbox
- Ecrã fullscreen, fundo escuro, uma foto de cada vez
- Header: posição (ex: "3 / 15"), label do slot, botão undo
- Barra de progresso

### Classificação (Touch)

1. Grid de botões na parte inferior representando os slots do mapa
2. Se o mapa tem grupos: segmented control para alternar entre grupos
3. Toque no botão → classificação imediata
4. Feedback: haptic + animação ghost (foto sai) + flash (nome do slot)
5. Undo disponível (botão no header)

### Ferramentas de Edição (durante a triagem)

| Ferramenta | Ação | Detalhe |
|------------|------|---------|
| Rodar | Rotação 90° clockwise | Reescreve a imagem |
| Espelhar | Flip horizontal | Reescreve a imagem |
| Cortar | Crop livre | Overlay com handles nos cantos, grelha de terços |
| Anterior | Volta à foto anterior | — |
| Saltar | Avança sem classificar | — |

### Regras da Triagem

- Uma foto de cada vez, navegação sequencial
- Cada classificação empilha um undo entry
- Undo desfaz a última ação (move a foto de volta)
- Quando o inbox esvazia → triagem termina ("Tudo classificado")
- Edições (rodar/espelhar/crop) são destrutivas no storage — undo guarda o blob anterior
- Wake Lock mantém o ecrã ligado durante toda a triagem
- Swipe horizontal para navegar entre fotos

### Indicadores nos Botões de Classificação

- Número do slot (T1, T2, ...)
- Contagem atual de fotos no slot
- Indicador "cheio" (verde) quando `count == expectedCount`
- Indicador "excedente" (laranja) quando `count > expectedCount`

---

## 5. Revisão

```
Grelha por slot → Verificar contagens → Reordenar → Recategorizar
```

### Layout

Duas zonas:

1. **Faixa do Inbox** (horizontal, scrollável no topo)
   - Miniaturas arrastáveis (long-press para iniciar drag)
   - Permite arrastar do inbox para qualquer slot

2. **Lista de slots** (vertical, scrollável)
   - Cada slot com header sticky (nome + contagem + indicador)
   - Grid de miniaturas arrastáveis
   - Drop zones vazias com borda tracejada (ficam verdes ao arrastar)

### Organização Visual

1. Grupo especial no topo: General + Trash
2. Grupos regulares com sub-slots, ordenados por número
3. Inbox por último (na faixa horizontal do topo)

### Operações

| Operação | Como | Resultado |
|----------|------|-----------|
| Reordenar (intra-slot) | Drag-and-drop | Renumera ficheiros sequencialmente |
| Recategorizar (inter-slot) | Drag de um slot para outro | Move foto para novo slot |
| Esvaziar lixeira | Botão "Limpar" + confirmação | Remove permanentemente |
| Ver foto | Toque na miniatura | Abre o Viewer |
| Filtrar por grupo | Segmented control (Tudo / C12 / C25) | Mostra apenas slots do grupo |

### Reordenação Atômica

Para evitar colisão de nomes ao reordenar dentro de um slot:
1. Renomear todos os ficheiros para nomes temporários
2. Renomear na nova ordem com índices sequenciais (1, 2, 3, ...)

---

## 6. Visualização de Foto (Viewer)

```
Toque na miniatura → Viewer fullscreen → Navegar / Editar / Mover
```

### Apresentação

- Ecrã fullscreen, fundo escuro
- Carrossel de slides com swipe horizontal
- Header: nome do ficheiro final, slot + posição
- Footer: ferramentas de edição + ações

### Interações

| Gesto | Ação |
|-------|------|
| Swipe horizontal | Navegar entre fotos do slot |
| Swipe para baixo | Fechar viewer |
| Pinch | Zoom (1x a 5x) |
| Double-tap | Toggle zoom 1x ↔ 2.5x |
| Tap simples | Toggle header/footer |

### Ações do Footer

| Ação | Descrição |
|------|-----------|
| Rodar | Rotação 90° clockwise |
| Espelhar | Flip horizontal |
| Mover | Overlay com grid de slots para selecionar destino |
| Lixeira | Move para Trash |

---

## 7. Exportação (ZIP)

```
Configurar → Gerar ZIP → Partilhar/Download → Marcar exportado
```

### Fases

1. **Ready** — configuração: escolher layout (pastas vs flat)
2. **Building** — geração do ZIP com barra de progresso
3. **Built** — ZIP pronto, botão para partilhar/download
4. **Done** — exportado com sucesso, opções pós-exportação

### Informações Mostradas

- Nome do ZIP
- Resumo: nº de pastas, nº de fotos, tamanho estimado
- Aviso se há fotos no inbox (serão incluídas na pasta Inbox)
- Lista de conteúdo (cada pasta com contagem)

### Layouts de Exportação

| Layout | Estrutura | fastreport.json | Reimportável |
|--------|-----------|-----------------|--------------|
| Com pastas | Hierarquia completa | Sim | Sim |
| Só fotos | Pasta única, nomes finais | Não | Não |

### Pós-Exportação

- Marca `exportedAt` com data atual
- Opção "Exportar outra vez"
- Opção "Apagar projeto do dispositivo"

### Método de Partilha

1. **Web Share API** (preferencial em mobile) — "Guardar em Ficheiros", AirDrop, etc.
2. **Download direto** (fallback)

---

## 8. Importação de ZIP

```
ZIP do FastReport → Ler fastreport.json → Criar projeto → Importar fotos
```

### Passos

1. Utilizador seleciona ficheiro ZIP
2. Ler conteúdo do ZIP
3. Procurar `fastreport.json` para identificar `mapId`, `displayName`, `createdAt`
4. Verificar que o mapa existe na app → se não, rejeitar
5. Se já existe projeto com mesmo nome → adicionar sufixo " (2)"
6. Criar projeto com a metadata do ZIP
7. Para cada JPEG no ZIP:
   - Se veio de um slot válido → colocar nesse slot
   - JPEGs preservados tal qual (sem re-encode)
   - Outros formatos → converter para JPEG
8. Marcar como já exportado (o ZIP já era uma exportação)

---

## 9. Esvaziar Lixeira

```
Botão "Limpar" → Confirmação → Eliminação permanente
```

### Regras

- Confirmação obrigatória (alert dialog)
- Remove blobs e referências das fotos no slot Trash
- Remove undo entries associadas a essas fotos
- Irreversível
- Atualiza `updatedAt`

---

## 10. Eliminar Projeto

```
Menu → Apagar projeto → Confirmação → Remoção
```

### Regras

- Confirmação obrigatória
- Se projeto **não exportado**: aviso diferente — "As fotos vão perder-se definitivamente"
- Remove toda a metadata e todos os blobs do storage
- Revoga todos os URLs em memória
- Remove dos projetos recentes

---

## 11. Sistema de Undo

### Estrutura

Pilha LIFO em runtime (não persistida entre sessões).

### Tipos de Undo

| Tipo | Trigger | O que guarda | Ação de undo |
|------|---------|--------------|--------------|
| `move` | Mover foto entre slots | Slot de origem e destino | Move de volta para o slot anterior |
| `image` | Editar foto (rodar/espelhar/crop) | Blobs anteriores (full + thumb) | Restaura os blobs originais |

### Regras

- Cada operação empilha um entry
- Desfaz o mais recente primeiro (LIFO)
- Se o ficheiro/blob de destino não existe mais → falha silenciosamente
- Pilha limpa ao fechar projeto/sessão
- Sem limite de tamanho na pilha
