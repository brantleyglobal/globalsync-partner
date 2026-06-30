// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { ethers } from "ethers";
import { styles, modalStyles } from '../utils/styles.jsx';
import logo from '../assets/logo.png';
import { supportedTokens } from '../utils/tokensX';
import { getExchangeRates } from "../utils/exchangeRates";
import { deployments } from "../utils/deploymentsX";

function formatMoneyFromDigits(raw) {
  // Remove all non‑digits (Type annotation safely removed)
  const digits = raw.replace(/\D/g, "");

  if (digits === "") return "";

  // Convert to number of cents
  const cents = Number(digits);

  // Convert to dollars with 2 decimals
  const value = (cents / 100).toFixed(2);

  // Add commas
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseLocalNumber(rawNumber, locale = undefined) {
  if (!rawNumber) return 0;
  
  // Convert to string safely in case a primitive number slips in
  const targetString = String(rawNumber);

  // Detect the decimal character used by the current user locale (e.g., '.' or ',')
  const amountToFormat = Intl.NumberFormat(locale).format(1.1);
  const decimal = amountToFormat.charAt(amountToFormat.length - 2);

  // Strip out everything except numbers, the negative sign, and the local decimal symbol
  const normalized = targetString.replace(new RegExp(`[^0-9${decimal}-]`, "g"), "");

  // If the local decimal separator is a comma, swap it to a period so standard Number() can process it
  const standardFormat = decimal === ',' ? normalized.replace(',', '.') : normalized;

  const result = Number(standardFormat);
  return isNaN(result) ? 0 : result;
}

export default function Sidebar({ 
  portalView, 
  setPortalView,
  lastVisitedMatrix,
  setLastVisitedMatrix,
  setRecentlyViewed,
  userAddress, 
  setUserAddress, 
  balances = [],
  authMethod,
  setAuthMethod,
  privateKey,
  setPrivateKey,
  keystoreJson,
  setKeystoreJson,
  keystorePassword,
  setKeystorePassword,
  mnemonicPhrase,
  setMnemonicPhrase,
  showKey,
  setShowKey,
  showKeystorePass,
  setShowKeystorePass,
  showMnemonic,
  setShowMnemonic,
  pledgedToken,
  setPledgedToken,
  pledgedAmount,
  setPledgedAmount,
  exchangeRate,
  setExchangeRate,
  convertedAmount,
  setConvertedAmount,
  isConnected,
  onConnectWallet,
  onDisconnectWallet
}) {
  // Keep your local layout toggle states here
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [showPurchaseDrawer, setShowPurchaseDrawer] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const [transactionType, setTransactionType] = useState("deposit");
  const [depositHash, setDepositHash] = useState("");

  // Automatically resolves the hex contract address right before submitting 
  const targetTokenObj = supportedTokens?.find(t => t.symbol === pledgedToken?.symbol);
  const tokenIdentifier = targetTokenObj?.address || pledgedToken?.address;

  const handleNativePurchase = async () => {
    // 1. Guard check: Ensure wallet state context is bound
    if (!userAddress) {
      alert("Please connect or enter a valid wallet address.");
      return;
    }

    const cleanAmountString = pledgedAmount.replace(/,/g, '');

    // 2. Structural Guard: Reject empty requests before hitting the node pipeline
    const amountFloat = parseFloat(pledgedAmount);
    if (!pledgedAmount || isNaN(amountFloat) || amountFloat <= 0) {
      alert("Please enter a valid deposit amount greater than zero.");
      return;
    }

    if (!pledgedToken) {
      alert("Please select a deposit method token.");
      return;
    }

    try {
      // Optional: Turn on busy states (e.g., setIsLoading(true))
      console.log(`Initiating purchase for ${pledgedAmount} of token ${pledgedToken.symbol}...`);

      // Generate a pseudo-random, unique tracking hash for the smart contract's replay guard
      // We append the timestamp to a standard 32-byte hex template string
      const uniqueNonce = Math.floor(Math.random() * 1000000);
      //const depositHash = `0x${Buffer.from(`DEP-${Date.now()}-${uniqueNonce}`).toString('hex').padEnd(64, '0')}`.slice(0, 66);

      const treasuryByContract = {
        [deployments.AcquisitionGateway?.toLowerCase()]: "0x1166579617240592e8a7c87bc389549eab8de047"
      };
  
      const targetTreasuryVault = treasuryByContract[deployments.AcquisitionGateway.toLowerCase()];
      if (!targetTreasuryVault) {
        return alert(`Security System Error: Selected contract address does not have a mapped Treasury Vault.`);
      }
  
      try {
        console.log(`Executing pre-flight receipt window validation against Treasury: ${targetTreasuryVault}`);
  
        let tokenConversionRate; 
        let computedAmountOut;
  
        const targetDecimalsBase18 = 18;

        if (transactionType === "deposit") {
          computedAmountOut = amountFloat / parseFloat(exchangeRate);
        } else {
          computedAmountOut = amountFloat * parseFloat(exchangeRate);
        }
        
        const safeFixedString = computedAmountOut.toFixed(18).replace(/e[-+]\d+/, (match) => {
          return Number(match).toFixed(18).split('e')[0];
        });
  
        const expectedTokensBase18 = ethers.parseUnits(safeFixedString, targetDecimalsBase18);
        const ALLOWABLE_SLIPPAGE_PERCENT = 1; 
        const slippageBasisPoints = 10000n - BigInt(ALLOWABLE_SLIPPAGE_PERCENT * 100);
        const priceFloorBase18 = (expectedTokensBase18 * slippageBasisPoints) / 10000n;
  
        console.clear(); 
        console.group("SYSTEM INTEGRITY AUDIT REPORT");
        console.table({
          "Token Exchange FX Rate":   { Value: `${exchangeRate} ${pledgedToken.symbol}`, Base18: "N/A" },
          "Expected Tokens Target":   { Value: `${computedAmountOut.toFixed(4)} Units`, Base18: expectedTokensBase18.toString() },
          "Slippage Floor Limit":     { Value: `${ethers.formatUnits(priceFloorBase18, 18)} Units`, Base18: priceFloorBase18.toString() },
          "Current Raw Input Hash":   { Value: depositHash || "EMPTY/NOT PROVIDED", Base18: "N/A" }
        });
        console.groupEnd();
  
        if (transactionType === "deposit" && !depositHash) {
          throw new Error("Missing Transaction Hash! You must provide the user's transaction payment hash.");
        }
        if (transactionType === "deposit" && !depositHash.startsWith("0x") || depositHash.length < 66) {
          throw new Error(`Invalid Hash Format! "${depositHash}" must be a 66-character hex string starting with 0x.`);
        }
  
        let verificationResponse = null;
  
        // --- THE SHIELD LAYER ---
        if (transactionType === "deposit") {
          try {
            verificationResponse = await window.api.triggerVault({
              modeArg: "verify-erc20-receipt",
              transactionHash: depositHash,
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
    
          const rawLoggedTokenAmount = BigInt(verificationResponse.rawAmount);
          const actualDecimalsOfPaymentToken = verificationResponse.decimals ?? targetDecimals ?? 18;
          const normalizedPaidAmountBase18 = BigInt(
            rescaleAmount(rawLoggedTokenAmount, actualDecimalsOfPaymentToken, targetDecimalsBase18)
          );
    
          console.log(`[AUDIT RECEIPT] Actual Payment Detected: ${ethers.formatUnits(normalizedPaidAmountBase18, 18)} Units`);
    
          if (verificationResponse.senderAddress.toLowerCase() !== userAddress.toLowerCase()) {
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
        }
  
      } catch (verifyError) {
        console.error("PRE-FLIGHT AUDIT REJECTION:", verifyError.message);
        alert(`PRE-FLIGHT VALIDATION CRASHED:\n\n${verifyError.message}`);
        return; 
      }

      // Construct the exact payload payload format expected by main.js
      const payload = {
        userAddress: userAddress,
        tokenAddress: pledgedToken.address, // Assuming pledgedToken state holds the token contract address
        amountIn: pledgedAmount,
        amountOut: computedAmountOut.toString(),
        exchangeRate: exchangeRate.toString(),
        depositHash: depositHash
      };

      // Invoke your secure preload contextBridge window method
      let result;
      if ( transactionType === "deposit") {
        result = await window.electronAPI.submitAcquisition(payload);
      } else {
        result = await window.electronAPI.submitUserLiquidate(payload);
      }
      
      // 7. Evaluate explicitly using a safe boolean evaluation
      if (result && result.success) {
        console.log(`Purchase transaction completed successfully. Tx Hash: ${result.txHash}`);
        alert(`Transaction confirmed! Hash: ${result.txHash}`);
        
        // Clear inputs to prevent stale double-submissions
        if (typeof setPledgedAmount === "function") setPledgedAmount("");
        
        // Close out the toggle parameters to minimize cleartext remnants
        setPledgedAmount("");
        setPledgedToken(null);
        if (typeof setIsOpen === "function") setIsOpen(false);
      } else {
        // Handle cases where the promise resolved but the backend script failed
        throw new Error(result?.error || "Transaction execution failed or reverted on-chain.");
      }

    } catch (error) {
      console.error("Critical Failure inside handleNativePurchase:", error);
      alert(`Purchase Failed: ${error.message || "Unknown execution or network error"}`);
    } finally {
      // Optional: Turn off transaction busy states here (e.g., setIsLoading(false))
    }
  };

  const handleSaveCredentials = async () => {
    // Guard check: Ensure they filled in the public target address
    if (!userAddress) return alert("Please enter a wallet address.");

    // Extract the correct secret depending on their selected method
    let secretToSend = '';
    if (authMethod === 'privateKey') secretToSend = privateKey;
    if (authMethod === 'keystore') secretToSend = keystoreJson;
    if (authMethod === 'mnemonic') secretToSend = mnemonicPhrase;

    const result = await onConnectWallet(authMethod, secretToSend, keystorePassword);
    console.log("Closing Sign-In Modal");
    if (result.success) {
      
      // Close out the toggle parameters to minimize cleartext layout remnants
      setShowAuthDrawer(false); 
      setIsOpen(false);
    }
  };

  const handleDisconnectWallet = async () => {
    // Fire off the master parent flush routine
    const result = await onDisconnectWallet();
    
    if (result.success) {
      
      // Close out the toggle parameters to minimize cleartext layout remnants
      setShowAuthDrawer(false); 
      setIsOpen(false);
    }
  };

  useEffect(() => {
      let cancelled = false; // guard against stale responses
      const requestId = Date.now();
  
      const fetchRate = async () => {
        const symbol = String(pledgedToken?.symbol || "").toUpperCase();
        if (!symbol) return;
  
        try {
          const { rates, gbdoRate } = await getExchangeRates();
  
          // Validate gbdoRate
          const gbdo = Number(gbdoRate);
          if (!isFinite(gbdo) || gbdo <= 0) {
            throw new Error(`Invalid GBDO rate: ${gbdoRate}`);
          }
  
          // Hardcoded USD prices for volatile tokens (example values)
          const hardcodedUsd = {
            WETH: 3000,
            WBNB: 900,
            WBTC: 90000,
          };
  
          // Build a quick lookup for API rates (assumed USD)
          const apiMap = new Map();
          if (Array.isArray(rates)) {
            for (const r of rates) {
              if (r?.symbol) {
                apiMap.set(String(r.symbol).toUpperCase(), Number(r.rate));
              }
            }
          }
  
          // Resolve tokenRate (USD)
          let tokenRate = hardcodedUsd[symbol];
          if (tokenRate === undefined) {
            const apiRate = apiMap.get(symbol);
            if (!isFinite(apiRate)) {
              throw new Error(`Exchange rate for token ${symbol} not found or invalid`);
            }
            tokenRate = apiRate;
          }
  
          // Compute token → GBDo
          const exchangeRateFloat = tokenRate / gbdo;
          console.log(exchangeRateFloat);
  
          // Extra validation
          if (!isFinite(exchangeRateFloat)) {
            throw new Error(
              `Computed exchange rate is invalid: tokenRate=${tokenRate}, gbdoRate=${gbdo}`
            );
          }
  
          // Skip if effect has been cancelled (user changed token)
          if (cancelled) return;
  
          // Keep string handler
          setExchangeRate(exchangeRateFloat.toString());
        } catch (err) {
          console.error("Error fetching exchange rate:", err);
          setExchangeRate("");
        }
      };
  
      fetchRate();
  
      return () => {
        // cancel any in-flight response from older selections
        cancelled = true;
      };
    }, [pledgedToken?.symbol]);
  
    // Derive converted amount whenever depositAmount or exchangeRate changes
    useEffect(() => {
      if (!exchangeRate || pledgedAmount === "") {
        setConvertedAmount("");
        return;
      }
  
      const rate = formatMoneyFromDigits(exchangeRate);
      const locale = navigator.language || "en-US";
      const amount = (parseLocalNumber(pledgedAmount, locale) * parseLocalNumber(exchangeRate, locale));
      const converted = formatMoneyFromDigits((amount).toFixed(2)).toString();
  
      setConvertedAmount(
        converted
      );
      
    }, [pledgedAmount, exchangeRate]);

  useEffect(() => {
    // Create a style element dynamically
    const styleElement = document.createElement("style");
    styleElement.id = "sidebar-webkit-scroll-shield";
    styleElement.textContent = `
      .no-track-scroll::-webkit-scrollbar {
        display: none !important;
        width: 0px !important;
        background: transparent !important;
      }
    `;
    document.head.appendChild(styleElement);

    // Cleanup when the component unmounts to prevent memory/style leaks
    return () => {
      const existingStyle = document.getElementById("sidebar-webkit-scroll-shield");
      if (existingStyle) existingStyle.remove();
    };
  }, []);

  return (
    <aside style={{
      ...styles.sidebar,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        
        // Keeps the mouse wheel / trackpad scrolling engine active
        overflowY: "scroll", 
        
        // Removes the permanent scrollbar track gap entirely
        scrollbarGutter: "auto", 
        
        // Instantly hides the visual scrollbar on Firefox
        scrollbarWidth: "none",  
        
        // Instantly hides the visual scrollbar on IE and old Edge
        msOverflowStyle: "none", 
    }}>

        {/* SIDEBAR HEADER & BRAND CONTAINER */}
        <div style={{
          ...styles.brandContainer, 
          display: "flex",
          alignItems: "center",
          gap: "12px",              
          padding: "12px 8px",
          flexShrink: 0        
        }}>
          <img 
              src={logo}           
              alt="BG COMPANY GLOBAL SYNC"
              style={{
                width: "70px",          
                height: "70px",
                objectFit: "contain"
              }}
          />

          <div style={{ display: "flex", flexDirection: "column", whiteSpace: "nowrap" }}>
              <h2 style={{ ...styles.title, margin: 0, fontSize: "20px", letterSpacing: "1px", color: "#a5a5a5", fontWeight: "100" }}>
                GLOBAL SYNC
              </h2>
              <span style={{ ...styles.subtitle, margin: 0, fontSize: "14px", opacity: 0.6 }}>
                ADMIN DASHBOARD
              </span>
              <span style={{ ...styles.subtitle, margin: 0, fontSize: "8px", opacity: 0.6 }}>
                by BG COMPANY
              </span>
          </div>
        </div>
                
        {/* 1. SIGN-IN / CREDENTIALS DRAWER */}
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", margin: "0 12px 16px 12px" }}>
          <div 
              onClick={() => (setShowAuthDrawer(!showAuthDrawer), setShowPurchaseDrawer(false), setIsOpen(false))} 
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 4px",
                cursor: "pointer",
                borderTop: "1px solid #1a1a1a",
                borderBottom: showAuthDrawer ? "none" : "1px solid #1a1a1a",
                transition: "color 0.2s ease",
                color: showAuthDrawer ? "#4ade807a" : "#555" 
              }}
          >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", letterSpacing: "1px", fontWeight: "600" }}>
              <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  background: showAuthDrawer ? "#4ade807a" : "#333",
                  boxShadow: showAuthDrawer ? "0 0 8px #4ade807a" : "none"
              }} />
              CONNECT WALLET
              </div>
              <span style={{ fontSize: "9px", transform: showAuthDrawer ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", opacity: 0.5 }}>
              ▼
              </span>
          </div>

          {showAuthDrawer && (
            <form 
              onSubmit={(e) => {
                e.preventDefault(); // Prevents page reload
                if (!isConnected) {
                  handleSaveCredentials();
                }
              }}
              style={{ ...styles.configSection, marginTop: "12px", borderTop: "1px dashed #222", paddingTop: "12px", display: "flex", flexDirection: "column" }}
            >
              {/*<div style={{ ...styles.configSection, marginTop: "12px", borderTop: "1px dashed #222", paddingTop: "12px" }}>*/}
              <p style={styles.microText}>Required for executing transactions.</p>
              
              <label style={styles.label}>ADMIN WALLET ADDRESS</label>
              <input
                  type="text"
                  placeholder="0x..."
                  style={styles.sidebarInput}
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
              />

              <label style={styles.label}>CREDENTIAL TYPE</label>
              <select
                  style={styles.sidebarInput}
                  value={authMethod}
                  onChange={(e) => setAuthMethod(e.target.value)}
              >
                  <option value="privateKey" style={{ background: "#121212" }}>Plain Private Key</option>
                  <option value="keystore" style={{ background: "#121212" }}>Encrypted Keystore JSON</option>
                  <option value="mnemonic" style={{ background: "#121212" }}>Mnemonic Seed Phrase</option>
              </select>

              {/* OPTION 1: PRIVATE KEY */}
              {authMethod === 'privateKey' && (
                  <>
                  <label style={styles.label}>PRIVATE KEY</label>
                  <div style={{...styles.label, marginBottom: '16px'}}>
                      <input
                        type={showKey ? "text" : "password"}
                        placeholder="••••••••••••••••••••••••"
                        style={{...styles.sidebarInput, marginBottom: 0, paddingRight: '45px'}}
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowKey(!showKey)} style={styles.visibilityToggle}>
                        {showKey ? "Hide" : "Show"}
                      </button>
                  </div>
                  </>
              )}

              {/* OPTION 2: ENCRYPTED KEYSTORE JSON */}
              {authMethod === 'keystore' && (
              <>
                <label style={styles.label}>KEYSTORE JSON</label>
                <div style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid #1c1c1c",
                borderRadius: "4px",
                padding: "8px",
                marginBottom: "12px",
                }}>
                <textarea
                    placeholder='{"version":3,"id":"...", "crypto":{...}}'
                    style={{
                    ...styles.label,
                    width: "100%",
                    height: "70px",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    resize: "none",
                    color: keystoreJson ? "#4ade80bd" : "#888",
                    fontSize: "10px",
                    lineHeight: "1.4",
                    boxSizing: "border-box"
                    }}
                    value={keystoreJson}
                    onChange={(e) => setKeystoreJson(e.target.value)}
                />
                
                {/* Utilities Action Bar */}
                <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    marginTop: "6px", 
                    borderTop: "1px solid #1a1a1a", 
                    paddingTop: "6px" 
                }}>
                  <button 
                    type="button" 
                    onClick={async () => {
                      try {
                        console.log("File button tapped. Initiating secure channel handshake...");
                        
                        // We create the payload both as separate arguments AND as a wrapped object
                        // to guarantee compatibility with your preload.js setup
                        const flatArgs = [
                          'FILE_PICKER_BYPASS', 
                          'keystore', 
                          'TRIGGER_OS_FILE_PICKER', 
                          ''
                        ];
                        const objectArg = {
                          address: 'FILE_PICKER_BYPASS',
                          method: 'keystore',
                          secret: 'TRIGGER_OS_FILE_PICKER',
                          password: ''
                        };

                        let response;

                        // 1. Try invoking the function using your exact backend parameter blueprint
                        try {
                          response = await window.electronAPI.saveAdminCredentials(...flatArgs);
                        } catch (err) {
                          // 2. Fallback instantly to the unified object layout if flat args are rejected
                          response = await window.electronAPI.saveAdminCredentials(objectArg);
                        }
                        
                        console.log("Backend response received:", response);

                        if (response?.success && response?.content) {
                          setKeystoreJson(response.content);
                        } else if (response?.error) {
                          alert(`System Notice: ${response.error}`);
                        }
                      } catch (err) {
                        console.error("OS File selector bridge error:", err);
                        alert("Critical: Context bridge handshake failed completely.");
                      }
                    }}
                    style={{ background: "transparent", border: "none", color: "#555", fontSize: "9px", cursor: "pointer", padding: "2px 0" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#a5f3fc"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "#555"}
                  >
                    🗂️ Load .json File
                  </button>
                    
                    {keystoreJson && (
                    <button 
                        type="button" 
                        onClick={() => setKeystoreJson('')}
                        style={{ background: "transparent", border: "none", color: "#ef44447a", fontSize: "9px", cursor: "pointer", padding: "2px 0" }}
                    >
                        Clear Text
                    </button>
                    )}
                  </div>
                </div>

                <label style={styles.label}>KEYSTORE PASSWORD</label>
                <div style={{...styles.cryptoInputWrapper, marginBottom: '16px'}}>
                <input
                    type={showKeystorePass ? "text" : "password"}
                    placeholder="Password to decrypt keystore"
                    style={{...styles.sidebarInput, marginBottom: 0, paddingRight: '45px'}}
                    value={keystorePassword}
                    onChange={(e) => setKeystorePassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowKeystorePass(!showKeystorePass)} style={styles.visibilityToggle}>
                    {showKeystorePass ? "Hide" : "Show"}
                </button>
                </div>
              </>
              )}

              {/* OPTION 3: MNEMONIC SEED PHRASE */}
              {authMethod === 'mnemonic' && (
                <>
                  <label style={styles.label}>SEED PHRASE (12/24 WORDS)</label>
                  <div style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid #1c1c1c",
                    borderRadius: "4px",
                    padding: "8px",
                    marginBottom: "16px",
                  }}>
                    <textarea
                      placeholder="Paste, type, or load your 12 or 24-word recovery seed phrase here..."
                      style={{
                        ...styles.label,
                        width: "100%",
                        height: "60px",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        resize: "none",
                        color: mnemonicPhrase ? "#4ade80bd" : "#888",
                        fontSize: "10px",
                        lineHeight: "1.4",
                        boxSizing: "border-box"
                      }}
                      value={mnemonicPhrase}
                      onChange={(e) => setMnemonicPhrase(e.target.value)}
                    />
                    
                    {/* Utilities Action Bar */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      marginTop: "6px", 
                      borderTop: "1px solid #1a1a1a", 
                      paddingTop: "6px" 
                    }}>
                      <button 
                        type="button" 
                        onClick={async () => {
                          try {
                            console.log("Mnemonic file button tapped. Initiating secure channel handshake...");
                            
                            const flatArgs = [
                              'FILE_PICKER_BYPASS', 
                              'mnemonic', 
                              'TRIGGER_OS_FILE_PICKER', 
                              ''
                            ];
                            const objectArg = {
                              address: 'FILE_PICKER_BYPASS',
                              method: 'mnemonic',
                              secret: 'TRIGGER_OS_FILE_PICKER',
                              password: ''
                            };

                            let response;

                            try {
                              response = await window.electronAPI.saveAdminCredentials(...flatArgs);
                            } catch (err) {
                              response = await window.electronAPI.saveAdminCredentials(objectArg);
                            }
                            
                            console.log("Backend response received:", response);

                            if (response?.success && response?.content) {
                              setMnemonicPhrase(response.content);
                            } else if (response?.error) {
                              alert(`System Notice: ${response.error}`);
                            }
                          } catch (err) {
                            console.error("OS File selector bridge error:", err);
                            alert("Critical: Context bridge handshake failed completely.");
                          }
                        }}
                        style={{ background: "transparent", border: "none", color: "#555", fontSize: "9px", cursor: "pointer", padding: "2px 0" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#a5f3fc"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#555"}
                      >
                        🗂️ Load Seed File
                      </button>
                        
                      {mnemonicPhrase && (
                        <button 
                          type="button" 
                          onClick={() => setMnemonicPhrase('')}
                          style={{ background: "transparent", border: "none", color: "#ef44447a", fontSize: "9px", cursor: "pointer", padding: "2px 0" }}
                        >
                          Clear Text
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {!isConnected &&  ( 

              <button 
                type="submit"
                style={{
                  ...styles.btnForestGreen,
                  background: "#0a0a0a96",
                  border: "1px solid rgba(0, 0, 0, 0.76)",
                  fontWeight: "lighter",
                  fontSize: "11px",
                  marginBottom: "8px"
                  }} onClick={handleSaveCredentials}>
                    CONNECT WALLET
              </button>
              )}

              {isConnected && (
                  <button 
                  type="button"
                  onClick={handleDisconnectWallet}
                  style={{
                      width: "100%",
                      padding: "8px",
                      background: "#0a0a0ab6",
                      border: "1px solid rgba(0, 0, 0, 0.76)",
                      borderRadius: "4px",
                      color: "#444444",
                      fontSize: "11px",
                      fontWeight: "600",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(10, 10, 10, 0.83)";
                      e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.76)";
                  }}
                  onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(10, 10, 10, 0.83)";
                      e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.76)";
                  }}
                  >
                  DISCONNECT WALLET
                  </button>
              )}
              </form>
          )}
        </div>

        {/* PURCHASE GBDo / NATIVE DRAWER */}
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", margin: "0 12px 16px 12px" }}>
          <div 
              onClick={() => (setShowPurchaseDrawer(!showPurchaseDrawer), setShowAuthDrawer(false), setIsOpen(false))} 
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 4px",
                cursor: "pointer",
                borderTop: "1px solid #1a1a1a",
                borderBottom: showPurchaseDrawer ? "none" : "1px solid #1a1a1a",
                transition: "color 0.2s ease",
                color: showPurchaseDrawer ? "#4ade807a" : "#555" 
              }}
          >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", letterSpacing: "1px", fontWeight: "600" }}>
              <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  background: showPurchaseDrawer ? "#4ade807a" : "#333",
                  boxShadow: showPurchaseDrawer ? "0 0 8px #4ade807a" : "none"
              }} />
              GBDo GATEWAY
              </div>
              <span style={{ fontSize: "9px", transform: showPurchaseDrawer ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", opacity: 0.5 }}>
              ▼
              </span>
          </div>

          {showPurchaseDrawer && (
            <form 
              onSubmit={(e) => {
                e.preventDefault(); // Prevents page reload
                if (!isConnected) {
                  handleSaveCredentials();
                }
              }}
              style={{ ...styles.configSection, marginTop: "12px", borderTop: "1px dashed #222", paddingTop: "12px", display: "flex", flexDirection: "column" }}
            >
              {/*<div style={{ ...styles.configSection, marginTop: "12px", borderTop: "1px dashed #222", paddingTop: "12px" }}>*/}
              {!isConnected && (
                <p style={styles.microText}>Wallet connection required to proceed.</p>
              )}
              

              {/* NATIVE PURCHASE & LIQUIDATION MODAL LAYER */}
              {isConnected && (
                <>
                  <label style={styles.label}>ONBOARDING</label>
                  
                  {/* DIRECTION TOGGLE SYSTEM */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: "600",
                        borderRadius: "4px",
                        border: "1px solid #222",
                        cursor: "pointer",
                        background: transactionType === "deposit" ? "#1a1a1a" : "transparent",
                        color: transactionType === "deposit" ? "#4ade807a" : "#666",
                      }}
                      onClick={() => {
                        setTransactionType("deposit");
                        setPledgedAmount(""); // Reset inputs on switch to keep states clean
                      }}
                    >
                      PURCHASE NATIVE
                    </button>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: "700",
                        borderRadius: "4px",
                        border: "1px solid #222",
                        cursor: "pointer",
                        background: transactionType === "cashout" ? "#1a1a1a" : "transparent",
                        color: transactionType === "cashout" ? "#f87171" : "#666",
                      }}
                      onClick={() => {
                        setTransactionType("cashout");
                        setPledgedAmount("");
                      }}
                    >
                      EXCHANGE NATIVE
                    </button>
                  </div>

                  <div>
                    <div>
                      {/* DYNAMIC LABELS */}
                      <label style={styles.label}>
                        {transactionType === "deposit" ? "DEPOSIT METHOD" : "CASH OUT METHOD"}
                      </label>
                      
                      <select 
                        style={styles.inputElement} 
                        value={pledgedToken ? pledgedToken.symbol : ""}
                        onChange={(e) => {
                          const selectedSymbol = e.target.value;
                          const tokenObject = supportedTokens.find(t => t.symbol === selectedSymbol);
                          setPledgedToken(tokenObject)
                        }}
                      >
                        <option value="" disabled style={{ ...styles.inputElement, background: "#121212" }}>
                          Select {transactionType === "deposit" ? "Deposit" : "Withdrawal"} Asset
                        </option>
                        {Array.isArray(supportedTokens) && supportedTokens
                          .filter((token) => !["BTC", "LINK", "ETH", "UNI", "MATIC", "COPx", "GBDo"].includes(token.symbol))
                          .map((token) => (
                          <option key={`tokenB-${token.address}`} value={token.symbol} style={{ background: "#121212" }}>
                            {token.symbol} ({token.name || token.chain})
                          </option>
                        ))}
                      </select>

                      <label style={styles.label}>
                        {transactionType === "deposit" ? "DEPOSIT AMOUNT" : "CASH OUT AMOUNT"}
                      </label>
                      
                      <div style={{...styles.cryptoInputWrapper, marginBottom: '16px'}}>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          placeholder={transactionType === "deposit" ? "Enter Requested Amount" : "Enter Amount to Cash Out"}
                          style={{...styles.sidebarInput, marginBottom: 0, paddingRight: '45px'}}
                          value={pledgedAmount}
                          onChange={(e) => {
                            const formatted = formatMoneyFromDigits(e.target.value);
                            setPledgedAmount(formatted);
                          }}
                        />
                      </div>
                      {transactionType === "deposit" && (
                      <div>
                        <label style={styles.label}>DEPOSIT TRANSACTION HASH</label>
                        <input type="text" placeholder="0x..." style={styles.inputElement} value={depositHash} onChange={(e) => setDepositHash(e.target.value)} />
                      </div>
                      )}

                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>

                        {/* TRANSPARENT LIVE CALCULATION DISK */}
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center",
                          padding: "10px 4px", 
                          borderTop: "1px dashed #1a1a1a",
                          marginTop: "4px"
                        }}>
                          <span style={{ fontSize: "10px", color: "#555", fontWeight: "600", letterSpacing: "0.5px" }}>
                            {transactionType === "deposit" ? "ESTIMATED GBDo" : `ESTIMATED ${pledgedToken.symbol || "NATIVE"}`}
                          </span>
                          <span style={{
                            ...styles.label,
                            fontSize: "11px", 
                            color: pledgedAmount && exchangeRate ? "#4ade807a" : "#444", 
                            fontWeight: "400",
                          }}>
                            {(() => {
                              const amount = parseFloat(String(pledgedAmount).replace(/,/g, ''));
                              const rate = parseFloat(exchangeRate);
                              
                              if (!isNaN(amount) && !isNaN(rate) && amount > 0 && rate > 0) {
                                if (transactionType === "deposit") {
                                  // Deposit: Token Amount * Rate = GBDo Received
                                  const totalGbdo = amount / rate;
                                  return `${totalGbdo.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} GBDo`;
                                } else {
                                  // Cash Out: GBDo Amount / Rate = Native Token Returned
                                  const totalNative = amount * rate;
                                  return `${totalNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${pledgedToken.symbol}`;
                                }
                              }
                              
                              return transactionType === "deposit" ? "0.00 GBDo" : `0.0000 ${pledgedToken.symbol || "Token"}`;
                            })()}
                          </span>
                        </div>

                        {/* EXCHANGE RATE SUBTEXT */}
                        {exchangeRate && pledgedToken && (
                          <div style={{ fontSize: "10px", color: "#666", margin: "2px 0 8px 4px", display: "flex", justifyContent: "space-between" }}>
                            <span>CONVERSION RATE:</span>
                            <span style={{ ...styles.label, color: "#aaa" }}>
                              1 {pledgedToken.symbol} ≈ {isFinite(parseFloat(exchangeRate)) ? parseFloat(exchangeRate).toFixed(4) : "0.00"} GBDo
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {isConnected && (
                  <button 
                  type="submit"
                  onClick={handleNativePurchase}
                  style={{
                      width: "100%",
                      padding: "8px",
                      background: "#0a0a0ab6",
                      border: "1px solid rgba(0, 0, 0, 0.76)",
                      borderRadius: "4px",
                      color: "#444444",
                      fontSize: "11px",
                      fontWeight: "600",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(10, 10, 10, 0.83)";
                      e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.76)";
                  }}
                  onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(10, 10, 10, 0.83)";
                      e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.76)";
                  }}
                  >
                  SUBMIT PURCHASE
                  </button>
              )}
              </form>
          )}
        </div>

        {/* PORTAL VIEW SELECTION SYSTEM */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "0 12px 16px 12px", marginTop: "30px", fontFamily: "system-ui, sans-serif" }}>
          <span style={{ 
            color: "#555", 
            fontSize: "11px", 
            letterSpacing: "1px", 
            fontWeight: "600", 
            marginBottom: "4px",
            padding: "10px 4px",
            borderTop: "1px solid #1a1a1a",
            borderBottom: showAuthDrawer ? "none" : "1px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{ 
              width: "6px", 
              height: "6px", 
              borderRadius: "50%", 
              background: isConnected ? "#4ade807a" : "#333",
              boxShadow: isConnected ? "0 0 8px #4ade807a" : "none",
              display: "inline-block"
            }} />
            WORKSPACE PORTALS
          </span>
          
          <button 
              onClick={() => {
                setPortalView('admin'); 
                setLastVisitedMatrix('admin');
                setShowPurchaseDrawer(false);
                setShowAuthDrawer(false);
                setIsOpen(false);
                localStorage.setItem('last_visited_matrix', 'admin');
                
                setRecentlyViewed(prev => {
                  const next = ['admin', ...prev.filter(k => k !== 'admin')].slice(0, 3);
                  localStorage.setItem('recently_viewed', JSON.stringify(next));
                  return next;
                });
              }}
              style={{
              ...styles.navItem, 
              background: portalView === 'admin' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'admin' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'admin' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "9px", fontWeight: "lighter", cursor: "pointer"
              }}
          >
              ADMINISTRATIVE DASHBOARD
          </button>

          <button 
              onClick={() => {
                setPortalView('swap'); 
                setLastVisitedMatrix('swap');
                setShowPurchaseDrawer(false);
                setShowAuthDrawer(false);
                setIsOpen(false);
                localStorage.setItem('last_visited_matrix', 'swap');

                setRecentlyViewed(prev => {
                  const next = ['swap', ...prev.filter(k => k !== 'swap')].slice(0, 3);
                  localStorage.setItem('recently_viewed', JSON.stringify(next));
                  return next;
                });
              }}
              style={{
              ...styles.navItem, 
              background: portalView === 'swap' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'swap' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'swap' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "9px", fontWeight: "lighter", cursor: "pointer"
              }}
          >
              XCHANGE DASHBOARD
          </button>

          <button 
              onClick={() => {
                setPortalView('gateway'); 
                setLastVisitedMatrix('gateway');
                setShowPurchaseDrawer(false);
                setShowAuthDrawer(false);
                setIsOpen(false);
                localStorage.setItem('last_visited_matrix', 'gateway');

                setRecentlyViewed(prev => {
                  const next = ['gateway', ...prev.filter(k => k !== 'gateway')].slice(0, 3);
                  localStorage.setItem('recently_viewed', JSON.stringify(next));
                  return next;
                });
              }}
              style={{
              ...styles.navItem, 
              background: portalView === 'gateway' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'gateway' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'gateway' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "9px", fontWeight: "lighter", cursor: "pointer"
              }}
          >
              GBDo GATEWAY MATRIX
          </button>

          <button 
              onClick={() => {
                setPortalView('affiliate'); 
                setLastVisitedMatrix('affiliate');
                setShowPurchaseDrawer(false);
                setShowAuthDrawer(false);
                setIsOpen(false);
                localStorage.setItem('last_visited_matrix', 'affiliate');

                setRecentlyViewed(prev => {
                  const next = ['affiliate', ...prev.filter(k => k !== 'affiliate')].slice(0, 3);
                  localStorage.setItem('recently_viewed', JSON.stringify(next));
                  return next;
                });
              }}
              style={{
              ...styles.navItem, 
              background: portalView === 'affiliate' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'affiliate' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'affiliate' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "9px", fontWeight: "lighter", cursor: "pointer"
              }}
          >
              AFFILIATE MATRIX
          </button>

          <button 
              onClick={() => {
                setPortalView('wholesale'); 
                setLastVisitedMatrix('wholesale');
                setShowPurchaseDrawer(false);
                setShowAuthDrawer(false);
                setIsOpen(false);
                localStorage.setItem('last_visited_matrix', 'wholesale');

                setRecentlyViewed(prev => {
                  const next = ['wholesale', ...prev.filter(k => k !== 'wholesale')].slice(0, 3);
                  localStorage.setItem('recently_viewed', JSON.stringify(next));
                  return next;
                });
              }}
              style={{
              ...styles.navItem, 
              background: portalView === 'wholesale' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'wholesale' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'wholesale' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "9px", fontWeight: "lighter", cursor: "pointer"
              }}
          >
              WHOLESALER MATRIX
          </button>

          <button 
              onClick={() => {
                setPortalView('investments'); 
                setLastVisitedMatrix('investments');
                setShowPurchaseDrawer(false);
                setShowAuthDrawer(false);
                setIsOpen(false);
                localStorage.setItem('last_visited_matrix', 'investments');

                setRecentlyViewed(prev => {
                  const next = ['investments', ...prev.filter(k => k !== 'investments')].slice(0, 3);
                  localStorage.setItem('recently_viewed', JSON.stringify(next));
                  return next;
                });
              }}
              style={{
              ...styles.navItem, 
              background: portalView === 'investments' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'investments' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'investments' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "9px", fontWeight: "lighter", cursor: "pointer"
              }}
          >
              INVESTOR MATRIX
          </button>
        </div>

        <hr style={styles.divider} />

        {/* ACCOUNT BALANCES DISPLAY (MIDDLE PANEL) */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "12px" 
          }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter" }}>
              ACCOUNT BALANCES
            </span>
            {isConnected && balances?.length > 0 && (
              <button 
                onClick={() => (setIsAssetModalOpen(true), setShowAuthDrawer(false), setIsOpen(false), setShowPurchaseDrawer(false))}
                style={{
                  background: "rgba(1, 41, 12, 0.4)",
                  border: "1px solid #01290c8e",
                  color: "#1d5c34",
                  fontSize: "9px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  textTransform: "uppercase"
                }}
              >
                Expand ↗
              </button>
            )}
          </div>

          {/* CONDENSED SIDEBAR PREVIEW */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {isConnected ? (
              (!balances || !Array.isArray(balances) || balances.length === 0) ? (
                <div style={{ color: "#555", fontStyle: "italic", fontSize: "11px" }}>No positive balances found...</div>
              ) : (
                // Only map top 3 assets as a quick glance in the sidebar
                balances.slice(0, 3).map((token, index) => (
                  <div key={index} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span style={{ color: "#aaa" }}>{token?.symbol || "UNKNOWN"}</span>
                    <span style={{ ...styles.label, color: "#666" }}>
                      {/* Ultra aggressive truncation for sidebar safety */}
                      {token?.balance ? (Number(token.balance) / Math.pow(10, token?.decimals || 18)).toFixed(2) : "0.00"}
                    </span>
                  </div>
                ))
              )
            ) : (
              <span style={{ ...styles.label, color: "#ef4444", fontWeight: "lighter", fontSize: "9px" }}>NO WALLET DETECTED</span>
            )}
          </div>
        </div>

        <hr style={styles.divider} />

        {/* OPERATIONAL COMPLIANCE DRAWER (FOOTER) */}
        <div style={{
            marginTop: "auto",
            marginBottom: "30px",
            display: "flex",
            flexDirection: "column",
            fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
            <div 
            onClick={() => (setIsOpen(!isOpen), setShowPurchaseDrawer(false), setShowAuthDrawer(false))}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 4px",
                cursor: "pointer",
                borderTop: "1px solid #1a1a1a", 
                transition: "color 0.2s ease",
                color: isOpen ? "#8b2424" : "#555" 
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = isOpen ? "#8b2424" : "#888"}
            onMouseLeave={(e) => e.currentTarget.style.color = isOpen ? "#8b2424" : "#555"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", letterSpacing: "1px", fontWeight: "600" }}>
                  <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  background: isOpen ? "#8b2424" : "#333",
                  boxShadow: isOpen ? "0 0 8px #8b2424" : "none",
                  display: "inline-block"
                  }} />
                  OPERATIONAL COMPLIANCE
              </div>
              <span style={{ fontSize: "9px", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", opacity: 0.5 }}>
                  ▼
              </span>
            </div>

            {isOpen && (
            <div style={{
                padding: "12px 4px 4px 4px",
                fontSize: "11px",
                lineHeight: "1.6",
                color: "#888",
                borderTop: "1px dashed #222",
                animation: "fadeIn 0.2s ease"
            }}>
                <p style={{ margin: "0 0 8px 0" }}>
                Blockchain structures inherently allow open verification of any cryptographic address. 
                </p>
                <p style={{ margin: "0 0 8px 0", color: "#b5b5b5" }}>
                However, attempting to submit asset purchases or obtaining settlement credits <b style={{ color: "#8b2424", fontWeight: "500" }}>will fail </b> without an active account verified and processed by BG Company.
                </p>
            </div>
            )}
            {/* EXPANDED ASSET POSITION PORTAL */}
            {isAssetModalOpen && (
              <div style={modalStyles.overlay}>
                <div style={{ 
                  ...modalStyles.content, 
                  backgroundColor: "#0a0a0a", 
                  border: "1px solid #161616", 
                  padding: "32px",
                  maxWidth: "750px",
                  display: "flex",          // Set vertical layout order for the whole modal window
                  flexDirection: "column"
                }}>
                  
                  {/* 1. HEADER MATRIX (Strict horizontal split for title and close button) */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: "600", letterSpacing: "1px" }}>
                        CURRENCY PORTFOLIO
                      </h3>
                      <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "11px" }}>
                        Real-time balance breakdown across supported networks
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => setIsAssetModalOpen(false)} 
                      style={{ ...modalStyles.closeButton, color: "#666", fontSize: "24px", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      &times;
                    </button>
                  </div>

                  {/* 2. ARCHITECTURAL LIMITATION BANNER (Moved outside the header so it gets full grid real estate) */}
                  <div style={{
                    margin: "0 0 24px 0",
                    padding: "16px",
                    backgroundColor: "rgba(1, 41, 12, 0.15)",
                    border: "1px solid rgba(1, 41, 12, 0.4)",
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "14px"
                  }}>
                    {/* TOP BLOCK: Notice Text */}
                    <div style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      gap: "4px",
                      textAlign: "center"
                    }}>
                      <span style={{ color: "#1d5c34", fontSize: "11px", fontWeight: "600", letterSpacing: "0.5px" }}>
                        SUPPORTED NETWORKS NOTICE
                      </span>
                      <span style={{ color: "#888", fontSize: "10px", lineHeight: "1.4" }}>
                        Balance validation engines are currently hard-locked to verified execution layers.
                      </span>
                    </div>
                    
                    {/* BOTTOM BLOCK: Centered Tiles */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "center", 
                      alignItems: "center", 
                      gap: "6px",
                      width: "100%"
                    }}>
                      {[ "global", "ethereum", "polygon", "base" ].map((chain) => (
                        <span key={chain} style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          color: chain === "global" ? "#1d5c34" : "#ffffff",
                          backgroundColor: "#111111",
                          border: chain === "global" ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid #222222",
                          padding: "5px 12px",
                          borderRadius: "4px",
                          letterSpacing: "0.5px"
                        }}>
                          {chain}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 3. MATRIX TABLE HEADER */}
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "120px 140px 1fr", 
                    padding: "0 8px 10px 8px", 
                    borderBottom: "1px solid #222", 
                    color: "#444", 
                    fontSize: "10px", 
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    <div>Network</div>
                    <div>Currency</div>
                    <div style={{ textAlign: "right" }}>Liquid Balance</div>
                  </div>

                  {/* 4. EXPANDED DATA LIST STACK */}
                  <div style={{ maxHeight: "400px", overflowY: "auto", marginTop: "8px" }}>
                    {balances.map((token, index) => {
                      const rawBalance = token?.balance || "0";
                      const decimals = typeof token?.decimals === "number" ? token.decimals : 18; 
                      const symbol = token?.symbol || "UNKNOWN";
                      const chain = token?.chain || "network";
                      const address = token?.address || "";
                      
                      let formattedBalance = "0.0000";
                      try {
                        if (typeof rawBalance === 'string' && rawBalance.length > 15) {
                          const pad = rawBalance.padStart(decimals + 1, '0');
                          const splitIdx = pad.length - decimals;
                          const whole = pad.slice(0, splitIdx);
                          const fraction = pad.slice(splitIdx, splitIdx + 4); 
                          formattedBalance = `${Number(whole).toLocaleString()}.${fraction}`;
                        } else {
                          formattedBalance = (Number(rawBalance) / Math.pow(10, decimals)).toFixed(4);
                        }
                      } catch (e) {
                        formattedBalance = "0.0000";
                      }

                      return (
                        <div 
                          key={index} 
                          style={{ 
                            display: "grid", 
                            gridTemplateColumns: "120px 140px 1fr", 
                            alignItems: "center", 
                            padding: "12px 8px", 
                            borderBottom: "1px solid #111",
                            background: index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"
                          }}
                        >
                          {/* CHAIN NETWORK */}
                          <div style={{ display: "flex" }}>
                            <span style={{ 
                              color: chain === "global" ? "#1d5c34" : "#1d5c34", 
                              fontSize: "9px", 
                              textTransform: "uppercase", 
                              backgroundColor: "rgba(52, 211, 153, 0.05)", 
                              border: chain === "global" ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(52, 211, 153, 0.1)",
                              padding: "2px 6px", 
                              borderRadius: "4px",
                              fontWeight: "bold"
                            }}>
                              {chain}
                            </span>
                          </div>

                          {/* TOKEN SYMBOL & ADDRESS TIP */}
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ color: "#fff", fontSize: "13px", fontWeight: "600" }}>{symbol}</span>
                            {address && (
                              <span style={{ ...styles.label, color: "#444", fontSize: "9px" }}>
                                {`${address.slice(0, 6)}...${address.slice(-4)}`}
                              </span>
                            )}
                          </div>

                          {/* UNCONSTRAINED MASSIVE BALANCE */}
                          <div style={{ 
                            textAlign: "right", 
                            fontFamily: "Courier New, Courier", 
                            fontSize: "15px", 
                            fontWeight: "600", 
                            color: "#ffffff" 
                          }}>
                            {formattedBalance}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
        </div>
    </aside>
  );
}