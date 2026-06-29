// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose secure internal wallet management methods to your React UI
contextBridge.exposeInMainWorld('electronAPI', {

  saveAdminCredentials: (address, method, secret, password) => 
    ipcRenderer.invoke('secure-save-credentials', { address, method, secret, password }),
    
  disconnectAdmin: () => 
    ipcRenderer.invoke('secure-disconnect-wallet'),

  getAdminStatus: () => 
    ipcRenderer.invoke('get-admin-status'),
  
  sendEmail: (payload) =>
    ipcRenderer.invoke('send-smtp-email', payload),

  swapRegistry: (payload) =>
    ipcRenderer.invoke('blockchain:swap-registry', payload),

  submitAcquisition: (payload) => 
    ipcRenderer.invoke('submit-acquisition', payload),

  submitDeposit: (payload) =>
    ipcRenderer.invoke('submitDeposit', payload),
  
  submitWithdrawal: (payload) =>
    ipcRenderer.invoke('submitWithdrawal', payload),

  submitUserLiquidate: (payload) => 
    ipcRenderer.invoke('submit-user-liquidate', payload),

  getNativeExchangeHistory: (payload) => 
    ipcRenderer.invoke('get-native-exchange-history', payload),

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

  executeTransaction: (txData) =>
    ipcRenderer.invoke('secure-execute-transaction', txData),

  querySwapRegistry: (targetAddress) =>
    ipcRenderer.invoke('query-swap-registry', targetAddress),
  
  triggerVault: (payload) =>
    ipcRenderer.invoke('trigger-vault', payload)

});