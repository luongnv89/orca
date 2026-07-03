import { execFile as execFileCallback } from 'node:child_process'
import { LOCAL_EXECUTION_HOST_ID } from '../shared/execution-host'
import type { ExternalTmuxSession, ExternalTmuxSessionPane } from '../shared/types'

const FIELD_SEPARATOR = '\u001f'
const DISCOVERY_TIMEOUT_MS = 1500
const LIST_PANES_FORMAT = [
  '#{session_id}',
  '#{session_name}',
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
  discoveredAt = Date.now()
): ExternalTmuxSession[] {
  const sessions = new Map<string, MutableSession>()
  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      continue
    }
    const fields = rawLine.split(FIELD_SEPARATOR)
    if (fields.length < 8) {
      continue
    }
    const [sessionId, sessionName, windowId, windowName, paneId, currentPath, command, active] =
      fields
    if (!sessionId || !sessionName || !paneId) {
      continue
    }
    const id = `external-tmux:${LOCAL_EXECUTION_HOST_ID}:${sessionId}`
    let session = sessions.get(id)
    if (!session) {
      session = {
        id,
        sessionId,
        sessionName,
        hostId: LOCAL_EXECUTION_HOST_ID,
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
    return parseTmuxListPanesOutput(stdout, discoveredAt)
  } catch {
    // Why: tmux is optional and often absent on Windows or SSH-light installs;
    // discovery must never break the project sidebar.
    return []
  }
}
