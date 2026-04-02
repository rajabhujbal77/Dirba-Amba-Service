import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Operation types for the sync queue
export type OperationType =
    | 'CREATE_BOOKING'
    | 'CREATE_TRIP'
    | 'MARK_DELIVERED'
    | 'MARK_RECEIVER_DELIVERED'
    | 'UPDATE_TRIP_STATUS'
    | 'UPDATE_BOOKING';

export type OperationStatus = 'pending' | 'syncing' | 'failed' | 'completed' | 'conflict';

export interface PendingOperation {
    id: string;
    type: OperationType;
    payload: any;
    status: OperationStatus;
    retryCount: number;
    maxRetries: number;
    createdAt: string;
    lastAttemptAt: string | null;
    error: string | null;
    // For optimistic UI - store the temporary local data
    optimisticData?: any;
    // For tracking what entity this operation affects
    entityType?: 'booking' | 'trip' | 'delivery';
    entityId?: string;
}

// Conflict information for resolution UI
export interface ConflictInfo {
    operationId: string;
    entityType: 'booking' | 'trip' | 'delivery';
    entityId: string;
    localData: any;
    serverData: any;
    localVersion: number;
    serverVersion: number;
    conflictedAt: string;
}

interface SyncState {
    pendingOperations: PendingOperation[];
    conflicts: ConflictInfo[];
    isSyncing: boolean;
    lastSyncAt: string | null;
    syncError: string | null;

    // Actions
    addOperation: (op: {
        type: OperationType;
        payload: any;
        optimisticData?: any;
        entityType?: 'booking' | 'trip' | 'delivery';
        entityId?: string;
        maxRetries?: number;
    }) => string;

    updateOperation: (id: string, updates: Partial<PendingOperation>) => void;
    removeOperation: (id: string) => void;
    clearCompleted: () => void;

    // Conflict management
    addConflict: (conflict: ConflictInfo) => void;
    resolveConflict: (operationId: string, resolution: 'keep_local' | 'keep_server' | 'cancel') => void;
    getConflicts: () => ConflictInfo[];
    hasConflicts: () => boolean;

    // Sync control
    setSyncing: (syncing: boolean) => void;
    setSyncError: (error: string | null) => void;
    markSyncComplete: () => void;

    // Getters
    getPendingCount: () => number;
    getFailedCount: () => number;
    getOperationsByType: (type: OperationType) => PendingOperation[];
    getOperationById: (id: string) => PendingOperation | undefined;
    hasPendingOperationsForEntity: (entityType: string, entityId: string) => boolean;
}

