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
      nodeIntegration: true,
      contextIsolation: false
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
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, rpcProvider);
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

      const receipt = await rpcProvider.getTransactionReceipt(transactionHash);
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
      if (!cryptoAuth || Object.keys(cryptoAuth).length === 0) {
        return { status: "Error", error: "Authentication credentials missing for state changes." };
      }

      // 1. Initialize signer identity context from payload profile
      let signer;
      if (cryptoAuth.authMethod === 'privateKey') {
        signer = new ethers.Wallet(cryptoAuth.privateKey, provider);
      } else if (cryptoAuth.authMethod === 'mnemonic') {
        signer = ethers.Wallet.fromPhrase(cryptoAuth.mnemonicPhrase, provider);
      } else if (cryptoAuth.authMethod === 'keystore') {
        signer = await ethers.Wallet.fromEncryptedJson(cryptoAuth.keystoreJson, cryptoAuth.keystorePassword);
        signer = signer.connect(provider);
      } else {
        return { status: "Error", error: "Unsupported transaction signing key type." };
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

  } catch (error) {
    console.error("Backend Contract Call Error:", error);
    return { status: "Error", error: error.message };
  }
});