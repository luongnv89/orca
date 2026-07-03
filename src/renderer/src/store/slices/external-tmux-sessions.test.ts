import { createStore } from 'zustand/vanilla'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExternalTmuxSession } from '../../../../shared/types'
import type { AppState } from '../types'
import {
  createExternalTmuxSessionsSlice,
  sanitizeExternalTmuxSessionPlacements
} from './external-tmux-sessions'

const listExternalTmuxSessions = vi.fn<() => Promise<ExternalTmuxSession[]>>()
const persistUI = vi.fn<(args: unknown) => Promise<void>>()

function session(id: string, sessionName = id): ExternalTmuxSession {
  return {
    id,
    sessionId: id,
    sessionName,
    sessionCreated: '1',
    hostId: 'local',
    discoveredAt: 1,
    paneCurrentPaths: ['/repo'],
    panes: []
  }
}

function createTestStore() {
  return createStore<AppState>()(
    (...args) =>
      ({
        ...createExternalTmuxSessionsSlice(...args)
      }) as AppState
  )
}

describe('createExternalTmuxSessionsSlice', () => {
  beforeEach(() => {
    listExternalTmuxSessions.mockReset()
    persistUI.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal('window', {
      api: {
        pty: { management: { listExternalTmuxSessions } },
        ui: { set: persistUI }
      }
    })
  })

  it('clears sessions when discovery IPC fails', async () => {
    listExternalTmuxSessions.mockResolvedValueOnce([session('tmux-1')])
    const store = createTestStore()
    await store.getState().refreshExternalTmuxSessions()
    expect(store.getState().externalTmuxSessionOrder).toEqual(['tmux-1'])

    listExternalTmuxSessions.mockRejectedValueOnce(new Error('tmux unavailable'))
    await store.getState().refreshExternalTmuxSessions()

    expect(store.getState().externalTmuxSessionOrder).toEqual([])
    expect(store.getState().externalTmuxSessionsById).toEqual({})
  })

  it('reconciles discovery snapshots authoritatively', async () => {
    listExternalTmuxSessions.mockResolvedValueOnce([session('tmux-1'), session('tmux-2')])
    const store = createTestStore()

    await store.getState().refreshExternalTmuxSessions()

    expect(store.getState().externalTmuxSessionOrder).toEqual(['tmux-1', 'tmux-2'])
    expect(Object.keys(store.getState().externalTmuxSessionsById)).toEqual(['tmux-1', 'tmux-2'])

    listExternalTmuxSessions.mockResolvedValueOnce([session('tmux-2')])
    await store.getState().refreshExternalTmuxSessions()

    expect(store.getState().externalTmuxSessionOrder).toEqual(['tmux-2'])
    expect(store.getState().externalTmuxSessionsById['tmux-1']).toBeUndefined()
  })

  it('persists manual project placement overrides', () => {
    const store = createTestStore()

    store.getState().setExternalTmuxSessionProjectPlacement('tmux-1', 'project-1')

    expect(store.getState().externalTmuxSessionPlacements).toEqual({
      'tmux-1': expect.objectContaining({ sessionId: 'tmux-1', projectId: 'project-1' })
    })
    expect(persistUI).toHaveBeenCalledWith({
      externalTmuxSessionPlacements: {
        'tmux-1': expect.objectContaining({ sessionId: 'tmux-1', projectId: 'project-1' })
      }
    })

    store.getState().setExternalTmuxSessionProjectPlacement('tmux-1', null)

    expect(store.getState().externalTmuxSessionPlacements).toEqual({})
  })

  it('normalizes persisted placement payloads', () => {
    expect(
      sanitizeExternalTmuxSessionPlacements({
        'tmux-1': { sessionId: 'tmux-1', projectId: 'project-1', assignedAt: 10 },
        'tmux-2': { sessionId: 'wrong', projectId: 'project-2' },
        'tmux-3': { sessionId: 'tmux-3', projectId: '' }
      })
    ).toEqual({
      'tmux-1': { sessionId: 'tmux-1', projectId: 'project-1', assignedAt: 10 }
    })
  })
})
