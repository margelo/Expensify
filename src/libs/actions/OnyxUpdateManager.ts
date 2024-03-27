import Onyx from 'react-native-onyx';
import Log from '@libs/Log';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {OnyxUpdatesFromServer, Response} from '@src/types/onyx';
import * as App from './App';
import * as OnyxUpdates from './OnyxUpdates';

// This file is in charge of looking at the updateIDs coming from the server and comparing them to the last updateID that the client has.
// If the client is behind the server, then we need to
// 1. Pause all sequential queue requests
// 2. Pause all Onyx updates from Pusher
// 3. Get the missing updates from the server
// 4. Apply those updates
// 5. Apply the original update that triggered this request (it could have come from either HTTPS or Pusher)
// 6. Restart the sequential queue
// 7. Restart the Onyx updates from Pusher
// This will ensure that the client is up-to-date with the server and all the updates have been applied in the correct order.
// It's important that this file is separate and not imported by OnyxUpdates.js, so that there are no circular dependencies. Onyx
// is used as a pub/sub mechanism to break out of the circular dependency.
// The circular dependency happens because this file calls API.GetMissingOnyxUpdates() which uses the SaveResponseInOnyx.js file
// (as a middleware). Therefore, SaveResponseInOnyx.js can't import and use this file directly.

let lastUpdateIDAppliedToClient: number | null = 0;
Onyx.connect({
    key: ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT,
    callback: (value) => (lastUpdateIDAppliedToClient = value),
});

let deferredUpdateBeforeReconnect: OnyxUpdatesFromServer | undefined;
let deferredUpdates: Record<number, OnyxUpdatesFromServer> = {};

