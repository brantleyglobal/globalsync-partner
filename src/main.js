const { app, BrowserWindow, ipcMain, Menu, Tray, shell, dialog, nativeImage } = require('electron');
// Catch unhandled sync exceptions
process.on('uncaughtException', (error) => {
  dialog.showErrorBox('Main Process Crash', error.stack || error.message);
});

const fs = require('fs');

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
  "function purchase(address buyer, address stable, uint256 productId, uint256 amount, uint256 shipping, uint256 customizations, bytes32 configs, uint256 quantity, uint256 rate, address affiliate, uint256 commission, uint256 region, bytes32 depositHash, uint256 purchaseTimeStamp) external",
  "function acquisition(address user, address token, uint256 amountin, uint256 amountout, uint256 rate, uint256 currentTxTime, bytes32 depositHash) external nonReentrant",
  "function liquidate(address payoutToken, uint256 amount, uint256 timeStamp) external",
  "function deposit(uint256 timeStamp, address investor, address token, uint256 amount, uint256 committedQuarters, uint256 incomingRate, bytes32 depositHash) external payable",
  "function deposit(uint256 timeStamp, address user, address token, address venture, uint256 amount, uint256 incomingRate, bytes32 depositHash) external payable",
  "function withdraw(address dividendTokenOrVenture, address payToken, uint256 holderBalance, uint256 timeStamp) external payable"
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

  const iconPath = path.join(__dirname, 'assets', `logo${iconExtension}`);
  const splashImgPath = path.join(__dirname, 'assets', 'logo.png');
  
  // 1. CREATE A SLEEK, FRAMELESS SPLASH WINDOW
  const splash = new BrowserWindow({
    width: 400,
    height: 400,
    frame: false,          // Removes the top window bar (close/minimize buttons)
    transparent: true,      // Allows transparent logos if your PNG has no background
    alwaysOnTop: true,      // Keeps it visible while the app boots up
    resizable: false,
    icon: iconPath,
    webPreferences: {
      webSecurity: false
    }
  });

  // Load a simple HTML string containing your image directly into the splash window
  // (Using a regular <img> tag pointing directly to your local logo file)
  splash.loadURL(`data:text/html;charset=utf-8,
    <html style="margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;">
      <body style="margin: 0; background: transparent; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">
        <img src="file://${splashImgPath.replace(/\\/g, '/')}" style="width: 80%; height: auto; object-fit: contain;" />
      </body>
    </html>
  `);

  // 2. INITIALIZE YOUR MAIN WINDOW (Keep it completely hidden)
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath, 
    show: false, // Hidden in memory
    backgroundColor: '#000000', 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // 3. THE SWAP: When the main page is ready, kill the splash and show the app
  win.once('ready-to-show', () => {
    setTimeout(() => {
      splash.destroy(); // Closes the logo window safely
      win.show();       // Opens your app layout seamlessly
    }, 800); // Optional 800ms fade/hold cushion so the logo doesn't disappear too fast
  });

  // --- Keep all your existing navigation handlers exactly as they are ---
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault(); 
      shell.openExternal(url); 
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
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
ipcMain.handle('secure-save-credentials', async (event, ...args) => {
  try {
    // ELECTRON PARAMETER UNPACKING
    // This safely extracts your variables regardless of how your preload bridge forwards them
    let address, method, secret, password;

    if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      // If the frontend sent a single wrapped object: { address: '...', ... }
      address = args[0].address;
      method = args[0].method;
      secret = args[0].secret;
      password = args[0].password;
    } else {
      // If the frontend sent flat, separate arguments: 'addr', 'meth', 'sec', 'pass'
      address = args[0];
      method = args[1];
      secret = args[2];
      password = args[3];
    }

    // 1. INTERCEPT STANDALONE FILE SELECTION CALLS IMMEDIATELY
    if (secret === 'TRIGGER_OS_FILE_PICKER') {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        // Completely removed the strict filters array to allow all file extensions (*.*)
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "File selection canceled." };
      }

      // Read file content from any location on the CPU directly into RAM
      const fileContent = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { success: true, content: fileContent };
    }

    // 2. YOUR ORIGINAL SECURE RAM STORAGE ENGINE
    if (!address || !secret) {
      throw new Error("Critical Exception: Missing address or secret credentials.");
    }

    activeAdminSession = {
      isConnected: true,
      address,
      method,
      secret,    
      password   
    };

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

