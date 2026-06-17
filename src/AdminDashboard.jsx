import React, { useState } from "react";
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
import Sidebar from './components/sideBar';
import { styles } from './utils/styles.jsx';
import './global.css';


export default function AdminDashboard() {
  // -----------------------------
  // Section 1: Contract Queries
  // -----------------------------

  // Add this state alongside your showAuthDrawer and isOpen states
  const [portalView, setPortalView] = useState('admin'); // Defaulting to your current view
  
  const [showAuthDrawer, setShowAuthDrawer] = useState(false); // Set to true if you want it open by default

  const handleDisconnectWallet = () => {
    setUserAddress("");
    setPrivateKey("");
    setKeystoreJson("");
    setKeystorePassword("");
    setMnemonicPhrase("");
    // If you are setting balances array somewhere globally/locally, clear it too:
    // setBalances([]); 
  };
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

  const [selectedStableTokenSymbol, setSelectedStableTokenSymbol] = useState(""); // e.g., "LGE20KVA"
  const [selectedAssetKey, setSelectedAssetKey] = useState(""); // e.g., "LGE20KVA"
  const [selectedPanelKey, setSelectedPanelKey] = useState(""); // e.g., "standard" or "customized"
  const [selectedGridTieKey, setSelectedGridTieKey] = useState("");
  const [selectedMonitoringKey, setSelectedMonitoringKey] = useState("");
  const [selectedCountryKey, setSelectedCountryKey] = useState("");

  const [selectedVoltage, setSelectedVoltage] = useState("");       // Fixed line 818 crash
  const [selectedFrequency, setSelectedFrequency] = useState("");   // Used in hardwareConfigBytes32
  const [selectedPhase, setSelectedPhase] = useState("");           // Used in hardwareConfigBytes32
  const [selectedReactor, setSelectedReactor] = useState("");       // Used in hardwareConfigBytes32
  
  // Token Metadata Context hooks for payment capturing
  const [selectedTokenAddress, setSelectedTokenAddress] = useState(""); 
  const [selectedTokenDecimals, setSelectedTokenDecimals] = useState(18);
  const [selectedTokenChain, setSelectedTokenChain] = useState("global");
  const [custodialWalletAddress, setCustodialWalletAddress] = useState("");

  const [purchaseTxHash, setPurchaseTxHash] = useState("");
  const [shippingDays, setShippingDays] = useState(90);

  const { balances } = useDirectTokenBalances();

  const handleSaveCredentials = async () => {
    // 1. Structural Validation Guard
    if (!authMethod) {
      alert("Please select a credential type.");
      return;
    }

    let derivedAddress = "";
    let payload = { authMethod };

    try {
      // 2. Cryptographic Parsing & Address Derivation
      if (authMethod === 'privateKey') {
        if (!privateKey || privateKey.length < 64) throw new Error("Invalid Private Key length.");
        
        // Ensure hex formatting prefix
        const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        const wallet = new ethers.Wallet(formattedKey);
        
        derivedAddress = wallet.address;
        payload.privateKey = formattedKey;

      } else if (authMethod === 'keystore') {
        if (!keystoreJson || !keystorePassword) throw new Error("Missing Keystore JSON or Password.");
        
        // Note: Decrypting a keystore takes a few seconds, standard UX uses a loading state here
        const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, keystorePassword);
        
        derivedAddress = wallet.address;
        payload.keystoreJson = keystoreJson;
        payload.keystorePassword = keystorePassword;

      } else if (authMethod === 'mnemonic') {
        if (!mnemonicPhrase) throw new Error("Mnemonic phrase cannot be empty.");
        
        const wallet = ethers.Wallet.fromMnemonic(mnemonicPhrase.trim());
        
        derivedAddress = wallet.address;
        payload.mnemonicPhrase = mnemonicPhrase.trim();
      }

      // 3. Address Mismatch Safety Check
      // If the admin typed a wallet address AND provided a key, verify they match!
      if (userAddress && userAddress.toLowerCase() !== derivedAddress.toLowerCase()) {
        throw new Error("Provided Admin Wallet Address does not match the derived credential key.");
      }

      // 4. Commit to Global App State
      // This instantly toggles your status bar to CONNECTED using a verified public key
      setUserAddress(derivedAddress); 
      
      console.log("Admin Credentials Verified & Initialized successfully:", derivedAddress);
      alert(`Wallet initialized successfully: ${derivedAddress.slice(0,6)}...${derivedAddress.slice(-4)}`);

      // TODO: Pass 'payload' or the initialized signer instance to your global Web3 provider context

    } catch (error) {
      console.error("Initialization Failed:", error.message);
      alert(`Security Initialization Error: ${error.message}`);
      
      // Clear out user address to drop the status bar back to 'NOT INITIALIZED' on failure
      setUserAddress(""); 
    }
  };

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
      const response = await window.api.triggerVault(payload);
      
      if (response && response.ok) {
        console.log("Verification Passed!", response);
        // response context contains: senderAddress, amount, tokenSymbol, tokenAddress
        setUserQueryResults([response]); 
        alert(`Verification Passed! Confirmed payment routed into Treasury Vault: ${targetTreasuryVault}`);
      } else {
        console.error("Verification Failed:", response?.reason);
        alert(`Verification Failed: ${response?.reason || "Unknown Error"}`);
      }
    } catch (error) {
      console.error("IPC verification pipeline crash:", error);
      alert(`Internal Engine Communication Error: ${error.message}`);
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

      const verificationResponse = await window.api.triggerVault({
        modeArg: "verify-erc20-receipt",
        transactionHash: purchaseTxHash,
        custodialWallet: targetTreasuryVault 
      });

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
      totalBaseDays: assetData.baseDays || 90,
      exchangeRate: activeExchangeRateBigInt.toString(),
      hardwareConfigBytes32: packedConfigBytes32,
      custodialDepositHash: trackedDepositHash,
      configurationSummary: `${chosenPanel.label || ""} / ${chosenGridTie.label || ""} / ${chosenMonitoring.label || ""}`,
      destinationCountry: selectedCountryKey,
      cryptoAuth: credentialsPayload 
    };

    try {
      console.log("Broadcasting multi-step coordinated execution payload to Electron backend...", payload);
      const response = await window.api.triggerVault(payload);
      setUserQueryResults(Array.isArray(response) ? response : [response]);
      alert("Transaction written and processed successfully!");
    } catch (error) {
      console.error("Coordinated IPC execution failed:", error);
    }
  };