export default () => {
    console.debug('[OnyxUpdateManager] Listening for updates from the server');
    Onyx.connect({
        key: ONYXKEYS.ONYX_UPDATES_FROM_SERVER,
        callback: (value) => {
            if (!value) {
                return;
            }

            // Since we used the same key that used to store another object, let's confirm that the current object is
            // following the new format before we proceed. If it isn't, then let's clear the object in Onyx.
            if (
                !(typeof value === 'object' && !!value) ||
                !('type' in value) ||
                (!(value.type === CONST.ONYX_UPDATE_TYPES.HTTPS && value.request && value.response) &&
                    !((value.type === CONST.ONYX_UPDATE_TYPES.PUSHER || value.type === CONST.ONYX_UPDATE_TYPES.AIRSHIP) && value.updates))
            ) {
                console.debug('[OnyxUpdateManager] Invalid format found for updates, cleaning and unpausing the queue');
                Onyx.set(ONYXKEYS.ONYX_UPDATES_FROM_SERVER, null);
                SequentialQueue.unpause();
                return;
            }

            if (Object.values(deferredUpdates).length === 0) {
                console.log('last applied update id before all deferred', lastUpdateIDAppliedToClient);
            }

            const updateParams = value;
            const lastUpdateIDFromServer = value.lastUpdateID;
            const previousUpdateIDFromServer = value.previousUpdateID;

            // In cases where we received a previousUpdateID and it doesn't match our lastUpdateIDAppliedToClient
            // we need to perform one of the 2 possible cases:
            //
            // 1. This is the first time we're receiving an lastUpdateID, so we need to do a final reconnectApp before
            // fully migrating to the reliable updates mode.
            // 2. This client already has the reliable updates mode enabled, but it's missing some updates and it
            // needs to fetch those.
            //
            // For both of those, we need to pause the sequential queue. This is important so that the updates are
            // applied in their correct and specific order. If this queue was not paused, then there would be a lot of
            // onyx data being applied while we are fetching the missing updates and that would put them all out of order.
            SequentialQueue.pause();
            let canUnpauseQueuePromise: Promise<Response | void>;

            // The flow below is setting the promise to a reconnect app to address flow (1) explained above.
            if (!lastUpdateIDAppliedToClient) {
                Log.info('Client has not gotten reliable updates before so reconnecting the app to start the process');

                deferredUpdateBeforeReconnect = updateParams;

                // Since this is a full reconnectApp, we'll not apply the updates we received - those will come in the reconnect app request.
                canUnpauseQueuePromise = App.finalReconnectAppAfterActivatingReliableUpdates();
            } else {
                // The flow below is setting the promise to a getMissingOnyxUpdates to address flow (2) explained above.

                // Get the number of deferred updates before adding the new one
                const existingDeferredUpdatesCount = Object.keys(deferredUpdates).length;
                // Add the new update to the deferred updates
                deferredUpdates[Number(updateParams.lastUpdateID)] = updateParams;

                console.log('new update: ', {updates: deferredUpdates, length: Object.keys(deferredUpdates).length});

                // If there are already deferred updates, then we don't need to fetch the missing updates again
                if (existingDeferredUpdatesCount > 0) {
                    return;
                }

                console.debug(`[OnyxUpdateManager] Client is behind the server by ${Number(previousUpdateIDFromServer) - lastUpdateIDAppliedToClient} so fetching incremental updates`);
                Log.info('Gap detected in update IDs from server so fetching incremental updates', true, {
                    lastUpdateIDFromServer,
                    previousUpdateIDFromServer,
                    lastUpdateIDAppliedToClient,
                });

                console.log('=== GET MISSING UPDATES CALL ===');

                // Get the missing Onyx updates from the server
                canUnpauseQueuePromise = App.getMissingOnyxUpdates(lastUpdateIDAppliedToClient, previousUpdateIDFromServer);
            }

            // This function will apply the deferred updates in order after the missing updates are fetched and applied
            function applyDeferredUpdates() {
                // It should not be possible for lastUpdateIDAppliedToClient to be null, after the missing updates have been applied, therefore we don't need to handle this case
                if (!lastUpdateIDAppliedToClient) {
                    return;
                }

                // If "updateAfterReconnectApp" is set, it means that case (1) was triggered and we need to apply the update that was queued before the reconnectApp
                if (deferredUpdateBeforeReconnect) {
                    OnyxUpdates.apply(deferredUpdateBeforeReconnect);
                    deferredUpdateBeforeReconnect = undefined;
                }

                // We only want to apply deferred updates that are newer than the last update that was applied to the client.
                // At this point, the missing updates from "GetMissingOnyxUpdates" have been applied already, so we can safely filter out.
                const pendingDeferredUpdates = Object.fromEntries(
                    Object.entries(deferredUpdates).filter(([lastUpdateID]) => {
                        // Same as above, it should not be possible for lastUpdateIDAppliedToClient to be null.
                        // Still, if so we want to keep the deferred update in the list
                        if (!lastUpdateIDAppliedToClient) {
                            return true;
                        }
                        return (Number(lastUpdateID) ?? 0) > lastUpdateIDAppliedToClient;
                    }),
                );
                const pendingDeferredUpdateValues = Object.values(pendingDeferredUpdates);

                function unpauseQueueAndReset() {
                    console.debug('[OnyxUpdateManager] Done applying all updates');
                    Onyx.set(ONYXKEYS.ONYX_UPDATES_FROM_SERVER, null);
                    SequentialQueue.unpause();
                }

                // If there are no remaining deferred updates after filtering out outdated ones,
                //  we can just unpause the queue and return
                if (pendingDeferredUpdateValues.length === 0) {
                    unpauseQueueAndReset();
                    return;
                }

                let lastValidDeferredUpdateID = 0;
                // In order for the deferred updates to be applied correctly in order,
                // we need to check if there are any gaps deferred updates.
                function areDeferredUpdatesChained(): boolean {
                    let isFirst = true;
                    for (const update of pendingDeferredUpdateValues) {
                        // If it's the first one, we need to skip it since we won't have the previousUpdateID
                        // if the previousUpdateID key exists, then we can just move on since there's no gap
                        if (isFirst || pendingDeferredUpdates[Number(update.previousUpdateID)]) {
                            lastValidDeferredUpdateID = Number(update.lastUpdateID);
                            isFirst = false;
                            // eslint-disable-next-line no-continue
                            continue;
                        }

                        return false;
                    }

                    return true;
                }

                //  If we detect a gap in the deferred updates, re-fetch the missing updates.
                if (!areDeferredUpdatesChained()) {
                    canUnpauseQueuePromise = App.getMissingOnyxUpdates(lastUpdateIDAppliedToClient, lastValidDeferredUpdateID).finally(applyDeferredUpdates);
                    return;
                }

                console.log('last update applied before deferred ', {lastUpdateIDAppliedToClient});

                Promise.all(pendingDeferredUpdateValues.map((update) => OnyxUpdates.apply(update))).finally(() => {
                    console.log('last update applied after deferred ', lastUpdateIDAppliedToClient);
                    unpauseQueueAndReset();
                    deferredUpdates = [];
                });
            }

            new Promise((resolve) => setTimeout(resolve, 10000)).then(() => canUnpauseQueuePromise).finally(applyDeferredUpdates);
        },
    });
};
