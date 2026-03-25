import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { spawn, execSync } from 'child_process'
import type { SlashCommand, WorkspaceFile } from './webview/lib/types'

/**
 * Resolve the real path of the `claude` binary by following symlinks.
 * Returns null if the binary cannot be found.
 */
function resolveClaudeBinary(): string | null {
  try {
    // `which claude` equivalent: find claude on PATH
    const rawPath = execSync('which claude', { encoding: 'utf8' }).trim()
    if (!rawPath) return null
    // Follow symlinks to the actual binary
    return fs.realpathSync(rawPath)
  } catch {
    return null
  }
}

/**
 * Extract built-in skill definitions from the Claude binary.
 *
 * The binary is a Bun-compiled JS bundle that embeds skill objects of the form:
 *   {type:"local",name:"clear",description:"Clear conversation history..."}
 *
 * We use `strings` to extract printable strings from the binary, then grep for
 * the `name:"X",description:"Y"` pattern that appears in each skill definition.
 * Names that appear with more than one description are tool-input schema fields
 * (not skills) and are excluded.
 */
async function extractBuiltinCommands(binaryPath: string): Promise<SlashCommand[]> {
  return new Promise((resolve) => {
    let stdout = ''
    let timedOut = false

    // `strings` extracts printable character sequences from the binary
    const proc = spawn('strings', [binaryPath])
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolve([])
    }, 10000)

    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    proc.on('error', () => {
      clearTimeout(timer)
      resolve([])
    })
    proc.on('close', () => {
      if (!timedOut) clearTimeout(timer)

      // Skill definitions in the binary look like:
      //   type:"local",name:"clear",description:"Clear conversation history..."
      //   type:"local-jsx",name:"mcp",description:"Manage MCP servers"
      // Matching on the type: prefix makes the extraction precise.
      const pattern = /type:"local(?:-jsx)?",name:"([a-z][a-z0-9_-]*)",description:"([^"]{3,120})"/g
      const seen = new Map<string, string>()
      let m: RegExpExecArray | null
      while ((m = pattern.exec(stdout)) !== null) {
        const [, name, desc] = m
        if (!seen.has(name)) seen.set(name, desc)
      }

      const commands: SlashCommand[] = []
      for (const [name, description] of seen) {
        commands.push({ name: `/${name}`, description })
      }
      resolve(commands)
    })
  })
}

export async function fetchSlashCommands(cwd: string): Promise<SlashCommand[]> {
  const commands = new Map<string, SlashCommand>()

  // Source 1: built-in commands extracted from the Claude binary
  const binaryPath = resolveClaudeBinary()
  if (binaryPath) {
    const builtins = await extractBuiltinCommands(binaryPath)
    for (const cmd of builtins) {
      commands.set(cmd.name, cmd)
    }
  }

  // Source 2: custom commands from ~/.claude/commands/ and {cwd}/.claude/commands/
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  const commandDirs = [
    path.join(home, '.claude', 'commands'),
    path.join(cwd, '.claude', 'commands'),
  ]
  for (const dir of commandDirs) {
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      const name = `/${path.basename(file, '.md')}`
      let description = ''
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8')
        const headingMatch = /^#+\s+(.+)$/m.exec(content)
        if (headingMatch) {
          description = headingMatch[1].trim()
        } else {
          const firstLine = content.split('\n').find((l) => l.trim().length > 0) ?? ''
          description = firstLine.trim()
        }
      } catch {
        // unreadable — skip
      }
      // Custom commands override builtins with the same name
      commands.set(name, { name, description })
    }
  }

  return [...commands.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function listWorkspaceFiles(workspacePath: string): Promise<WorkspaceFile[]> {
  const EXCLUDE = '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.next/**,**/build/**}'
  const uris = await vscode.workspace.findFiles('**/*', EXCLUDE, 500)

  const dirSet = new Set<string>()
  for (const uri of uris) {
    let dir = path.dirname(uri.fsPath)
    while (dir !== workspacePath && dir.startsWith(workspacePath)) {
      dirSet.add(dir)
      dir = path.dirname(dir)
    }
  }

  const files: WorkspaceFile[] = uris.map((uri) => ({
    path: uri.fsPath,
    relativePath: path.relative(workspacePath, uri.fsPath),
    name: path.basename(uri.fsPath),
    isDirectory: false,
  }))

  const dirs: WorkspaceFile[] = Array.from(dirSet).map((dir) => ({
    path: dir,
    relativePath: path.relative(workspacePath, dir),
    name: path.basename(dir),
    isDirectory: true,
  }))

  return [...files, ...dirs].sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

export function resolveCustomCommand(commandName: string, workspacePath: string): string | null {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  const candidates = [
    path.join(workspacePath, '.claude', 'commands', `${commandName}.md`),
    path.join(home, '.claude', 'commands', `${commandName}.md`),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return fs.readFileSync(candidate, 'utf8')
      } catch {
        return null
      }
    }
  }
  return null
}