return (
  <div style={styles.appContainer}>

    {/* SIDEBAR COMPONENT */}
    <Sidebar 
      portalView={portalView} 
      setPortalView={setPortalView}
      userAddress={userAddress}
      setUserAddress={setUserAddress}
      balances={balances}
    />

    {/* DYNAMIC WORKSPACE PORTAL CONTAINER */}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto" }}>
      
      {/* VIEW 1: INVESTMENTS PANEL */}
      {portalView === 'investments' && (
        <CorePortfolioMatrix userAddress={userAddress} balances={balances} />
      )}

      {/* VIEW 2: PARTNER PORTAL (WHOLESALE DISTRIBUTION WORKSPACE) */}
      {portalView === 'wholesale' && (
        <PartnerPortal 
          userAddress={userAddress} 
          activeContract={selectedContract}
        />
      )}

      {/* VIEW 3: AFFILIATE PORTAL NETWORK PANEL */}
      {portalView === 'affiliate' && (
        <AffiliatePortal userAddress={userAddress} activeContract={selectedContract} />
      )}
      
      {/* VIEW 2: CORE ADMIN ENGINE PANEL */}
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
          handlePurchase={handlePurchase}
          transactionHash={transactionHash}
          setTransactionHash={setTransactionHash}
          custodialWallet={custodialWallet}
          setCustodialWallet={setCustodialWallet}
          handleVerifyDeposit={handleVerifyDeposit}
        />
      )}

    </div>
  </div>
)};