import { parse } from 'shell-quote'

/**
 * Extracts the first executable name from a shell command string.
 * Uses shell-quote to properly handle quoting, operators, pipes, etc.
 * Returns null if the command cannot be parsed or is empty.
 */
export function getBaseCommand(command: string): string | null {
  try {
    const tokens = parse(command)
    const first = tokens.find((t): t is string => typeof t === 'string')
    if (!first) return null
    return first.split('/').pop() ?? null
  } catch {
    return null
  }
}