// Generate a simple unique ID without external dependency
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useSyncStore = create<SyncState>()(
    persist(
        (set, get) => ({
            pendingOperations: [],
            conflicts: [],
            isSyncing: false,
            lastSyncAt: null,
            syncError: null,

            addOperation: ({ type, payload, optimisticData, entityType, entityId, maxRetries = 5 }) => {
                const id = generateId();
                const operation: PendingOperation = {
                    id,
                    type,
                    payload,
                    status: 'pending',
                    retryCount: 0,
                    maxRetries,
                    createdAt: new Date().toISOString(),
                    lastAttemptAt: null,
                    error: null,
                    optimisticData,
                    entityType,
                    entityId,
                };

                set((state) => ({
                    pendingOperations: [...state.pendingOperations, operation],
                }));

                console.log(`[SyncStore] Added operation: ${type} (${id})`);
                return id;
            },

            updateOperation: (id, updates) => {
                set((state) => ({
                    pendingOperations: state.pendingOperations.map((op) =>
                        op.id === id ? { ...op, ...updates } : op
                    ),
                }));
            },

            removeOperation: (id) => {
                set((state) => ({
                    pendingOperations: state.pendingOperations.filter((op) => op.id !== id),
                    conflicts: state.conflicts.filter((c) => c.operationId !== id),
                }));
                console.log(`[SyncStore] Removed operation: ${id}`);
            },

            clearCompleted: () => {
                set((state) => ({
                    pendingOperations: state.pendingOperations.filter(
                        (op) => op.status !== 'completed'
                    ),
                }));
            },

            // Conflict management
            addConflict: (conflict) => {
                set((state) => {
                    // Mark the operation as having a conflict
                    const updatedOps = state.pendingOperations.map((op) =>
                        op.id === conflict.operationId ? { ...op, status: 'conflict' as OperationStatus } : op
                    );

                    // Add conflict if not already exists
                    const existingConflict = state.conflicts.find(c => c.operationId === conflict.operationId);
                    if (existingConflict) {
                        return { pendingOperations: updatedOps };
                    }

                    return {
                        pendingOperations: updatedOps,
                        conflicts: [...state.conflicts, conflict],
                    };
                });
                console.log(`[SyncStore] Added conflict for operation: ${conflict.operationId}`);
            },

            resolveConflict: (operationId, resolution) => {
                const { pendingOperations, conflicts } = get();
                const conflict = conflicts.find(c => c.operationId === operationId);
                const operation = pendingOperations.find(op => op.id === operationId);

                if (!conflict || !operation) {
                    console.warn(`[SyncStore] Conflict or operation not found: ${operationId}`);
                    return;
                }

                if (resolution === 'keep_local') {
                    // Reset operation to pending with updated version info
                    set((state) => ({
                        pendingOperations: state.pendingOperations.map((op) =>
                            op.id === operationId
                                ? {
                                    ...op,
                                    status: 'pending' as OperationStatus,
                                    retryCount: 0,
                                    payload: {
                                        ...op.payload,
                                        _forceOverwrite: true,
                                        _serverVersion: conflict.serverVersion
                                    }
                                }
                                : op
                        ),
                        conflicts: state.conflicts.filter(c => c.operationId !== operationId),
                    }));
                    console.log(`[SyncStore] Resolved conflict (keep local): ${operationId}`);
                } else if (resolution === 'keep_server') {
                    // Remove the operation and conflict
                    set((state) => ({
                        pendingOperations: state.pendingOperations.filter(op => op.id !== operationId),
                        conflicts: state.conflicts.filter(c => c.operationId !== operationId),
                    }));
                    console.log(`[SyncStore] Resolved conflict (keep server): ${operationId}`);
                } else {
                    // Cancel - just remove the operation
                    set((state) => ({
                        pendingOperations: state.pendingOperations.filter(op => op.id !== operationId),
                        conflicts: state.conflicts.filter(c => c.operationId !== operationId),
                    }));
                    console.log(`[SyncStore] Resolved conflict (cancelled): ${operationId}`);
                }
            },

            getConflicts: () => get().conflicts,

            hasConflicts: () => get().conflicts.length > 0,

            setSyncing: (syncing) => {
                set({ isSyncing: syncing });
            },

            setSyncError: (error) => {
                set({ syncError: error });
            },

            markSyncComplete: () => {
                set({
                    lastSyncAt: new Date().toISOString(),
                    isSyncing: false,
                    syncError: null,
                });
            },

            getPendingCount: () => {
                return get().pendingOperations.filter(
                    (op) => op.status === 'pending' || op.status === 'syncing'
                ).length;
            },

            getFailedCount: () => {
                return get().pendingOperations.filter((op) => op.status === 'failed').length;
            },

            getOperationsByType: (type) => {
                return get().pendingOperations.filter((op) => op.type === type);
            },

            getOperationById: (id) => {
                return get().pendingOperations.find((op) => op.id === id);
            },

            hasPendingOperationsForEntity: (entityType, entityId) => {
                return get().pendingOperations.some(
                    (op) =>
                        op.entityType === entityType &&
                        op.entityId === entityId &&
                        (op.status === 'pending' || op.status === 'syncing')
                );
            },
        }),
        {
            name: 'mango-sync-queue',
            // Persist all pending operations and conflicts
            partialize: (state) => ({
                pendingOperations: state.pendingOperations,
                conflicts: state.conflicts,
                lastSyncAt: state.lastSyncAt,
            }),
        }
    )
);

export default useSyncStore;

