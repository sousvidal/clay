import type { Attachment } from '../../lib/types'

// ── Model / effort config ─────────────────────────────────────────────

export const MODELS = [
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'haiku', label: 'Haiku' },
  { id: 'opus', label: 'Opus' },
] as const

export const EFFORTS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'max', label: 'Max' },
] as const

// ── Helpers ──────────────────────────────────────────────────────────

export function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return ''

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export function basename(p: string): string {
  return p.split('/').pop() ?? p
}

// ── File type helpers ────────────────────────────────────────────────

export const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'yaml',
  'yml',
  'csv',
  'xml',
  'html',
  'htm',
  'css',
  'py',
  'rs',
  'go',
  'java',
  'rb',
  'sh',
  'bash',
  'zsh',
  'toml',
  'ini',
  'env',
  'graphql',
  'sql',
  'vue',
  'svelte',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'kt',
  'swift',
])

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'pdf') return 'application/pdf'
  if (TEXT_EXTENSIONS.has(ext)) return 'text/plain'
  return 'application/octet-stream'
}

export function isImageType(mediaType: string): boolean {
  return mediaType.startsWith('image/')
}

function isTextType(mediaType: string, filename: string): boolean {
  if (mediaType.startsWith('text/')) return true
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return TEXT_EXTENSIONS.has(ext)
}

export function readFileAsAttachment(file: File): Promise<Attachment> {
  const mediaType = file.type || guessMimeType(file.name)
  const isText = isTextType(mediaType, file.name)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(reader.error)

    if (isText) {
      reader.onload = () => {
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          mediaType,
          data: reader.result as string,
          isText: true,
        })
      }
      reader.readAsText(file)
    } else {
      reader.onload = () => {
        // Strip "data:<mediaType>;base64," prefix
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1] ?? ''
        const previewUrl = isImageType(mediaType) ? URL.createObjectURL(file) : undefined
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          mediaType,
          data: base64,
          isText: false,
          previewUrl,
        })
      }
      reader.readAsDataURL(file)
    }
  })
}
