# 06 — Telas e Navegação

Inventário completo de telas, ações do utilizador e padrões de UI.

---

## 1. Mapa de Navegação

```
Home
├── Settings (push da direita)
├── Novo Projeto (bottom sheet)
└── Projeto (push da direita)
    ├── Tab: Inbox
    │   └── Triagem (fullscreen por baixo)
    │       └── Crop Overlay
    ├── Tab: Revisão
    │   └── Viewer (fullscreen por cima)
    │       └── Mover Para (overlay)
    ├── Exportar (bottom sheet)
    └── Menu de Ações (action sheet)
```

### Transições

| De → Para | Tipo | Duração |
|-----------|------|---------|
| Home → Projeto | Slide da direita | ~520ms |
| Home → Settings | Slide da direita | ~520ms |
| Qualquer → Sheet | Slide de baixo | ~480ms |
| Projeto → Triagem | Slide de baixo | ~500ms |
| Qualquer → Viewer | Scale-in | ~320ms |
| Qualquer → Action Sheet | Fly de baixo | ~440ms |
| Qualquer → Alert | Scale-in | ~220ms |

### Gesto de Voltar

- **Edge-swipe** da borda esquerda → volta ao ecrã anterior
- **Drag para baixo** em sheets/viewer → fecha

---

## 2. Tela: Home

### O Que Mostra

Lista de projetos existentes como cards, cada um com:
- Mosaico 2×2 das 4 primeiras fotos (excluindo lixeira)
- Nome do projeto
- Nome do mapa usado
- Data de criação
- Contagem: total de fotos, quantas por classificar
- Barra de progresso (% classificadas)
- Badge: "Exportado" (verde) ou "Não exportado" (laranja)

Rodapé:
- Total de bytes armazenados
- Estado de proteção do storage (protegido/não garantido)
- Aviso laranja global se há projetos não exportados

### Ações

| Ação | Trigger | Resultado |
|------|---------|-----------|
| Abrir projeto | Tocar no card | Abre Projeto (inbox se há pendentes, revisão se não) |
| Novo projeto | Botão "+" | Action Sheet: "Novo projeto" / "Importar ZIP" |
| Configurações | Ícone engrenagem | Abre Settings |

### Estado Vazio

Mensagem de boas-vindas + botão "Novo projeto" + link "Importar ZIP"

---

## 3. Tela: Novo Projeto

**Tipo:** Bottom sheet modal

### Campos

| Campo | Tipo | Validação |
|-------|------|-----------|
| Nome | Input texto (autocapitaliza) | Slug válido, sem duplicatas |
| Mapa | Seleção entre mapas | Obrigatório |

### Detalhes

- Placeholder dinâmico com data de hoje
- Preview do slug e nome de ficheiro gerado
- Mostra detalhes do mapa selecionado: nº de pastas, grupos
- Check mark no mapa ativo

### Ação

"Criar" → cria projeto, fecha sheet, abre o projeto

---

## 4. Tela: Projeto

**Tipo:** Push screen com NavBar + TabBar

### NavBar

| Posição | Elemento | Ação |
|---------|----------|------|
| Esquerda | ← Projetos | Voltar para Home |
| Direita | Share | Abrir Exportação |
| Direita | ··· | Menu de ações |

### Menu de Ações (Action Sheet)

- Exportar ZIP
- Importar fotos
- Apagar projeto (destrutivo, vermelho)

### Tab: Inbox

**Se há fotos no inbox:**
- Cabeçalho hero: número grande de fotos pendentes
- Resumo: classificadas / lixeira / mapa usado
- Botões: "Iniciar triagem" + "Importar"
- Grid de miniaturas (pinch-to-resize colunas)

**Se inbox vazio mas projeto tem fotos:**
- "Tudo classificado!" + "Ir para revisão" + "Exportar"

**Se projeto vazio:**
- "Sem fotos" + "Escolher da fototeca" / "Tirar fotografia"

### Tab: Revisão

Componente Review embarcado (ver Fluxo de Revisão)

---

## 5. Tela: Triagem

**Tipo:** Fullscreen, fundo escuro

### Layout

```
┌─────────────────────────┐
│  ← Undo    3/15    ×    │  Header
├─────────────────────────┤
│  ═══════════════        │  Barra de progresso
│                         │
│                         │
│        [FOTO]           │  Foto central (swipe H para navegar)
│                         │
│                         │
├─────────────────────────┤
│  ↻  ↔  ✂  ←  →         │  Ferramentas
├─────────────────────────┤
│  [Tudo] [C12] [C25]     │  Segmented (se há grupos)
├─────────────────────────┤
│  T1  T2  T3  T4  T5  T6│
│  T7  T8  T9  T10 T11 T12│  Grid de classificação
│  T13 T14 T15 T16 T17 T18│
│  T19 T20 T21 T22 T23 T24│
│  [General]  [extras] [🗑]│
└─────────────────────────┘
```

### Landscape

Layout adaptado: foto à esquerda, teclado de classificação à direita.

### Fim da Triagem

Quando inbox esvazia: "Tudo classificado!" + botão "Ir para revisão"

---

## 6. Tela: Revisão

**Tipo:** Embarcada na tab Revisão do Projeto

### Layout

