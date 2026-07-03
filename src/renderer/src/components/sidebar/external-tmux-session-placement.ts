import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { isPathInsideOrEqual } from '../../../../shared/cross-platform-path'
import type {
  ExternalTmuxSession,
  ExternalTmuxSessionPlacements,
  Project,
  ProjectHostSetup,
  Repo,
  Worktree
} from '../../../../shared/types'

export const UNCLASSIFIED_EXTERNAL_TMUX_SECTION_KEY = 'external-tmux:unclassified'
export const EXTERNAL_TMUX_SESSION_DRAG_TYPE = 'application/x-orca-external-tmux-session'

type PlacementInput = {
  sessions: readonly ExternalTmuxSession[]
  placements: ExternalTmuxSessionPlacements
  projects: readonly Project[]
  projectHostSetups: readonly ProjectHostSetup[]
  repos: readonly Repo[]
  worktrees: readonly Worktree[]
}

export type ExternalTmuxSessionSection = {
  sectionKey: string
  label: string
  projectId: string | null
  sessions: ExternalTmuxSession[]
}

function projectSectionKey(projectId: string): string {
  return `project:${projectId}`
}

function sessionMatchesHost(
  session: ExternalTmuxSession,
  hostId: string | null | undefined
): boolean {
  return session.hostId === (hostId ?? LOCAL_EXECUTION_HOST_ID)
}

function findProjectByPath(
  session: ExternalTmuxSession,
  projectHostSetups: readonly ProjectHostSetup[],
  worktrees: readonly Worktree[]
): string | null {
  const setupByRepoId = new Map(projectHostSetups.map((setup) => [setup.repoId, setup]))
  for (const candidatePath of session.paneCurrentPaths) {
    for (const setup of projectHostSetups) {
      if (
        sessionMatchesHost(session, setup.hostId) &&
        isPathInsideOrEqual(setup.path, candidatePath)
      ) {
        return setup.projectId
      }
    }
    for (const worktree of worktrees) {
      if (
        sessionMatchesHost(session, worktree.hostId) &&
        isPathInsideOrEqual(worktree.path, candidatePath)
      ) {
        return setupByRepoId.get(worktree.repoId)?.projectId ?? worktree.repoId
      }
    }
  }
  return null
}

export function resolveExternalTmuxSessionProjectId(args: {
  session: ExternalTmuxSession
  placements: ExternalTmuxSessionPlacements
  projects: readonly Project[]
  projectHostSetups: readonly ProjectHostSetup[]
  worktrees: readonly Worktree[]
}): string | null {
  const manualProjectId = args.placements[args.session.id]?.projectId
  if (manualProjectId && args.projects.some((project) => project.id === manualProjectId)) {
    return manualProjectId
  }
  const matchedProjectId = findProjectByPath(args.session, args.projectHostSetups, args.worktrees)
  return matchedProjectId && args.projects.some((project) => project.id === matchedProjectId)
    ? matchedProjectId
    : null
}

export function buildExternalTmuxSessionSections({
  sessions,
  placements,
  projects,
  projectHostSetups,
  repos,
  worktrees
}: PlacementInput): ExternalTmuxSessionSection[] {
  if (sessions.length === 0) {
    return []
  }
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const repoById = new Map(repos.map((repo) => [repo.id, repo]))
  const sections = new Map<string, ExternalTmuxSessionSection>()
  const getOrCreateSection = (
    projectId: string | null,
    fallbackLabel: string
  ): ExternalTmuxSessionSection => {
    const sectionKey = projectId
      ? projectSectionKey(projectId)
      : UNCLASSIFIED_EXTERNAL_TMUX_SECTION_KEY
    let section = sections.get(sectionKey)
    if (!section) {
      section = {
        sectionKey,
        label: projectId
          ? (projectById.get(projectId)?.displayName ?? fallbackLabel)
          : fallbackLabel,
        projectId,
        sessions: []
      }
      sections.set(sectionKey, section)
    }
    return section
  }

  for (const session of sessions) {
    const projectId = resolveExternalTmuxSessionProjectId({
      session,
      placements,
      projects,
      projectHostSetups,
      worktrees
    })
    const fallbackLabel = projectId
      ? (repoById.get(projectId)?.displayName ?? 'Project')
      : 'Unclassified tmux sessions'
    getOrCreateSection(projectId, fallbackLabel).sessions.push(session)
  }

  return [...sections.values()].sort((left, right) => {
    if (left.projectId === null) {
      return 1
    }
    if (right.projectId === null) {
      return -1
    }
    return left.label.localeCompare(right.label)
  })
}
