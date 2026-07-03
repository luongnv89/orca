import { describe, expect, it } from 'vitest'
import type {
  ExternalTmuxSession,
  Project,
  ProjectHostSetup,
  Repo,
  Worktree
} from '../../../../shared/types'
import {
  UNCLASSIFIED_EXTERNAL_TMUX_SECTION_KEY,
  buildExternalTmuxSessionSections,
  resolveExternalTmuxSessionProjectId
} from './external-tmux-session-placement'

function tmuxSession(overrides: Partial<ExternalTmuxSession>): ExternalTmuxSession {
  return {
    id: 'tmux-1',
    sessionId: '$1',
    sessionName: 'agent',
    hostId: 'local',
    discoveredAt: 1,
    paneCurrentPaths: [],
    panes: [],
    ...overrides
  }
}

const project: Project = {
  id: 'project-1',
  displayName: 'Project One',
  badgeColor: '#777777',
  sourceRepoIds: ['repo-1'],
  createdAt: 1,
  updatedAt: 1
}

const repo: Repo = {
  id: 'repo-1',
  path: '/workspace/project-one',
  displayName: 'Repo One',
  badgeColor: '#777777',
  branch: 'main',
  addedAt: 1,
  sortOrder: 1,
  worktreeOrder: {}
} as Repo

const setup: ProjectHostSetup = {
  id: 'setup-1',
  projectId: project.id,
  hostId: 'local',
  repoId: repo.id,
  path: '/workspace/project-one',
  displayName: 'Project One',
  setupState: 'ready',
  setupMethod: 'legacy-repo',
  createdAt: 1,
  updatedAt: 1
}

const worktree: Worktree = {
  id: 'worktree-1',
  repoId: repo.id,
  path: '/workspace/project-one/feature',
  branch: 'feature',
  name: 'feature',
  isMainWorktree: false,
  isBare: false,
  isArchived: false,
  isPinned: false,
  addedAt: 1,
  lastActivityAt: 1,
  sortOrder: 1,
  instanceId: 'instance-1'
} as unknown as Worktree

describe('external tmux session placement', () => {
  it('matches sessions to a project by pane cwd under a host setup path', () => {
    const session = tmuxSession({ paneCurrentPaths: ['/workspace/project-one/src'] })

    expect(
      resolveExternalTmuxSessionProjectId({
        session,
        placements: {},
        projects: [project],
        projectHostSetups: [setup],
        worktrees: []
      })
    ).toBe(project.id)
  })

  it('does not match paths across host identities', () => {
    const session = tmuxSession({
      hostId: 'ssh:remote',
      paneCurrentPaths: ['/workspace/project-one']
    })

    expect(
      resolveExternalTmuxSessionProjectId({
        session,
        placements: {},
        projects: [project],
        projectHostSetups: [setup],
        worktrees: []
      })
    ).toBeNull()
  })

  it('lets manual placement override automatic cwd matching', () => {
    const targetProject = { ...project, id: 'project-2', displayName: 'Project Two' }
    const session = tmuxSession({ paneCurrentPaths: ['/workspace/project-one/src'] })

    expect(
      resolveExternalTmuxSessionProjectId({
        session,
        placements: {
          [session.id]: { sessionId: session.id, projectId: targetProject.id, assignedAt: 2 }
        },
        projects: [project, targetProject],
        projectHostSetups: [setup],
        worktrees: []
      })
    ).toBe(targetProject.id)
  })

  it('builds visible project and unclassified sections', () => {
    const matched = tmuxSession({ id: 'tmux-1', paneCurrentPaths: [worktree.path] })
    const unknown = tmuxSession({ id: 'tmux-2', sessionName: 'unknown', paneCurrentPaths: [] })

    const sections = buildExternalTmuxSessionSections({
      sessions: [matched, unknown],
      placements: {},
      projects: [project],
      projectHostSetups: [setup],
      repos: [repo],
      worktrees: [worktree]
    })

    expect(sections).toEqual([
      {
        sectionKey: `project:${project.id}`,
        label: project.displayName,
        projectId: project.id,
        sessions: [matched]
      },
      {
        sectionKey: UNCLASSIFIED_EXTERNAL_TMUX_SECTION_KEY,
        label: 'Unclassified tmux sessions',
        projectId: null,
        sessions: [unknown]
      }
    ])
  })
})
