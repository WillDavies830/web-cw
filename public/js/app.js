/**
 * Main application script for Race Control
 */

const App = (function() {
    // Application state
    let currentPage = null;
    let currentTab = null;
    let currentRace = null;
    
    // DOM elements
    const pageLoading = document.getElementById('page-loading');
    const pageRaceSelection = document.getElementById('page-race-selection');
    const pageRaceForm = document.getElementById('page-race-form');
    const pageRaceDetail = document.getElementById('page-race-detail');
    const pageRunnerForm = document.getElementById('page-runner-form');
    const pageRunnerImport = document.getElementById('page-runner-import');
    
    // Tab content elements
    const tabContentTiming = document.getElementById('tab-content-timing');
    const tabContentRunners = document.getElementById('tab-content-runners');
    const tabContentResults = document.getElementById('tab-content-results');
    const tabContentSettings = document.getElementById('tab-content-settings');
    
    /**
     * Initialize the application
     */
    async function init() {
      // Set up event listeners
      setupEventListeners();
      
      // Display device ID
      const deviceIdInput = document.getElementById('device-id');
      if (deviceIdInput) {
        deviceIdInput.value = utils.generateDeviceId();
      }
      
      // Set offline mode toggle
      const offlineModeToggle = document.getElementById('offline-mode');
      if (offlineModeToggle) {
        const offlineMode = localStorage.getItem('offline_mode') === 'true';
        offlineModeToggle.checked = offlineMode;
        
        offlineModeToggle.addEventListener('change', (e) => {
          localStorage.setItem('offline_mode', e.target.checked.toString());
          utils.showToast(`Offline mode ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
        });
      }
      
      // Load races and show race selection page
      await loadRaces();
      showPage('race-selection');
    }
    
    /**
     * Set up event listeners for all UI elements
     */
    function setupEventListeners() {
      // Tabs
      document.getElementById('tab-timing').addEventListener('click', () => switchTab('timing'));
      document.getElementById('tab-runners').addEventListener('click', () => switchTab('runners'));
      document.getElementById('tab-results').addEventListener('click', () => switchTab('results'));
      document.getElementById('tab-settings').addEventListener('click', () => switchTab('settings'));
      
      // Race actions
      document.getElementById('btn-create-race').addEventListener('click', showCreateRaceForm);
      document.getElementById('btn-cancel-race').addEventListener('click', () => showPage('race-selection'));
      document.getElementById('race-form').addEventListener('submit', handleRaceFormSubmit);
      
      // Race control actions
      document.getElementById('btn-start-race').addEventListener('click', startRace);
      document.getElementById('btn-end-race').addEventListener('click', endRace);
      document.getElementById('btn-record-finish').addEventListener('click', recordFinish);
      
      // Runner management
      document.getElementById('btn-add-runner').addEventListener('click', showAddRunnerForm);
      document.getElementById('btn-import-runners').addEventListener('click', showImportRunnersForm);
      document.getElementById('btn-cancel-runner').addEventListener('click', () => showRaceDetail('runners'));
      document.getElementById('runner-form').addEventListener('submit', handleRunnerFormSubmit);
      
      // Runner import
      document.getElementById('btn-cancel-import').addEventListener('click', () => showRaceDetail('runners'));
      document.getElementById('btn-process-import').addEventListener('click', processRunnerImport);
      
      // Result search
      document.getElementById('search-results').addEventListener('input', (e) => {
        Results.searchResults(e.target.value);
      });
      
      // Runner search
      document.getElementById('search-runners').addEventListener('input', (e) => {
        Runners.searchRunners(e.target.value);
      });
      
      // Export results
      document.getElementById('btn-export-results').addEventListener('click', Results.exportResults);
      
      // Sync actions
      document.getElementById('btn-sync-results').addEventListener('click', Sync.manualSync);
      
      // Settings actions
      document.getElementById('btn-edit-race').addEventListener('click', showEditRaceForm);
      document.getElementById('btn-clear-local-data').addEventListener('click', Sync.clearLocalData);
      
      // Manual bib entry form
      document.getElementById('bib-number').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          recordFinish();
        }
      });
    }
    
    /**
     * Show a specific page
     */
    function showPage(pageName) {
      // Hide all pages
      const pages = document.querySelectorAll('.page');
      pages.forEach(page => page.classList.add('hidden'));
      
      // Hide loading spinner
      pageLoading.classList.add('hidden');
      
      // Show requested page
      switch (pageName) {
        case 'race-selection':
          pageRaceSelection.classList.remove('hidden');
          break;
          
        case 'race-form':
          pageRaceForm.classList.remove('hidden');
          break;
          
        case 'race-detail':
          pageRaceDetail.classList.remove('hidden');
          break;
          
        case 'runner-form':
          pageRunnerForm.classList.remove('hidden');
          break;
          
        case 'runner-import':
          pageRunnerImport.classList.remove('hidden');
          break;
          
        default:
          // Show loading by default
          pageLoading.classList.remove('hidden');
          break;
      }
      
      currentPage = pageName;
    }
    
    /**
     * Switch between tabs in race detail view
     */
    function switchTab(tabName) {
      // Update tab buttons
      const tabButtons = document.querySelectorAll('.tab-button');
      tabButtons.forEach(button => button.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');
      
      // Update tab content
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`tab-content-${tabName}`).classList.add('active');
      
      currentTab = tabName;
      
      // Load tab-specific data
      if (tabName === 'runners') {
        Runners.loadRunners(currentRace.id);
      } else if (tabName === 'results') {
        Results.loadResults(currentRace.id);
      }
    }
    
    /**
     * Load races from API
     */
    async function loadRaces() {
      showPage('loading');
      
      // First try to get from localStorage (for offline mode)
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      const cachedRaces = localStorage.getItem('races');
      
      if (offlineMode && cachedRaces) {
        try {
          const races = JSON.parse(cachedRaces);
          renderRaceList(races);
          showPage('race-selection');
          return races;
        } catch (error) {
          console.error('Error parsing cached races:', error);
        }
      }
      
      // If online or no cached data, fetch from API
      if (navigator.onLine) {
        try {
          const response = await fetch('/api/races');
          if (!response.ok) throw new Error('Failed to fetch races');
          
          const races = await response.json();
          
          // Cache races for offline use
          localStorage.setItem('races', JSON.stringify(races));
          
          renderRaceList(races);
          showPage('race-selection');
          return races;
        } catch (error) {
          console.error('Error loading races:', error);
          utils.showToast('Failed to load races', 'error');
          
          // If we have cached data, use it even if we're online
          if (cachedRaces) {
            try {
              const races = JSON.parse(cachedRaces);
              renderRaceList(races);
              showPage('race-selection');
              return races;
            } catch (error) {
              console.error('Error parsing cached races:', error);
            }
          }
        }
      } else {
        utils.showToast('You are offline. Using cached race data.', 'warning');
        
        if (cachedRaces) {
          try {
            const races = JSON.parse(cachedRaces);
            renderRaceList(races);
            showPage('race-selection');
            return races;
          } catch (error) {
            console.error('Error parsing cached races:', error);
          }
        }
      }
      
      // If we get here, we have no data to show
      showPage('race-selection');
      document.getElementById('race-list').innerHTML = 
        '<div class="empty-state">No races found. Create a new race to get started.</div>';
      
      return [];
    }
    
    /**
     * Render the race list
     */
    function renderRaceList(races) {
      const raceList = document.getElementById('race-list');
      
      if (!races || races.length === 0) {
        raceList.innerHTML = '<div class="empty-state">No races found. Create a new race to get started.</div>';
        return;
      }
      
      raceList.innerHTML = '';
      
      races.forEach(race => {
        const raceCard = document.createElement('div');
        raceCard.className = 'race-card';
        raceCard.setAttribute('data-id', race.id);
        
        // Store race name for offline use
        localStorage.setItem(`race_name_${race.id}`, race.name);
        
        raceCard.innerHTML = `
          <h3>${race.name}</h3>
          <p>${race.description || 'No description'}</p>
          <div class="race-card-status ${race.status}">${race.status}</div>
        `;
        
        raceCard.addEventListener('click', () => loadRaceDetail(race.id));
        
        raceList.appendChild(raceCard);
      });
    }
    
    /**
     * Show create race form
     */
    function showCreateRaceForm() {
      document.getElementById('race-form-title').textContent = 'Create Race';
      document.getElementById('race-form').reset();
      showPage('race-form');
    }
    
    /**
     * Show edit race form
     */
    function showEditRaceForm() {
      document.getElementById('race-form-title').textContent = 'Edit Race';
      
      // Fill form with current race data
      const form = document.getElementById('race-form');
      form.elements.name.value = currentRace.name;
      form.elements.description.value = currentRace.description || '';
      
      showPage('race-form');
    }
    
    /**
     * Handle race form submission
     */
    async function handleRaceFormSubmit(e) {
      e.preventDefault();
      
      const form = e.target;
      const name = form.elements.name.value.trim();
      const description = form.elements.description.value.trim();
      
      if (!name) {
        utils.showToast('Race name is required', 'error');
        return;
      }
      
      showPage('loading');
      
      // Check if we're creating or editing
      const isEditing = document.getElementById('race-form-title').textContent === 'Edit Race';
      
      if (isEditing && currentRace) {
        // Update existing race
        await updateRace(currentRace.id, { name, description });
      } else {
        // Create new race
        await createRace({ name, description });
      }
    }
    
    /**
     * Create a new race
     */
    async function createRace(raceData) {
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      
      // If offline, we can't create a new race
      if (offlineMode || !navigator.onLine) {
        utils.showToast('Cannot create race while offline', 'error');
        showPage('race-selection');
        return;
      }
      
      try {
        const response = await fetch('/api/races', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(raceData)
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create race');
        }
        
        const newRace = await response.json();
        
        // Update cached races
        const cachedRaces = JSON.parse(localStorage.getItem('races') || '[]');
        cachedRaces.unshift(newRace);
        localStorage.setItem('races', JSON.stringify(cachedRaces));
        
        utils.showToast('Race created successfully', 'success');
        
        // Show race detail
        loadRaceDetail(newRace.id);
      } catch (error) {
        console.error('Error creating race:', error);
        utils.showToast(error.message, 'error');
        showPage('race-selection');
      }
    }
    
    /**
     * Update an existing race
     */
    async function updateRace(raceId, raceData) {
      if (!navigator.onLine) {
        utils.showToast('Cannot update race while offline', 'error');
        showRaceDetail('settings');
        return;
      }
      
      try {
        const response = await fetch(`/api/races/${raceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(raceData)
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update race');
        }
        
        const updatedRace = await response.json();
        
        // Update cached races
        const cachedRaces = JSON.parse(localStorage.getItem('races') || '[]');
        const index = cachedRaces.findIndex(r => r.id === raceId);
        
        if (index >= 0) {
          cachedRaces[index] = updatedRace;
          localStorage.setItem('races', JSON.stringify(cachedRaces));
        }
        
        utils.showToast('Race updated successfully', 'success');
        
        // Update current race and display
        currentRace = updatedRace;
        updateRaceDetailDisplay();
        showRaceDetail('settings');
      } catch (error) {
        console.error('Error updating race:', error);
        utils.showToast(error.message, 'error');
        showRaceDetail('settings');
      }
    }
    
    /**
     * Load race detail page
     */
    async function loadRaceDetail(raceId) {
      showPage('loading');
      
      // First try to get from localStorage (for offline mode)
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      const cachedRaces = localStorage.getItem('races');
      
      if ((offlineMode || !navigator.onLine) && cachedRaces) {
        try {
          const races = JSON.parse(cachedRaces);
          const race = races.find(r => r.id == raceId);
          
          if (race) {
            currentRace = race;
            showRaceDetail('timing');
            return race;
          }
        } catch (error) {
          console.error('Error fetching race from cache:', error);
        }
      }
      
      // If online, fetch from API
      if (navigator.onLine) {
        try {
          const response = await fetch(`/api/races/${raceId}`);
          if (!response.ok) throw new Error('Failed to fetch race details');
          
          const race = await response.json();
          currentRace = race;
          
          // Update race in cache
          const cachedRaces = JSON.parse(localStorage.getItem('races') || '[]');
          const index = cachedRaces.findIndex(r => r.id == raceId);
          
          if (index >= 0) {
            cachedRaces[index] = race;
          } else {
            cachedRaces.push(race);
          }
          
          localStorage.setItem('races', JSON.stringify(cachedRaces));
          
          showRaceDetail('timing');
          return race;
        } catch (error) {
          console.error('Error loading race details:', error);
          utils.showToast('Failed to load race details', 'error');
          showPage('race-selection');
        }
      } else {
        utils.showToast('You are offline. Some features may be limited.', 'warning');
        showPage('race-selection');
      }
    }
    
    /**
     * Show race detail page with specified tab
     */
    function showRaceDetail(tab = 'timing') {
      if (!currentRace) {
        showPage('race-selection');
        return;
      }
      
      // Update race detail display
      updateRaceDetailDisplay();
      
      // Switch to the specified tab
      switchTab(tab);
      
      // Show race detail page
      showPage('race-detail');
      
      // Initialize results if on timing tab
      if (tab === 'timing') {
        Results.initializeRace(currentRace.id, currentRace.start_time);
        updateRaceControlButtons();
      }
    }
    
    /**
     * Update race detail display with current race info
     */
    function updateRaceDetailDisplay() {
      document.getElementById('race-detail-name').textContent = currentRace.name;
      document.getElementById('race-detail-description').textContent = currentRace.description || '';
      
      const raceStatus = document.getElementById('race-status');
      raceStatus.textContent = currentRace.status;
      raceStatus.className = `race-status ${currentRace.status}`;
      
      // Restore race timer if active
      if (currentRace.status === 'active' && currentRace.start_time) {
        Timer.start(currentRace.start_time);
      }
    }
    
    /**
     * Update race control buttons based on race status
     */
    function updateRaceControlButtons() {
      const startButton = document.getElementById('btn-start-race');
      const endButton = document.getElementById('btn-end-race');
      const runnerInput = document.getElementById('runner-input');
      const recentFinishes = document.getElementById('recent-finishes');
      
      if (currentRace.status === 'pending') {
        startButton.classList.remove('hidden');
        endButton.classList.add('hidden');
        runnerInput.classList.add('hidden');
        recentFinishes.classList.add('hidden');
      } else if (currentRace.status === 'active') {
        startButton.classList.add('hidden');
        endButton.classList.remove('hidden');
        runnerInput.classList.remove('hidden');
        recentFinishes.classList.remove('hidden');
      } else if (currentRace.status === 'completed') {
        startButton.classList.add('hidden');
        endButton.classList.add('hidden');
        runnerInput.classList.add('hidden');
        recentFinishes.classList.remove('hidden');
      }
      
      // Update sync status display
      Sync.updateSyncStatus();
    }
    
    /**
     * Start the race
     */
    async function startRace() {
      if (!currentRace) return;
      
      if (currentRace.status !== 'pending') {
        utils.showToast('Race has already been started', 'error');
        return;
      }
      
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      
      // If offline, handle locally
      if (offlineMode || !navigator.onLine) {
        // Start timer
        Timer.start();
        
        // Update race status locally
        currentRace.status = 'active';
        currentRace.start_time = Timer.getStartTime();
        
        // Update cached races
        const cachedRaces = JSON.parse(localStorage.getItem('races') || '[]');
        const index = cachedRaces.findIndex(r => r.id === currentRace.id);
        
        if (index >= 0) {
          cachedRaces[index] = currentRace;
          localStorage.setItem('races', JSON.stringify(cachedRaces));
        }
        
        // Update UI
        updateRaceControlButtons();
        utils.showToast('Race started (offline mode)', 'info');
        
        // Add to sync queue
        const syncQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        syncQueue.push({
          type: 'race_start',
          data: {
            race_id: currentRace.id,
            start_time: currentRace.start_time
          },
          timestamp: Date.now()
        });
        localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
        
        return;
      }
      
      // If online, call API
      try {
        const response = await fetch(`/api/races/${currentRace.id}/start`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to start race');
        }
        
        const updatedRace = await response.json();
        
        // Update current race
        currentRace = updatedRace;
        
        // Update cached races
        const cachedRaces = JSON.parse(localStorage.getItem('races') || '[]');
        const index = cachedRaces.findIndex(r => r.id === currentRace.id);
        
        if (index >= 0) {
          cachedRaces[index] = currentRace;
          localStorage.setItem('races', JSON.stringify(cachedRaces));
        }
        
        // Start timer with server timestamp
        Timer.start(currentRace.start_time);
        
        // Update UI
        updateRaceControlButtons();
        utils.showToast('Race started', 'success');
      } catch (error) {
        console.error('Error starting race:', error);
        utils.showToast(error.message, 'error');
      }
    }
    
    /**
     * End the race
     */
    async function endRace() {
      if (!currentRace) return;
      
      if (currentRace.status !== 'active') {
        utils.showToast('Race is not active', 'error');
        return;
      }
      
      const offlineMode = localStorage.getItem('offline_mode') === 'true';
      
      // If offline, handle locally
      if (offlineMode || !navigator.onLine) {
        // Stop timer
        Timer.stop();
        
        // Update race status locally
        currentRace.status = 'completed';
        
        // Update cached races
        const cachedRaces = JSON.parse(localStorage.getItem('races') || '[]');
        const index = cachedRaces.findIndex(r => r.id === currentRace.id);
        
        if (index >= 0) {
          cachedRaces[index] = currentRace;
          localStorage.setItem('races', JSON.stringify(cachedRaces));
        }
        
        // Update UI
        updateRaceControlButtons();
        utils.showToast('Race ended (offline mode)', 'info');
        
        // Add to sync queue
        const syncQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        syncQueue.push({
          type: 'race_end',
          data: {
            race_id: currentRace.id
          },
          timestamp: Date.now()
        });
        localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
        
        return;
      }
      
      // If online, call API
      try {
        const response = await fetch(`/api/races/${currentRace.id}/end`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to end race');
        }
        
        const updatedRace = await response.json();
        
        // Update current race
        currentRace = updatedRace;
        
        // Update cached races
        const cachedRaces = JSON.parse(localStorage.getItem('races') || '[]');
        const index = cachedRaces.findIndex(r => r.id === currentRace.id);
        
        if (index >= 0) {
          cachedRaces[index] = currentRace;
          localStorage.setItem('races', JSON.stringify(cachedRaces));
        }
        
        // Stop timer
        Timer.stop();
        
        // Update UI
        updateRaceControlButtons();
        utils.showToast('Race ended', 'success');
      } catch (error) {
        console.error('Error ending race:', error);
        utils.showToast(error.message, 'error');
      }
    }
    
    /**
     * Record a finish time
     */
    function recordFinish() {
      if (!currentRace || currentRace.status !== 'active') {
        utils.showToast('Race is not active', 'error');
        return;
      }
      
      const bibInput = document.getElementById('bib-number');
      const bibNumber = bibInput.value.trim();
      
      if (!bibNumber) {
        utils.showToast('Bib number is required', 'error');
        return;
      }
      
      // Record finish time
      Results.recordFinish(bibNumber);
      
      // Clear input and focus for next entry
      bibInput.value = '';
      bibInput.focus();
    }
    
    /**
     * Show add runner form
     */
    function showAddRunnerForm() {
      document.getElementById('runner-form-title').textContent = 'Add Runner';
      document.getElementById('runner-form').reset();
      showPage('runner-form');
    }
    
    /**
     * Handle runner form submission
     */
    function handleRunnerFormSubmit(e) {
      e.preventDefault();
      
      const form = e.target;
      const bibNumber = form.elements.bib_number.value.trim();
      const name = form.elements.name.value.trim();
      
      if (!bibNumber) {
        utils.showToast('Bib number is required', 'error');
        return;
      }
      
      // Add runner
      Runners.addRunner({
        bib_number: bibNumber,
        name: name
      });
      
      // Return to runners tab
      showRaceDetail('runners');
    }
    
    /**
     * Show import runners form
     */
    function showImportRunnersForm() {
      document.getElementById('import-data').value = '';
      showPage('runner-import');
    }
    
    /**
     * Process runner import from CSV
     */
    function processRunnerImport() {
      const importData = document.getElementById('import-data').value.trim();
      
      if (!importData) {
        utils.showToast('No data to import', 'error');
        return;
      }
      
      // Process CSV data
      const lines = importData.split('\n');
      const runners = [];
      const errors = [];
      
      lines.forEach((line, index) => {
        // Skip empty lines
        if (!line.trim()) return;
        
        // Parse CSV line (simple implementation, assumes no commas in fields)
        const parts = line.split(',');
        
        if (parts.length < 1) {
          errors.push(`Line ${index + 1}: Invalid format`);
          return;
        }
        
        const bibNumber = parts[0].trim();
        const name = parts.length > 1 ? parts[1].trim() : '';
        
        if (!bibNumber || isNaN(parseInt(bibNumber, 10))) {
          errors.push(`Line ${index + 1}: Invalid bib number`);
          return;
        }
        
        runners.push({
          bib_number: parseInt(bibNumber, 10),
          name: name
        });
      });
      
      if (errors.length > 0) {
        utils.showToast(`Found ${errors.length} errors in import data`, 'error');
        console.error('Import errors:', errors);
      }
      
      if (runners.length > 0) {
        // Import runners
        Runners.importRunners(runners);
        
        // Return to runners tab
        showRaceDetail('runners');
      } else {
        utils.showToast('No valid runners found in import data', 'error');
      }
    }
    
    // Initialize application
    document.addEventListener('DOMContentLoaded', init);
    
    // Return public API
    return {
      init,
      showPage,
      showRaceDetail,
      switchTab,
      loadRaces,
      loadRaceDetail,
      startRace,
      endRace,
      recordFinish
    };
  })();
  
  // Export App globally
  window.App = App;