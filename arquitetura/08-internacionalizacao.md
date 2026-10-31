# 08 — Internacionalização (i18n)

Idiomas, strings, detecção automática e regras de localização.

---

## 1. Idiomas Suportados

| Idioma | Código | Locale | Padrão |
|--------|--------|--------|--------|
| Português | `pt` | `pt-PT` | Sim (língua padrão) |
| Inglês | `en` | `en-GB` | Fallback |

---

## 2. Detecção Automática

Ordem de resolução:

1. Preferência salva pelo utilizador (`langPref` no settings)
2. Se `langPref == 'auto'`: idioma do browser (`navigator.languages[0]`)
   - Se começa com `"pt"` → Português
   - Caso contrário → Inglês
3. Fallback final: Inglês

---

## 3. Função de Tradução

```
t(key, vars?) → string
```

- Busca a chave no dicionário do idioma ativo
- Se não encontrar: tenta no outro idioma (fallback)
- Se não encontrar em nenhum: retorna a própria chave
- Substituição de variáveis: `{var}` é substituído pelo valor correspondente

Exemplo:
```
t('export.photos', { count: 15 }) → "15 fotos"
```

---

## 4. Organização das Strings

~175 strings organizadas por contexto:

| Namespace | Conteúdo |
|-----------|----------|
| `app.*` | Globais (Projetos, Cancelar, OK, Apagar, Guardar) |
| `home.*` | Tela inicial (lista de projetos, estado vazio) |
| `new.*` | Criação de projeto (wizard, validação) |
| `project.*` | Tela de projeto (tabs, importação) |
| `review.*` | Revisão (drag, slots, contagens) |
| `triage.*` | Triagem (progresso, classificação, fim) |
| `viewer.*` | Visualizador (navegação, ações) |
| `export.*` | Exportação (layout, progresso, sucesso) |
| `zip.*` | Importação de ZIP (erros, progresso) |
| `settings.*` | Configurações (aparência, idioma, storage) |
| `install.*` | Prompt de instalação PWA |
| `slot.*` | Nomes de slots especiais (Inbox, General, Lixeira) |

---

## 5. Regras de Localização

### O que traduz (UI)

- Labels de botões
- Títulos de telas
- Mensagens de erro e avisos
- Descriptions de mapas e slots
- Textos de progresso
- Dialogs de confirmação

### O que NÃO traduz (dados/filesystem)

| Elemento | Sempre em | Motivo |
|----------|-----------|--------|
| Nomes de pastas | Inglês | Compatibilidade cross-platform |
| Nomes de ficheiros | Inglês | Padrão previsível |
| IDs de mapa | Inglês | Identificadores técnicos |
| IDs de slot | Inglês | Identificadores técnicos |
| `fastreport.json` | Inglês | Schema fixo |
| Extensão `.jpeg` | Inglês | Padrão técnico |

### Nomes de Mapas

Os mapas têm nomes bilíngues (`name.pt` e `name.en`). A UI mostra o nome no idioma ativo.

---

## 6. Adição de Novos Idiomas

Para adicionar um idioma:

1. Criar dicionário com todas as ~175 chaves
2. Adicionar à lógica de detecção automática
3. Adicionar opção na tela de Settings
4. Adicionar nome bilíngue nos mapas de organização
5. **Não** traduzir nomes de pastas ou ficheiros
