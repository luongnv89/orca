import { Terminal } from 'lucide-react'
import type { ExternalTmuxSession } from '../../../../shared/types'
import { cn } from '@/lib/utils'
import { EXTERNAL_TMUX_SESSION_DRAG_TYPE } from './external-tmux-session-placement'

type ExternalTmuxSessionRowProps = {
  session: ExternalTmuxSession
  depth?: number
}

function getSessionDetail(session: ExternalTmuxSession): string {
  const activePane = session.panes.find((pane) => pane.active)
  return activePane?.currentPath ?? session.paneCurrentPaths[0] ?? 'External tmux session'
}

export default function ExternalTmuxSessionRow({
  session,
  depth = 0
}: ExternalTmuxSessionRowProps) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(EXTERNAL_TMUX_SESSION_DRAG_TYPE, session.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'group mx-2 rounded-md border border-transparent px-2 py-1.5 text-sidebar-foreground',
        'cursor-grab select-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
      </div>
    </div>
  )
}
