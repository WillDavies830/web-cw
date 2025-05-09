/**
 * Runners management module for Race Control
 */

const Runners = (function() {
    let currentRaceId = null;
    let runnersList = [];
    let searchTimeout = null;
    
    /**
     * Load runners for a race from API or local storage
     */
    async function loadRunners(raceId) {
      currentRaceId = raceId;
      
      // First try to get from localStorage (for offline mode)
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      const cachedRunners = localStorage.getItem(`runners_${raceId}`);
      
      if (offlineMode && cachedRunners) {
        try {
          runnersList = JSON.parse(cachedRunners);
          renderRunnersList();
          return runnersList;
        } catch (error) {
          console.error('Error parsing cached runners:', error);
        }
      }
      
      // If online or no cached data, fetch from API
      if (navigator.onLine) {
        try {
          const response = await fetch(`/api/runners/race/${raceId}`);
          if (!response.ok) throw new Error('Failed to fetch runners');
          
          runnersList = await response.json();
          
          // Cache runners for offline use
          localStorage.setItem(`runners_${raceId}`, JSON.stringify(runnersList));
          
          renderRunnersList();
          return runnersList;
        } catch (error) {
          console.error('Error loading runners:', error);
          utils.showToast('Failed to load runners', 'error');
          
          // If we have cached data, use it even if we're online
          if (cachedRunners) {
            try {
              runnersList = JSON.parse(cachedRunners);
              renderRunnersList();
              return runnersList;
            } catch (error) {
              console.error('Error parsing cached runners:', error);
            }
          }
        }
      } else {
        utils.showToast('You are offline. Using cached runners data.', 'warning');
      }
      
      return [];
    }
    
    /**
     * Add a new runner
     */
    async function addRunner(runnerData) {
      const { bib_number, name } = runnerData;
      
      // Validate data
      if (!bib_number) {
        utils.showToast('Bib number is required', 'error');
        return null;
      }
      
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      
      // If offline or no connection, save locally
      if (offlineMode || !navigator.onLine) {
        const newRunner = {
          id: `local_${Date.now()}`,
          race_id: currentRaceId,
          bib_number: parseInt(bib_number, 10),
          name: name || '',
          local_only: true
        };
        
        // Add to local cache
        runnersList.push(newRunner);
        localStorage.setItem(`runners_${currentRaceId}`, JSON.stringify(runnersList));
        
        // Add to sync queue
        const syncQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        syncQueue.push({
          type: 'runner_add',
          data: {
            race_id: currentRaceId,
            bib_number: parseInt(bib_number, 10),
            name: name || ''
          },
          timestamp: Date.now()
        });
        localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
        
        renderRunnersList();
        utils.showToast('Runner added locally. Will sync when online.', 'info');
        return newRunner;
      }
      
      // If online, send to API
      try {
        const response = await fetch('/api/runners', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            race_id: currentRaceId,
            bib_number: parseInt(bib_number, 10),
            name: name || ''
          })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to add runner');
        }
        
        const newRunner = await response.json();
        
        // Update local cache
        runnersList.push(newRunner);
        localStorage.setItem(`runners_${currentRaceId}`, JSON.stringify(runnersList));
        
        renderRunnersList();
        utils.showToast('Runner added successfully', 'success');
        return newRunner;
      } catch (error) {
        console.error('Error adding runner:', error);
        utils.showToast(error.message, 'error');
        return null;
      }
    }
    
    /**
     * Import multiple runners from CSV format
     */
    async function importRunners(runnersData) {
      if (!runnersData || runnersData.length === 0) {
        utils.showToast('No runners to import', 'error');
        return { added: [], errors: [] };
      }
      
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      
      // If offline, store locally and sync later
      if (offlineMode || !navigator.onLine) {
        const added = [];
        const errors = [];
        
        for (const runner of runnersData) {
          const { bib_number, name } = runner;
          
          if (!bib_number) {
            errors.push({ runner, error: 'Bib number is required' });
            continue;
          }
          
          // Check for duplicate bib numbers
          const existingRunner = runnersList.find(r => 
            r.race_id == currentRaceId && r.bib_number == bib_number
          );
          
          if (existingRunner) {
            errors.push({ runner, error: 'Bib number already in use' });
            continue;
          }
          
          const newRunner = {
            id: `local_${Date.now()}_${bib_number}`,
            race_id: currentRaceId,
            bib_number: parseInt(bib_number, 10),
            name: name || '',
            local_only: true
          };
          
          runnersList.push(newRunner);
          added.push(newRunner);
        }
        
        // Update local cache
        localStorage.setItem(`runners_${currentRaceId}`, JSON.stringify(runnersList));
        
        // Add to sync queue
        const syncQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        syncQueue.push({
          type: 'runners_bulk',
          data: {
            race_id: currentRaceId,
            runners: added.map(r => ({
              bib_number: r.bib_number,
              name: r.name
            }))
          },
          timestamp: Date.now()
        });
        localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
        
        renderRunnersList();
        utils.showToast(`Imported ${added.length} runners locally. Will sync when online.`, 'info');
        return { added, errors };
      }
      
      // If online, send to API
      try {
        const response = await fetch('/api/runners/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            race_id: currentRaceId,
            runners: runnersData
          })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to import runners');
        }
        
        const result = await response.json();
        
        // Update local cache with new runners
        if (result.added && result.added.length > 0) {
          runnersList = [...runnersList, ...result.added];
          localStorage.setItem(`runners_${currentRaceId}`, JSON.stringify(runnersList));
        }
        
        renderRunnersList();
        utils.showToast(`Successfully imported ${result.added.length} runners`, 'success');
        return result;
      } catch (error) {
        console.error('Error importing runners:', error);
        utils.showToast(error.message, 'error');
        return { added: [], errors: [] };
      }
    }
    
    /**
     * Get a runner by bib number
     */
    function getRunnerByBib(bibNumber) {
      return runnersList.find(runner => runner.bib_number == bibNumber);
    }
    
    /**
     * Get a runner by ID
     */
    function getRunnerById(runnerId) {
      return runnersList.find(runner => runner.id == runnerId);
    }
    
    /**
     * Search runners by name or bib number
     */
    function searchRunners(query) {
      if (!query) {
        renderRunnersList(runnersList);
        return;
      }
      
      // Clear any existing timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      
      // Debounce search to avoid excessive rendering
      searchTimeout = setTimeout(() => {
        const searchTerm = query.toLowerCase().trim();
        
        const filtered = runnersList.filter(runner => {
          const nameMatch = runner.name && runner.name.toLowerCase().includes(searchTerm);
          const bibMatch = runner.bib_number.toString().includes(searchTerm);
          return nameMatch || bibMatch;
        });
        
        renderRunnersList(filtered);
      }, 300);
    }
    
    /**
     * Render the runners list in the UI
     */
    function renderRunnersList(runnersToRender = null) {
      const runnersList = document.getElementById('runners-list');
      const listToRender = runnersToRender || runnersList;
      
      if (!runnersList) return;
      
      runnersList.innerHTML = '';
      
      if (listToRender.length === 0) {
        runnersList.innerHTML = '<div class="empty-state">No runners found. Add runners to get started.</div>';
        return;
      }
      
      // Sort by bib number
      const sortedRunners = [...listToRender].sort((a, b) => a.bib_number - b.bib_number);
      
      sortedRunners.forEach(runner => {
        const runnerElement = document.createElement('div');
        runnerElement.className = 'runner-item';
        
        // Add local-only indicator
        const localClass = runner.local_only ? 'local-only' : '';
        
        runnerElement.innerHTML = `
          <div class="runner-bib">${runner.bib_number}</div>
          <div class="runner-name ${localClass}">${runner.name || 'Unknown'}</div>
          <div class="runner-actions">
            <button class="btn-icon btn-edit" data-id="${runner.id}">✏️</button>
            <button class="btn-icon btn-delete" data-id="${runner.id}">🗑️</button>
          </div>
        `;
        
        runnersList.appendChild(runnerElement);
      });
      
      // Add event listeners for edit and delete buttons
      document.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const runnerId = e.target.getAttribute('data-id');
          // TODO: Implement edit functionality
          console.log('Edit runner', runnerId);
        });
      });
      
      document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const runnerId = e.target.getAttribute('data-id');
          // TODO: Implement delete functionality
          console.log('Delete runner', runnerId);
        });
      });
    }
    
    // Return public API
    return {
      loadRunners,
      addRunner,
      importRunners,
      getRunnerByBib,
      getRunnerById,
      searchRunners,
      renderRunnersList
    };
  })();
  
  // Export module
  window.Runners = Runners;