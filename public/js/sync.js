/**
 * Synchronization module for Race Control
 * Handles offline data synchronization with server
 */

const Sync = (function() {
    let syncInProgress = false;
    
    /**
     * Initialize sync module
     */
    function init() {
      // Add event listeners for online/offline events
      window.addEventListener('online', handleOnlineStatus);
      window.addEventListener('offline', handleOnlineStatus);
      
      // Update initial online status
      utils.updateOnlineStatus();
      
      // Try to sync on load if we're online
      if (navigator.onLine) {
        attemptSync();
      }
    }
    
    /**
     * Handle online/offline status changes
     */
    function handleOnlineStatus() {
      utils.updateOnlineStatus();
      
      if (navigator.onLine) {
        utils.showToast('You are back online!', 'success');
        attemptSync();
      } else {
        utils.showToast('You are offline. Changes will be synced when you reconnect.', 'warning');
      }
      
      // Update sync status display
      updateSyncStatus();
    }
    
    /**
     * Update the sync status display
     */
    function updateSyncStatus() {
      const syncStatus = document.getElementById('sync-status');
      const unsavedCount = document.getElementById('unsaved-count');
      
      if (!syncStatus || !unsavedCount) return;
      
      const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
      const count = queue.length;
      
      unsavedCount.textContent = count;
      
      if (count > 0) {
        syncStatus.classList.remove('hidden');
      } else {
        syncStatus.classList.add('hidden');
      }
    }
    
    /**
     * Attempt to synchronize data with server
     */
    async function attemptSync() {
      if (!navigator.onLine || syncInProgress) return;
      
      const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
      if (queue.length === 0) return;
      
      syncInProgress = true;
      
      try {
        utils.showToast('Syncing data with server...', 'info');
        
        // Process queue items in order
        const newQueue = [];
        
        for (const item of queue) {
          try {
            await processQueueItem(item);
          } catch (error) {
            console.error('Error processing sync item:', error);
            // Keep failed items in queue for retry
            newQueue.push(item);
          }
        }
        
        // Update queue
        localStorage.setItem('sync_queue', JSON.stringify(newQueue));
        
        if (newQueue.length === 0) {
          utils.showToast('All data synchronized successfully!', 'success');
        } else {
          utils.showToast(`Sync incomplete. ${newQueue.length} items remaining.`, 'warning');
        }
      } catch (error) {
        console.error('Sync error:', error);
        utils.showToast('Sync failed. Will retry later.', 'error');
      } finally {
        syncInProgress = false;
        updateSyncStatus();
      }
    }
    
    /**
     * Process a single queue item
     */
    async function processQueueItem(item) {
      switch (item.type) {
        case 'runner_add':
          await syncRunner(item.data);
          break;
          
        case 'runners_bulk':
          await syncRunnersBulk(item.data);
          break;
          
        case 'result_add':
          await syncResult(item.data);
          break;
          
        case 'results_bulk':
          await syncResultsBulk(item.data);
          break;
          
        default:
          console.warn('Unknown sync item type:', item.type);
          // Skip unknown types
          return;
      }
    }
    
    /**
     * Sync a single runner
     */
    async function syncRunner(data) {
      const response = await fetch('/api/runners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to sync runner');
      }
      
      const runner = await response.json();
      
      // Update local storage with server ID
      const raceId = data.race_id;
      const runnersData = JSON.parse(localStorage.getItem(`runners_${raceId}`) || '[]');
      
      // Find and update the runner
      const index = runnersData.findIndex(r => 
        r.bib_number == data.bib_number && r.race_id == raceId
      );
      
      if (index >= 0) {
        runnersData[index] = {
          ...runnersData[index],
          ...runner,
          local_only: false
        };
        
        localStorage.setItem(`runners_${raceId}`, JSON.stringify(runnersData));
      }
      
      return runner;
    }
    
    /**
     * Sync multiple runners
     */
    async function syncRunnersBulk(data) {
      const response = await fetch('/api/runners/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to sync runners');
      }
      
      const result = await response.json();
      
      // Update local storage with server IDs
      if (result.added && result.added.length > 0) {
        const raceId = data.race_id;
        const runnersData = JSON.parse(localStorage.getItem(`runners_${raceId}`) || '[]');
        
        result.added.forEach(runner => {
          // Find and update the runner
          const index = runnersData.findIndex(r => 
            r.bib_number == runner.bib_number && r.race_id == raceId
          );
          
          if (index >= 0) {
            runnersData[index] = {
              ...runnersData[index],
              ...runner,
              local_only: false
            };
          }
        });
        
        localStorage.setItem(`runners_${raceId}`, JSON.stringify(runnersData));
      }
      
      return result;
    }
    
    /**
     * Sync a single result
     */
    async function syncResult(data) {
      const response = await fetch('/api/results/finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to sync result');
      }
      
      const result = await response.json();
      
      // Update local storage with server ID
      const raceId = data.race_id;
      const resultsData = JSON.parse(localStorage.getItem(`results_${raceId}`) || '[]');
      
      // Find and update the result (match by runner_id)
      const index = resultsData.findIndex(r => 
        r.runner_id == data.runner_id && r.race_id == raceId
      );
      
      if (index >= 0) {
        resultsData[index] = {
          ...resultsData[index],
          ...result,
          local_only: false
        };
        
        localStorage.setItem(`results_${raceId}`, JSON.stringify(resultsData));
      }
      
      return result;
    }
    
    /**
     * Sync multiple results
     */
    async function syncResultsBulk(data) {
      const response = await fetch('/api/results/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || 'Failed to sync results');
      }
      
      const result = await response.json();
      
      // Update local storage with server IDs
      if (result.processed && result.processed.length > 0) {
        const raceId = data.race_id;
        const resultsData = JSON.parse(localStorage.getItem(`results_${raceId}`) || '[]');
        
        result.processed.forEach(syncedResult => {
          // Find and update the result
          const index = resultsData.findIndex(r => 
            r.runner_id == syncedResult.runner_id && r.race_id == raceId
          );
          
          if (index >= 0) {
            resultsData[index] = {
              ...resultsData[index],
              ...syncedResult,
              local_only: false
            };
          }
        });
        
        localStorage.setItem(`results_${raceId}`, JSON.stringify(resultsData));
      }
      
      return result;
    }
    
    /**
     * Manually trigger sync
     */
    function manualSync() {
      if (!navigator.onLine) {
        utils.showToast('Cannot sync while offline', 'error');
        return;
      }
      
      attemptSync();
    }
    
    /**
     * Clear all local data
     */
    function clearLocalData() {
      utils.showConfirmModal(
        'Clear Local Data',
        'This will delete all locally stored data. This action cannot be undone. Continue?',
        () => {
          // Keep device ID but clear everything else
          const deviceId = localStorage.getItem('deviceId');
          
          localStorage.clear();
          
          if (deviceId) {
            localStorage.setItem('deviceId', deviceId);
          }
          
          utils.showToast('Local data cleared successfully', 'success');
          
          // Reload page to reset app state
          window.location.reload();
        }
      );
    }
    
    // Return public API
    return {
      init,
      attemptSync,
      manualSync,
      updateSyncStatus,
      clearLocalData
    };
  })();
  
  // Initialize sync module when page loads
  window.addEventListener('load', Sync.init);
  
  // Export module
  window.Sync = Sync;