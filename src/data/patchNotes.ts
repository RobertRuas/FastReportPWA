export interface PatchNote {
  version: string
  date: string
  items: {
    pt: string[]
    en: string[]
  }
}

export const patchNotes: PatchNote[] = [
  {
    version: '2026.11.15.2',
    date: '2026-11-15',
    items: {
      pt: [
        'Cards do resumo da página inicial mais pequenos — os quatro passam a caber numa só linha.',
        'Novo projeto: corrigido o texto de exemplo do nome, que mostrava "{date}" em vez da data.',
        'Novo projeto: o nome é agora escrito em maiúsculas e sem acentos nem caracteres especiais, à medida que escreve.',
        'Nota discreta no fundo da página inicial a explicar como se estrutura um projeto.'
      ],
      en: [
        'Smaller summary cards on the home screen — all four now fit in one row.',
        'New project: fixed the name example, which showed "{date}" instead of the date.',
        'New project: the name is now typed in uppercase with no accents or special characters.',
        'Discreet note at the bottom of the home screen explaining how a project is structured.'
      ]
    }
  },
  {
    version: '2026.11.15.1',
    date: '2026-11-15',
    items: {
      pt: [
        'Review: ao fechar uma foto, a lista fica exatamente na posição onde estava. O visualizador passa a abrir por cima da grelha, em vez de a substituir e recarregar.',
        'O filtro de grupo escolhido no Review deixa de se perder ao abrir e fechar uma foto.'
      ],
      en: [
        'Review: closing a photo now leaves the list exactly where it was. The viewer opens on top of the grid instead of replacing and rebuilding it.',
        'The group filter picked on Review is no longer lost when opening and closing a photo.'
      ]
    }
  },
  {
    version: '2026.11.15',
    date: '2026-11-15',
    items: {
      pt: [
        'Barra do visualizador de fotos refeita: desfazer, espelhar, recortar, rodar, mover e excluir — cada um com o seu próprio ícone.',
        'Novo recorte de fotos com moldura ajustável pelos cantos.',
        'Mover para outro slot passa a estar disponível também durante a triagem.',
        'Rodapé da página inicial mostra a data e hora do último deploy, à direita do espaço utilizado.'
      ],
      en: [
        'Photo viewer toolbar rebuilt: undo, flip, crop, rotate, move and delete — each with its own icon.',
        'New photo crop with a frame you drag by the corners.',
        'Move to another slot is now available during triage too.',
        'Home footer shows the last deploy date and time, right of the storage used.'
      ]
    }
  },
  {
    version: '2026.11.13',
    date: '2026-11-13',
    items: {
      pt: [
        'Migração completa do backend para a API windlog — Supabase removido.',
        'Novo login com e-mail + senha (a senha é definida no primeiro acesso).',
        'Sincronização de definições agora por polling (30s) em vez de realtime.',
        'Link de partilha por e-mail removido — use o ficheiro ZIP exportado localmente.',
        'Limite de 100 MB por backup sincronizado para a cloud.'
      ],
      en: [
        'Complete backend migration to the windlog API — Supabase removed.',
        'New login with email + password (password is set on first access).',
        'Settings sync now via polling (30s) instead of realtime.',
        'Share by email link removed — share the locally exported ZIP instead.',
        '100 MB limit per cloud-synced backup.'
      ]
    }
  },
  {
    version: '2026.11.09.2',
    date: '2026-11-09',
    items: {
      pt: [
        'Correção do scroll ao voltar do Image View — agora espera os thumbs carregarem antes de repor a posição.'
      ],
      en: [
        'Fixed scroll restore when returning from the Image View — now waits for thumbs to render before scrolling back.'
      ]
    }
  },
  {
    version: '2026.11.09',
    date: '2026-11-09',
    items: {
      pt: [
        'Backup para a cloud agora usa upload resumível (TUS) — resolve "Load failed" em projetos grandes no iOS.',
        'Ao fechar o Image View, a lista do Review volta à posição onde estavas.',
        'Novo ecrã de notas de versão a cada atualização.'
      ],
      en: [
        'Cloud backup now uses resumable (TUS) uploads — fixes "Load failed" on iOS for large projects.',
        'Closing the Image View returns the Review list to where you were.',
        'New release notes screen on every update.'
      ]
    }
  }
]

export function latestPatchNote(): PatchNote | null {
  return patchNotes[0] ?? null
}
