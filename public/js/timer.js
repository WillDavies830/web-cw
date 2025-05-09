/**
 * Race timer module for Race Control
 */

const Timer = (function() {
    let startTime = 0;
    let isRunning = false;
    let timerInterval = null;
    let elapsedTime = 0;
    
    const timerDisplay = document.getElementById('timer-display');
    
    // Start the timer
    function start(customStartTime = null) {
      if (isRunning) return;
      
      startTime = customStartTime || Math.floor(Date.now() / 1000);
      isRunning = true;
      
      // Update display immediately
      updateDisplay();
      
      // Update timer display every second
      timerInterval = setInterval(updateDisplay, 1000);
      
      // Store race start time in localStorage for offline usage
      localStorage.setItem('race_timer_start', startTime.toString());
      localStorage.setItem('race_timer_running', 'true');
    }
    
    // Stop the timer
    function stop() {
      if (!isRunning) return;
      
      clearInterval(timerInterval);
      isRunning = false;
      
      // Clear stored data
      localStorage.setItem('race_timer_running', 'false');
    }
    
    // Reset the timer
    function reset() {
      stop();
      startTime = 0;
      elapsedTime = 0;
      timerDisplay.textContent = '00:00:00';
      
      // Clear local storage
      localStorage.removeItem('race_timer_start');
      localStorage.removeItem('race_timer_running');
    }
    
    // Get current elapsed time in seconds
    function getElapsedTime() {
      if (!isRunning && startTime === 0) return 0;
      
      return Math.floor(Date.now() / 1000) - startTime;
    }
    
    // Update the timer display
    function updateDisplay() {
      if (!isRunning && startTime === 0) return;
      
      elapsedTime = getElapsedTime();
      timerDisplay.textContent = utils.formatTime(elapsedTime);
    }
    
    // Load timer state from localStorage (for page refreshes)
    function restoreState() {
      const savedStart = localStorage.getItem('race_timer_start');
      const savedRunning = localStorage.getItem('race_timer_running');
      
      if (savedStart && savedRunning === 'true') {
        start(parseInt(savedStart, 10));
      } else if (savedStart) {
        // Timer was started but stopped
        startTime = parseInt(savedStart, 10);
        updateDisplay();
      }
    }
    
    // Get if timer is running
    function isActive() {
      return isRunning;
    }
    
    // Get start time
    function getStartTime() {
      return startTime;
    }
    
    // Initial state restore
    window.addEventListener('load', restoreState);
    
    // Return public methods
    return {
      start,
      stop,
      reset,
      getElapsedTime,
      isActive,
      getStartTime
    };
  })();
  
  // Export timer
  window.Timer = Timer;