ipcMain.handle('blockchain:swap-registry', async (event, payload) => {

  const REGISTRY_ABI = [
    "function swapRegistry(address) external view returns (address swapAddress, address partyA, address partyB, address tokenA, address tokenB, uint256 amountA, uint256 amountB, uint8 status)",
    "function getSwapsForUser(address user) external view returns (address[] memory)",
    "function createNewSwap(address partyA, address partyB, address tokenA, uint256 amountA, bytes32 partyADepositHash, address tokenB, uint256 amountB, bytes32 partyBDepositHash) external returns (address)",
    "function deposit(address swapAddress, address party, bytes32 depositHash) external",
    "function refund(address swapAddress, address party, bytes32 refundHash) external",
    "function markPartyAPayoutCompleted(address swapAddress) external",
    "function markPartyBPayoutCompleted(address swapAddress) external"
  ];

  const CLONE_INSTANCE_ABI = [
    "function partyADeposited() external view returns (bool)",
    "function partyBDeposited() external view returns (bool)",
    "function payoutACompleted() external view returns (bool)",
    "function payoutBCompleted() external view returns (bool)"
  ];

  const REGISTRY_STATUS_LABELS = {
    0: "PendingDeposits", 1: "PartyADeposited", 2: "PartyBDeposited", 3: "Completed",
    4: "PartyAPayoutDone", 5: "PartyBPayoutDone", 6: "FullySettled",
    7: "PartyARefunded", 8: "PartyBRefunded", 9: "FullyRefunded"
  };

  try {
    const { action, contractAddress, userAddress } = payload;

    // --- SUB-ROUTINE 1: FETCH HISTORY ---
    if (action === "GET_HISTORY") {
      const registryContract = new ethers.Contract(contractAddress, REGISTRY_ABI, providers.globalChain);
      const cloneAddresses = await registryContract.getSwapsForUser(userAddress);
      const historyRecords = [];

      for (let i = 0; i < cloneAddresses.length; i++) {
        const swapAddr = cloneAddresses[i];
        const structDetails = await registryContract.swapRegistry(swapAddr);
        
        // Inspect individual lifecycle flags inside the unique instance clone
        const instanceContract = new ethers.Contract(swapAddr, CLONE_INSTANCE_ABI, providers.globalChain);
        let partyAClosed = false;
        let partyBClosed = false;

        try {
          const [pA_Done, pB_Done, pA_Dep, pB_Dep] = await Promise.all([
            instanceContract.payoutACompleted(),
            instanceContract.payoutBCompleted(),
            instanceContract.partyADeposited(),
            instanceContract.partyBDeposited()
          ]);
          partyAClosed = pA_Done || pA_Dep;
          partyBClosed = pB_Done || pB_Dep;
        } catch (err) {
          // Fallback if the clone instance is uninitialized or empty
        }

        const tokenAMatch = supportedTokens.find(t => t.address.toLowerCase() === structDetails.tokenA.toLowerCase());
        const tokenBMatch = supportedTokens.find(t => t.address.toLowerCase() === structDetails.tokenB.toLowerCase());

        // Push the cleaned record directly to the frontend array
        historyRecords.push({
          id: `${swapAddr}-${i}`,
          cloneAddress: swapAddr,
          partyA: structDetails.partyA,
          partyB: structDetails.partyB,
          tokenA: structDetails.tokenA,
          tokenB: structDetails.tokenB,
          amountA: structDetails.amountA.toString(), 
          amountB: structDetails.amountB.toString(),
          status: Number(structDetails.status),
          statusLabel: REGISTRY_STATUS_LABELS[Number(structDetails.status)] || "Unknown",
          partyAClosed,
          partyBClosed,
          
          // If found in your array, use its true symbol. Otherwise, fall back gracefully.
          symbolA: tokenAMatch ? tokenAMatch.symbol : "UNKNOWN",
          symbolB: tokenBMatch ? tokenBMatch.symbol : "UNKNOWN"
        });
      }
      return { success: true, data: historyRecords };
    }

    // --- PROTECTED ADMIN ROUTINES ---
    // Enforce active wallet validation matching your system's design
    if (!activeAdminSession || !activeAdminSession.isConnected) {
      return { success: false, error: "Session missing. Please re-authenticate your admin wallet credentials." };
    }
    const adminSigner = new ethers.Wallet(activeAdminSession.secret, providers.globalChain);
    const registryContract = new ethers.Contract(contractAddress, REGISTRY_ABI, adminSigner);
    const sheild = new ethers.Contract(deployments.GlobalSheild, REGISTRY_ABI, adminSigner);
    const ts = Math.floor(Date.now() / 1000);

    // --- SUB-ROUTINE 2: DEPLOY NEW ESCROW ---
    if (action === "CREATE_SWAP") {
      const tx = await registryContract.createSwap(
        payload.partyA,
        payload.partyB,
        payload.tokenA,
        payload.amountA, 
        payload.partyADepositHash,
        payload.tokenB,
        payload.amountB,
        payload.partyBDepositHash,
        ts
      );
      const receipt = await tx.wait(1);
      return { success: true, txHash: receipt.hash };
    }

    // --- SUB-ROUTINE 3: DEPOSIT STEP ---
    if (action === "DEPOSIT") {
      const tx = await sheild.deposit(payload.targetSwapAddress, userAddress, payload.clearingHash, ts);
      const receipt = await tx.wait(1);
      return { success: true, txHash: receipt.hash };
    }

    // --- SUB-ROUTINE 4: REFUND STEP ---
    if (action === "REFUND") {
      const tx = await sheild.refund(payload.targetSwapAddress, userAddress, payload.clearingHash);
      const receipt = await tx.wait(1);
      return { success: true, txHash: receipt.hash };
    }

    return { success: false, error: `Action variants matching request [${action}] unmapped.` };

  } catch (error) {
    console.error("Custom swap registry handler threw execution exception:", error);
    return { success: false, error: error.reason || error.message };
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
  purchaseContractAddress,
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
      "function getUserDeposit(address user) view returns (tuple(uint256 timestamp, uint256 amountin, uint256 amountout, uint256 rate, address user, address token, address dividend, uint256 quartersCommitted, uint256 startQuarter, uint256 key, bytes32 depositTxHash, bytes32 refundHash, bool refund)[])",
      "function getUserWithdrawals(address user) view returns (tuple(address user, address dividendToken, address[7] payToken, uint256 quartersCommitted, uint256 startQuarter, uint256 unlockQuarter, uint256 stage, bool autoPay, uint256 userDividendAmount, uint256[7] termSupplyPerStage, uint256[7] poolBalancePerStage, address[7] payoutSetter, uint256[7] amountout, bytes32[7] payoutTxHash)[])",
    ];

    // 3. Explicit Venture Contract ABI Specs (Array boundaries explicitly expanded to [39])
    const ventureAbi = [
      "function getUserTermCount(address user) view returns (uint256)",
      "function getUserDepositCount(address user) view returns (uint256)",
      "function getUserDeposit(address user) view returns (tuple(uint256 timestamp, uint256 amountin, uint256 amountout, uint256 rate, address user, address token, address venture, bytes32 depositTxHash, bytes32 refundHash, bool refund)[])",
      "function getUserWithdrawals(address user) view returns (tuple(address user, address ventureToken, address[39] payToken, uint256 quartersCommitted, uint256 startQuarter, uint256 unlockQuarter, uint256 redemptionPeriod, uint256 stage, bool autoPay, uint256 timestamp, uint256 userDividendAmount, uint256 termTotalSupply, address[39] payoutSetter, uint256[39] principalSlice, uint256[39] amountout, bytes32[39] payoutTxHash)[])",
    ];

    const purchaseAbi = [
      "function getUserTermCount(address user) view returns (uint256)",
      "function getUserPurchases(address user) view returns (tuple(address user, address token, address purchaseSetter, address refundSetter, uint256 region, uint256 purchaseIndex, uint256 quantity, uint256 id, uint256 timestamp, uint256 amount, uint256 shipping, uint256 customizations, uint256 rate, bool refund, bytes32 purchaseTxHash, bytes32 refundHash, bytes32 configs)[] memory)"
    ];

    const matrixContract = new ethers.Contract(matrixContractAddress, matrixAbi, providers.globalChain);
    const purchaseContract = purchaseContractAddress ? new ethers.Contract(purchaseContractAddress, purchaseAbi, providers.globalChain) : null;
    const vaultContract = vaultContractAddress ? new ethers.Contract(vaultContractAddress, vaultAbi, providers.globalChain) : null;
    const ventureContract = ventureContractAddress ? new ethers.Contract(ventureContractAddress, ventureAbi, providers.globalChain) : null;

    // --- EXECUTION PASS 1: CORE SUMMARIES & POOL COUNTERS ---
    const [
      userOverviews,
      purchaseTermCount,
      PurchasesRaw,
      vaultDepositCount,
      vaultTermCount,
      vaultDeposits,
      vaultWithdrawals,
      ventureDepositCount,
      ventureTermCount,
      ventureDeposits,
      ventureWithdrawals
    ] = await Promise.all([
      matrixContract.getUserOverview(userAddress),
      purchaseContract ? purchaseContract.getUserTermCount(userAddress) : Promise.resolve(0n),
      purchaseContract ? purchaseContract.getUserPurchases(userAddress).catch(() => []) : Promise.resolve([]),
      vaultContract ? vaultContract.getUserDepositCount(userAddress) : Promise.resolve(0n),
      vaultContract ? vaultContract.getUserTermCount(userAddress) : Promise.resolve(0n),
      vaultContract ? vaultContract.getUserDeposit(userAddress).catch(() => []) : Promise.resolve([]),
      vaultContract ? vaultContract.getUserWithdrawals(userAddress).catch(() => []) : Promise.resolve([]),
      ventureContract ? ventureContract.getUserDepositCount(userAddress) : Promise.resolve(0n),
      ventureContract ? ventureContract.getUserTermCount(userAddress) : Promise.resolve(0n),
      ventureContract ? ventureContract.getUserDeposit(userAddress).catch(() => []) : Promise.resolve([]),
      ventureContract ? ventureContract.getUserWithdrawals(userAddress).catch(() => []) : Promise.resolve([])
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
      user: d.user, token: d.token, venture: d.ventureToken, depositTxHash: d.depositTxHash, refundHash: d.refundHash, refund: d.refund
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
        deposits: mapVaultDeposits(vaultDepositsRaw),
        withdrawals: mapVaultWithdrawals(vaultWithdrawalsRaw)
      },
      ventureStats: {
        deposits: mapVentureDeposits(ventureDepositsRaw),
        withdrawals: mapVentureWithdrawals(ventureWithdrawalsRaw)
      },
      purchaseStats: {
        purchases: mapPurchases(PurchasesRaw),
      }
    };

  } catch (error) {
    console.error("Backend dual-ABI portfolio serialization processing crashed:", error);
    throw error;
  }
});

