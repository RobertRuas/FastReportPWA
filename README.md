# FastReport PWA

Aplicação mobile-first para captura, triagem e exportação de relatórios fotográficos de inspeção. Funciona offline como PWA — sem backend, todos os dados ficam no dispositivo.

**Live:** https://robertruas.github.io/FastReportPWA/

## Funcionalidades

- **Projetos de inspeção** — cria projetos baseados em mapas de organização com pastas predefinidas
- **Captura e importação** — importa fotos da câmara ou galeria com compressão automática
- **Triagem por swipe** — classifica fotos rapidamente com gestos ou atalhos de teclado
- **Revisão e reordenação** — revê fotos por categoria antes de exportar
- **Exportação ZIP** — gera ficheiro ZIP com fotos organizadas por pasta, pronto para entrega
- **Autenticação por dispositivo** — fingerprint do browser + verificação por e-mail; dispositivo fica registado para acessos futuros
- **Offline-first** — todos os dados em IndexedDB, funciona sem internet após instalação
- **Bilingue** — Português e Inglês com detecção automática

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Vue 3 + TypeScript |
| UI | PrimeVue 4 (Aura) |
| Routing | Vue Router (Hash History) |
| Storage | IndexedDB |
| E-mail | EmailJS |
| Build | Vite 6 |
| Deploy | GitHub Pages + Actions |

## Setup local

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento
npm run dev

# Type-check + build
npm run build

# Preview do build
npm run preview
```

## Variáveis de ambiente

Copiar `.env.example` para `.env` e preencher:

```env
VITE_EMAILJS_SERVICE_ID=service_xxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxx
```

Configurar em [emailjs.com](https://www.emailjs.com):
1. Criar conta gratuita
2. Adicionar serviço Gmail
3. Criar template com variáveis: `{{to_name}}`, `{{to_email}}`, `{{verification_code}}`

Sem EmailJS configurado, a app funciona normalmente — o envio de e-mail fica desativado mas o código de acesso alternativo continua disponível.

## Deploy

O deploy para GitHub Pages é automático via GitHub Actions a cada push na branch `main`.

Os secrets do EmailJS devem ser configurados em **Settings → Secrets → Actions**:
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`

## Estrutura do projeto

```
src/
├── app/
│   ├── layouts/        # AppLayout (header + toolbar + content)
│   └── router/         # Rotas e navigation guard de auth
├── components/
│   ├── common/         # Componentes partilhados (ProjectTabs)
│   ├── feedback/       # Overlays e indicadores
│   └── navigation/     # AppHeader, PageToolbar
├── composables/        # Estado reativo (useAuth, useProjects, useSettings...)
├── data/               # Mapas de organização (JSON)
├── i18n/               # Traduções pt/en
├── models/             # Tipos TypeScript
├── pages/              # Uma pasta por página
│   ├── Auth/
│   ├── Home/
│   ├── Maps/
│   ├── NewProject/
│   ├── PhotoViewer/
│   ├── ProjectDetails/
│   ├── ProjectReview/
│   └── Settings/
├── services/           # Lógica de negócio (db, auth, export, fingerprint...)
└── styles/             # Tokens CSS, global, PrimeVue overrides
```

## Documentação de arquitetura

A pasta `arquitetura/` contém 8 documentos cobrindo todas as regras de negócio, modelos de dados, fluxos de trabalho e decisões técnicas.

## Licença

Privado — todos os direitos reservados.
