/**
 * Utility functions for Race Control application
 */

// Format time in HH:MM:SS format
function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '--:--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  }
  
  // Format short time in MM:SS format
  function formatShortTime(seconds) {
    if (!seconds && seconds !== 0) return '--:--';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    return [
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  }
  
  // Generate a unique device ID
  function generateDeviceId() {
    const existingId = localStorage.getItem('deviceId');
    if (existingId) return existingId;
    
    const newId = 'device_' + Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
    localStorage.setItem('deviceId', newId);
    return newId;
  }
  
  // Show a toast notification
  function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-message">${message}</div>
      <button class="toast-close">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Add close button functionality
    const closeButton = toast.querySelector('.toast-close');
    closeButton.addEventListener('click', () => {
      toastContainer.removeChild(toast);
    });
    
    // Auto remove after duration
    setTimeout(() => {
      if (toast.parentElement) {
        toastContainer.removeChild(toast);
      }
    }, duration);
  }
  
  // Show confirmation modal
  function showConfirmModal(title, message, confirmAction) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const confirmButton = document.getElementById('modal-confirm');
    const cancelButton = document.getElementById('modal-cancel');
    const closeButton = document.getElementById('modal-close');
    
    modalTitle.textContent = title;
    modalContent.textContent = message;
    
    modalContainer.classList.remove('hidden');
    
    const confirmHandler = () => {
      confirmAction();
      modalContainer.classList.add('hidden');
      confirmButton.removeEventListener('click', confirmHandler);
    };
    
    const cancelHandler = () => {
      modalContainer.classList.add('hidden');
      confirmButton.removeEventListener('click', confirmHandler);
    };
    
    confirmButton.addEventListener('click', confirmHandler);
    cancelButton.addEventListener('click', cancelHandler);
    closeButton.addEventListener('click', cancelHandler);
  }
  
  // Check online status
  function updateOnlineStatus() {
    const statusDisplay = document.getElementById('network-status');
    if (navigator.onLine) {
      statusDisplay.textContent = 'Online';
      statusDisplay.className = 'online';
    } else {
      statusDisplay.textContent = 'Offline';
      statusDisplay.className = 'offline';
    }
  }
  
  // Export functions
  window.utils = {
    formatTime,
    formatShortTime,
    generateDeviceId,
    showToast,
    showConfirmModal,
    updateOnlineStatus
  };