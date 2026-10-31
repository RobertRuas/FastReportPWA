# Plano de Desenvolvimento — FastReport PWA

> Base: repositório [AppSimple](https://github.com/RobertRuas/AppSimple)
> Regras de negócio: diretório `arquitetura/`
> Stack: Vue 3 + TypeScript + PrimeVue (free) + Vue Router (Hash History)
> Alvo: PWA mobile-first (iPhone Safari + home screen)

---

## Regras Obrigatórias (herdadas do AppSimple)

Estas regras aplicam-se a **todas as etapas** sem exceção:

1. **Stack fixa:** Vue 3 Composition API + `<script setup>` + TypeScript + PrimeVue (free only) + PrimeIcons. Nenhuma outra lib UI.
2. **Design system:** Usar exclusivamente os tokens CSS existentes (`tokens.css`). Nunca hardcodar valores arbitrários.
3. **Layout:** Duas barras fixas (AppHeader + PageToolbar). Nunca criar uma terceira barra. Nunca duplicar o botão voltar no conteúdo.
4. **Fullscreen:** Páginas fullscreen (triagem, viewer) usam `meta.fullscreen: true` — ambas as barras somem.
5. **Navegação:** Hash History (`/#/rota`). Nunca usar `window.location.href`. Sempre Vue Router programático.
6. **Formulários:** Topo da área de conteúdo, sem card wrapper, largura total, labels obrigatórios, font ≥ 16px nos inputs.
7. **Safari:** `100dvh` com fallback, safe areas via `env()`, inputs ≥ 16px, nunca `user-scalable=no`.
8. **Diretórios:** Cada página em `src/pages/{Nome}/`, componentes exclusivos em `components/` dentro da página. Shared em `src/components/`. Composables em `src/composables/`. Serviços em `src/services/`.
9. **Estado:** Composables singleton com `ref`/`reactive` module-level. Sem Pinia. Sem stores separados.
10. **Estilo:** Scoped CSS em cada componente. Valores dos tokens. `:active` para feedback tátil. `-webkit-tap-highlight-color: transparent`.
11. **PrimeVue:** Apenas componentes gratuitos. PrimeIcons exclusivamente para ícones.

---

## Componentes Existentes a Reutilizar

| Componente | Reutilização | Adaptação |
|------------|-------------|-----------|
| `AppHeader` | Direto | Apenas traduzir o título |
| `PageToolbar` | Direto | Ações dinâmicas por página |
| `AppLayout` | Direto | Já tem modo fullscreen |
| `ImportOverlay` | Direto | Já faz exatamente o que precisamos |
| `ProjectTabs` | Adaptar | Renomear tabs para "Inbox" / "Revisão" |
| `PhotoGroup` | Adaptar | Trocar placeholder de cor por thumbnail real, adicionar badge de contagem |
| `PhotoThumb` | Adaptar | Mostrar imagem real em vez de cor |
| `PhotoViewerPage` | Adaptar | Base para a Triagem — o sorting keyboard já existe |
| `imageProcessor` | Direto | Pipeline JPEG já implementado (1024px, 85%) |
| `useNavigation` | Direto | |
| `usePageTitle` | Direto | |
| `usePageActions` | Direto | |
| `usePhotoImport` | Adaptar | Ligar ao IndexedDB |

---

## Etapas de Desenvolvimento

### Etapa 1 — Persistência e Modelos de Dados

Criar a camada de dados real (IndexedDB) e os modelos do domínio FastReport. Esta etapa substitui os mocks do AppSimple por dados reais sem alterar a UI.

**Entregar:**

- `src/services/db.ts` — Wrapper IndexedDB (`fastreport` v1, stores: `projects`, `blobs`, `settings`)
  - CRUD de projetos, fotos e blobs
  - Debounce de 250ms nas escritas
  - Save imediato em momentos críticos (criação, importação, exportação)
  - Boot: ler tudo numa única transação
  - Solicitar `navigator.storage.persist()`

- `src/services/mapCatalog.ts` — Catálogo de mapas de organização
  - Carregar os 2 mapas JSON embarcados (inspection-t24, tendons-retrofit)
  - Validação de mapa (ver `arquitetura/05-regras-de-negocio.md` §4.1)
  - Resolver slot por ID, listar slots por grupo, calcular caminhos

- `src/models/types.ts` — Tipos TypeScript
  - `OrganizationMap`, `Slot`, `Project`, `Photo`, `PhotoBlob`, `Settings`, `UndoEntry`
  - Schemas conforme `arquitetura/02-modelos-de-dados.md`

- `src/services/slugify.ts` — Gerar slug do projeto (NFD, strip diacríticos, non-alnum → `_`)

- `src/services/fileNamer.ts` — Gerar nomes de ficheiro (`{slug}_{token}_{index}.jpeg`) com gap-filling

- **Reescrever** `useProjects.ts` — Ligar ao IndexedDB real (CRUD, lista, getProject)
- **Reescrever** `usePhotoStore.ts` — Fotos reais com blobs em IndexedDB, Object URLs
- **Adaptar** `usePhotoImport.ts` — Persistir no IndexedDB via `db.ts`
- **Adaptar** `useSettings.ts` — Persistir no IndexedDB em vez de localStorage

- `src/services/undoManager.ts` — Pilha de undo (move + image edit, runtime only)

**Mapas JSON a embalar:**
- `src/data/inspection-t24.json`
- `src/data/tendons-retrofit.json`

**Não alterar:** Nenhuma página ou componente visual. Apenas a camada de dados por baixo.

---

### Etapa 2 — Home e Criação de Projeto

Adaptar a HomePage e criar o fluxo de novo projeto com dados reais.

**Entregar:**

- **Adaptar** `HomePage.vue`
  - Cards de resumo: Total de projetos, Mapas disponíveis, Exportados, Não exportados
  - Lista de projetos reais do IndexedDB (nome, mapa, data, contagem, barra de progresso, badge exportado/não exportado)
  - Mosaico 2×2 com thumbnails reais no card do projeto (ou ícone placeholder)
  - Rodapé: total de bytes armazenados, estado do storage persistence
  - Ação "+" no AppHeader → abrir criação de projeto
  - Estado vazio: mensagem + botão criar

- **Criar** `src/pages/NewProject/NewProjectPage.vue`
  - Formulário: Nome (input texto, autocapitalizar, validação de slug e duplicatas, preview do nome de ficheiro) + Mapa (lista de seleção com detalhes)
  - Seguir regras de formulário do AppSimple (topo, sem card, labels, 16px)
  - Ação "Criar" na PageToolbar
  - Ao criar: escrever no IndexedDB, navegar para o projeto

- **Criar** `src/composables/useProjectCreate.ts` — Validação de nome, criação, estrutura de slots

**Não criar:** Nenhum componente visual novo que não exista no AppSimple. Usar os mesmos padrões de card, lista, formulário.

---

### Etapa 3 — Projeto (Inbox + Importação)

Implementar a página do projeto com a tab Inbox e importação de fotos real.

**Entregar:**

- **Adaptar** `ProjectDetailsPage.vue` (renomear para o contexto FastReport)
  - Summary card: número de fotos no inbox, contagem classificadas/lixeira/mapa
  - Action cards: "Iniciar Triagem" (com pulse se há pendentes) + "Importar" (com badge de contagem)
  - Status area: "Tudo classificado" ou "X por classificar"
  - Botões: "Ir para Revisão" + "Exportar"
  - Importação via `usePhotoImport` → pipeline real (decode, resize ≤1024px, JPEG 85%, thumb 256px 75%)
  - `ImportOverlay` já funciona — ligar aos dados reais

- **Adaptar** `ProjectTabs.vue` — Tabs "Inbox" e "Revisão" com contagem

- **Criar** `src/composables/useProjectSession.ts`
  - Estado da sessão ativa: projeto aberto, tab ativo, grupo selecionado
  - Derivações: current project, photos in slot, stats

**Formatos aceites na importação:** JPEG, PNG, HEIC, HEIF, TIFF, GIF, BMP, WebP

---

### Etapa 4 — Triagem

Implementar o fluxo central de classificação foto-a-foto.

**Entregar:**

- **Adaptar** `PhotoViewerPage.vue` → Tela de triagem real
  - Imagem real em vez de placeholder colorido
  - Toolbar: fechar, undo, espelhar, rodar, lixeira, badge grupo, contador
  - Área de imagem: foto real, transições slide-next/slide-prev (já existentes)
  - Flash overlay na classificação (já existente)
  - **Sorting keyboard** (já existente — adaptar):
    - Categorias: carregar do mapa real (General, Lixo + groups/buckets)
    - Sub-categorias: carregar slots reais do grupo ativo (T1–T24)
    - Cores dos grupos: manter padrão existente (blue C12, yellow C25)
    - Indicador "cheio" quando `count == expectedCount`
  - Classificação: toque → `movePhoto()` → undo push → avançar
  - Haptic feedback: `navigator.vibrate(8)`
  - Wake Lock: `navigator.wakeLock.request('screen')`
  - Fim da triagem: mensagem "Tudo classificado" + botão "Ir para revisão"

- **Criar** `src/services/photoEditor.ts`
  - Rodar 90° CW (canvas transform)
  - Espelhar horizontal (canvas transform)
  - Cada edição: re-encode JPEG, atualizar blob e thumb no IndexedDB, push undo

- **Adaptar** `usePhotoStore.ts` — `movePhoto()`, `editPhoto()`, undo/redo integrado

**Não criar:** Crop (fica para a Etapa 6). Não criar componentes visuais novos — usar os padrões existentes.

---

### Etapa 5 — Revisão e Viewer

Implementar a grelha de revisão com drag-and-drop e o viewer de foto.

**Entregar:**

- **Adaptar** `ProjectReviewPage.vue`
  - Carregar slots reais do mapa com fotos reais
  - `PhotoGroup` por slot com thumbnails reais
  - Header por slot: nome + contagem + badge (verde se completo, laranja se ≠ expectedCount)
  - Filtro por grupo: segmented control (Tudo / C12 / C25) — se o mapa tiver grupos
  - Slot lixeira: opacidade reduzida, botão "Limpar" com confirmação (ConfirmDialog do PrimeVue)
  - Drop zone vazia: borda tracejada

- **Adaptar** `PhotoGroup.vue`
  - Mostrar thumbnails reais (trocar `PhotoThumb` de cor para `<img>`)
  - Drag-to-reorder intra-slot (já funciona com pointer events)
  - Drag cross-slot: mover foto de um grupo para outro (emitir evento com slot destino)
  - Ao reordenar: atualizar ordem no IndexedDB, renumerar nomes

- **Criar** `src/pages/PhotoViewer/PhotoViewerPage.vue` (viewer separado da triagem)
  - Reutilizar o layout fullscreen do sorting
  - Carrousel de fotos do slot (swipe horizontal)
  - Footer: Rodar, Espelhar, Mover para (overlay com grid de slots), Lixeira
  - Tap na foto na revisão → abre viewer filtrado por slot

- **Adaptar** `src/composables/usePhotoStore.ts` — `reorderPhotos()`, `clearTrash()`

---

### Etapa 6 — Exportação, Importação de ZIP, i18n e Finalização

Implementar exportação, importação, internacionalização e funcionalidades restantes.

**Entregar:**

- **Criar** `src/pages/Export/ExportPage.vue` (ou sheet dentro do projeto)
  - Seletor de layout: "Com pastas" / "Só fotos"
  - Resumo: nº pastas, nº fotos, tamanho estimado, aviso se inbox não vazio
  - Gerar ZIP em memória (método STORE, sem compressão)
  - Web Share API (preferencial) ou download direto
  - Marcar `exportedAt`, opção de apagar projeto
  - Barra de progresso (ProgressBar do PrimeVue)

- **Criar** `src/services/zipWriter.ts` — Gerar ZIP (STORE, UTF-8, CRC32)
- **Criar** `src/services/zipReader.ts` — Ler ZIP (STORE + DEFLATE)

- **Criar** importação de ZIP
  - Ler `fastreport.json` → validar mapa → criar projeto → importar fotos
  - Nomes duplicados: sufixo " (2)"
  - JPEGs preservados sem re-encode

- **Criar** `src/services/i18n.ts`
  - Dicionários PT + EN (~175 strings)
  - `t(key, vars?)` com substituição
  - Detecção automática: `navigator.languages[0]`
  - Seleção manual nas Settings

- **Adaptar** `SettingsPage.vue`
  - Idioma (Auto / PT / EN)
  - Layout de exportação padrão
  - Armazenamento (bytes usados, proteção)
  - Versão da app

- **Criar** `src/services/photoEditor.ts` — Adicionar Crop
  - Coordenadas normalizadas (0–1), mínimo 5%
  - Overlay com handles nos cantos e grelha de terços (reutilizar padrão visual existente)

- **PWA:**
  - Service worker (pre-cache, cache-first)
  - Manifest (fullscreen, ícones)
  - Atualização via visibilitychange

- **Eliminar** código de demonstração
  - Remover `DemoPage.vue`
  - Remover dados mock dos composables
  - Limpar rotas de demo

---

## Rotas Finais

| Rota | Página | Meta |
|------|--------|------|
| `/#/` | HomePage | `isHome: true` |
| `/#/projects/new` | NewProjectPage | `fallbackRoute: '/'` |
| `/#/projects/:id` | ProjectDetailsPage | `fallbackRoute: '/'` |
| `/#/projects/:id/review` | ProjectReviewPage | `fallbackRoute: '/'` |
| `/#/projects/:id/triage` | TriagePage | `fullscreen: true` |
| `/#/projects/:id/viewer` | PhotoViewerPage | `fullscreen: true` |
| `/#/projects/:id/export` | ExportPage | `fallbackRoute: '/'` |
| `/#/settings` | SettingsPage | `fallbackRoute: '/'` |

---

## O Que NÃO Fazer

- Não criar componentes visuais que fujam do padrão do AppSimple
- Não instalar libs extras (Sortable.js, Pinia, Tailwind, etc.)
- Não criar uma terceira barra de navegação
- Não usar gradientes, sombras fortes, nested cards, botões oversized
- Não criar abstrações prematuras ou helpers desnecessários
- Não implementar dark mode (não existe no AppSimple)
- Não criar backend ou autenticação
- Não implementar sync/cloud
