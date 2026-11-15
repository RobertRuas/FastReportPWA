/**
 * Input mask for project names: folds accents, uppercases and keeps only
 * A-Z, 0-9, space, hyphen and underscore — everything else is dropped.
 * Applied as the user types so the name always matches what slugify() and
 * the exported file names can represent.
 */
export function sanitizeProjectName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}
