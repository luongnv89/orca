import { useRef } from 'react'
import { Ellipsis, Terminal } from 'lucide-react'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { ExternalTmuxSession } from '../../../../shared/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { openExternalTmuxSessionInTerminal } from '@/lib/external-tmux-session-attach'
import { translate } from '@/i18n/i18n'
import { EXTERNAL_TMUX_SESSION_DRAG_TYPE } from './external-tmux-session-placement'

export type ExternalTmuxSessionProjectOption = {
  id: string
  label: string
}

type ExternalTmuxSessionRowProps = {
  session: ExternalTmuxSession
  optionId?: string
  depth?: number
  currentProjectId: string | null
  projectOptions: readonly ExternalTmuxSessionProjectOption[]
  onMoveToProject: (sessionId: string, projectId: string | null) => void
}

function getSessionDetail(session: ExternalTmuxSession): string {
  const activePane = session.panes.find((pane) => pane.active)
  return (
    activePane?.currentPath ??
    session.paneCurrentPaths[0] ??
    translate(
      'auto.components.sidebar.ExternalTmuxSessionRow.detailFallback',
      'External tmux session'
    )
  )
}

function getSessionLabel(session: ExternalTmuxSession): string {
  return translate(
    'auto.components.sidebar.ExternalTmuxSessionRow.sessionLabel',
    'External tmux session {{sessionName}}',
    { sessionName: session.sessionName }
  )
}

function getUnsupportedSessionLabel(session: ExternalTmuxSession): string {
  return translate(
    'auto.components.sidebar.ExternalTmuxSessionRow.remoteAttachUnsupportedLabel',
    'External tmux session {{sessionName}}. Remote attach is not supported yet.',
    { sessionName: session.sessionName }
  )
}

export default function ExternalTmuxSessionRow({
  session,
  optionId,
  depth = 0,
  currentProjectId,
  projectOptions,
  onMoveToProject
}: ExternalTmuxSessionRowProps) {
  const didDragRef = useRef(false)
  const canAttach = session.hostId === LOCAL_EXECUTION_HOST_ID
  const sessionDetail = getSessionDetail(session)
  const unsupportedAttachText = translate(
    'auto.components.sidebar.ExternalTmuxSessionRow.remoteAttachUnsupported',
    'Remote attach is not supported yet.'
  )

  const handleOpenSession = (): void => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    if (!canAttach) {
      return
    }
    void openExternalTmuxSessionInTerminal(session)
  }

  return (
    <div
      id={optionId}
      draggable
      role="option"
      tabIndex={0}
      aria-selected={false}
      aria-label={canAttach ? getSessionLabel(session) : getUnsupportedSessionLabel(session)}
      aria-description={canAttach ? undefined : unsupportedAttachText}
      onClick={handleOpenSession}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleOpenSession()
        }
      }}
      onDragStart={(event) => {
        didDragRef.current = true
        event.dataTransfer.setData(EXTERNAL_TMUX_SESSION_DRAG_TYPE, session.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      // Why: without this, a cancelled/completed drag leaves didDragRef stuck
      // true and the next click is silently swallowed by handleOpenSession.
      onDragEnd={() => {
        didDragRef.current = false
      }}
      className={cn(
        'group mx-2 rounded-md border border-transparent px-2 py-1.5 text-worktree-sidebar-foreground',
        'select-none hover:bg-worktree-sidebar-accent hover:text-worktree-sidebar-accent-foreground',
        canAttach ? 'cursor-pointer' : 'cursor-default',
        'active:cursor-grabbing',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring',
        'focus-within:bg-worktree-sidebar-accent focus-within:text-worktree-sidebar-accent-foreground'
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      title={session.sessionName}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Terminal className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-5">{session.sessionName}</div>
          <div className="truncate text-xs text-muted-foreground">{sessionDetail}</div>
          {!canAttach ? (
            <div className="truncate text-xs text-muted-foreground">{unsupportedAttachText}</div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-worktree-sidebar-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          {translate('auto.components.sidebar.ExternalTmuxSessionRow.tmuxBadge', 'tmux')}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label={translate(
                'auto.components.sidebar.ExternalTmuxSessionRow.moveToProjectAriaLabel',
                'Move {{sessionName}} to a project',
                { sessionName: session.sessionName }
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              // Why: without this, Enter/Space on the trigger bubbles to the row's
              // onKeyDown and both opens the menu and attaches to the session.
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Ellipsis className="size-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {currentProjectId ? (
              <>
                <DropdownMenuItem onSelect={() => onMoveToProject(session.id, null)}>
                  {translate(
                    'auto.components.sidebar.ExternalTmuxSessionRow.moveToUnclassified',
                    'Move to unclassified'
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {projectOptions.length > 0 ? (
              projectOptions.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  disabled={project.id === currentProjectId}
                  onSelect={() => onMoveToProject(session.id, project.id)}
                >
                  {project.id === currentProjectId
                    ? translate(
                        'auto.components.sidebar.ExternalTmuxSessionRow.currentProjectLabel',
                        'Current: {{projectLabel}}',
                        { projectLabel: project.label }
                      )
                    : project.label}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>
                {translate(
                  'auto.components.sidebar.ExternalTmuxSessionRow.noProjectsAvailable',
                  'No projects available'
                )}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
