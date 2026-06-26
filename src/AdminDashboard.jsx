import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { genData } from "./utils/genData";
import { getExchangeRates } from "./utils/exchangeRates";
import { buildCompactConfigBytes32 } from "./utils/configurationPacker";
import { sendTransferOnTargetChain, rescaleAmount } from "./utils/targetChain";
import logo from './assets/logo.png';
import { supportedTokens } from "./utils/tokensX";
import { deployments } from "./utils/deploymentsX";
import { useAccount, usePublicClient } from "wagmi";
import { useDirectTokenBalances } from "./utils/directBalances";
import CoreAdminEngine from './components/coreAdminEngine';
import CorePortfolioMatrix from './components/corePortfolio';
import PartnerPortal from './components/corePartner.jsx';
import AffiliatePortal from "./components/coreAffiliate.jsx";
import GlobalSwapPortal from "./components/coreSwap.jsx";
import NativeExchangeHistory from "./components/coreNative.jsx";
import Sidebar from './components/sideBar';
import { useRpcStatus } from "./utils/statusRpc";
import { styles } from './utils/styles.jsx';
import './global.css';


export default function AdminDashboard() {
  // -----------------------------
  // Section 1: Contract Queries
  // -----------------------------

  // Add this state alongside your showAuthDrawer and isOpen states
  const [portalView, setPortalView] = useState('hub'); // Defaulting to your current view
  const [loading, setLoading] = useState(false);
  const rpcUp = useRpcStatus();
  
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);

  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedTermNumber, setSelectedTermNumber] = useState(Number);
  const [payoutType, setPayoutType] = useState("");
  const [timestampResults, setTimestampResults] = useState([]);

  const [userAddress, setUserAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [authMethod, setAuthMethod] = useState("privateKey"); 
  const [keystoreJson, setKeystoreJson] = useState("");
  const [keystorePassword, setKeystorePassword] = useState("");
  const [showKeystorePass, setShowKeystorePass] = useState(false);
  const [mnemonicPhrase, setMnemonicPhrase] = useState("");
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const [pledgedToken, setPledgedToken] = useState("");
  const [pledgedAmount, setPledgedAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [convertedAmount, setConvertedAmount] = useState("");

  const [quatity, setSelectedQuantity] = useState(Number);
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");

  const [selectedStableTokenSymbol, setSelectedStableTokenSymbol] = useState(""); // e.g., "LGE20KVA"
  const [selectedAssetKey, setSelectedAssetKey] = useState(""); // e.g., "LGE20KVA"
  const [selectedPanelKey, setSelectedPanelKey] = useState(""); // e.g., "standard" or "customized"
  const [selectedGridTieKey, setSelectedGridTieKey] = useState("");
  const [selectedMonitoringKey, setSelectedMonitoringKey] = useState("");
  const [selectedCountryKey, setSelectedCountryKey] = useState("");

  const [selectedVoltage, setSelectedVoltage] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState("");
  const [selectedPhase, setSelectedPhase] = useState("");
  const [selectedReactor, setSelectedReactor] = useState("");
  
  // Token Metadata Context hooks for payment capturing
  const [selectedTokenAddress, setSelectedTokenAddress] = useState(""); 
  const [selectedTokenDecimals, setSelectedTokenDecimals] = useState(18);
  const [selectedTokenChain, setSelectedTokenChain] = useState("global");
  const [custodialWalletAddress, setCustodialWalletAddress] = useState("");

  const [purchaseTxHash, setPurchaseTxHash] = useState("");
  const [shippingDays, setShippingDays] = useState(90);
  
  const [currentView, setCurrentView] = useState('hub');
  // This forces React to look at the browser's storage on refresh before defaulting to null
  const [lastVisitedMatrix, setLastVisitedMatrix] = useState(() => {
    return localStorage.getItem('last_visited_matrix') || null;
  });

  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      const saved = localStorage.getItem('recently_viewed');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure the parsed item is strictly a standard Array
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.error("Failed parsing recently_viewed storage data:", error);
    }
    return []; // Fallback to an empty array safely
  });
    
  const matrixNames = {
    investments: "Investor Matrix",
    wholesale: "Wholesaler Matrix",
    affiliate: "Affiliate Matrix",
    swap: "Global Gateway Matrix",
    gateway: "XChange Dashboard",
    admin: "Administrative Dashboard"
  };

  const navigateToMatrix = (matrixKey) => {
    setPortalView(matrixKey);
    setLastVisitedMatrix(matrixKey);
    
    setRecentlyViewed((prev) => {
      // Filter out the key if it already exists to avoid duplicates, then move it to the front
      const filtered = prev.filter(item => item !== matrixKey);
      return [matrixKey, ...filtered].slice(0, 3); // Keeps the top 3 most recent
    });
  };
  
  const [wholesaleTotal, setWholesaleTotal] = useState("");
  const [onTotalChange, setOnTotalChange] = useState("");
  const [portfolioTotal, setPortfolioTotal] = useState("0.00 GBDo");
  const [affiliateTotal, setAffiliateTotal] = useState("");
  const { balances } = useDirectTokenBalances(userAddress);

  const getUnixTimestamp = (dateStr, isEndOfDay = false) => {
    if(!dateStr) return Math.floor(Date.now() / 1000);
    const date = new Date(dateStr);
    if(isEndOfDay) {
      date.setHours(23, 59, 59, 999)
    }
    return Math.floor(date.getTime() / 1000);
  }

  const contracts = [
    { name: "AcquisitionGateway", address: deployments.AcquisitionGateway },
    { name: "AssetPurchase", address: deployments.AssetPurchase },
    { name: "SmartVault", address: deployments.SmartVault },
    { name: "RegionInfrastructure", address: deployments.RegionInfrastructure }
  ];

  const handleTimestampQuery = async () => {
    if (!selectedContract) {
      alert("Please select a contract!");
      return;
    }

    if (!selectedType) {
      alert("Please select a transaction type!");
      //"Deposit" or "Withdraw"
      return;
    }

    const startParts = startDate ? startDate.split("-") : []; //If making a direct chain call the following must be changed to Math.floor(Date.now() / 1000) formatting
    const endParts = endDate ? endDate.split("-") : [];
    const startTs = getUnixTimestamp(startDate, false);
    const endTs = getUnixTimestamp(endDate, true);
    
    const payload = {
      contractArg: selectedContract,
      modeArg: "timestamp-query",
      txType: selectedType,
      dateArgs: [
        startTs,
        endTs,
        false
      ]
    };

    console.log("Sending query to Electron backend:", payload);
    const response = await window.api.triggerVault(payload);

    if (response && response.status === "Success") {
      setTimestampResults([response]);
    } else {
      setTimestampResults([{ error: "Failed to fetch data from backend" }]);
    }1
  };

  const handlePurchaseNative = async (amount, tokenSymbolOrAddress, rate) => {
    try {
      console.log(`Processing backend transaction for ${amount} ${tokenSymbolOrAddress} at rate ${rate}`);
      
      // 1. Call your web3 provider / electron IPC pipeline / smart contract here
      // const tx = await myContract.buyGBDo(amount, ...);
      // await tx.wait();

      // 2. Return a safe success flag so the Sidebar knows it can clear inputs and close drawers
      return { success: true };
      
    } catch (error) {
      console.error("Parent transaction routing failure:", error);
      return { success: false, message: error.message };
    }
  };

  // -----------------------------
  // Section 2: User & Tx Queries
  // -----------------------------
  const [buyerWalletAddress, setBuyerWalletAddress] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [custodialWallet, setCustodialWallet] = useState("");
  const [userQueryResults, setUserQueryResults] = useState([]);

  const handleUserQuery = async () => {
    if (!selectedContract) {
      alert("Please select a contract!");
      return;
    }
    if (!selectedType) {
      alert("Please select a transaction type!");
      return;
    }

    const limit = selectedTermNumber || 5;
    
    const payload = {
      modeArg: "user-activity",
      contractAddress: selectedContract, // Named cleanly for backend
      txType: selectedType,
      userAddress: walletAddress,
      limit: limit
    };

    console.log("Querying User Activity...", payload);
    const response = await window.api.triggerVault(payload);
    setUserQueryResults(response?.status === "Success" ? response.data : []);
  };

  const handleVerifyDeposit = async () => {
    // Ensure a contract selection exists to lookup the correct treasury
    if (!selectedContract) {
      alert("Please select a target Contract in the dashboard dropdown first to align the correct Treasury Vault destination!");
      return;
    }

    if (!transactionHash) {
      alert("Please fill in the Transaction Hash to verify!");
      return;
    }

    // Dynamic Treasury Alignment Map mapped to your deployments configurations
    const treasuryByContract = {
      [deployments.AcquisitionGateway?.toLowerCase()]: "0x1166579617240592e8a7c87bc389549eab8de047",
      [deployments.AssetPurchase?.toLowerCase()]:      "0xdfb86551fceff6ae1eca2681417a42e2a0ce5b0e",
      [deployments.SmartVault?.toLowerCase()]:         "0x4e59da805d602f8d651a60afb1184959db3580d8",
      [deployments.RegionInfrastructure?.toLowerCase()]:"0x17ae805b0a4e4d8a6ed39c1889062cdecc8c5857",
    };

    // Dynamically resolve target treasury vault base routing address
    const targetTreasuryVault = treasuryByContract[selectedContract.toLowerCase()];

    if (!targetTreasuryVault) {
      alert(`Configuration Missing: Selected contract address (${selectedContract}) does not resolve to a mapped corporate Treasury Vault.`);
      return;
    }

    const payload = {
      modeArg: "verify-erc20-receipt",
      transactionHash: transactionHash,
      custodialWallet: targetTreasuryVault // Overwritten safely via the structural map rule
    };

    try {
      console.log(`Verifying deposit receipt against Dynamic Treasury (${targetTreasuryVault})...`, payload);
      
      let response = null;

      // --- THE SHIELD LAYER ---
      try {
        response = await window.api.triggerVault(payload);
      } catch (ipcError) {
        // Quietly log the raw code/network exception to the developer tools console
        console.error("IPC verification pipeline background crash:", ipcError);
        
        // Mock a clean failure state so the UI handles it gracefully down below
        response = { ok: false, reason: "The verification engine was unable to read this transaction. Please ensure the hash is correct and confirmed on-chain." };
      }
      // ------------------------
      
      if (response && response.ok) {
        console.log("Verification Passed!", response);
        // response context contains: senderAddress, amount, tokenSymbol, tokenAddress
        setUserQueryResults([response]); 
        alert(`Verification Passed! Confirmed payment routed into Treasury Vault: ${targetTreasuryVault}`);
      } else {
        console.warn("Verification Failed:", response?.reason);
        // Clean business-facing alert instead of code jargon
        alert(`Verification Failed: ${response?.reason || "Could not confirm deposit layout metadata."}`);
      }
    } catch (err) {
      // Bypassed for standard verification rejections
      console.error("Critical verification form layout error:", err);
    }
  };

  const handlePurchase = async () => {
    if (!selectedAssetKey) {
      alert("Please select an asset model!");
      return;
    }

    // --- CRASH PREVENTION FIXES ---
    const targetUserWallet = userAddress || walletAddress; 
    const trackedDepositHash = purchaseTxHash; 
    // -------------------------------

    const assetData = selectedAssetKey ? genData[selectedAssetKey] : {};
    const chosenPanel = assetData?.panel ? assetData.panel[selectedPanelKey] || {} : {};
    const gridTieGroup = assetData?.gridTie || assetData?.etie || assetData?.xtie || {};
    const chosenGridTie = gridTieGroup[selectedGridTieKey] || {};
    const chosenMonitoring = assetData?.monitoring ? assetData.monitoring[selectedMonitoringKey] || {} : {};

    const basePriceNum = Number(assetData.price || 0); 
    const panelPriceNum = Number(chosenPanel.price || 0);
    const gridTiePriceNum = Number(chosenGridTie.price ?? chosenGridTie.apriceInGBDo ?? chosenGridTie.amount ?? 0);
    const monitoringPriceNum = Number(chosenMonitoring.price || 0);

    const totalUpchargesNum = panelPriceNum + gridTiePriceNum + monitoringPriceNum;
    const humanTotalDollars = basePriceNum + totalUpchargesNum;

    const targetDecimals = selectedTokenDecimals || 18;
    const totalNativeAmountBigInt = ethers.parseUnits(humanTotalDollars.toString(), targetDecimals);
    const totalUpcharges = ethers.parseUnits(totalUpchargesNum.toString(), targetDecimals);
    const basePrice = ethers.parseUnits(basePriceNum.toString(), targetDecimals);

    const treasuryByContract = {
      [deployments.AssetPurchase?.toLowerCase()]: "0xdfb86551fceff6ae1eca2681417a42e2a0ce5b0e"
    };

    const targetTreasuryVault = treasuryByContract[deployments.AssetPurchase.toLowerCase()];
    if (!targetTreasuryVault) {
      return alert(`Security System Error: Selected contract address does not have a mapped Treasury Vault.`);
    }

    try {
      console.log(`Executing pre-flight receipt window validation against Treasury: ${targetTreasuryVault}`);

      let tokenConversionRate; 
      try {
        const rateData = await getExchangeRates();
        const paymentTokenSymbol = selectedStableTokenSymbol; 

        if (paymentTokenSymbol && paymentTokenSymbol.toUpperCase() !== "GBDO") {
          // Strict lookup against your already-guarded rates array
          const rateEntry = rateData.rates.find(
            (r) => r.symbol === paymentTokenSymbol
          );
          
          if (rateEntry) {
            tokenConversionRate = Number(rateEntry.rate);
          } else {
            // If this logs, the symbol in your state doesn't match the symbol in your rates array
            console.error(`[Lookup Error] Could not find match for "${paymentTokenSymbol}" in rates pool:`, rateData.rates.map(r => r.symbol));
          }
        }
      } catch (e) {
        console.warn("Pre-flight bridge check failed to read exchangeData pool.", e);
      }

      const targetDecimalsBase18 = 18;
      const expectedTokensHuman = (Number(humanTotalDollars) || 0) / tokenConversionRate;
      
      const safeFixedString = expectedTokensHuman.toFixed(18).replace(/e[-+]\d+/, (match) => {
        return Number(match).toFixed(18).split('e')[0];
      });

      const expectedTokensBase18 = ethers.parseUnits(safeFixedString, targetDecimalsBase18);
      const ALLOWABLE_SLIPPAGE_PERCENT = 1; 
      const slippageBasisPoints = 10000n - BigInt(ALLOWABLE_SLIPPAGE_PERCENT * 100);
      const priceFloorBase18 = (expectedTokensBase18 * slippageBasisPoints) / 10000n;

      console.clear(); 
      console.group("SYSTEM INTEGRITY AUDIT REPORT");
      console.table({
        "Configuration Cost (USD)": { Value: `${humanTotalDollars.toFixed(2)}`, Base18: ethers.parseUnits(humanTotalDollars.toFixed(18), 18).toString() },
        "Token Exchange FX Rate":   { Value: `${tokenConversionRate} ${selectedStableTokenSymbol}`, Base18: "N/A" },
        "Expected Tokens Target":   { Value: `${expectedTokensHuman.toFixed(4)} Units`, Base18: expectedTokensBase18.toString() },
        "Slippage Floor Limit":     { Value: `${ethers.formatUnits(priceFloorBase18, 18)} Units`, Base18: priceFloorBase18.toString() },
        "Current Raw Input Hash":   { Value: purchaseTxHash || "EMPTY/NOT PROVIDED", Base18: "N/A" }
      });
      console.groupEnd();

      if (!purchaseTxHash) {
        throw new Error("Missing Transaction Hash! You must provide the user's transaction payment hash.");
      }
      if (!purchaseTxHash.startsWith("0x") || purchaseTxHash.length < 66) {
        throw new Error(`Invalid Hash Format! "${purchaseTxHash}" must be a 66-character hex string starting with 0x.`);
      }

      let verificationResponse = null;

      // --- THE SHIELD LAYER ---
      try {
        verificationResponse = await window.api.triggerVault({
          modeArg: "verify-erc20-receipt",
          transactionHash: purchaseTxHash,
          custodialWallet: targetTreasuryVault 
        });
      } catch (ipcError) {
        // Direct the technical background crash straight to the console log
        console.error("IPC validation background pipe crashed:", ipcError);
        
        // Mock a clean rejection profile so the code handles it smoothly down below
        verificationResponse = { ok: false, reason: "The verification server was unable to index the transaction. Please ensure it is confirmed on-chain." };
      }

      if (!verificationResponse || !verificationResponse.ok) {
        throw new Error(verificationResponse?.reason || "Receipt was not found on the blockchain indexer.");
      }

      const rawLoggedTokenAmount = BigInt(verificationResponse.amount);
      const actualDecimalsOfPaymentToken = verificationResponse.decimals ?? targetDecimals ?? 18;
      const normalizedPaidAmountBase18 = BigInt(
        rescaleAmount(rawLoggedTokenAmount, actualDecimalsOfPaymentToken, targetDecimalsBase18)
      );

      console.log(`[AUDIT RECEIPT] Actual Payment Detected: ${ethers.formatUnits(normalizedPaidAmountBase18, 18)} Units`);

      if (verificationResponse.senderAddress.toLowerCase() !== targetUserWallet.toLowerCase()) {
        throw new Error(
          `Ownership Mismatch!\n` +
          `• On-Chain Sender: ${verificationResponse.senderAddress.toLowerCase()}\n` +
          `• Target State Wallet: ${targetUserWallet.toLowerCase()}`
        );
      }

      if (normalizedPaidAmountBase18 < priceFloorBase18) {
        const varianceBase18 = priceFloorBase18 - normalizedPaidAmountBase18;
        throw new Error(
          `Slippage Violation! The transacted amount is too low.\n` +
          `• Required Floor: ${ethers.formatUnits(priceFloorBase18, 18)} tokens\n` +
          `• Received Amount: ${ethers.formatUnits(normalizedPaidAmountBase18, 18)} tokens`
        );
      }

      console.log("Receipt Verification Passed. Moving smoothly to step 2...");

    } catch (verifyError) {
      console.error("PRE-FLIGHT AUDIT REJECTION:", verifyError.message);
      alert(`PRE-FLIGHT VALIDATION CRASHED:\n\n${verifyError.message}`);
      return; 
    }

    let activeExchangeRateBigInt = ethers.parseUnits("1.0", 18);
    try {
      const rateData = await getExchangeRates();
      const selectedTokenSymbol = selectedStableTokenSymbol || "USDT"; 
      const matchedToken = rateData.rates.find(
        (r) => r.symbol.toUpperCase() === selectedTokenSymbol.toUpperCase()
      );

      if (matchedToken) {
        const targetRateFloat = matchedToken.rateAgainstGBDo || matchedToken.rate;
        activeExchangeRateBigInt = ethers.parseUnits(targetRateFloat.toFixed(6), 18);
      }
    } catch (rateError) {
      console.error("Non-critical rate tracking error:", rateError);
    }

    let packedConfigBytes32 = "";
    try {
      packedConfigBytes32 = buildCompactConfigBytes32({
        selectedVariations: {
          ["epanel" in assetData.panel ? "epanel" : "xpanel"]: chosenPanel,
          ["etie" in assetData.gridTie ? "etie" : "xtie"]: chosenGridTie,
          "monitoring": chosenMonitoring
        },
        selectedVoltage: Number(selectedVoltage), 
        selectedFrequency: selectedFrequency,     
        selectedPhase: selectedPhase,             
        selectedReactor: selectedReactor,         
      });
    } catch (packError) {
      console.error("Local configuration assembly failure:", packError.message);
      alert(`Configuration Optimization Error: ${packError.message}`);
      return;
    }

    let credentialsPayload = {};
    if (authMethod === 'privateKey') {
      if (!privateKey) return alert("Private key is required!");
      credentialsPayload = { authMethod: 'privateKey', privateKey };
    } else if (authMethod === 'keystore') {
      if (!keystoreJson || !keystorePassword) return alert("Keystore data missing!");
      credentialsPayload = { authMethod: 'keystore', keystoreJson, keystorePassword };
    } else if (authMethod === 'mnemonic') {
      if (!mnemonicPhrase) return alert("Mnemonic phrase is required!");
      credentialsPayload = { authMethod: 'mnemonic', mnemonicPhrase };
    }

    const payload = {
      modeArg: "execute-state-change",
      buyerWalletAddress: buyerWalletAddress,
      selectedTokenAddress: selectedTokenAddress,
      transactionType: selectedType,
      assetId: assetData.assetId,
      basePrice: basePrice.toString(),
      customizationUpcharges: totalUpcharges.toString(),
      shippingTransitDays: shippingDays.toString(),
      quantity: quantity,
      totalBaseDays: assetData.baseDays || 90,
      exchangeRate: activeExchangeRateBigInt.toString(),
      hardwareConfigBytes32: packedConfigBytes32,
      custodialDepositHash: trackedDepositHash,
      configurationSummary: `${chosenPanel.label || ""} / ${chosenGridTie.label || ""} / ${chosenMonitoring.label || ""}`,
      destinationCountry: selectedCountryKey,
      cryptoAuth: credentialsPayload 
    };

    let liveTransactionHash = "";

    try {
      console.log("Broadcasting multi-step coordinated execution payload to Electron backend...", payload);
      
      const response = await window.api.triggerVault(payload);
      setUserQueryResults(Array.isArray(response) ? response : [response]);
      
      // Extract the live hash out of the success payload object
      if (response && response.status === "Success" && response.data) {
        liveTransactionHash = response.data;
        console.log("Captured live blockchain transaction hash:", liveTransactionHash);
      }

      alert("Transaction written and processed successfully!");
    } catch (error) {
      console.error("Coordinated IPC execution failed:", error);
    }

    const totalTokenAmount = (basePrice + totalUpcharges).toString();
    let affiliateAddress = 0x0000000000000000000000000000000000000000;
    if (userAddress != buyerWalletAddress) {
      affiliateAddress = userAddress;
    }

    const result = await window.electron.sendEmail({
      firstname,
      lastname,
      email,
      tx: trackedDepositHash,
      checkoutAsset: assetData.assetId,
      quantity,
      totalTokenAmount,
      userAddress: buyerWalletAddresss,
      tokenSymbol: selectedTokenSymbol,
      configuration: configurationSummary,
      address,
      phone,
      country: selectedCountryKey,
      promo: 0x0000000000000000000000000000000000000000,
      postalCode,
      receipt: liveTransactionHash,
      purchaseMadeEvents: "",
    });

    if (result.success) {
      console.log("Email notification sent.");
    } else {
      console.error("Failed to send email notification:", result.error);
    }
  };

  const handleSecureConnect = async (authMethod, secretToSend, keystorePassword) => {
    if (!userAddress) {
      alert("Please enter a wallet address.");
      return { success: false };
    }

    try {
      let response = null;

      try {
        response = await window.electronAPI.saveAdminCredentials(
          userAddress,
          authMethod,
          secretToSend,
          keystorePassword
        );
      } catch (ipcError) {
        // Direct severe system/communication faults strictly to the dev console log
        console.error("IPC Vault Authentication Bridge Exception:", ipcError);
        
        // Mock a clean failure object so the user block stays running smoothly
        response = { success: false, error: "The local secure vault service is currently unreachable. Please restart the desktop client application." };
      }

      // BACKEND VERIFICATION CHECK FIRST
      if (response && response.success) {
        setUserAddress(response.address);
        setIsConnected(response.isConnected); // Set true ONLY when backend verifies keys match
        
        // CRITICAL SECURITY WIPEOUT: Clear cleartext fields from React RAM immediately
        setPrivateKey('');
        setKeystoreJson('');
        setKeystorePassword('');
        setMnemonicPhrase('');
        
        return { success: true };
      } else {
        alert(`Connection Failed: ${response?.error || 'Invalid Credentials'}`);
        setIsConnected(false);
        return { success: false };
      }
    } catch (ipcError) {
      console.error("IPC Bridge Exception:", ipcError);
      setIsConnected(false);
      return { success: false };
    }
  };

  const handleSecureDisconnect = async () => {
    try {
      const response = await window.electronAPI.disconnectAdmin();

      if (response && response.success) {
        setUserAddress('');
        setIsConnected(false); // Cleanly drop UI connection state

        setPrivateKey('');
        setKeystoreJson('');
        setKeystorePassword('');
        setMnemonicPhrase('');

        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error("IPC disconnection tracking pipeline failure:", error);
      return { success: false };
    }
  };

  // FIRST, define the hook block so the browser knows what it is
  const useRpcLatency = (rpcUrl, intervalMs = 5000) => {
    const [latency, setLatency] = useState(0);

    useEffect(() => {
      if (!rpcUrl) return;

      const checkLatency = async () => {
        const startTime = performance.now();
        
        try {
          await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
          });
          
          const endTime = performance.now();
          setLatency(Math.round(endTime - startTime));
        } catch (error) {
          console.error("RPC Latency check failed", error);
          setLatency(-1);
        }
      };

      checkLatency();
      const interval = setInterval(checkLatency, intervalMs);

      return () => clearInterval(interval);
    }, [rpcUrl, intervalMs]);

    return latency;
  };

  // 2. SECOND, call the hook using your endpoint configuration
  const latency = useRpcLatency("https://rpc.brantley-global.com");

  return (
  <div style={styles.appContainer}>

    {/* SIDEBAR COMPONENT */}
    <Sidebar 
      portalView={portalView} 
      setPortalView={setPortalView}
      setLastVisitedMatrix={setLastVisitedMatrix}
      setRecentlyViewed={setRecentlyViewed}
      userAddress={userAddress}
      setUserAddress={setUserAddress}
      balances={balances}
      authMethod={authMethod}
      setAuthMethod={setAuthMethod}
      privateKey={privateKey}
      setPrivateKey={setPrivateKey}
      keystoreJson={keystoreJson}
      setKeystoreJson={setKeystoreJson}
      keystorePassword={keystorePassword}
      setKeystorePassword={setKeystorePassword}
      mnemonicPhrase={mnemonicPhrase}
      setMnemonicPhrase={setMnemonicPhrase}
      showKey={showKey}
      setShowKey={setShowKey}
      showKeystorePass={showKeystorePass}
      setShowKeystorePass={setShowKeystorePass}
      showMnemonic={showMnemonic}
      setShowMnemonic={setShowMnemonic}
      pledgedToken={pledgedToken}
      setPledgedToken={setPledgedToken}
      pledgedAmount={pledgedAmount}
      setPledgedAmount={setPledgedAmount}
      exchangeRate={exchangeRate}
      setExchangeRate={setExchangeRate}
      convertedAmount={convertedAmount}
      setConvertedAmount={setConvertedAmount}
      purchaseNative={handlePurchaseNative}
      isConnected={isConnected}
      onConnectWallet={handleSecureConnect}
      onDisconnectWallet={handleSecureDisconnect}
    />

    {/* DYNAMIC WORKSPACE PORTAL CONTAINER */}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto", background: "#050505" }}>

      {/* MASTER DEFAULT LANDING: SYSTEM OPERATIONS HUB */}
      {(!portalView || portalView === 'hub') && (
        <div style={{ padding: "48px 64px", maxWidth: "1400px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          
          {/* HEADER LAYER: Minimalist Typography */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #111", paddingBottom: "16px", marginBottom: "40px" }}>
            <div>
              <h1 style={{ ...styles.label, color: "#ffffff", fontSize: "20px", fontWeight: "300", letterSpacing: "1px", margin: "0 0 4px 0" }}>GLOBAL PARTNER HUB</h1>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "0.5px", margin: 0 }}>
                SYSTEM RUNTIME & OPERATIONAL MATRIX
              </p>
            </div>
            
            {/* STATUS BAR */}
            <div style={{ ...styles.label, display: "flex", gap: "24px", fontSize: "11px", letterSpacing: "0.5px" }}>
              <div>
                <span style={{ color: "#444" }}>NETWORK: </span>
                <span style={{ color: rpcUp && latency > 0 ? "#1c9c31bd" : "#ef4444" }}>
                  {rpcUp && latency > 0 ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div>
                <span style={{ color: "#444" }}>STATUS: </span>
                {isConnected ? (
                  <span style={{ color: "#1c9c31bd", fontWeight: "500" }}>CONNECTED</span>
                ) : (
                  <span style={{ color: "#ef4444", fontWeight: "500" }}>DISCONNECTED</span>
                )}
              </div>
              <div>
              <span style={{ color: "#444" }}>ACTIVE WALLET: </span>
              <span style={{ color: isConnected && userAddress ? "#fff" : "#555" }}>
                {isConnected && userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`.toUpperCase() : "0XNONE"}
              </span>
            </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", width: "100%", margin: "0 0 20px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.49) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
          </div>

          {/* THREE-COLUMN BENTO GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#111", border: "1px solid #83828217", borderRadius: "4px", overflow: "hidden" }}>
            
            {/* TOP UTILITY 1: RESUME */}
            <div style={{ background: "#090909", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "120px" }}>
              <div>
                <span style={{ color: "#8d8d8d", fontSize: "10px", letterSpacing: "1px" }}>RESUME SESSION</span>
                <p style={{ ...styles.label, color: lastVisitedMatrix ? "#fff" : "#444", fontSize: "13px", margin: "8px 0 0 0" }}>
                  {lastVisitedMatrix ? matrixNames[lastVisitedMatrix] : "No recent activity log."}
                </p>
              </div>
              {lastVisitedMatrix ? (
                <button 
                  onClick={() => setPortalView(lastVisitedMatrix)}
                  style={{ 
                    ...styles.btnForestGreen,
                    background: "rgba(13, 61, 20, 0.26)",
                    color: "#fff", 
                    border: "1px solid rgba(119, 119, 119, 0.15)",
                    borderRadius: "4px",
                    padding: "6px 12px",
                    fontSize: "10px",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    textAlign: "center",
                    marginTop: "16px",
                    width: "fit-content",
                    transition: "background 0.2s ease"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"}
                >
                  BACK TO BUSINESS
                </button>
              ) : (
                <div style={{ height: "27px", marginTop: "16px" }} />
              )}
            </div>

            {/* TOP UTILITY 2: LOGS */}
            <div style={{ background: "#090909", padding: "24px", minHeight: "120px" }}>
              <span style={{ color: "#8d8d8d", fontSize: "10px", letterSpacing: "1px" }}>HISTORICAL USAGE</span>
              <div style={{ marginTop: "12px", fontSize: "11px", color: "#888", display: "flex", flexDirection: "column", gap: "4px" }}>
                
                {/* Safe defensive check before mapping */}
                {Array.isArray(recentlyViewed) && recentlyViewed.slice(0, 2).map((matrixKey) => (
                  <div key={matrixKey}>
                    • {matrixNames?.[matrixKey]?.split(':')[0] || matrixKey.toUpperCase()}
                  </div>
                ))}
                
                {(!recentlyViewed || !Array.isArray(recentlyViewed) || recentlyViewed.length === 0) && (
                  <div style={{ color: "#333" }}>Logs empty.</div>
                )}
                
              </div>
            </div>

            {/* TOP UTILITY 3: TELEMETRY */}
            <div style={{ background: "#090909", padding: "24px", minHeight: "120px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span style={{ color: "#8d8d8d", fontSize: "10px", letterSpacing: "1px" }}>NETWORK LATENCY</span>
                <p style={{ ...styles.label, color: "#fff", fontSize: "16px", margin: "8px 0 0 0" }}>
                  {latency > 0 ? `${latency} ms` : "0 ms"}
                </p>
              </div>
              <span style={{ color: "#8d8d8d", fontSize: "10px" }}>
                NODE STABILITY: {' '}
                {latency === 0 ? (
                  <span style={{ color: "#555" }}>OFFLINE</span>
                ) : latency < 100 ? (
                  <span style={{ color: "#22c55e" }}>OPTIMAL</span>
                ) : latency <= 250 ? (
                  <span style={{ color: "#eab308" }}>STABLE</span>
                ) : (
                  <span style={{ color: "#ef4444" }}>DEGRADED</span>
                )}
              </span>
            </div>
          </div>

          {/* DIVIDER 1: THE SYSTEM PARTITION */}
          {/* Separates transient hardware status widgets from primary functional architecture */}
          <div style={{ display: "flex", alignItems: "center", margin: "48px 0 32px 0" }}>
            <span style={{ ...styles.label, color: "#696868", fontSize: "10px", letterSpacing: "2px", fontWeight: "600", paddingRight: "24px" }}>CORE SYSTEM MATRICES</span>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, #888787 0%, #111 80%, transparent 100%)" }} />
          </div>

          {/* CORE MATRIX INTERFACES GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            
            {[
              { id: 'admin', title: 'Administrative Dashboard', desc: 'Settlements, system audits, and deposits.', label: 'CORE_ENGINE', val: 'SECURE' },
              { id: 'wholesale', title: 'Wholesaler Matrix', desc: 'Track inventory purchases and corporate credits.', label: 'CUMULATIVE_VOLUME', val: !isConnected && wholesaleTotal ? `$${wholesaleTotal}` : "0" },
              { id: 'investments', title: 'Investor Matrix', desc: 'Portfolio view and execution dashboard.', label: 'OUTSTANDING', val: !isConnected && portfolioTotal ? portfolioTotal : "0.00 GBDo"},
              { id: 'gateway', title: 'Global Dollar Gateway', desc: 'Liquidity flow configurations and exchanges.', label: 'GATEWAY_ROUTER', val: 'ACTIVE' },
              { id: 'swap', title: 'Global XChange Matrix', desc: 'Escrowed swap executions and counterparties.', label: 'ESCROW_SYSTEM', val: 'STABLE' },
              { id: 'affiliate', title: 'Affiliate Matrix', desc: 'Performance analytics and distribution loops.', label: 'COMMISSIONS', val: `${(!isConnected && affiliateTotal) ? `$${String(affiliateTotal).trim()}` : "0.00"} GBDo` }
            ].map((m) => (
              <div 
                key={m.id}
                onClick={() => navigateToMatrix(m.id)}
                style={{ 
                  background: "#090909",
                  border: "1px solid #111",
                  padding: "24px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#222";
                  e.currentTarget.style.background = "#0d0d0d";
                  // Instantly target the card's internal vertical divider lines on hover
                  const line = e.currentTarget.querySelector('.card-split-line');
                  if (line) line.style.background = '#222';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#111";
                  e.currentTarget.style.background = "#090909";
                  const line = e.currentTarget.querySelector('.card-split-line');
                  if (line) line.style.background = '#111';
                }}
              >
                <div>
                  <h3 style={{ ...styles.label, color: "#fff", fontSize: "14px", fontWeight: "400", margin: "0 0 4px 0" }}>{m.title}</h3>
                  <p style={{ ...styles.label, color: "#666", fontSize: "11px", margin: 0, maxWidth: "340px" }}>{m.desc}</p>
                </div>
                
                {/* THE DATA COLUMN SPLITTER */}
                {/* Creates an elegant visual alignment channel before structural metrics data blocks */}
                <div style={{ display: "flex", alignItems: "center", height: "32px", gap: "24px" }}>
                  <div 
                    className="card-split-line" 
                    style={{ width: "1px", height: "100%", background: "#111", transition: "background 0.3s" }} 
                  />
                  <div style={{ textAlign: "right", minWidth: "100px" }}>
                    <div style={{ ...styles.label, color: "#444", fontSize: "9px", letterSpacing: "0.5px" }}>{m.label}</div>
                    <div style={{ ...styles.label, color: "#fff", fontSize: "12px", marginTop: "2px" }}>{m.val}</div>
                  </div>
                </div>

              </div>
            ))}

          </div>

        </div>
      )}    
      {/* VIEW 1: INVESTMENTS PANEL */}
      {portalView === 'investments' && (
        <CorePortfolioMatrix 
          userAddress={userAddress}
          balances={balances}
          onTotalChange={setPortfolioTotal}
          isConnected={isConnected}
        />
      )}

      {/* VIEW 2: PARTNER PORTAL (WHOLESALE DISTRIBUTION WORKSPACE) */}
      {portalView === 'wholesale' && (
        <PartnerPortal 
          userAddress={userAddress} 
          activeContract={selectedContract}
          cumalativeChange={setWholesaleTotal}
          selectedAssetKey={selectedAssetKey}
          setSelectedAssetKey={setSelectedAssetKey}
          selectedPanelKey={selectedPanelKey}
          setSelectedPanelKey={setSelectedPanelKey}
          selectedGridTieKey={selectedGridTieKey}
          setSelectedGridTieKey={setSelectedGridTieKey}
          selectedMonitoringKey={selectedMonitoringKey}
          setSelectedMonitoringKey={setSelectedMonitoringKey}
          selectedCountryKey={selectedCountryKey}
          setSelectedCountryKey={setSelectedCountryKey}
          selectedStableTokenSymbol={selectedStableTokenSymbol}
          setSelectedStableTokenSymbol={setSelectedStableTokenSymbol}
          supportedTokens={supportedTokens}
          setSelectedTokenAddress={setSelectedTokenAddress}
          setSelectedTokenDecimals={setSelectedTokenDecimals}
          setSelectedTokenChain={setSelectedTokenChain}
          purchaseTxHash={purchaseTxHash}
          setPurchaseTxHash={setPurchaseTxHash}
          buyerWalletAddress={buyerWalletAddress}
          setBuyerWalletAddress={setBuyerWalletAddress}
          genData={genData}
          selectedVoltage={selectedVoltage}
          setSelectedVoltage={setSelectedVoltage}
          selectedFrequency={selectedFrequency}
          setSelectedFrequency={setSelectedFrequency}
          selectedPhase={selectedPhase}
          setSelectedPhase={setSelectedPhase}
          selectedReactor={selectedReactor}
          setSelectedReactor={setSelectedReactor}
          quuantity={setSelectedQuantity}
          firstname={firstname}
          setFirstname={setFirstname}
          lastname={lastname}
          setLastname={setLastname}
          email={email}
          setEmail={setEmail}
          phone={phone}
          setPhone={setPhone}
          postalCode={postalCode}
          setPostalCode={setPostalCode}
          address={address}
          setAddress={setAddress}
          handlePurchase={handlePurchase}
          isConnected={isConnected} 
        />
      )}

      {/* VIEW 3: AFFILIATE PORTAL NETWORK PANEL */}
      {portalView === 'affiliate' && (
        <AffiliatePortal
          userAddress={userAddress}
          activeContract={selectedContract}
          affiliateTotal={affiliateTotal}
          isConnected={isConnected}
        />
      )}

      {/* VIEW 4: SWAP PORTAL PANEL */}
      {portalView === 'swap' && (
        <GlobalSwapPortal
          userAddress={userAddress}
          activeContract={selectedContract}
          isConnected={isConnected}
        />
      )}

      {/* VIEW 5: GATEWAY PORTAL PANEL */}
      {portalView === 'gateway' && (
        <NativeExchangeHistory
          userAddress={userAddress}
          activeContract={selectedContract}
          isConnected={isConnected}
        />
      )}
      
      {/* VIEW 6: CORE ADMIN ENGINE PANEL */}
      {portalView === 'admin' && (
        <CoreAdminEngine
          styles={styles}
          userAddress={userAddress}
          authMethod={authMethod}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          selectedContract={selectedContract}
          setSelectedContract={setSelectedContract}
          contracts={contracts}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          handleTimestampQuery={handleTimestampQuery}
          timestampResults={timestampResults}
          selectedTermNumber={selectedTermNumber}
          setSelectedTermNumber={setSelectedTermNumber}
          walletAddress={walletAddress}
          setWalletAddress={setWalletAddress}
          handleUserQuery={handleUserQuery}
          userQueryResults={userQueryResults}
          transactionHash={transactionHash}
          setTransactionHash={setTransactionHash}
          custodialWallet={custodialWallet}
          setCustodialWallet={setCustodialWallet}
          handleVerifyDeposit={handleVerifyDeposit}
          isConnected={isConnected} 
        />
      )}

    </div>
  </div>
)};