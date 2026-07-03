import { describe, expect, it } from 'vitest'
import type { ExternalTmuxSession, ProjectHostSetup, Worktree } from '../../../shared/types'
import {
  buildTmuxAttachStartupCommand,
  resolveWorktreeIdForExternalTmuxSession,
  shellQuoteForTmuxSessionName
} from './external-tmux-session-attach'

function session(overrides: Partial<ExternalTmuxSession>): ExternalTmuxSession {
  return {
    id: 'external-tmux:local:$1:1',
    sessionId: '$1',
    sessionName: 'agent',
    sessionCreated: '1',
    hostId: 'local',
    discoveredAt: 1,
    paneCurrentPaths: [],
    panes: [],
    ...overrides
  }
}

const setup: ProjectHostSetup = {
  id: 'setup-1',
  projectId: 'project-1',
  hostId: 'local',
  repoId: 'repo-1',
  path: '/workspace/project-one',
  displayName: 'Project One',
  setupState: 'ready',
  setupMethod: 'legacy-repo',
  createdAt: 1,
  updatedAt: 1
}

const mainWorktree = {
  id: 'wt-main',
  repoId: 'repo-1',
  path: '/workspace/project-one',
  branch: 'main',
  name: 'main',
  isMainWorktree: true,
  isBare: false,
  isArchived: false,
  isPinned: false,
  addedAt: 1,
  lastActivityAt: 1,
  sortOrder: 1,
  instanceId: 'i1',
  hostId: 'local'
} as unknown as Worktree

describe('external tmux session attach helpers', () => {
  it('quotes session names for tmux attach', () => {
    expect(shellQuoteForTmuxSessionName('agent-one')).toBe("'agent-one'")
    expect(shellQuoteForTmuxSessionName("agent's")).toBe("'agent'\\''s'")
    expect(buildTmuxAttachStartupCommand('agent-one')).toBe(
      "exec tmux attach-session -t 'agent-one'"
    )
  })

  it('resolves main worktree for a placed project', () => {
    const child = {
      ...mainWorktree,
      id: 'wt-child',
      isMainWorktree: false,
      path: '/workspace/project-one/feat'
    }
    expect(
      resolveWorktreeIdForExternalTmuxSession({
        session: session({ paneCurrentPaths: ['/workspace/project-one/feat'] }),
        placements: {},
        projects: [],
        projectHostSetups: [setup],
        worktrees: [child, mainWorktree],
        projectIdHint: 'project-1'
      })
    ).toBe('wt-main')
  })

  it('resolves worktree from pane cwd when unclassified', () => {
    expect(
      resolveWorktreeIdForExternalTmuxSession({
        session: session({ paneCurrentPaths: ['/workspace/project-one/src'] }),
        placements: {},
        projects: [],
        projectHostSetups: [setup],
        worktrees: [mainWorktree],
        projectIdHint: null
      })
    ).toBe('wt-main')
  })
})
