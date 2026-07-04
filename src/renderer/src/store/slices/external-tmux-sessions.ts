import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type {
  ExternalTmuxSession,
  ExternalTmuxSessionPlacement,
  ExternalTmuxSessionPlacements
} from '../../../../shared/types'

export type ExternalTmuxSessionsSlice = {
  externalTmuxSessionsById: Record<string, ExternalTmuxSession>
  externalTmuxSessionOrder: string[]
  externalTmuxSessionPlacements: ExternalTmuxSessionPlacements
  externalTmuxSessionsLastDiscoveredAt: number | null
  refreshExternalTmuxSessions: () => Promise<void>
  setExternalTmuxSessionProjectPlacement: (sessionId: string, projectId: string | null) => void
}

function isUnsafeRecordKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype'
}

export function sanitizeExternalTmuxSessionPlacements(
  value: unknown
): ExternalTmuxSessionPlacements {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const placements: ExternalTmuxSessionPlacements = {}
  for (const [key, rawPlacement] of Object.entries(value)) {
    // Why: persisted UI state is user-tamperable; these keys mutate object
    // prototypes when assigned into plain records.
    if (isUnsafeRecordKey(key)) {
      continue
    }
    if (!rawPlacement || typeof rawPlacement !== 'object' || Array.isArray(rawPlacement)) {
      continue
    }
    const placement = rawPlacement as Partial<ExternalTmuxSessionPlacement>
    const projectId =
      placement.projectId === null
        ? null
        : typeof placement.projectId === 'string' && placement.projectId.trim().length > 0
          ? placement.projectId
          : undefined
    if (
      typeof placement.sessionId !== 'string' ||
      placement.sessionId !== key ||
      projectId === undefined
    ) {
      continue
    }
    placements[key] = {
      sessionId: placement.sessionId,
      projectId,
      assignedAt: typeof placement.assignedAt === 'number' ? placement.assignedAt : 0
    }
  }
  return placements
}

function snapshotToState(
  sessions: readonly ExternalTmuxSession[]
): Pick<
  ExternalTmuxSessionsSlice,
  'externalTmuxSessionsById' | 'externalTmuxSessionOrder' | 'externalTmuxSessionsLastDiscoveredAt'
> {
  const byId: Record<string, ExternalTmuxSession> = {}
  const order: string[] = []
  for (const session of sessions) {
    if (!session.id || byId[session.id]) {
      continue
    }
    byId[session.id] = session
    order.push(session.id)
  }
  return {
    externalTmuxSessionsById: byId,
    externalTmuxSessionOrder: order,
    externalTmuxSessionsLastDiscoveredAt: Date.now()
  }
}

export const createExternalTmuxSessionsSlice: StateCreator<
  AppState,
  [],
  [],
  ExternalTmuxSessionsSlice
> = (set, get) => {
  let inFlightRefresh: Promise<void> | null = null

  return {
    externalTmuxSessionsById: {},
    externalTmuxSessionOrder: [],
    externalTmuxSessionPlacements: {},
    externalTmuxSessionsLastDiscoveredAt: null,

    refreshExternalTmuxSessions: () => {
      if (inFlightRefresh) {
        return inFlightRefresh
      }
      const request = (async () => {
        try {
          const sessions = await window.api.pty.management.listExternalTmuxSessions()
          // Why: tmux discovery returns an authoritative snapshot; replacing the
          // map removes ended sessions without requiring per-row cleanup.
          set(snapshotToState(sessions))
        } catch (error) {
          console.info('External tmux session discovery skipped', error)
          set(snapshotToState([]))
        }
      })()
      const trackedRequest = request.finally(() => {
        if (inFlightRefresh === trackedRequest) {
          inFlightRefresh = null
        }
      })
      inFlightRefresh = trackedRequest
      return trackedRequest
    },

    setExternalTmuxSessionProjectPlacement: (sessionId, projectId) => {
      if (!sessionId || isUnsafeRecordKey(sessionId)) {
        return
      }
      if (projectId !== null && !projectId.trim()) {
        return
      }
      const current = get().externalTmuxSessionPlacements
      const next = { ...current }
      next[sessionId] = { sessionId, projectId, assignedAt: Date.now() }
      set({ externalTmuxSessionPlacements: next })
      void window.api.ui.set({ externalTmuxSessionPlacements: next }).catch(console.error)
    }
  }
}
