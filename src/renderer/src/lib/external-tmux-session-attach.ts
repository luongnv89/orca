import { toast } from 'sonner'
import { reconcileTabOrder } from '@/components/tab-bar/reconcile-order'
import { isPathInsideOrEqual } from '../../../shared/cross-platform-path'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import type {
  ExternalTmuxSession,
  ExternalTmuxSessionPlacements,
  Project,
  ProjectHostSetup,
  Worktree
} from '../../../shared/types'
import { useAppStore } from '@/store'
import { getAllWorktreesFromState, getProjectHostSetupProjectionFromState } from '@/store/selectors'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { resolveExternalTmuxSessionProjectId } from '@/components/sidebar/external-tmux-session-placement'
import {
  createWebRuntimeSessionTerminal,
  isWebRuntimeSessionActive
} from '@/runtime/web-runtime-session'
import { getRuntimeEnvironmentIdForWorktree } from '@/lib/worktree-runtime-owner'
import { translate } from '@/i18n/i18n'

/** Shell-safe single-quoted string for tmux session names. */
export function shellQuoteForTmuxSessionName(sessionName: string): string {
  return `'${sessionName.replace(/'/g, `'\\''`)}'`
}

export function buildTmuxAttachStartupCommand(sessionName: string): string {
  return `exec tmux attach-session -t ${shellQuoteForTmuxSessionName(sessionName)}`
}

function worktreeMatchesSessionHost(worktree: Worktree, session: ExternalTmuxSession): boolean {
  return (worktree.hostId ?? LOCAL_EXECUTION_HOST_ID) === session.hostId
}

export function resolveWorktreeIdForExternalTmuxSession(args: {
  session: ExternalTmuxSession
  placements: ExternalTmuxSessionPlacements
  projects: readonly Project[]
  projectHostSetups: readonly ProjectHostSetup[]
  worktrees: readonly Worktree[]
  projectIdHint: string | null
}): string | null {
  const projectId =
    args.projectIdHint ??
    resolveExternalTmuxSessionProjectId({
      session: args.session,
      placements: args.placements,
      projects: args.projects,
      projectHostSetups: args.projectHostSetups,
      worktrees: args.worktrees
    })

  if (projectId) {
    const repoIds = new Set(
      args.projectHostSetups
        .filter(
          (setup) =>
            setup.projectId === projectId &&
            (setup.hostId ?? LOCAL_EXECUTION_HOST_ID) === args.session.hostId
        )
        .map((setup) => setup.repoId)
    )
    const candidates = args.worktrees.filter(
      (worktree) =>
        !worktree.isArchived &&
        worktreeMatchesSessionHost(worktree, args.session) &&
        repoIds.has(worktree.repoId)
    )
    const main = candidates.find((worktree) => worktree.isMainWorktree)
    return (main ?? candidates[0])?.id ?? null
  }

  for (const candidatePath of args.session.paneCurrentPaths) {
    for (const worktree of args.worktrees) {
      if (worktree.isArchived || !worktreeMatchesSessionHost(worktree, args.session)) {
        continue
      }
      if (isPathInsideOrEqual(worktree.path, candidatePath)) {
        return worktree.id
      }
    }
  }

  const fallback = args.worktrees.find(
    (worktree) => !worktree.isArchived && worktreeMatchesSessionHost(worktree, args.session)
  )
  return fallback?.id ?? null
}

export async function openExternalTmuxSessionInTerminal(
  session: ExternalTmuxSession
): Promise<void> {
  if (session.hostId !== LOCAL_EXECUTION_HOST_ID) {
    toast.error(
      translate(
        'auto.lib.externalTmuxSessionAttach.remoteUnsupported',
        'Attaching to tmux on remote hosts is not supported yet.'
      )
    )
    return
  }

  const state = useAppStore.getState()
  const worktrees = getAllWorktreesFromState(state)
  const { setups: projectHostSetups } = getProjectHostSetupProjectionFromState(state)
  const projects = state.projects ?? []
  const placements = state.externalTmuxSessionPlacements ?? {}

  const projectIdHint =
    placements[session.id]?.projectId ??
    resolveExternalTmuxSessionProjectId({
      session,
      placements,
      projects,
      projectHostSetups,
      worktrees
    })

  const worktreeId = resolveWorktreeIdForExternalTmuxSession({
    session,
    placements,
    projects,
    projectHostSetups,
    worktrees,
    projectIdHint
  })

  if (!worktreeId) {
    toast.error(
      translate(
        'auto.lib.externalTmuxSessionAttach.noWorkspace',
        'Open a project workspace first, then attach to this tmux session.'
      )
    )
    return
  }

  const startupCwd =
    session.panes.find((pane) => pane.active)?.currentPath ??
    session.paneCurrentPaths[0] ??
    undefined

  const attachCommand = buildTmuxAttachStartupCommand(session.sessionName)

  activateAndRevealWorktree(worktreeId, { revealInSidebar: false })

  const runtimeEnvironmentId = getRuntimeEnvironmentIdForWorktree(state, worktreeId)
  if (isWebRuntimeSessionActive(runtimeEnvironmentId)) {
    const created = await createWebRuntimeSessionTerminal({
      worktreeId,
      environmentId: runtimeEnvironmentId,
      command: attachCommand,
      cwd: startupCwd,
      startupCommandDelivery: 'shell-ready',
      activate: true,
      selectWorktree: true
    })
    if (!created) {
      toast.error(
        translate(
          'auto.lib.externalTmuxSessionAttach.attachFailed',
          'Could not open a terminal to attach to {{sessionName}}.',
          { sessionName: session.sessionName }
        )
      )
    }
    return
  }

  const store = useAppStore.getState()
  const newTab = store.createTab(worktreeId, undefined, undefined, {
    activate: true,
    ...(startupCwd ? { startupCwd } : {})
  })
  store.queueTabStartupCommand(newTab.id, {
    command: attachCommand,
    startupCommandDelivery: 'shell-ready'
  })
  store.setActiveTabType('terminal')

  const freshState = useAppStore.getState()
  const termIds = (freshState.tabsByWorktree[worktreeId] ?? []).map((tab) => tab.id)
  const editorIds = freshState.openFiles
    .filter((file) => file.worktreeId === worktreeId)
    .map((file) => file.id)
  const base = reconcileTabOrder(freshState.tabBarOrderByWorktree[worktreeId], termIds, editorIds)
  const order = base.filter((id) => id !== newTab.id)
  order.push(newTab.id)
  store.setTabBarOrder(worktreeId, order)
}
