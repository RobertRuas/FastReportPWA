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