ipcMain.handle('submitDeposit', async (event, payload) => {
  const provider = providers.globalChain;

  // Wallet profile state validation matching core system guidelines
  if (!activeAdminSession || !activeAdminSession.isConnected) {
    return { status: "Error", error: "No active admin wallet profile loaded in session memory." };
  }

  let signer;
  try {
    if (activeAdminSession.method === 'privateKey') {
      signer = new ethers.Wallet(activeAdminSession.secret, provider);
    } else if (activeAdminSession.method === 'mnemonic') {
      signer = ethers.Wallet.fromPhrase(activeAdminSession.secret, provider);
    } else if (activeAdminSession.method === 'keystore') {
      let rawJson = activeAdminSession.secret;
      const pass = activeAdminSession.password || "";
      signer = await ethers.Wallet.fromEncryptedJson(rawJson, pass);
      signer = signer.connect(provider);
    } else {
      return { status: "Error", error: "Unsupported structural signing key type." };
    }
  } catch (err) {
    console.error("Failed to build signer from memory session:", err);
    return { status: "Error", error: `Signer hydration failed: ${err.message}` };
  }

  // Bind execution client configuration deployment target
  // Ensure deployments.AcquisitionGateway or deployments.VaultManager target maps appropriately here
  const targetContractAddress = deployments.GlobalSheild; 
  console.log(`Executing Deposit execution vector utilizing signer: ${signer.address}`);
  const mainContract = new ethers.Contract(targetContractAddress, CONTRACT_ABI, signer);

  try {
    const {
      depositType,         // "SMART_VAULT" || "VENTURE_VAULT"
      timeStamp,           // Passed from view layer runtime block
      userAddress,         // Wallet address of target client user
      tokenAddress,        // Input asset address
      ventureAddress,      // Target Venture Node contract address (Venture Only)
      amountIn,            // Raw or parsed user amount string
      committedQuarters,   // Lock duration parameter (Smart Vault Only)
      incomingRate         // Calculated conversion exchange rate mapping value
    } = payload;

    // Secure string parsing to BigInt (assuming standard 18 decimal formatting assets)
    const parsedAmount = ethers.parseUnits(amountIn.toString(), 18);
    const parsedRate = ethers.parseUnits(incomingRate.toString(), 18);
    const formattedHash = payload.depositHash.startsWith("0x") ? payload.depositHash : `0x${payload.depositHash}`;

    let tx;

    if (depositType === "SMART_VAULT") {
      console.log(`[Electron Backend] Executing Smart Vault Deposit for user: ${userAddress}`);
      const parsedQuarters = BigInt(committedQuarters || 0);

      // Invoke overloaded Smart Vault layout function explicitly
      const depositFn = mainContract["vaultDeposit(uint256,address,address,uint256,uint256,uint256,bytes32)"];
      const tx1 = await mainContract.ventureDeposit(
        payload.timeStamp,
        payload.user,
        payload.token,
        payload.venture,
        payload.amount,
        payload.incomingRate,
        payload.depositHash
      );
    } else {
      console.log(`[Electron Backend] Executing Venture Vault Deposit for user: ${userAddress}`);
      
      // Invoke overloaded Venture Vault layout function explicitly
      const depositFn = mainContract["ventureDeposit(uint256,address,address,address,uint256,uint256,bytes32)"];
      const tx2 = await mainContract.vaultDeposit(
        payload.timeStamp,
        payload.investor,
        payload.token,
        payload.amount,
        payload.committedQuarters,
        payload.incomingRate,
        payload.depositHash
      );
    }

    console.log(`[Deposit Transaction Broadcasted] Hash: ${tx.hash}`);
    const receipt = await tx.wait();

    return { success: true, txHash: receipt.hash };

  } catch (error) {
    console.error("[Electron Backend] Deposit Node Failure:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('submitWithdrawal', async (event, payload) => {
  const provider = providers.globalChain;

  if (!activeAdminSession || !activeAdminSession.isConnected) {
    return { status: "Error", error: "No active admin wallet profile loaded in session memory." };
  }

  let signer;
  try {
    if (activeAdminSession.method === 'privateKey') {
      signer = new ethers.Wallet(activeAdminSession.secret, provider);
    } else if (activeAdminSession.method === 'mnemonic') {
      signer = ethers.Wallet.fromPhrase(activeAdminSession.secret, provider);
    } else if (activeAdminSession.method === 'keystore') {
      let rawJson = activeAdminSession.secret;
      const pass = activeAdminSession.password || "";
      signer = await ethers.Wallet.fromEncryptedJson(rawJson, pass);
      signer = signer.connect(provider);
    } else {
      return { status: "Error", error: "Unsupported structural signing key type." };
    }
  } catch (err) {
    console.error("Failed to build signer from memory session:", err);
    return { status: "Error", error: `Signer hydration failed: ${err.message}` };
  }

  const targetContractAddress = deployments.GlobalSheild;
  console.log(`Executing Withdrawal execution vector utilizing signer: ${signer.address}`);
  const mainContract = new ethers.Contract(targetContractAddress, CONTRACT_ABI, signer);

  try {
    const {
      targetAddress,       // maps dynamically to dividendToken or venture address
      payToken,            // token payout channel address
      holderBalance,       // raw validation asset account metrics string
      timeStamp            // action transaction execution time tracker log
    } = payload;

    console.log(`[Electron Backend] Routing withdrawal settlement request targeting node ${targetAddress}...`);

    const parsedBalance = ethers.parseUnits(holderBalance.toString(), 18);

    // Dynamic execution of universal matching function template
    // Signature: withdraw(address,address,uint256,uint256)
    const tx = await mainContract.withdraw(
      targetAddress,
      payToken,
      parsedBalance,
      BigInt(timeStamp)
    );

    console.log(`[Withdrawal Transaction Broadcasted] Hash: ${tx.hash}`);
    const receipt = await tx.wait();

    return { success: true, txHash: receipt.hash };

  } catch (error) {
    console.error("[Electron Backend] Withdrawal Node Failure:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('submit-acquisition', async (event, payload) => {

  const provider = providers.globalChain;

  // 1. Check RAM memory instead of the hard drive file
  if (!activeAdminSession || !activeAdminSession.isConnected) {
    return { status: "Error", error: "No active admin wallet profile loaded in session memory." };
  }

  let signer;

  try {
    // 2. Read the secret directly out of your activeAdminSession RAM variable
    if (activeAdminSession.method === 'privateKey') {
      signer = new ethers.Wallet(activeAdminSession.secret, provider);

    } else if (activeAdminSession.method === 'mnemonic') {
      signer = ethers.Wallet.fromPhrase(activeAdminSession.secret, provider);

    } else if (activeAdminSession.method === 'keystore') {
      // If it's a keystore file, read the secret string and the password from RAM
      let rawJson = activeAdminSession.secret;
      const pass = activeAdminSession.password || "";
      
      signer = await ethers.Wallet.fromEncryptedJson(rawJson, pass);
      signer = signer.connect(provider);

    } else {
      return { status: "Error", error: "Unsupported structural signing key type." };
    }

  } catch (err) {
    console.error("Failed to build signer from memory session:", err);
    return { status: "Error", error: `Signer hydration failed: ${err.message}` };
  }

  console.log(`Executing contract state modification using signer: ${signer.address}`);
  const mainContract = new ethers.Contract(deployments.GlobalSheild, CONTRACT_ABI, signer);

  try {
    const { 
      userAddress,    // Web3 address of target user
      tokenAddress,   // Address of inbound deposit token (e.g., WETH, USDC)
      amountIn,       // Raw stablecoin/deposit amount from user 
      amountOut,      // Calculated GBDo value to mint/distribute
      exchangeRate,   // Current system conversion rate metrics
      depositHash     // Unique hash identifier for deduplication check
    } = payload;

    console.log(`[Electron Backend] Initiating acquisition rule for user ${userAddress}...`);

    // Parse values securely into BigInt representation (assuming 18 decimal assets)
    const parsedAmountIn = ethers.parseUnits(amountIn.toString(), 18);
    const parsedAmountOut = ethers.parseUnits(amountOut.toString(), 18);
    const parsedRate = ethers.parseUnits(exchangeRate.toString(), 18);
    const currentTxTime = Math.floor(Date.now() / 1000);

    // Call your exact contract function layout natively
    const tx = await mainContract.acquisition(
      userAddress,
      tokenAddress,
      parsedAmountIn,
      parsedAmountOut,
      parsedRate,
      currentTxTime,
      depositHash
    );

    console.log(`[Transaction Broadcasted] Hash: ${tx.hash}`);
    const receipt = await tx.wait(); // Wait for block confirmation

    return { success: true, txHash: receipt.hash };

  } catch (error) {
    console.error("[Electron Backend] Acquisition Transaction Failure:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('submit-user-liquidate', async (event, payload) => {

  const provider = providers.globalChain;

  // 1. Check RAM memory instead of the hard drive file
  if (!activeAdminSession || !activeAdminSession.isConnected) {
    return { status: "Error", error: "No active admin wallet profile loaded in session memory." };
  }

  let signer;

  try {
    // 2. Read the secret directly out of your activeAdminSession RAM variable
    if (activeAdminSession.method === 'privateKey') {
      signer = new ethers.Wallet(activeAdminSession.secret, provider);

    } else if (activeAdminSession.method === 'mnemonic') {
      signer = ethers.Wallet.fromPhrase(activeAdminSession.secret, provider);

    } else if (activeAdminSession.method === 'keystore') {
      // If it's a keystore file, read the secret string and the password from RAM
      let rawJson = activeAdminSession.secret;
      const pass = activeAdminSession.password || "";
      
      signer = await ethers.Wallet.fromEncryptedJson(rawJson, pass);
      signer = signer.connect(provider);

    } else {
      return { status: "Error", error: "Unsupported structural signing key type." };
    }

  } catch (err) {
    console.error("Failed to build signer from memory session:", err);
    return { status: "Error", error: `Signer hydration failed: ${err.message}` };
  }

  console.log(`Executing contract state modification using signer: ${signer.address}`);
  const mainContract = new ethers.Contract(deployments.AcquisitionGateway, contractABI, signer);

  try {
    const { payoutTokenAddress, amountToCashOut } = payload;
    const timeStamp = Math.floor(Date.now() / 1000);

    // Parse user numeric parameters securely
    const parsedAmount = ethers.parseUnits(amountToCashOut.toString(), 18);

    console.log(`[Electron Backend] Processing public liquidation queue for ${amountToCashOut} tokens...`);

    // Sends the transaction directly to your liquidated code block structure
    const tx = await mainContract.liquidate(
      payoutTokenAddress,
      parsedAmount,
      timeStamp
    );

    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };

  } catch (error) {
    console.error("[Electron Backend] User Liquidation Submission Failure:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-native-exchange-history', async (event, { userAddress }) => {
  try {
    const provider = providers.globalChain;
    // We instantiate a generic provider read-only instance to maximize speed and bypass wallet locks
    const readContract = new ethers.Contract(deployments.AcquisitionGateway, CONTRACT_ABI, provider);

    console.log(`[Electron Backend] Compiling exchange history for user: ${userAddress}`);

    // 1. Fetch total transactions logged under the user profile
    const totalTermsBigInt = await readContract.getUserTermCount(userAddress);
    const totalTerms = Number(totalTermsBigInt);

    const historyRecords = [];

    // 2. Loop through tracking slots cleanly via open index view lookups
    for (let i = 0; i < totalTerms; i++) {
      const p = await readContract.getUserTerm(userAddress, i);

      // Map raw blockchain struct arrays into clean native JS data objects
      historyRecords.push({
        timestamp: Number(p.timestamp),
        user: p.user,
        token: p.token,
        payoutSetter: p.payoutSetter,
        refundSetter: p.refundSetter,
        termIndex: Number(p.termIndex),
        amountin: p.amountin.toString(),        // Lowercase to match your struct exactly
        amountout: p.amountout.toString(),      // Lowercase to match your struct exactly
        exchangeRate: p.exchangeRate.toString(),
        purchaseTxHash: p.purchaseTxHash,
        payoutTxHash: p.payoutTxHash,
        refundHash: p.refundHash,
        refund: p.refund,
        credit: p.credit
      });
    }

    // Sort records sequentially (most recent transactions show first)
    return { 
      success: true, 
      records: historyRecords.sort((a, b) => b.timestamp - a.timestamp) 
    };

  } catch (error) {
    console.error("[Electron Backend] Failed to recompile user exchange records:", error);
    return { success: false, error: error.message, records: [] };
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

      // 1. Check RAM memory instead of the hard drive file
      if (!activeAdminSession || !activeAdminSession.isConnected) {
        return { status: "Error", error: "No active admin wallet profile loaded in session memory." };
      }

      let signer;

      try {
        // 2. Read the secret directly out of your activeAdminSession RAM variable
        if (activeAdminSession.method === 'privateKey') {
          signer = new ethers.Wallet(activeAdminSession.secret, provider);

        } else if (activeAdminSession.method === 'mnemonic') {
          signer = ethers.Wallet.fromPhrase(activeAdminSession.secret, provider);

        } else if (activeAdminSession.method === 'keystore') {
          // If it's a keystore file, read the secret string and the password from RAM
          let rawJson = activeAdminSession.secret;
          const pass = activeAdminSession.password || "";
          
          signer = await ethers.Wallet.fromEncryptedJson(rawJson, pass);
          signer = signer.connect(provider);

        } else {
          return { status: "Error", error: "Unsupported structural signing key type." };
        }

      } catch (err) {
        console.error("Failed to build signer from memory session:", err);
        return { status: "Error", error: `Signer hydration failed: ${err.message}` };
      }

      console.log(`Executing contract state modification using signer: ${signer.address}`);
      const writeableContract = new ethers.Contract(deployments.GlobalSheild, CONTRACT_ABI, signer);

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