# Progresso do Desenvolvimento

## Etapa 1 — Persistência e Modelos de Dados
**Status:** ✅ Concluída

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/models/types.ts` | Tipos TypeScript: OrganizationMap, Slot, Project, Photo, PhotoBlob, AppSettings, UndoEntry |
| `src/data/inspection-t24.json` | Mapa de inspeção T1–T24 (27 slots, sem grupos) |
| `src/data/tendons-retrofit.json` | Mapa de retrofit de tendões (53 slots, grupos C12/C25, expectedCount: 7) |
| `src/services/db.ts` | Wrapper IndexedDB completo — stores: projects, blobs, settings. CRUD, debounce 250ms, boot(), storage persistence |
| `src/services/mapCatalog.ts` | Catálogo de mapas com validação completa (10 regras), helpers: getSlot, getGroups, getSlotsForGroup, hasGroups |
| `src/services/slugify.ts` | Normalização NFD → strip diacríticos → underscore |
| `src/services/fileNamer.ts` | Geração de nomes de ficheiro com gap-filling, slotFileToken, slotPath |
| `src/services/undoManager.ts` | Pilha de undo (push, pop, clear, removeByPhoto) |

### Arquivos Reescritos

| Arquivo | De → Para |
|---------|-----------|
| `src/composables/useProjects.ts` | Mock hardcoded → IndexedDB real. CRUD, createProject com validação (slug, duplicatas), touchProject, markExported, photosInSlot, projectStats, totalBytes |
| `src/composables/usePhotoStore.ts` | Array em memória → IndexedDB com blobs. Object URLs geridos, addPhotosToInbox, movePhoto, updateBlobs, deletePhoto, clearTrash |
| `src/composables/usePhotoImport.ts` | Apenas memória → Persiste blobs no IndexedDB. Gera thumbnail 256px/75%. Natural sort por nome. Chama touchProject após import |
| `src/composables/useSettings.ts` | localStorage → IndexedDB. Watch com debounce, load/reset |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/services/imageProcessor.ts` | Adicionado `generateThumb()`, orientação EXIF via `imageOrientation: 'from-image'` |
| `tsconfig.app.json` | Adicionado `src/**/*.json` ao include para suportar imports de mapas |

### Verificação

- ✅ `vue-tsc --noEmit` — 0 erros de tipo
- ✅ `vite build` — build completo sem erros (1.28s)
- ⚠️ Páginas existentes (HomePage, ProjectDetails, etc.) ainda usam a interface antiga do `useProjects` — vão ser adaptadas na Etapa 2

### Decisões Técnicas

1. **IDs com prefixo:** Projetos `p` + timestamp base36 + random, Fotos `f` + timestamp base36 + random
2. **Debounce:** Escritas normais com 250ms de debounce, momentos críticos (criação, export) usam `saveProjectNow`
3. **URLs em memória:** Object URLs criados on-demand via `loadProjectUrls`, revogados em `revokeAllUrls`
4. **Mapas como JSON estático:** Importados diretamente via `import ... from '@/data/...'`
5. **Validação de mapa:** 10 regras implementadas em `validateMap()` conforme documentação de arquitetura
6. **Gap-filling:** `nextIndex()` encontra o primeiro buraco na sequência de índices

---

## Etapa 2 — Home e Criação de Projeto
**Status:** ✅ Concluída

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/NewProject/NewProjectPage.vue` | Formulário de criação: nome com validação de slug/duplicatas, preview de ficheiro, seleção de mapa com radio cards |
| `src/composables/useProjectCreate.ts` | Lógica de criação: validação, slug, preview, mapSummary, canCreate |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Home/HomePage.vue` | Reescrita completa — summary cards (projetos, mapas, exportados, pendentes), lista de projetos reais do IndexedDB ordenada por data, barra de progresso, badge exportado/pendente, estado vazio, rodapé com storage |
| `src/app/router/index.ts` | Adicionada rota `/projects/new`, renomeada rota de triagem para `/projects/:id/triage`, título da home para "FastReport" |
| `src/components/navigation/AppHeader.vue` | Aceita `actions` prop — botão "+" na home. Removido botão bell placeholder |
| `src/app/layouts/AppLayout.vue` | Boot na montagem (loadProjects + loadSettings), loading spinner, header actions dinâmicas (home → "+"), v-if booted antes do conteúdo |

