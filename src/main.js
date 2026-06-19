const { app, BrowserWindow, ipcMain, Menu, Tray, shell, dialog, nativeImage } = require('electron');
// Catch unhandled sync exceptions
process.on('uncaughtException', (error) => {
  dialog.showErrorBox('Main Process Crash', error.stack || error.message);
});

// Catch unhandled async promise rejections
process.on('unhandledRejection', (reason) => {
  dialog.showErrorBox('Unhandled Promise Rejection', String(reason));
});
const path = require('path');
const ethers = require('ethers');

// Use __dirname to lock the path to the packaged folder, not the OS environment
const tokensPath = path.join(__dirname, 'tokens.js');
const deploymentsPath = path.join(__dirname, 'deployments.json');

const supportedTokens = require(tokensPath);
const deployments = require(deploymentsPath);
const providers = {
  ethereum: new ethers.JsonRpcProvider("https://1rpc.io/eth"),
  polygon:  new ethers.JsonRpcProvider("https://polygon-rpc.com"),
  globalChain:   new ethers.JsonRpcProvider("https://rpc.brantley-global.com"),
}

const CONTRACT_ABI = [
  "function getDepositsInRange(uint256 startTs, uint256 endTs, bool process) public returns (bool)",
  "function getWithdrawInRange(uint256 startTs, uint256 endTs, bool process) public returns (bool)",
  "function getUserTermCount(address user) external view returns (uint256)",
  "function getUserDepositCount(address user) external view returns (uint256)",
  "function getWithdrawalUser(address user, uint256 index) external view returns (tuple(address user, uint256 index) memory)",
  "function getDepositUser(address user, uint256 index) external view returns (tuple(address user, uint256 index) memory)",
  "function purchase(address buyer, address stable, uint256 productId, uint256 amount, uint256 shipping, uint256 customizations, bytes32 configs, uint256 quantity, uint256 rate, address affiliate, uint256 commission, uint256 region, bytes32 depositHash, uint256 purchaseTimeStamp) external"
];

const decimalsCache = {};
const ERC20_MINIMAL_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

function createWindow() {
  let iconExtension = '.png';
  if (process.platform === 'win32') iconExtension = '.ico';
  if (process.platform === 'darwin') iconExtension = '.icns';

  // Looks at the project root for the OS shell icon
  const iconPath = path.join(__dirname, 'assets', `logo${iconExtension}`);
  
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.webContents.on('will-navigate', (event, url) => {
    // If the window tries to navigate away from localhost or your packaged local app files...
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault(); // Stop it from opening inside Electron
      shell.openExternal(url); // Force it out to Chrome/Safari
    }
  });

  // Keep your existing handler as back-up protection
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // THE FIX: '..' steps out of 'src/' so Electron can find the 'dist/' folder next to it
    win.loadFile(path.join(__dirname, 'dist', 'index.html')); 
  }
}