```
┌─────────────────────────┐
│ [Tudo] [C12] [C25]      │  Filtro por grupo
├─────────────────────────┤
│ Inbox ─ 📷📷📷📷 ──→    │  Faixa horizontal (drag to slots)
├─────────────────────────┤
│ General (2)             │  Slot header (sticky)
│  📷 📷                  │  Grid de miniaturas
├─────────────────────────┤
│ T1 (3) ✓                │  ✓ = completo
│  📷 📷 📷               │
├─────────────────────────┤
│ T2 (0)                  │  Slot vazio
│  ┈ ┈ ┈ ┈               │  Drop zone tracejada
├─────────────────────────┤
│ Trash (1) [Limpar]      │
│  📷                     │  Opacidade reduzida
├─────────────────────────┤
│ [↩ Desfazer]            │  Rodapé com undo
└─────────────────────────┘
```

### Drag-and-Drop

- **Da faixa inbox:** long-press (220ms) para iniciar
- **Dos slots:** toque imediato (com detecção de direção: horizontal = drag, vertical = scroll)
- **Grupo partilhado:** todos os slots aceitam drops de todos os outros
- **Visual:** drop zone fica verde ao arrastar sobre

---

## 7. Tela: Viewer

**Tipo:** Fullscreen sobre tudo, fundo escuro

### Layout

```
┌─────────────────────────┐
│ Inspecao_T01_3.jpeg      │  Header (toggle com tap)
│ T1 · 3 de 5             │
├─────────────────────────┤
│                         │
│                         │
│        [FOTO]           │  Carrossel (swipe H, pinch zoom)
│                         │
│                         │
├─────────────────────────┤
│  ↻   ↔   📂   🗑       │  Footer: Rodar/Espelhar/Mover/Lixeira
└─────────────────────────┘
```

### Overlay "Mover Para"

Grid de todos os slots (exceto inbox) com nome e contagem. Toque → move a foto.

---

## 8. Tela: Exportação

**Tipo:** Bottom sheet modal

### Fases

| Fase | Conteúdo |
|------|----------|
| Ready | Layout selector + resumo + "Criar ZIP" |
| Building | Barra de progresso circular |
| Built | "Guardar ou partilhar" |
| Done | "Exportado!" + "Exportar outra vez" + "Apagar do dispositivo" |

### Informações

- Nome do ZIP: `{nome_projeto}.zip`
- Nº de pastas e fotos
- Tamanho estimado
- Aviso se há fotos no inbox
- Lista expandível com conteúdo por pasta

---

## 9. Tela: Settings

**Tipo:** Push screen

### Secções

| Secção | Opções |
|--------|--------|
| Aparência | Auto / Clara / Escura (com swatches visuais) |
| Idioma | Automático / Português / English |
| Miniaturas por linha | Auto / 3-8 (segmented com preview) |
| Tamanho da interface | Pequeno (0.9x) / Normal (1x) / Grande (1.1x) / Muito grande (1.2x) |
| Armazenamento | Fotos guardadas (bytes), proteção, offline, instalação |
| Sobre | Criar projeto de exemplo, versão |

---

## 10. Componentes Reutilizáveis

### Navegação e Layout

| Componente | Descrição |
|------------|-----------|
| NavBar | Barra de navegação com título central, ações esquerda/direita, blur quando scrolled |
| NavButton | Botão de navegação (ícone + texto opcional) |
| PushScreen | Container com slide da direita + edge-swipe back |
| Sheet | Bottom sheet deslizável com drag-to-dismiss |
| ActionSheet | Menu de ações estilo iOS (lista + cancelar) |

### Feedback

| Componente | Descrição |
|------------|-----------|
| Alert | Diálogo de confirmação (título + corpo + botões) |
| Toast | Notificação flutuante temporária (1.8s) |
| Busy | Overlay de progresso com anel circular |

### Interação

| Componente | Descrição |
|------------|-----------|
| PinchGrid | Wrapper que ajusta colunas com pinch gesture |
| CropOverlay | Overlay de recorte com handles, grelha de terços |
| Icon | SVG inline com 30+ ícones, tamanho em rem |

### Funcional

| Componente | Descrição |
|------------|-----------|
| Install | Banner PWA (instrução de instalação) |

---

## 11. Padrões de Interação

### Gestos

| Gesto | Contexto | Ação |
|-------|----------|------|
| Edge-swipe (borda esquerda) | PushScreen | Voltar |
| Drag para baixo | Sheet, Viewer | Fechar |
| Pinch em grelha | Grid de miniaturas | Alterar nº de colunas (3–8) |
| Pinch no viewer | Foto fullscreen | Zoom (1x–5x) |
| Double-tap | Viewer | Toggle zoom 1x ↔ 2.5x |
| Swipe horizontal | Viewer, Triagem | Navegar entre fotos |
| Swipe vertical | Viewer | Fechar |
| Long-press | Revisão (faixa inbox) | Iniciar drag-and-drop |

### Feedback

| Tipo | Quando |
|------|--------|
| Haptic | Classificação, início de drag |
| Animação ghost | Foto sai ao classificar |
| Flash de texto | Nome do slot aparece brevemente |
| Drop zone verde | Área válida para drop |
| Badge animado | Contagem atualizada |

### Responsividade

| Contexto | Comportamento |
|----------|---------------|
| Portrait | Layout padrão vertical |
| Landscape | Triagem: foto à esquerda, teclas à direita |
| Colunas auto | `Math.round(largura / (80 * escala_ui))` |
| Reduced motion | Desativa animações |