### Verificação

- ✅ `vue-tsc --noEmit` — 0 erros de tipo
- ✅ `vite build` — build completo sem erros (1.24s)

### Decisões Técnicas

1. **Boot centralizado:** AppLayout faz `load()` de projetos e settings no `onMounted`, mostra spinner enquanto carrega
2. **Header actions dinâmico:** AppLayout injeta "+" no AppHeader quando na home, sem novo composable
3. **Thumbnail placeholder:** Ícone colorido baseado em hash do nome em vez de carregar blobs (performance)
4. **Barra de progresso:** `sorted/total` por projeto com ProgressBar do PrimeVue
5. **Storage footer:** Mostra total de bytes e estado de persistência (protegido/não protegido)
6. **Mapa selector:** Radio-style cards com resumo (slots, grupos) — sem componente novo

---

## Etapa 3 — Projeto (Inbox + Importação)
**Status:** ✅ Concluída

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/composables/useProjectSession.ts` | Sessão ativa: openProject carrega blobs/URLs, closeProject revoga. Expõe project, map, stats computados |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ProjectDetails/ProjectDetailsPage.vue` | Reescrita completa — IDs string, dados reais via useProjectSession, summary card (inbox/classificadas/lixeira/mapa), action cards com pulse, status area (3 estados), importação real, botões Revisão/Exportar |
| `src/components/common/ProjectTabs.vue` | projectId: string, labels "Inbox"/"Revisão", badges de contagem com cores (inbox: warn, review: success) |

### Verificação

- ✅ `vue-tsc --noEmit` — 0 erros de tipo
- ✅ `vite build` — build completo sem erros (1.30s)

### Decisões Técnicas

1. **useProjectSession:** Centraliza abertura/fecho de projeto — carrega Object URLs ao abrir, revoga ao fechar (previne memory leaks)
2. **3 estados visuais:** "Tudo classificado" (verde), "X por classificar" (amarelo), "Sem fotos" (neutro)
3. **Toolbar action:** Botão importar na PageToolbar para acesso rápido além do action card
4. **Formatos aceites:** `image/*` cobre JPEG, PNG, HEIC, HEIF, TIFF, GIF, BMP, WebP (conversão HEIC automática em iOS Safari)

---

## Etapa 4 — Triagem
**Status:** ✅ Concluída

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/services/photoEditor.ts` | `rotate90cw` e `mirrorH` — transformações canvas com re-encode JPEG 85% |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PhotoViewer/PhotoViewerPage.vue` | Reescrita completa — triagem real com fotos do IndexedDB, sorting keyboard data-driven (mapas com/sem grupos), classificação com flash/haptic, undo move+image, rotate/mirror com undo, Wake Lock, estado de conclusão |
| `src/services/undoManager.ts` | Corrigido `canUndo`/`count` de `readonly(ref(...))` para `computed(...)` |
| `src/pages/ProjectDetails/ProjectDetailsPage.vue` | Removido `closeProject` no unmount — sessão persiste na navegação para triagem |

### Verificação

- ✅ `vue-tsc --noEmit` — 0 erros de tipo
- ✅ `vite build` — build completo sem erros (1.30s)

### Decisões Técnicas

1. **Keyboard data-driven:** Categorias e sub-slots carregados do mapa real. Mapas sem grupos (inspection-t24) mostram slots diretamente; mapas com grupos (tendons-retrofit) usam toggle C12/C25
2. **Flash-then-move:** Flash de 350ms antes do movePhoto real — previne mudança visual instantânea, `busy` flag bloqueia input duplo
3. **Undo move:** Pop da stack → movePhoto reverso → reposiciona currentIndex no inbox
4. **Undo image:** Blobs anteriores guardados no UndoEntry, restaurados com updateBlobs + recalculo de dimensões
5. **Wake Lock:** `navigator.wakeLock.request('screen')` no mount, release no unmount
6. **Indicador "cheio":** Slots com `expectedCount` mostram contagem e ficam verdes quando `count >= expectedCount`
7. **Sessão persistente:** ProjectDetailsPage não fecha a sessão no unmount — permite navegação fluida para triagem sem recarregar blobs

---

