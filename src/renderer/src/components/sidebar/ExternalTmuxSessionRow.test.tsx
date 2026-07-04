// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExternalTmuxSession } from '../../../../shared/types'
import ExternalTmuxSessionRow from './ExternalTmuxSessionRow'
import { EXTERNAL_TMUX_SESSION_DRAG_TYPE } from './external-tmux-session-placement'

const { openExternalTmuxSessionInTerminal } = vi.hoisted(() => ({
  openExternalTmuxSessionInTerminal: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/lib/external-tmux-session-attach', () => ({
  openExternalTmuxSessionInTerminal
}))

const session: ExternalTmuxSession = {
  id: 'session-1',
  sessionId: '$1',
  sessionName: 'demo-session',
  sessionCreated: '2026-01-01T00:00:00.000Z',
  hostId: 'local',
  discoveredAt: 0,
  paneCurrentPaths: ['/tmp/demo'],
  panes: []
}

function renderRow(
  overrides: Partial<{
    session: ExternalTmuxSession
    currentProjectId: string | null
    projectOptions: { id: string; label: string }[]
    onMoveToProject: (sessionId: string, projectId: string | null) => void
  }> = {}
): ReturnType<typeof render> {
  return render(
    <ExternalTmuxSessionRow
      session={overrides.session ?? session}
      currentProjectId={overrides.currentProjectId ?? null}
      projectOptions={overrides.projectOptions ?? []}
      onMoveToProject={overrides.onMoveToProject ?? vi.fn()}
    />
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ExternalTmuxSessionRow', () => {
  it('opens the session on click after a completed drag (regression: stuck didDragRef)', () => {
    renderRow()
    const row = screen.getByRole('option')

    fireEvent.dragStart(row, { dataTransfer: makeDataTransfer() })
    fireEvent.dragEnd(row)
    fireEvent.click(row)

    expect(openExternalTmuxSessionInTerminal).toHaveBeenCalledTimes(1)
    expect(openExternalTmuxSessionInTerminal).toHaveBeenCalledWith(session)
  })

  it('does not open the session for the click that ends a drag', () => {
    renderRow()
    const row = screen.getByRole('option')

    fireEvent.dragStart(row, { dataTransfer: makeDataTransfer() })
    fireEvent.click(row)

    expect(openExternalTmuxSessionInTerminal).not.toHaveBeenCalled()
  })

  it('does not open the session when Enter is pressed on the move-to-project trigger', () => {
    renderRow()
    const trigger = screen.getByRole('button', { name: /move demo-session to a project/i })

    fireEvent.keyDown(trigger, { key: 'Enter' })

    expect(openExternalTmuxSessionInTerminal).not.toHaveBeenCalled()
  })

  it('does not present remote sessions as attach targets while keeping move actions available', () => {
    renderRow({
      session: { ...session, hostId: 'ssh:demo-host' },
      projectOptions: [{ id: 'project-1', label: 'Demo Project' }]
    })
    const row = screen.getByRole('option')
    const trigger = screen.getByRole('button', { name: /move demo-session to a project/i })

    fireEvent.click(row)
    fireEvent.keyDown(row, { key: 'Enter' })

    expect(openExternalTmuxSessionInTerminal).not.toHaveBeenCalled()
    expect(row.getAttribute('aria-description')).toBe('Remote attach is not supported yet.')
    expect(screen.getByText('Remote attach is not supported yet.')).toBeTruthy()
    expect((trigger as HTMLButtonElement).disabled).toBe(false)
  })
})

function makeDataTransfer(): DataTransfer {
  const store = new Map<string, string>()
  return {
    setData: (format: string, data: string) => store.set(format, data),
    getData: (format: string) => store.get(format) ?? '',
    dropEffect: 'move',
    effectAllowed: 'uninitialized',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [EXTERNAL_TMUX_SESSION_DRAG_TYPE]
  } as unknown as DataTransfer
}