app.whenReady().then(() => {
  createWindow();

  // ==========================================
  // CUSTOM DESKTOP APPLICATION MENU BUILDER
  // ==========================================
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Disconnect Wallet',
          click: () => {
            // Sends a secure bridge signal to your active React UI window
            if (win) {
              win.webContents.send('menu-disconnect-wallet');
            }
          }
        },
        { type: 'separator' },
        {
          // Restores the native operating system close window / exit hotkeys
          label: 'Close Window',
          accelerator: process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+W',
          click: () => {
            win.close();
          }
        },
        {
          label: 'Quit Application',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // ... your Edit and View menus remain exactly the same ...
    {
      label: 'Help',
      submenu: [
        {
          label: 'Visit Dashboard Website',
          click: async () => {
            // Now this command will actually fire completely unimpeded!
            await shell.openExternal('https://brantley-global.com'); 
          }
        },
        { type: 'separator' },
        {
          label: 'View Network Status',
          click: async () => {
            await shell.openExternal('https://rpc.brantley-global.com');
          }
        }
      ]
    }
  ];

  const appMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(appMenu);

  // Maintain your existing activation check
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/// ==========================================
// YOUR ORIGINAL VAULT LOGIC & IPC INTERCEPTOR
// ==========================================

// Your helper function from the original snippet
function toISO(y, m, d, isEnd = false) {
  if (!y || !m || !d) return "";
  return isEnd ? `${y}-${m}-${d}T23:59:59.999Z` : `${y}-${m}-${d}T00:00:00.000Z`;
}

// Your core processing function
async function vaultWithdrawalProcess(contracts, modes, startISO, endISO, withPayouts) {
  console.log("ENGINE RUNNING with data:", { contracts, modes, startISO, endISO, withPayouts });
  
  // This is where your heavy lifting happens (Bitcoinjs, CSV writing, etc.)
  // For now, we return a success message to show the UI it worked.
  return { 
    status: "Success", 
    message: `Processed ${contracts.length} contracts in ${modes.length} mode(s).` 
  };
}

function rescaleAmount(amount, fromDecimals, toDecimals) {
  if (fromDecimals === toDecimals) return amount;

  if (fromDecimals > toDecimals) {
    const factor = BigInt(10) ** BigInt(fromDecimals - toDecimals);
    return (amount / factor); // downscale
  } else {
    const factor = BigInt(10) ** BigInt(toDecimals - fromDecimals);
    return (amount * factor); // upscale
  }
}

// This listens for the frontend dashboard to send data over the 'run-vault' bridge
// ==================== BEFORE (ORIGINAL) ====================
// (This space was completely empty)

// ==================== AFTER (UPDATED SECURE) ====================
// Checks if a secure credential profile exists on the user's hardware disk
// 1. Declare a simple session object in the background memory (top of main.js)
let activeAdminSession = {
  isConnected: false,
  address: "",
  method: "",
  secret: "",
  password: ""
};

// ========================================================
// REWRITTEN: IN-MEMORY IPC HANDLERS
// ========================================================

// 1. Checks if a live session currently exists in active memory
ipcMain.handle('get-admin-status', async () => {
  return {
    isConnected: activeAdminSession.isConnected,
    address: activeAdminSession.address,
    method: activeAdminSession.method
  };
});

// 2. Holds cleartext inputs strictly inside Node's background RAM variable
ipcMain.handle('secure-save-credentials', async (event, { address, method, secret, password }) => {
  try {
    if (!address || !secret) {
      throw new Error("Critical Exception: Missing address or secret credentials.");
    }

    // Save everything strictly to your system's volatile RAM space
    activeAdminSession = {
      isConnected: true,
      address,
      method,
      secret,    // Isolated from React/Chromium memory scrapping
      password   // Kept strictly inside the background runtime
    };

    // Return the absolute truth directly to the frontend response payload
    return { 
      success: true, 
      isConnected: activeAdminSession.isConnected, 
      address: activeAdminSession.address 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Flushes and purges the memory space completely on logout
ipcMain.handle('secure-disconnect-wallet', async () => {
  activeAdminSession = {
    isConnected: false,
    address: "",
    method: "",
    secret: "",
    password: ""
  };
  return { success: true };
});

ipcMain.handle('blockchain:get-balances', async (event, userAddress) => {
  if (!userAddress || typeof userAddress !== 'string') return [];

  try {
    // 1. Group tokens by their defined chain property
    const grouped = { ethereum: [], polygon: [], globalChain: [] };
    
    // Fallback array check to handle common CommonJS module export variations Safely
    const tokenList = Array.isArray(supportedTokens) 
      ? supportedTokens 
      : (supportedTokens.supportedTokens || []);

    tokenList.forEach(token => {
      const key = token.chain === 'global' ? 'globalChain' : token.chain;
      if (grouped[key]) grouped[key].push(token);
    });

    // 2. Loop through each chain client concurrently
    const balancePromises = Object.entries(grouped).map(async ([chainKey, tokens]) => {
      if (tokens.length === 0) return [];
      
      const provider = providers[chainKey];
      if (!provider) return [];

      // Execute queries for this specific network group
      const results = await Promise.allSettled(
        tokens.map(async (token) => {
          let rawBalance = 0n;

          if (token.isNative) {
            rawBalance = await provider.getBalance(userAddress);
          } else {
            const contract = new ethers.Contract(token.address, erc20Abi, provider);
            rawBalance = await contract.balanceOf(userAddress);
          }

          return {
            symbol: token.symbol,
            address: token.address,
            decimals: token.decimals || 18,
            // Stringify BigInt completely prevents Electron IPC payload breakages
            balance: rawBalance.toString(), 
            isNative: !!token.isNative,
            chain: token.chain,
          };
        })
      );

      return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(token => BigInt(token.balance) > 0n); // Drop zero entries
    });

    const allResults = await Promise.all(balancePromises);
    return allResults.flat();

  } catch (error) {
    console.error("IPC main process execution failed:", error);
    return [];
  }
});

// Inside main.js
ipcMain.handle('blockchain:get-affiliate-history', async (event, { userAddress, contractAddress, chainKey }) => {
  if (!userAddress || !contractAddress) return [];

  try {
    // Verified ABI configuration layout matching struct array return definitions
    const affiliateAbi = [
      "function getAffiliateHistory(address user) view returns (tuple(address user, uint256 purchaseIndex, uint256 commission, string commissionHash)[])"
    ];
    
    // Explicit contract instantiation inside secure desktop node container
    const contract = new ethers.Contract(contractAddress, affiliateAbi, providers.globalChain);

    const records = await contract.getAffiliateHistory(userAddress);
    
    // Safely normalize raw big integers into strings before streaming across IPC lanes
    return (records || []).map(rec => ({
      user: rec.user,
      purchaseIndex: rec.purchaseIndex.toString(),
      commission: rec.commission.toString(),
      commissionHash: rec.commissionHash
    }));

  } catch (error) {
    console.error("Backend affiliate log fetch failed:", error);
    throw error; 
  }
});

// Add this under your existing handlers in main.js
// Inside your main Electron process file where context bridges are set up
ipcMain.handle('blockchain:get-partner-ledger', async (event, { userAddress, contractAddress, chainKey }) => {
  if (!userAddress || !contractAddress) return [[], []];

  try {
    const partnerAbi = [
      "function getUserPurchasesWithCredits(address user) view returns (tuple(uint256 id, uint256 amount, uint256 quantity, uint256 timestamp)[] terms, uint256[] credits)"
    ];
    
    // Assumes providers.globalChain is instantiated inside your secure Node scope
    const contract = new ethers.Contract(contractAddress, partnerAbi, providers.globalChain);

    const [terms, credits] = await contract.getUserPurchasesWithCredits(userAddress);
    
    // Format big variables safely to strings before shipping across the process channel
    const serializedTerms = (terms || []).map(tx => ({
      id: tx.id.toString(),
      amount: tx.amount.toString(),
      quantity: tx.quantity.toString(),
      timestamp: tx.timestamp.toString()
    }));

    const serializedCredits = (credits || []).map(c => c.toString());

    return [serializedTerms, serializedCredits];

  } catch (error) {
    console.error("Backend partner ledger sync failure:", error);
    throw error;
  }
});

ipcMain.handle('blockchain:get-user-expanded-portfolio', async (event, { 
  userAddress, 
  matrixContractAddress, 
  vaultContractAddress, 
  ventureContractAddress, 
  chainKey 
}) => {
  if (!userAddress || !matrixContractAddress) return null;

  try {

    // 1. Matrix Overview ABI (Static Index [0] Core Blueprint)
    const matrixAbi = [
      "function getUserOverview(address user) view returns (tuple(uint256[] balanceAmount, uint256[] vaultDepositAmount, uint256[] ventureDepositAmount, uint256[] vaultWithdrawAmount, uint256[] ventureWithdrawAmount, uint256[] purchases, uint256 timestamp)[])"
    ];

    // 2. Explicit Vault Contract ABI Specs (Array boundaries set to [7])
    const vaultAbi = [
      "function getUserTermCount(address user) view returns (uint256)",
      "function getUserDepositCount(address user) view returns (uint256)",
      "function getDepositUser(address user, uint256 index) view returns (tuple(uint256 timestamp, uint256 amountin, uint256 amountout, uint256 rate, address user, address token, address dividend, uint256 quartersCommitted, uint256 startQuarter, uint256 key, bytes32 depositTxHash, bytes32 refundHash, bool refund))",
      "function getWithdrawalUser(address user, uint256 index) view returns (tuple(address user, address dividendToken, address[7] payToken, uint256 quartersCommitted, uint256 startQuarter, uint256 unlockQuarter, uint256 stage, bool autoPay, uint256 userDividendAmount, uint256[7] termSupplyPerStage, uint256[7] poolBalancePerStage, address[7] payoutSetter, uint256[7] amountout, bytes32[7] payoutTxHash))",
      "function getUserPurchases(address user) view returns (tuple(address user, address token, address purchaseSetter, address refundSetter, uint256 region, uint256 purchaseIndex, uint256 quantity, uint256 id, uint256 timestamp, uint256 amount, uint256 shipping, uint256 customizations, uint256 rate, bool refund, bytes32 purchaseTxHash, bytes32 refundHash, bytes32 configs)[] memory)"
    ];

    // 3. Explicit Venture Contract ABI Specs (Array boundaries explicitly expanded to [39])
    const ventureAbi = [
      "function getUserTermCount(address user) view returns (uint256)",
      "function getUserDepositCount(address user) view returns (uint256)",
      "function getDepositUser(address user, uint256 index) view returns (tuple(uint256 timestamp, uint256 amountin, uint256 amountout, uint256 rate, address user, address token, address venture, bytes32 depositTxHash, bytes32 refundHash, bool refund))",
      "function getWithdrawalUser(address user, uint256 index) view returns (tuple(address user, address ventureToken, address[39] payToken, uint256 quartersCommitted, uint256 startQuarter, uint256 unlockQuarter, uint256 redemptionPeriod, uint256 stage, bool autoPay, uint256 timestamp, uint256 userDividendAmount, uint256 termTotalSupply, address[39] payoutSetter, uint256[39] principalSlice, uint256[39] amountout, bytes32[39] payoutTxHash))",
      "function getUserPurchases(address user) view returns (tuple(address user, address token, address purchaseSetter, address refundSetter, uint256 region, uint256 purchaseIndex, uint256 quantity, uint256 id, uint256 timestamp, uint256 amount, uint256 shipping, uint256 customizations, uint256 rate, bool refund, bytes32 purchaseTxHash, bytes32 refundHash, bytes32 configs)[] memory)"
    ];

    const matrixContract = new ethers.Contract(matrixContractAddress, matrixAbi, providers.globalChain);
    const vaultContract = vaultContractAddress ? new ethers.Contract(vaultContractAddress, vaultAbi, providers.globalChain) : null;
    const ventureContract = ventureContractAddress ? new ethers.Contract(ventureContractAddress, ventureAbi, providers.globalChain) : null;

    // --- EXECUTION PASS 1: CORE SUMMARIES & POOL COUNTERS ---
    const [
      userOverviews,
      vaultDepositCount,
      vaultPurchasesRaw,
      ventureDepositCount,
      venturePurchasesRaw
    ] = await Promise.all([
      matrixContract.getUserOverview(userAddress),
      vaultContract ? vaultContract.getUserPurchases(userAddress) : Promise.resolve([]),
      ventureContract ? ventureContract.getUserPurchases(userAddress) : Promise.resolve([])
    ]);

    // --- EXECUTION PASS 2: HISTORICAL STRUCT ARRAY LOOPS ---
    const vaultDepositPromises = Array.from({ length: Number(vaultDepositCount) }, (_, i) => vaultContract.getDepositUser(userAddress, i));
    const vaultWithdrawalPromises = Array.from({ length: Number(vaultTermCount) }, (_, i) => vaultContract.getWithdrawalUser(userAddress, i));
    
    const ventureDepositPromises = Array.from({ length: Number(ventureDepositCount) }, (_, i) => ventureContract.getDepositUser(userAddress, i));
    const ventureWithdrawalPromises = Array.from({ length: Number(ventureTermCount) }, (_, i) => ventureContract.getWithdrawalUser(userAddress, i));

    const [
      vaultDepositsRaw,
      vaultWithdrawalsRaw,
      ventureDepositsRaw,
      ventureWithdrawalsRaw
    ] = await Promise.all([
      Promise.all(vaultDepositPromises),
      Promise.all(vaultWithdrawalPromises),
      Promise.all(ventureDepositPromises),
      Promise.all(ventureWithdrawalPromises)
    ]);

    // --- PHASE 3: ISOLATED MAPPING & DATA CLEANING ---
    // Core Shared Purchase Cleaner
    const mapPurchases = (rawArr) => (rawArr || []).map((p) => ({
      user: p.user, token: p.token, purchaseSetter: p.purchaseSetter, refundSetter: p.refundSetter,
      region: p.region.toString(), purchaseIndex: p.purchaseIndex.toString(), quantity: p.quantity.toString(),
      id: p.id.toString(), timestamp: p.timestamp.toString(), amount: p.amount.toString(),
      shipping: p.shipping.toString(), customizations: p.customizations.toString(), rate: p.rate.toString(),
      refund: p.refund, purchaseTxHash: p.purchaseTxHash, refundHash: p.refundHash, configs: p.configs
    }));

    // Vault Specific Serialization Mapping
    const mapVaultDeposits = (rawArr) => (rawArr || []).map((d) => ({
      timestamp: d.timestamp.toString(), amountin: d.amountin.toString(), amountout: d.amountout.toString(), rate: d.rate.toString(),
      user: d.user, token: d.token, dividend: d.dividend, quartersCommitted: d.quartersCommitted.toString(),
      startQuarter: d.startQuarter.toString(), key: d.key.toString(), depositTxHash: d.depositTxHash, refundHash: d.refundHash, refund: d.refund
    }));

    const mapVaultWithdrawals = (rawArr) => (rawArr || []).map((w) => ({
      user: w.user, dividendToken: w.dividendToken, payToken: w.payToken, quartersCommitted: w.quartersCommitted.toString(),
      startQuarter: w.startQuarter.toString(), unlockQuarter: w.unlockQuarter.toString(), stage: w.stage.toString(), autoPay: w.autoPay,
      userDividendAmount: w.userDividendAmount.toString(), termSupplyPerStage: w.termSupplyPerStage.map(v => v.toString()),
      poolBalancePerStage: w.poolBalancePerStage.map(v => v.toString()), payoutSetter: w.payoutSetter, amountout: w.amountout.map(v => v.toString()), payoutTxHash: w.payoutTxHash
    }));

    // Venture Specific Serialization Mapping
    const mapVentureDeposits = (rawArr) => (rawArr || []).map((d) => ({
      timestamp: d.timestamp.toString(), amountin: d.amountin.toString(), amountout: d.amountout.toString(), rate: d.rate.toString(),
      user: d.user, token: d.token, venture: d.venture, depositTxHash: d.depositTxHash, refundHash: d.refundHash, refund: d.refund
    }));

    const mapVentureWithdrawals = (rawArr) => (rawArr || []).map((w) => ({
      user: w.user, ventureToken: w.ventureToken, payToken: w.payToken, // Array size 39
      quartersCommitted: w.quartersCommitted.toString(), startQuarter: w.startQuarter.toString(), unlockQuarter: w.unlockQuarter.toString(),
      redemptionPeriod: w.redemptionPeriod.toString(), stage: w.stage.toString(), autoPay: w.autoPay, timestamp: w.timestamp.toString(),
      userDividendAmount: w.userDividendAmount.toString(), termTotalSupply: w.termTotalSupply.toString(), payoutSetter: w.payoutSetter, // Array size 39
      principalSlice: w.principalSlice.map(v => v.toString()), // Array size 39
      amountout: w.amountout.map(v => v.toString()), // Array size 39
      payoutTxHash: w.payoutTxHash // Array size 39
    }));

    // Matrix Struct [0] Verification Checks
    let overviewData = null;
    if (userOverviews && userOverviews.length > 0) {
      const latestState = userOverviews[userOverviews.length - 1];
      if (latestState.balanceAmount?.length && latestState.purchases?.length) {
        overviewData = {
          balance: latestState.balanceAmount[0].toString(),
          vaultDeposit: latestState.vaultDepositAmount[0].toString(),
          ventureDeposit: latestState.ventureDepositAmount[0].toString(),
          vaultWithdraw: latestState.vaultWithdrawAmount[0].toString(),
          ventureWithdraw: latestState.ventureWithdrawAmount[0].toString(),
          purchase: latestState.purchases[0].toString(),
          timestamp: latestState.timestamp ? latestState.timestamp.toString() : "0"
        };
      }
    }

    return {
      overview: overviewData,
      vaultStats: {
        purchases: mapPurchases(vaultPurchasesRaw),
        deposits: mapVaultDeposits(vaultDepositsRaw),
        withdrawals: mapVaultWithdrawals(vaultWithdrawalsRaw)
      },
      ventureStats: {
        purchases: mapPurchases(venturePurchasesRaw),
        deposits: mapVentureDeposits(ventureDepositsRaw),
        withdrawals: mapVentureWithdrawals(ventureWithdrawalsRaw)
      }
    };

  } catch (error) {
    console.error("Backend dual-ABI portfolio serialization processing crashed:", error);
    throw error;
  }
});

ipcMain.handle('trigger-vault', async (event, payload) => {
  try {

    const {
      // Query parameters
      modeArg,
      contractAddress,
      txType,
      args,
      userAddress,
      limit,
      transactionHash,
      custodialWallet,

      // State-change specific parameters
      cryptoAuth,
      assetId,
      basePrice,
      shippingTransitDays,
      customizationUpcharges,
      hardwareConfigBytes32,
      selectedTokenAddress,
      buyerWalletAddress,
      configurationSummary,
      custodialDepositHash
    } = payload;

    // --- MODE 1: TIMESTAMP QUERY ---
    if (modeArg === "timestamp-query") {
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, providers.globalChain);
      let tx;
      if (txType === "Deposit") {
        // Warning: if getDepositsInRange modifies state, use .staticCall to read without spending gas
        tx = await contract.getDepositsInRange.staticCall(args[0], args[1], args[2]);
      } else {
        tx = await contract.getWithdrawInRange.staticCall(args[0], args[1], args[2]);
      }
      return { status: "Success", data: tx };
    }

    // --- MODE 2: MULTI-STEP USER LOOP ---
    // Automates checking total count, verifying limit, and fetching array items loop in backend
    if (modeArg === "user-activity") {
      const provider = providers.globalChain;
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
      const results = [];
      
      if (txType === "Deposit") {
        const count = await contract.getUserDepositCount(userAddress);
        const totalItems = Number(count);
        const fetchCount = Math.min(totalItems, limit);

        for (let i = totalItems - 1; i >= totalItems - fetchCount; i--) {
          const item = await contract.getDepositUser(userAddress, i);
          results.push({ index: i, item: item.toString() });
        }
      } else {
        const count = await contract.getUserTermCount(userAddress);
        const totalItems = Number(count);
        const fetchCount = Math.min(totalItems, limit);

        for (let i = totalItems - 1; i >= totalItems - fetchCount; i--) {
          const item = await contract.getWithdrawalUser(userAddress, i);
          results.push({ index: i, item: item.toString() });
        }
      }
      return { status: "Success", data: results };
    }

    if (modeArg === "verify-erc20-receipt") {
      if (!transactionHash || !custodialWallet || !contractAddress) {
        return { ok: false, reason: "Missing transactionHash, custodialWallet, or contractAddress in payload." };
      }

      const targetTokenLower = contractAddress.toLowerCase();
      
      // 1. Locate the token directly within your token selection module
      const matchedToken = supportedTokens.find(t => t.address.toLowerCase() === targetTokenLower);
      if (!matchedToken) {
        return { ok: false, reason: `Token contract address ${contractAddress} is not supported by this application.` };
      }

      // 2. Map the network provider directly using your explicit chain properties
      let provider;
      if (matchedToken.chain === "polygon" || matchedToken.chainId === 137) {
        provider = providers.polygon;
      } else if (matchedToken.chain === "global" || matchedToken.chainId === 38391207) {
        provider = providers.globalChain;
      } else {
        // Catches both "ethereum" and your typo string "ethreum" seamlessly
        provider = providers.ethereum; 
      }

      const receipt = await provider.getTransactionReceipt(transactionHash);
      if (!receipt) return { ok: false, reason: "Receipt not found on-chain." };
      if (receipt.status !== 1) return { ok: false, reason: "Transaction reverted on-chain." };

      const targetCustodialLower = custodialWallet.toLowerCase();
      const iface = new ethers.Interface(ERC20_MINIMAL_ABI);
      
      let matchedTransfer = null;

      // Scan log entries for any token Transfer event targeting our custodial wallet
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed && parsed.name === "Transfer") {
            const toAddress = String(parsed.args.to).toLowerCase();
            
            if (toAddress === targetCustodialLower) {
              matchedTransfer = {
                tokenAddress: log.address,
                from: String(parsed.args.from),
                rawValue: BigInt(parsed.args.value.toString())
              };
              break; // Found the deposit event matching our criteria
            }
          }
        } catch (e) {
          // Log parsing failure skipped; log belongs to alternative ABI formatting
        }
      }

      if (!matchedTransfer) {
        return { ok: false, reason: `No ERC20 Transfer log found targeting custodial address: ${custodialWallet}` };
      }

      // Resolve Decimals and Symbol through supportedTokens list or direct on-chain query fallback
      const tokenAddressLower = matchedTransfer.tokenAddress.toLowerCase();
      const cachedToken = supportedTokens.find(t => t.address.toLowerCase() === tokenAddressLower);
      
      let decimals = 18;
      let tokenSymbol = "UNKNOWN";

      if (cachedToken) {
        decimals = cachedToken.decimals;
        tokenSymbol = cachedToken.symbol;
      } else if (decimalsCache[tokenAddressLower]) {
        decimals = decimalsCache[tokenAddressLower].decimals;
        tokenSymbol = decimalsCache[tokenAddressLower].symbol;
      } else {
        try {
          const tokenContract = new ethers.Contract(matchedTransfer.tokenAddress, ERC20_MINIMAL_ABI, rpcProvider);
          const [onchainDecimals, onchainSymbol] = await Promise.all([
            tokenContract.decimals(),
            tokenContract.symbol()
          ]);
          decimals = Number(onchainDecimals);
          tokenSymbol = String(onchainSymbol);
          
          decimalsCache[tokenAddressLower] = { decimals, symbol: tokenSymbol };
        } catch (err) {
          console.warn(`Could not fetch metadata for contract: ${matchedTransfer.tokenAddress}. Defaulting to 18 decimals.`);
        }
      }

      // Convert raw BigInt amount to readable string structure (e.g., "150.50")
      const formattedAmount = ethers.formatUnits(matchedTransfer.rawValue, decimals);

      return {
        status: "Success",
        ok: true,
        senderAddress: matchedTransfer.from,
        amount: formattedAmount,
        tokenSymbol: tokenSymbol,
        tokenAddress: matchedTransfer.tokenAddress
      };
    }

    // ==========================================
    // PATCHED: FLAT PURCHASE STATE CHANGE
    // ==========================================
    if (modeArg === "execute-state-change") {
      const provider = providers.globalChain;
      
      // Check if an encrypted file exists locally
      if (!fs.existsSync(secureConfigPath)) {
        return { status: "Error", error: "No admin wallet profile configured on this system." };
      }

      const activeProfile = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'));
      let signer;

      // Safely read and decrypt the stored hardware profile on the fly
      if (activeProfile.method === 'privateKey') {
        const encryptedBuffer = Buffer.from(activeProfile.secret, 'base64');
        const rawKey = safeStorage.decryptString(encryptedBuffer); // Decrypt via OS key
        signer = new ethers.Wallet(rawKey, provider);
      } else if (activeProfile.method === 'mnemonic') {
        const encryptedBuffer = Buffer.from(activeProfile.secret, 'base64');
        const rawPhrase = safeStorage.decryptString(encryptedBuffer);
        signer = ethers.Wallet.fromPhrase(rawPhrase, provider);
      } else if (activeProfile.method === 'keystore') {
        const rawJson = Buffer.from(activeProfile.secret, 'base64').toString('utf8');
        let pass = "";
        const kpPath = path.join(app.getPath('userData'), '.kp');
        if (fs.existsSync(kpPath)) {
          pass = safeStorage.decryptString(Buffer.from(fs.readFileSync(kpPath, 'utf8'), 'base64'));
        }
        signer = await ethers.Wallet.fromEncryptedJson(rawJson, pass);
        signer = signer.connect(provider);
      } else {
        return { status: "Error", error: "Unsupported structural signing key type." };
      }

      console.log(`Executing contract state modification using signer: ${signer.address}`);
      const writeableContract = new ethers.Contract(deployments.AssetPurchase, CONTRACT_ABI, signer);

      // 2. Parse and normalize parameters to fit your flat function arguments
      const buyerAddress = buyerWalletAddress;
      const stableCoinAddress = selectedTokenAddress;
      const productId = BigInt(assetId || 0);
      const nativeAmount = BigInt(basePrice || 0);
      const shippingCost = BigInt(shippingTransitDays || 0); // Mapping transit metric or raw upcharge value
      const customizationCost = BigInt(customizationUpcharges || 0);
      const configsBytes32 = hardwareConfigBytes32; // Pre-packed config string from frontend
      const quantity = BigInt(1); // Default to single item purchase or pull dynamically
      const exchangeRate = BigInt(1); // Set conversion multiplier baseline
      const commissionAmount = BigInt(0);
      const regionId = BigInt(0); // Map destination region identifier if tracked on-chain
      const purchaseTimeStamp = BigInt(Math.floor(Date.now() / 1000));
      // Inside your main.js 'execute-state-change' handler block:
      const transactionDepositHash = payload.custodialDepositHash;

      let affiliateAddress = "0x0000000000000000000000000000000000000000"; // Fallback placeholder

      try {
        const isUserAffiliate = await writeableContract._isAffiliate(signer.address);

        if (isUserAffiliate) {
          affiliateAddress = signer.address;
        }
      } catch (error) {
        console.error("Failed to check affiliate status:", error);
        // Fallback placeholder remains untouched if the call fails
      }

      if (!transactionDepositHash || 
          transactionDepositHash === "0x0000000000000000000000000000000000000000000000000000000000000000" || 
          transactionDepositHash === "0x00") {
        return { 
          status: "Error", 
          error: "Critical Ledger Exception: Purchase rejected. A valid, non-zero custodial deposit hash is required to execute state change." 
        };
      }

      console.log("Broadcasting purchase call parameters to network:", {
        buyerAddress, productId, nativeAmount, customizationCost, configsBytes32
      });

      console.log (customizationCost);

      // 3. Dispatch live transaction execution matching signature exactly
      const txResponse = await writeableContract.purchase(
        buyerAddress,
        stableCoinAddress,
        productId,
        nativeAmount,
        shippingCost,
        customizationCost,
        configsBytes32,
        quantity,
        exchangeRate,
        affiliateAddress,
        commissionAmount,
        regionId,
        transactionDepositHash,
        purchaseTimeStamp
      );

      console.log(`Transaction dispatched successfully. Hash: ${txResponse.hash}`);

      // 4. Await confirmation receipt
      const receipt = await txResponse.wait();
      console.log("Transaction successfully written to block storage:", receipt.hash);

      return { 
        status: "Success", 
        data: receipt.hash, 
        summary: `Purchase successful! Config [${configurationSummary}] verified in block footprint.` 
      };
    }

    signer = null;

  } catch (error) {
    console.error("Backend Contract Call Error:", error);
    return { status: "Error", error: error.message };
  }
});