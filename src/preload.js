// preload.js
const { contextBridge } = require('electron');

// Expose the raw EIP-1193 provider methods safely to the UI frontend
contextBridge.exposeInMainWorld('electronEthereum', {
  request: async (args) => {
    if (!window.ethereum) throw new Error("No crypto wallet found");
    return await window.ethereum.request(args);
  },
  on: (eventName, callback) => {
    if (window.ethereum) window.ethereum.on(eventName, callback);
  },
  removeListener: (eventName, callback) => {
    if (window.ethereum) window.ethereum.removeListener(eventName, callback);
  }
});