## Etapa 5 — Revisão e Viewer
**Status:** ✅ Concluída

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ProjectReview/ProjectReviewPage.vue` | Reescrita completa — filtro por grupo (segmented control Tudo/C12/C25), inbox strip horizontal com drag, inter-slot drag-and-drop via pointer events + ghost element, drop zones com feedback visual, indicadores de conclusão de slot, botão limpar lixeira com confirmação, undo footer flutuante |
| `src/pages/PhotoViewer/PhotoViewerPage.vue` | Overlay "Mover para" no modo revisão — bottom sheet com grelha de slots classificáveis, movePhoto + undoPush integrados |

### Verificação

- ✅ `vue-tsc --noEmit` — 0 erros de tipo
- ✅ `vite build` — build completo sem erros

### Decisões Técnicas

1. **Inter-slot drag:** Pointer events (pointerdown/pointermove/pointerup) com ghost element clonado, hit detection via `document.elementFromPoint` e `data-drop-slot` attributes
2. **Filtro por grupo:** Segmented control dinâmico baseado nos grupos do mapa. Mapas sem grupos não mostram o filtro
3. **Inbox strip:** Thumbnails horizontais scrolláveis com drag capability para classificação rápida
4. **Move overlay:** Bottom sheet com backdrop, grelha de botões para slots alvo (exclui slot actual)
5. **Trash label:** Identificador interno `'__trash__'` para comparação no template (independente de i18n)

---

## Etapa 6 — Exportação, ZIP, i18n e Finalização
**Status:** ✅ Concluída

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/i18n/pt.ts` | Dicionário português (~170 chaves organizadas por namespace) |
| `src/i18n/en.ts` | Dicionário inglês (mesmas chaves) |
| `src/composables/useI18n.ts` | Composable i18n: `detectLang()` via navigator.languages, `lang` computado, `t(key, vars?)` com fallback PT→EN→key e substituição de variáveis |
| `src/services/zipImportService.ts` | Importação de ZIP: lê fastreport.json, valida metadata, cria projeto (dedup de nome), mapeia pastas→slots, preserva JPEGs, converte outros formatos, gera thumbnails |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/services/exportService.ts` | Reescrito — estrutura de pastas via slotFileToken/slotPath, fastreport.json incluído no layout folders, `shareOrSave()` com Web Share API + fallback File System Access API |
| `src/pages/ProjectDetails/ProjectDetailsPage.vue` | Action sheet (Exportar ZIP, Importar fotos, Apagar projeto), confirmação de delete (mensagem diferente se não exportado), i18n completo |
| `src/pages/Home/HomePage.vue` | Importação de ZIP, botão no estado vazio, i18n completo, formatDate locale-aware, mapName bilíngue |
| `src/pages/Settings/SettingsPage.vue` | i18n completo (template e script: storage, preferências, confirmação reset, proteção) |
| `src/pages/ProjectReview/ProjectReviewPage.vue` | i18n completo (filtro, inbox, trash, undo, estados vazios) |
| `src/pages/PhotoViewer/PhotoViewerPage.vue` | i18n (done states, move overlay, labels de triagem) |
| `src/pages/NewProject/NewProjectPage.vue` | i18n completo (labels, placeholder, nome de mapa bilíngue) |
| `src/components/common/ProjectTabs.vue` | i18n (Inbox → t('slot.inbox'), Revisão → t('review.title')) |
| `src/composables/useProjectCreate.ts` | i18n (erros de validação, mapSummary com chaves traduzidas) |

### Verificação

- ✅ `vue-tsc --noEmit` — 0 erros de tipo
- ✅ `vite build` — build completo sem erros (1.20s)

### Decisões Técnicas

1. **i18n sem biblioteca externa:** Composable próprio com ~170 chaves, fallback chain PT→EN→key, variáveis `{var}` via regex
2. **Detecção automática:** `navigator.languages` mapeado para PT ou EN, override via settings.langPref
3. **Web Share API:** Partilha nativa de ficheiro ZIP no mobile, fallback para download no desktop
4. **ZIP import:** Preserva JPEGs sem re-encode, converte outros formatos, mapeia pastas para slots via lookup duplo (path completo + last folder)
5. **fastreport.json:** Incluído apenas no layout 'folders' para manter reimportabilidade
6. **Delete project:** Confirmação com mensagem diferenciada se projecto não foi exportado
