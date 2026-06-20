// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose secure internal wallet management methods to your React UI
contextBridge.exposeInMainWorld('electronAPI', {

  fetchBalances: (address) =>
    ipcRenderer.invoke('blockchain:get-balances', address),

  getAffiliateHistory: (data) =>
    ipcRenderer.invoke('blockchain:get-affiliate-history', data),
  
  getPartnerLedger: (data) =>
    ipcRenderer.invoke('blockchain:get-partner-ledger', data),

  getExpandedPortfolio: (data) =>
    ipcRenderer.invoke('blockchain:get-user-expanded-portfolio', data),

  getUserOverview: (data) =>
  ipcRenderer.invoke('blockchain:get-user-overview', data),
  
  saveAdminCredentials: (address, method, secret, password) => 
    ipcRenderer.invoke('secure-save-credentials', { address, method, secret, password }),
    
  disconnectAdmin: () => 
    ipcRenderer.invoke('secure-disconnect-wallet'),

  getAdminStatus: () => 
    ipcRenderer.invoke('get-admin-status'),

  executeTransaction: (txData) =>
    ipcRenderer.invoke('secure-execute-transaction', txData)
});