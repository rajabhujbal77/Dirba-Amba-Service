/**
 * Sync Engine - Handles background synchronization of pending operations
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Max retries per operation
 * - Processes queue when online
 * - Handles partial failures
 * - Conflict detection and resolution
 */

import { useSyncStore, PendingOperation, OperationType, ConflictInfo } from '../stores/syncStore';
import { useOnlineStore } from '../stores/onlineStore';
import { bookingsApi, tripsApi } from './api';

// Configuration
const CONFIG = {
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
    MAX_RETRIES: 5,
    SYNC_INTERVAL_MS: 5000, // Check queue every 5 seconds when online
};

// Calculate exponential backoff delay
function getBackoffDelay(retryCount: number): number {
    const delay = CONFIG.BASE_DELAY_MS * Math.pow(2, retryCount);
    return Math.min(delay, CONFIG.MAX_DELAY_MS);
}

// Check if an error is a conflict error (409 or version mismatch)
function isConflictError(error: any): boolean {
    // HTTP 409 Conflict
    if (error.status === 409) {
        return true;
    }

    // Supabase version mismatch errors
    if (error.message) {
        const conflictMessages = [
            'version mismatch',
            'modified by another',
            'optimistic lock',
            'concurrent update',
            'conflict',
        ];
        return conflictMessages.some(msg =>
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    return false;
}

// Check if an error is retryable (network errors, timeouts, etc.)
function isRetryableError(error: any): boolean {
    // Conflicts are NOT retryable - they need user resolution
    if (isConflictError(error)) {
        return false;
    }

    // Network errors (fetch throws TypeError on network failure)
    if (error instanceof TypeError) {
        return true;
    }

    // Timeout/abort errors
    if (error.name === 'AbortError') {
        return true;
    }

    // HTTP status codes that are retryable
    if (error.status) {
        // 408 Request Timeout, 429 Too Many Requests, 5xx Server Errors
        return error.status === 408 || error.status === 429 || error.status >= 500;
    }

    // Check error message for network-related patterns
    if (error.message) {
        const errorMsg = error.message.toLowerCase();
        const retryablePatterns = [
            'network',
            'timeout',
            'connection',
            'econnrefused',
            'enotfound',
            'socket hang up',
            'err_name_not_resolved',
            'err_internet_disconnected',
            'err_connection',
            'err_network',
            'net::',
            'failed to fetch',
            'abort',
        ];
        return retryablePatterns.some(pattern => errorMsg.includes(pattern));
    }

    // If browser is offline, it's retryable
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return true;
    }

    return false;
}

// Execute a single operation
async function executeOperation(operation: PendingOperation): Promise<{ success: boolean; result?: any; error?: string; isConflict?: boolean; serverData?: any }> {
    try {
        switch (operation.type) {
            case 'CREATE_BOOKING': {
                const result = await bookingsApi.create(operation.payload);
                return { success: true, result };
            }

            case 'CREATE_TRIP': {
                const { tripData, bookingIds } = operation.payload;
                const result = await tripsApi.create(tripData, bookingIds);
                return { success: true, result };
            }

            case 'MARK_DELIVERED': {
                const { bookingId, paymentMethod, updates } = operation.payload;
                if (updates) {
                    await bookingsApi.update(bookingId, updates);
                } else {
                    await bookingsApi.updateStatus(bookingId, 'delivered');
                }
                return { success: true };
            }

            case 'MARK_RECEIVER_DELIVERED': {
                const { receiverId, bookingId: rBookingId, paymentMethod: rPaymentMethod } = operation.payload;
                await bookingsApi.markReceiverDelivered(receiverId, rBookingId, rPaymentMethod);
                return { success: true };
            }

            case 'UPDATE_TRIP_STATUS': {
                const { tripId, status } = operation.payload;
                await tripsApi.update(tripId, { status });
                return { success: true };
            }

            case 'UPDATE_BOOKING': {
                const { id, updates: bookingUpdates } = operation.payload;
                await bookingsApi.update(id, bookingUpdates);
                return { success: true };
            }

            default:
                return { success: false, error: `Unknown operation type: ${operation.type}` };
        }
    } catch (error: any) {
        console.error(`[SyncEngine] Operation ${operation.id} failed:`, error);

        // Check if this is a conflict error
        if (isConflictError(error)) {
            return {
                success: false,
                error: error.message || 'Conflict detected',
                isConflict: true,
                serverData: error.serverData || null,
            };
        }

        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

// Process a single operation with retry logic
async function processOperation(operation: PendingOperation): Promise<boolean> {
    const { updateOperation, removeOperation, addConflict } = useSyncStore.getState();

    // Mark as syncing
    updateOperation(operation.id, {
        status: 'syncing',
        lastAttemptAt: new Date().toISOString(),
    });

    const result = await executeOperation(operation);

    if (result.success) {
        // Success - remove from queue
        console.log(`[SyncEngine] Operation ${operation.id} completed successfully`);
        removeOperation(operation.id);
        return true;
    }

    // Check if this is a conflict
    if (result.isConflict) {
        console.log(`[SyncEngine] Conflict detected for operation ${operation.id}`);

        // Create conflict info for user resolution
        const conflictInfo: ConflictInfo = {
            operationId: operation.id,
            entityType: operation.entityType || 'booking',
            entityId: operation.entityId || operation.payload.id || 'unknown',
            localData: operation.optimisticData || operation.payload,
            serverData: result.serverData,
            localVersion: operation.payload._localVersion || 0,
            serverVersion: result.serverData?.version || 0,
            conflictedAt: new Date().toISOString(),
        };

        addConflict(conflictInfo);
        return false;
    }

    // Failed - check if we should retry
    const newRetryCount = operation.retryCount + 1;

    if (isRetryableError({ message: result.error }) && newRetryCount < operation.maxRetries) {
        // Schedule retry
        const delay = getBackoffDelay(newRetryCount);
        console.log(`[SyncEngine] Operation ${operation.id} failed, will retry in ${delay}ms (attempt ${newRetryCount}/${operation.maxRetries})`);

        updateOperation(operation.id, {
            status: 'pending',
            retryCount: newRetryCount,
            error: result.error || null,
        });

        // Wait before allowing next sync attempt
        await new Promise(resolve => setTimeout(resolve, delay));
        return false;
    }

    // Max retries exceeded or non-retryable error
    console.error(`[SyncEngine] Operation ${operation.id} permanently failed after ${newRetryCount} attempts`);
    updateOperation(operation.id, {
        status: 'failed',
        retryCount: newRetryCount,
        error: result.error || 'Max retries exceeded',
    });

    return false;
}

// Process all pending operations
export async function processQueue(): Promise<void> {
    const { pendingOperations, isSyncing, setSyncing, markSyncComplete } = useSyncStore.getState();
    const { isOnline } = useOnlineStore.getState();

    // Don't sync if offline or already syncing
    if (!isOnline || isSyncing) {
        return;
    }

    // Get pending operations (not failed, not already syncing)
    const toProcess = pendingOperations.filter(op => op.status === 'pending');

    if (toProcess.length === 0) {
        return;
    }

    console.log(`[SyncEngine] Processing ${toProcess.length} pending operations`);
    setSyncing(true);

    try {
        // Process operations in order (FIFO)
        for (const operation of toProcess) {
            // Check if still online before each operation
            if (!useOnlineStore.getState().isOnline) {
                console.log('[SyncEngine] Went offline, stopping queue processing');
                break;
            }

            await processOperation(operation);
        }
    } finally {
        markSyncComplete();
    }
}

// Retry all failed operations
export async function retryFailed(): Promise<void> {
    const { pendingOperations, updateOperation } = useSyncStore.getState();

    // Reset failed operations to pending
    const failedOps = pendingOperations.filter(op => op.status === 'failed');

    for (const op of failedOps) {
        updateOperation(op.id, {
            status: 'pending',
            retryCount: 0,
            error: null,
        });
    }

    console.log(`[SyncEngine] Reset ${failedOps.length} failed operations for retry`);

    // Process the queue
    await processQueue();
}

// Start the sync engine - call this on app mount
let syncInterval: ReturnType<typeof setInterval> | null = null;
let onlineUnsubscribe: (() => void) | null = null;

export function startSyncEngine(): void {
    console.log('[SyncEngine] Starting sync engine');

    // Process queue immediately if online and have pending ops
    processQueue();

    // Set up periodic sync check
    syncInterval = setInterval(() => {
        const { isOnline } = useOnlineStore.getState();
        const { getPendingCount } = useSyncStore.getState();

        if (isOnline && getPendingCount() > 0) {
            processQueue();
        }
    }, CONFIG.SYNC_INTERVAL_MS);

    // Subscribe to online status changes
    onlineUnsubscribe = useOnlineStore.subscribe((state, prevState) => {
        if (state.isOnline && !prevState.isOnline) {
            console.log('[SyncEngine] Back online, processing queue');
            // Small delay to let connection stabilize
            setTimeout(processQueue, 1000);
        }
    });
}

export function stopSyncEngine(): void {
    console.log('[SyncEngine] Stopping sync engine');

    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }

    if (onlineUnsubscribe) {
        onlineUnsubscribe();
        onlineUnsubscribe = null;
    }
}

// Helper to queue an operation (used by components)
export function queueOperation(
    type: OperationType,
    payload: any,
    options?: {
        optimisticData?: any;
        entityType?: 'booking' | 'trip' | 'delivery';
        entityId?: string;
    }
): string {
    const { addOperation } = useSyncStore.getState();
    const { isOnline } = useOnlineStore.getState();

    const operationId = addOperation({
        type,
        payload,
        ...options,
    });

    // If online, try to process immediately
    if (isOnline) {
        // Use setTimeout to avoid blocking the UI
        setTimeout(processQueue, 100);
    }

    return operationId;
}

export default {
    processQueue,
    retryFailed,
    startSyncEngine,
    stopSyncEngine,
    queueOperation,
};
