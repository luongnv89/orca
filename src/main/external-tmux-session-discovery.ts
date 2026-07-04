import { execFile as execFileCallback } from 'node:child_process'
import { LOCAL_EXECUTION_HOST_ID } from '../shared/execution-host'
import type { ExecutionHostId } from '../shared/execution-host'
import type { ExternalTmuxSession, ExternalTmuxSessionPane } from '../shared/types'

const FIELD_SEPARATOR = '\u001f'
const DISCOVERY_TIMEOUT_MS = 1500
const LIST_PANES_FORMAT = [
  '#{session_id}',
  '#{session_name}',
  '#{session_created}',
  '#{window_id}',
  '#{window_name}',
  '#{pane_id}',
  '#{pane_current_path}',
  '#{pane_current_command}',
  '#{pane_active}'
].join(FIELD_SEPARATOR)

type ExecFile = (
  file: string,
  args: readonly string[],
  options: { timeout: number; maxBuffer: number },
  callback: (error: Error | null, stdout: string, stderr: string) => void
) => void

type DiscoverExternalTmuxSessionsOptions = {
  execFile?: ExecFile
  now?: () => number
}

type MutableSession = ExternalTmuxSession & {
  panePathSet: Set<string>
}

export function parseTmuxListPanesOutput(
  output: string,
  discoveredAt = Date.now(),
  hostId: ExecutionHostId = LOCAL_EXECUTION_HOST_ID
): ExternalTmuxSession[] {
  const sessions = new Map<string, MutableSession>()
  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      continue
    }
    const fields = rawLine.split(FIELD_SEPARATOR)
    if (fields.length < 9) {
      continue
    }
    const sessionId = fields[0]!
    const sessionName = fields[1]!
    const sessionCreated = fields[2]!
    const windowId = fields[3]!
    const windowName = fields[4]!
    const paneId = fields[5]!
    const currentPath = fields[6]!
    const command = fields[7]!
    const active = fields[8]!
    if (!sessionId || !sessionName || !sessionCreated || !paneId) {
      continue
    }
    // Why: tmux can reuse `$1`-style session ids after a server restart, so
    // persisted placement keys include the creation timestamp as durable salt.
    const id = `external-tmux:${hostId}:${sessionId}:${sessionCreated}`
    let session = sessions.get(id)
    if (!session) {
      session = {
        id,
        sessionId,
        sessionName,
        sessionCreated,
        hostId,
        discoveredAt,
        paneCurrentPaths: [],
        panes: [],
        panePathSet: new Set()
      }
      sessions.set(id, session)
    }
    const pane: ExternalTmuxSessionPane = {
      paneId,
      windowId: windowId || null,
      windowName: windowName || null,
      currentPath: currentPath || null,
      currentCommand: command || null,
      active: active === '1'
    }
    session.panes.push(pane)
    if (pane.currentPath && !session.panePathSet.has(pane.currentPath)) {
      session.panePathSet.add(pane.currentPath)
      session.paneCurrentPaths.push(pane.currentPath)
    }
  }

  return [...sessions.values()]
    .map(({ panePathSet: _panePathSet, ...session }) => session)
    .sort((left, right) => left.sessionName.localeCompare(right.sessionName))
}

export async function discoverExternalTmuxSessions(
  options: DiscoverExternalTmuxSessionsOptions = {}
): Promise<ExternalTmuxSession[]> {
  const execFile = options.execFile ?? (execFileCallback as unknown as ExecFile)
  const discoveredAt = options.now?.() ?? Date.now()

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        'tmux',
        ['list-panes', '-a', '-F', LIST_PANES_FORMAT],
        { timeout: DISCOVERY_TIMEOUT_MS, maxBuffer: 512 * 1024 },
        (error, result) => {
          if (error) {
            reject(error)
            return
          }
          resolve(result)
        }
      )
    })
    // Why: this IPC enumerates only the local tmux server. Remote/runtime hosts
    // stay host-isolated until a dedicated remote command path is available.
    return parseTmuxListPanesOutput(stdout, discoveredAt, LOCAL_EXECUTION_HOST_ID)
  } catch {
    // Why: tmux is optional and often absent on Windows or SSH-light installs;
    // discovery must never break the project sidebar.
    return []
  }
}
