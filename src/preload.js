// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose secure internal wallet management methods to your React UI
contextBridge.exposeInMainWorld('electronAPI', {

  fetchBalances: (address) => ipcRenderer.invoke('blockchain:get-balances', address),
  
  // 1. Send raw user inputs down to Main Process for hardware-tied encryption
  saveAdminCredentials: (address, method, secret, password) => 
    ipcRenderer.invoke('secure-save-credentials', { address, method, secret, password }),
    
  // 2. Erase the secure wallet data completely from local storage/disk
  disconnectAdmin: () => 
    ipcRenderer.invoke('secure-disconnect-wallet'),

  // 3. Ask the Main Process if an admin profile is already configured on startup
  getAdminStatus: () => 
    ipcRenderer.invoke('get-admin-status'),

  // 4. Trigger an on-chain transaction or signing request using the secured key
  executeTransaction: (txData) =>
    ipcRenderer.invoke('secure-execute-transaction', txData)
});