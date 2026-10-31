# 01 — Visão Geral do Produto

## O Que É o FastReport

Organizador de fotos de trabalho para inspeções de engenharia civil. Técnicos fotografam em campo (pontes, torres eólicas, cabos de retrofit) e precisam classificar centenas de fotos em pastas padronizadas para montar relatórios fotográficos.

O FastReport **não gera relatórios** — organiza as fotos para que outro programa as use.

---

## Público-Alvo

Engenheiros e técnicos de campo que:
- Fotografam durante inspeções e obras
- Precisam organizar grandes volumes de fotos rapidamente
- Trabalham offline (sem internet garantida no campo)
- Entregam fotos organizadas para relatórios

---

## Princípios Fundamentais

1. **Storage local é verdade** — sem nuvem, sem contas, sem sync. Tudo vive no dispositivo.
2. **Sem lock-in** — fotos são JPEGs padrão em pastas nomeadas de forma previsível, acessíveis fora da app.
3. **Importação não-destrutiva** — originais nunca são apagados pela app.
4. **Touch-first** — toda a triagem funciona por toque. A interface é otimizada para uso rápido com uma mão.
5. **Offline-first** — a app funciona 100% sem internet.
6. **Nomes previsíveis** — o padrão `{slug}_{token}_{index}.jpeg` garante que ficheiros são ordenáveis e identificáveis fora da app.
7. **Conversão universal** — qualquer formato de imagem suportado vira JPEG padronizado.
8. **Mapa fixo** — o tipo de projeto (mapa) é escolhido na criação e não muda depois.
9. **Pastas em inglês** — independente do idioma da UI, nomes de pastas e ficheiros são sempre em inglês.
10. **Tolerância a erros** — operações degradam graciosamente em vez de crashar.

---

## Vocabulário do Domínio

| Termo | Definição |
|-------|-----------|
| **Mapa de Organização** | Template JSON que define a estrutura de classificação de um tipo de projeto (quais pastas, quantas fotos esperadas, hierarquia de grupos) |
| **Slot** | Destino de classificação = uma pasta. Cada slot tem um ID, nome de pasta, e opcionalmente um grupo e contagem esperada |
| **Projeto** | Unidade de trabalho = conjunto de fotos organizadas por um mapa específico |
| **Slug** | Nome do projeto normalizado para uso em nomes de ficheiro (sem acentos, sem caracteres especiais) |
| **Inbox** | Slot especial onde todas as fotos importadas caem antes da classificação |
| **General** | Slot genérico para fotos que não cabem em nenhuma categoria específica |
| **Trash** | Lixeira virtual — fotos descartadas mas não eliminadas permanentemente |
| **Grupo** | Agrupamento hierárquico de slots (ex: C12 agrupa T01–T24). Nem todos os mapas têm grupos |
| **Group Bucket** | Slot que representa um grupo inteiro, para fotos gerais desse grupo |
| **Triagem** | Fluxo central: classificar fotos uma a uma, movendo do Inbox para os slots |
| **Revisão** | Vista em grelha de todos os slots para verificar, reordenar e recategorizar fotos |
| **Delivery/Exportação** | Preparar as fotos organizadas para uso externo (ZIP ou drag-and-drop) |
| **Gap-filling** | Ao numerar ficheiros, preencher buracos na sequência (1, 2, 4 → próximo é 3, não 5) |
| **File Token** | Identificador do slot para nomes de ficheiro: `folder` sem grupo, `group_folder` com grupo |
| **fastreport.json** | Ficheiro de metadata do projeto, presente na raiz da pasta do projeto |
| **Delivery Ledger** | Registo de quais fotos já foram "entregues" para o relatório |

---

## Fluxo Principal (Resumo)

```
Criar Projeto
     ↓
Importar Fotos (câmera ou galeria)
     ↓
Triagem (classificar foto a foto)
     ↓
Revisão (verificar, reordenar, ajustar)
     ↓
Exportar (ZIP ou partilha)
     ↓
(Opcional) Apagar projeto do dispositivo
```

---

## Mapas Existentes

| Mapa | ID | Slots | Grupos | Uso Típico |
|------|----|-------|--------|------------|
| Inspeção T1–T24 | `inspection-t24` | 27 | Nenhum | Inspeção genérica de torres/estruturas |
| Retrofit de Tendões | `tendons-retrofit` | 53 | C12, C25 | Retrofit de cabos com duas secções |

Os mapas são embarcados na app como JSON estático. No futuro, o utilizador poderá criar mapas personalizados.
