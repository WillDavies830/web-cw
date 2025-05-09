/**
 * Race results management module for Race Control
 */

const Results = (function() {
    let currentRaceId = null;
    let raceStartTime = null;
    let resultsList = [];
    let searchTimeout = null;
    
    /**
     * Initialize results for a race
     */
    function initializeRace(raceId, startTime) {
      currentRaceId = raceId;
      raceStartTime = startTime;
      
      // Load cached results for this race
      const cachedResults = localStorage.getItem(`results_${raceId}`);
      if (cachedResults) {
        try {
          resultsList = JSON.parse(cachedResults);
        } catch (error) {
          console.error('Error parsing cached results:', error);
          resultsList = [];
        }
      } else {
        resultsList = [];
      }
    }
    
    /**
     * Load results from API or local storage
     */
    async function loadResults(raceId) {
      currentRaceId = raceId;
      
      // First try to get from localStorage (for offline mode)
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      const cachedResults = localStorage.getItem(`results_${raceId}`);
      
      if (offlineMode && cachedResults) {
        try {
          resultsList = JSON.parse(cachedResults);
          renderResultsList();
          return resultsList;
        } catch (error) {
          console.error('Error parsing cached results:', error);
        }
      }
      
      // If online or no cached data, fetch from API
      if (navigator.onLine) {
        try {
          const response = await fetch(`/api/results/race/${raceId}`);
          if (!response.ok) throw new Error('Failed to fetch results');
          
          resultsList = await response.json();
          
          // Cache results for offline use
          localStorage.setItem(`results_${raceId}`, JSON.stringify(resultsList));
          
          renderResultsList();
          return resultsList;
        } catch (error) {
          console.error('Error loading results:', error);
          utils.showToast('Failed to load results', 'error');
          
          // If we have cached data, use it even if we're online
          if (cachedResults) {
            try {
              resultsList = JSON.parse(cachedResults);
              renderResultsList();
              return resultsList;
            } catch (error) {
              console.error('Error parsing cached results:', error);
            }
          }
        }
      } else {
        utils.showToast('You are offline. Using cached results data.', 'warning');
      }
      
      return [];
    }
    
    /**
     * Record a finish time for a runner
     */
    async function recordFinish(bibNumber, finishTime = null) {
      if (!currentRaceId) {
        utils.showToast('No active race selected', 'error');
        return null;
      }
      
      if (!bibNumber) {
        utils.showToast('Bib number is required', 'error');
        return null;
      }
      
      // Get the runner by bib number
      const runner = Runners.getRunnerByBib(bibNumber);
      if (!runner) {
        utils.showToast(`Runner with bib #${bibNumber} not found`, 'error');
        return null;
      }
      
      // Use current time if not provided
      const currentTime = finishTime || Math.floor(Date.now() / 1000);
      const deviceId = utils.generateDeviceId();
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      
      // If offline or no connection, save locally
      if (offlineMode || !navigator.onLine) {
        const newResult = {
          id: `local_${Date.now()}`,
          race_id: currentRaceId,
          runner_id: runner.id,
          finish_time: currentTime,
          bib_number: runner.bib_number,
          runner_name: runner.name,
          elapsed_time: raceStartTime ? currentTime - raceStartTime : null,
          elapsed_time_formatted: raceStartTime ? utils.formatTime(currentTime - raceStartTime) : null,
          device_id: deviceId,
          local_only: true
        };
        
        // Check if we already have a result for this runner
        const existingIndex = resultsList.findIndex(r => r.bib_number == bibNumber);
        
        if (existingIndex >= 0) {
          // Update existing result
          resultsList[existingIndex] = newResult;
          utils.showToast(`Updated finish time for runner #${bibNumber}`, 'info');
        } else {
          // Add new result
          resultsList.push(newResult);
          utils.showToast(`Recorded finish for runner #${bibNumber}`, 'success');
        }
        
        // Sort by finish time
        resultsList.sort((a, b) => a.finish_time - b.finish_time);
        
        // Update positions
        resultsList.forEach((result, index) => {
          result.position = index + 1;
        });
        
        // Update local cache
        localStorage.setItem(`results_${currentRaceId}`, JSON.stringify(resultsList));
        
        // Add to sync queue
        const syncQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        syncQueue.push({
          type: 'result_add',
          data: {
            race_id: currentRaceId,
            runner_id: runner.id,
            finish_time: currentTime,
            device_id: deviceId
          },
          timestamp: Date.now()
        });
        localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
        
        // Update recent finishes
        updateRecentFinishes(newResult);
        renderResultsList();
        return newResult;
      }
      
      // If online, send to API
      try {
        const response = await fetch('/api/results/finish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            race_id: currentRaceId,
            runner_id: runner.id,
            finish_time: currentTime,
            device_id: deviceId
          })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to record finish time');
        }
        
        const result = await response.json();
        
        // Fetch updated results to get positions and formatted times
        await loadResults(currentRaceId);
        
        // Get the updated result with all fields
        const updateResult = resultsList.find(r => r.id === result.id);
        
        // Update recent finishes
        updateRecentFinishes(updateResult);
        
        utils.showToast(`Recorded finish for runner #${bibNumber}`, 'success');
        return updateResult;
      } catch (error) {
        console.error('Error recording finish time:', error);
        utils.showToast(error.message, 'error');
        return null;
      }
    }
    
    /**
     * Update the recent finishes display
     */
    function updateRecentFinishes(newResult) {
      const recentFinishList = document.getElementById('recent-finish-list');
      if (!recentFinishList) return;
      
      // Create the finish item element
      const finishItem = document.createElement('div');
      finishItem.className = 'finish-item';
      
      // Calculate elapsed time if not provided
      let elapsedTime = newResult.elapsed_time;
      let elapsedFormatted = newResult.elapsed_time_formatted;
      
      if (!elapsedTime && raceStartTime) {
        elapsedTime = newResult.finish_time - raceStartTime;
        elapsedFormatted = utils.formatTime(elapsedTime);
      }
      
      finishItem.innerHTML = `
        <div class="finish-bib">${newResult.bib_number}</div>
        <div class="finish-name">${newResult.runner_name || 'Unknown'}</div>
        <div class="finish-time">${elapsedFormatted || '--:--:--'}</div>
      `;
      
      // Add local-only indicator
      if (newResult.local_only) {
        finishItem.classList.add('local-only');
      }
      
      // Insert at the beginning
      recentFinishList.insertBefore(finishItem, recentFinishList.firstChild);
      
      // Limit to 10 recent finishes
      if (recentFinishList.children.length > 10) {
        recentFinishList.removeChild(recentFinishList.lastChild);
      }
    }
    
    /**
     * Search results by name or bib number
     */
    function searchResults(query) {
      if (!query) {
        renderResultsList(resultsList);
        return;
      }
      
      // Clear any existing timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      
      // Debounce search to avoid excessive rendering
      searchTimeout = setTimeout(() => {
        const searchTerm = query.toLowerCase().trim();
        
        const filtered = resultsList.filter(result => {
          const nameMatch = result.runner_name && result.runner_name.toLowerCase().includes(searchTerm);
          const bibMatch = result.bib_number.toString().includes(searchTerm);
          return nameMatch || bibMatch;
        });
        
        renderResultsList(filtered);
      }, 300);
    }
    
    /**
     * Generate summary statistics for the results
     */
    function generateSummary() {
      if (resultsList.length === 0) {
        return {
          totalFinishers: 0,
          firstFinishTime: null,
          lastFinishTime: null,
          averageTime: null
        };
      }
      
      // Calculate statistics
      const totalFinishers = resultsList.length;
      
      // Sort by finish time
      const sortedResults = [...resultsList].sort((a, b) => a.finish_time - b.finish_time);
      
      const firstFinish = sortedResults[0];
      const lastFinish = sortedResults[sortedResults.length - 1];
      
      let totalElapsedTime = 0;
      let validTimes = 0;
      
      sortedResults.forEach(result => {
        if (result.elapsed_time) {
          totalElapsedTime += result.elapsed_time;
          validTimes++;
        }
      });
      
      const averageTime = validTimes > 0 ? Math.floor(totalElapsedTime / validTimes) : null;
      
      return {
        totalFinishers,
        firstFinishTime: firstFinish.elapsed_time_formatted,
        lastFinishTime: lastFinish.elapsed_time_formatted,
        averageTime: averageTime ? utils.formatTime(averageTime) : null
      };
    }
    
    /**
     * Render the results list in the UI
     */
    function renderResultsList(resultsToRender = null) {
      const resultsListEl = document.getElementById('results-list');
      const summaryEl = document.getElementById('results-summary');
      const listToRender = resultsToRender || resultsList;
      
      if (!resultsListEl) return;
      
      resultsListEl.innerHTML = '';
      
      if (listToRender.length === 0) {
        resultsListEl.innerHTML = '<div class="empty-state">No results found. Record finishes to see results here.</div>';
        
        if (summaryEl) {
          summaryEl.innerHTML = '';
        }
        
        return;
      }
      
      // Sort by position/finish time
      const sortedResults = [...listToRender].sort((a, b) => {
        if (a.position === null && b.position !== null) return 1;
        if (a.position !== null && b.position === null) return -1;
        if (a.position === null && b.position === null) return a.finish_time - b.finish_time;
        return a.position - b.position;
      });
      
      sortedResults.forEach(result => {
        const resultElement = document.createElement('div');
        resultElement.className = 'result-item';
        
        // Add local-only indicator
        const localClass = result.local_only ? 'local-only' : '';
        
        resultElement.innerHTML = `
          <div class="result-place">${result.position || '-'}</div>
          <div class="result-info">
            <div class="result-bib">#${result.bib_number}</div>
            <div class="result-name ${localClass}">${result.runner_name || 'Unknown'}</div>
          </div>
          <div class="result-time">${result.elapsed_time_formatted || '--:--:--'}</div>
        `;
        
        resultsListEl.appendChild(resultElement);
      });
      
      // Update summary statistics
      if (summaryEl) {
        const summary = generateSummary();
        
        summaryEl.innerHTML = `
          <div class="stat-grid">
            <div class="stat-item">
              <h4>Total Finishers</h4>
              <div class="stat-value">${summary.totalFinishers}</div>
            </div>
            <div class="stat-item">
              <h4>First Finish</h4>
              <div class="stat-value">${summary.firstFinishTime || '--:--:--'}</div>
            </div>
            <div class="stat-item">
              <h4>Last Finish</h4>
              <div class="stat-value">${summary.lastFinishTime || '--:--:--'}</div>
            </div>
            <div class="stat-item">
              <h4>Average Time</h4>
              <div class="stat-value">${summary.averageTime || '--:--:--'}</div>
            </div>
          </div>
        `;
      }
    }
    
    /**
     * Get count of unsaved/unsynced results
     */
    function getUnsyncedCount() {
      return resultsList.filter(result => result.local_only).length;
    }
    
    /**
     * Export results as CSV file
     */
    async function exportResults() {
      if (!currentRaceId) {
        utils.showToast('No race selected', 'error');
        return;
      }
      
      try {
        // If online, use the API endpoint
        if (navigator.onLine) {
          window.location.href = `/api/results/race/${currentRaceId}/export`;
          return;
        }
        
        // If offline, generate CSV from local data
        const raceName = localStorage.getItem(`race_name_${currentRaceId}`) || 'race';
        let csvContent = 'Position,Bib,Name,Finish Time\n';
        
        // Sort by position/finish time
        const sortedResults = [...resultsList].sort((a, b) => {
          if (a.position === null && b.position !== null) return 1;
          if (a.position !== null && b.position === null) return -1;
          if (a.position === null && b.position === null) return a.finish_time - b.finish_time;
          return a.position - b.position;
        });
        
        sortedResults.forEach(result => {
          csvContent += [
            result.position || '',
            result.bib_number,
            `"${result.runner_name || ''}"`,
            result.elapsed_time_formatted || ''
          ].join(',') + '\n';
        });
        
        // Create downloadable link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${raceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting results:', error);
        utils.showToast('Failed to export results', 'error');
      }
    }
    
    // Return public API
    return {
      initializeRace,
      loadResults,
      recordFinish,
      searchResults,
      renderResultsList,
      getUnsyncedCount,
      exportResults
    };
  })();
  
  // Export module
  window.Results = Results;