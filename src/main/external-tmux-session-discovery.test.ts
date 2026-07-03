import { describe, expect, it } from 'vitest'
import {
  discoverExternalTmuxSessions,
  parseTmuxListPanesOutput
} from './external-tmux-session-discovery'

const sep = '\u001f'

function line(fields: readonly string[]): string {
  return fields.join(sep)
}

describe('parseTmuxListPanesOutput', () => {
  it('groups panes into stable external tmux sessions', () => {
    const output = [
      line(['$1', 'agent-one', '@1', 'editor', '%1', '/repo', 'zsh', '1']),
      line(['$1', 'agent-one', '@2', 'tests', '%2', '/repo/packages/app', 'vim', '0']),
      line(['$2', 'agent-two', '@3', 'shell', '%3', '', 'bash', '1'])
    ].join('\n')

    const sessions = parseTmuxListPanesOutput(output, 123)

    expect(sessions).toEqual([
      {
        id: 'external-tmux:local:$1',
        sessionId: '$1',
        sessionName: 'agent-one',
        hostId: 'local',
        discoveredAt: 123,
        paneCurrentPaths: ['/repo', '/repo/packages/app'],
        panes: [
          {
            paneId: '%1',
            windowId: '@1',
            windowName: 'editor',
            currentPath: '/repo',
            currentCommand: 'zsh',
            active: true
          },
          {
            paneId: '%2',
            windowId: '@2',
            windowName: 'tests',
            currentPath: '/repo/packages/app',
            currentCommand: 'vim',
            active: false
          }
        ]
      },
      {
        id: 'external-tmux:local:$2',
        sessionId: '$2',
        sessionName: 'agent-two',
        hostId: 'local',
        discoveredAt: 123,
        paneCurrentPaths: [],
        panes: [
          {
            paneId: '%3',
            windowId: '@3',
            windowName: 'shell',
            currentPath: null,
            currentCommand: 'bash',
            active: true
          }
        ]
      }
    ])
  })

  it('ignores malformed rows without failing discovery', () => {
    const output = [
      'not-enough-fields',
      line(['', 'missing-session-id', '@1', 'win', '%1', '/repo', 'zsh', '1']),
      line(['$3', 'valid', '@2', 'win', '%2', '/repo', 'zsh', '1'])
    ].join('\n')

    expect(parseTmuxListPanesOutput(output, 1)).toHaveLength(1)
  })
})

describe('discoverExternalTmuxSessions', () => {
  it('returns parsed sessions from tmux list-panes output', async () => {
    const execFile = (
      _file: string,
      _args: readonly string[],
      _options: { timeout: number; maxBuffer: number },
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ): void => {
      callback(null, line(['$1', 'agent', '@1', 'win', '%1', '/repo', 'zsh', '1']), '')
    }

    await expect(discoverExternalTmuxSessions({ execFile, now: () => 5 })).resolves.toMatchObject([
      { id: 'external-tmux:local:$1', sessionName: 'agent', discoveredAt: 5 }
    ])
  })

  it('fails soft when tmux is unavailable or has no server', async () => {
    const execFile = (
      _file: string,
      _args: readonly string[],
      _options: { timeout: number; maxBuffer: number },
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ): void => {
      callback(new Error('spawn tmux ENOENT'), '', '')
    }

    await expect(discoverExternalTmuxSessions({ execFile })).resolves.toEqual([])
  })
})
