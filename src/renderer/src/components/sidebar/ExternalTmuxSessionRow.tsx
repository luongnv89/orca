import { Ellipsis, Terminal } from 'lucide-react'
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
  return activePane?.currentPath ?? session.paneCurrentPaths[0] ?? 'External tmux session'
}

function getSessionLabel(session: ExternalTmuxSession): string {
  return `External tmux session ${session.sessionName}`
}

export default function ExternalTmuxSessionRow({
  session,
  optionId,
  depth = 0,
  currentProjectId,
  projectOptions,
  onMoveToProject
}: ExternalTmuxSessionRowProps) {
  return (
    <div
      id={optionId}
      draggable
      role="option"
      tabIndex={0}
      aria-selected={false}
      aria-label={getSessionLabel(session)}
      onDragStart={(event) => {
        event.dataTransfer.setData(EXTERNAL_TMUX_SESSION_DRAG_TYPE, session.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'group mx-2 rounded-md border border-transparent px-2 py-1.5 text-sidebar-foreground',
        'cursor-grab select-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring',
        'focus-within:bg-sidebar-accent focus-within:text-sidebar-accent-foreground'
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      title={session.sessionName}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Terminal className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-5">{session.sessionName}</div>
          <div className="truncate text-xs text-muted-foreground">{getSessionDetail(session)}</div>
        </div>
        <span className="shrink-0 rounded-full border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          tmux
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label={`Move ${session.sessionName} to a project`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <Ellipsis className="size-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {currentProjectId ? (
              <>
                <DropdownMenuItem onSelect={() => onMoveToProject(session.id, null)}>
                  Move to unclassified
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
                  {project.id === currentProjectId ? 'Current: ' : ''}
                  {project.label}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No projects available</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
