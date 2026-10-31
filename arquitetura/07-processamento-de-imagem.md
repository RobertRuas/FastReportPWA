# 07 — Processamento de Imagem

Pipeline de importação, edição, thumbnails e formatos suportados.

---

## 1. Formatos Suportados

| Extensão | Formato | Suportado |
|----------|---------|-----------|
| `.jpg`, `.jpeg` | JPEG | Sim |
| `.png` | PNG | Sim |
| `.heic`, `.heif` | HEIC/HEIF (Apple) | Sim |
| `.tif`, `.tiff` | TIFF | Sim |
| `.gif` | GIF | Sim |
| `.bmp` | BMP | Sim |
| `.webp` | WebP | Sim |

Todos são convertidos para **JPEG** na importação. O formato interno do sistema é exclusivamente JPEG.

---

## 2. Pipeline de Importação

```
Ficheiro original
     ↓
Decode (createImageBitmap ou Image fallback)
     ↓
Normalizar orientação EXIF (imageOrientation: 'from-image')
     ↓
Redimensionar (≤ maxDimension, mantendo proporção)
     ↓
Encode JPEG (qualidade 85%)
     → full: Blob JPEG ≤1024px
     ↓
Redimensionar para thumbnail
     ↓
Encode JPEG (qualidade 75%)
     → thumb: Blob JPEG 256px largura
```

### Parâmetros Configuráveis

| Parâmetro | Padrão | Range | Descrição |
|-----------|--------|-------|-----------|
| `maxDimension` | 1024 | 256–4096 | Dimensão máxima (px) da maior aresta |
| `jpegQuality` | 0.85 | 0.4–1.0 | Qualidade JPEG para full |
| Thumb width | 256 | Fixo | Largura da miniatura |
| Thumb quality | 0.75 | Fixo | Qualidade JPEG da miniatura |

### Regras

- **Smoothing de alta qualidade** no redimensionamento (`imageSmoothingQuality: 'high'`)
- **Proporção mantida** — nunca distorce a imagem
- **Escrita atómica** — temp → replace, nunca parcial
- Se a imagem já é JPEG dentro dos limites, ainda é processada (normalização de orientação)

---

## 3. Edição de Fotos

### 3.1 Rotação

- **Ângulo:** 90° clockwise
- **Resultado:** dimensões invertidas (w↔h)
- **Técnica:** Canvas com `translate(h, 0)` + `rotate(π/2)`
- **Destrutivo:** substitui o blob no storage

### 3.2 Espelhamento

- **Direção:** horizontal (flip)
- **Técnica:** Canvas com `translate(w, 0)` + `scale(-1, 1)`
- **Destrutivo:** substitui o blob no storage

### 3.3 Crop

- **Coordenadas:** normalizadas (0–1) relativas à imagem original
- **Mínimo:** 5% da dimensão original (em cada eixo)
- **Handles:** 4 cantos arrastáveis
- **Grelha:** terços (rule of thirds)
- **Clamp:** nunca sai dos limites da imagem
- **Técnica:** Canvas com `drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh)`
- **Destrutivo:** substitui o blob no storage

### Regras Comuns de Edição

| Regra | Detalhe |
|-------|---------|
| Destrutiva | Substitui o blob no storage |
| Undo | Blob anterior guardado na pilha de undo |
| Re-encode | JPEG após cada edição |
| Thumbnail | Regenerada após edição |
| Timestamps | `updatedAt` atualizado, `exportedAt` zerado |

---

## 4. Thumbnails

### Geração

- Criadas no momento da importação
- Regeneradas após edição de foto
- 256px de largura, proporção mantida
- JPEG qualidade 75%

### Uso

- Grelhas de miniaturas (Home, Projeto, Revisão)
- Faixa do inbox
- Cards de projeto na Home (mosaico 2×2)

---

## 5. ZIP

### Escrita (Exportação)

- Implementação própria (zero dependências externas)
- Método **STORE** (sem compressão — JPEGs já são comprimidos)
- Encoding UTF-8 para nomes de ficheiro
- CRC32 para integridade
- Gerado inteiramente em memória

### Leitura (Importação de ZIP)

- Suporta método **STORE** e **DEFLATE**
- DEFLATE via `DecompressionStream('deflate-raw')`
- Parsing do ZIP central directory

---

## 6. Fluxo Visual

```
[Câmera/Galeria]
      ↓
  ┌─── Importação ───┐
  │ HEIC → decode    │
  │ EXIF → normalize │
  │ Scale → ≤1024px  │
  │ JPEG → 85%       │
  │ Thumb → 256px    │
  └──────────────────┘
      ↓
  [Inbox: foto pronta]
      ↓
  ┌─── Triagem ──────┐
  │ Rodar? → re-JPEG │
  │ Flip?  → re-JPEG │
  │ Crop?  → re-JPEG │
  └──────────────────┘
      ↓
  [Slot classificado]
      ↓
  ┌─── Exportação ───┐
  │ JPEG → ZIP STORE │
  │ (sem re-encode)  │
  └──────────────────┘
      ↓
  [ZIP pronto]
```
