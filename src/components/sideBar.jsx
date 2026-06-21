// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';
import logo from '../assets/logo.png';
import { supportedTokens } from '../utils/tokensX';
import { getExchangeRates } from "../utils/exchangeRates";

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
  purchaseNative,
  isConnected,
  onConnectWallet,
  onDisconnectWallet
}) {
  // Keep your local layout toggle states here
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [showPurchaseDrawer, setShowPurchaseDrawer] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [transactionType, setTransactionType] = useState("deposit");

  // Automatically resolves the hex contract address right before submitting 
  const targetTokenObj = supportedTokens?.find(t => t.symbol === pledgedToken);
  const tokenIdentifier = targetTokenObj?.address || pledgedToken;

  const handleNativePurchase = async () => {
    // 1. Guard check: Ensure wallet state context is bound
    if (!userAddress) {
      alert("Please connect or enter a valid wallet address.");
      return;
    }

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
      console.log(`Initiating purchase for ${pledgedAmount} of token ${pledgedToken}...`);

      // Calculate the expected GBDo output token metrics 
      // formula: amountIn * exchangeRate (or your app's specific custom conversion logic)
      const computedAmountOut = amountFloat * parseFloat(exchangeRate || 1);

      // Generate a pseudo-random, unique tracking hash for the smart contract's replay guard
      // We append the timestamp to a standard 32-byte hex template string
      const uniqueNonce = Math.floor(Math.random() * 1000000);
      const depositHash = `0x${Buffer.from(`DEP-${Date.now()}-${uniqueNonce}`).toString('hex').padEnd(64, '0')}`.slice(0, 66);

      // Construct the exact payload payload format expected by main.js
      const payload = {
        userAddress: userAddress,
        tokenAddress: pledgedToken, // Assuming pledgedToken state holds the token contract address
        amountIn: pledgedAmount,
        amountOut: computedAmountOut.toString(),
        exchangeRate: exchangeRate.toString(),
        depositHash: depositHash
      };

      // Invoke your secure preload contextBridge window method
      const result = await window.electronAPI.submitAcquisition(payload);
      
      // 7. Evaluate explicitly using a safe boolean evaluation
      if (result && result.success) {
        console.log(`Purchase transaction completed successfully. Tx Hash: ${result.txHash}`);
        alert(`Transaction confirmed! Hash: ${result.txHash}`);
        
        // Clear inputs to prevent stale double-submissions
        if (typeof setPledgedAmount === "function") setPledgedAmount("");
        
        // Close out the toggle parameters to minimize cleartext remnants
        if (typeof setShowPurchaseDrawer === "function") setShowPurchaseDrawer(false); 
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
        const symbol = String(pledgedToken || "").toUpperCase();
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
    }, [pledgedToken]);
  
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
              onClick={() => (setShowAuthDrawer(!showAuthDrawer), setShowPurchaseDrawer(false))} 
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
                  background: showAuthDrawer ? "#4ade80" : "#333",
                  boxShadow: showAuthDrawer ? "0 0 8px #4ade80" : "none"
              }} />
              CONNECT WALLET
              </div>
              <span style={{ fontSize: "9px", transform: showAuthDrawer ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", opacity: 0.5 }}>
              ▼
              </span>
          </div>

          {showAuthDrawer && (
              <div style={{ ...styles.configSection, marginTop: "12px", borderTop: "1px dashed #222", paddingTop: "12px" }}>
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
                  <div style={{...styles.cryptoInputWrapper, marginBottom: '16px'}}>
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
                    width: "100%",
                    height: "70px",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    resize: "none",
                    color: keystoreJson ? "#4ade80" : "#888",
                    fontSize: "10px",
                    fontFamily: "monospace",
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
                        width: "100%",
                        height: "60px",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        resize: "none",
                        color: mnemonicPhrase ? "#4ade80" : "#888",
                        fontSize: "10px",
                        fontFamily: "monospace",
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

              <button style={{
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
              </div>
          )}
        </div>

        {/* PURCHASE GBDo / NATIVE DRAWER */}
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", margin: "0 12px 16px 12px" }}>
          <div 
              onClick={() => (setShowPurchaseDrawer(!showPurchaseDrawer), setShowAuthDrawer(false))} 
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
                  background: showPurchaseDrawer ? "#4ade80" : "#333",
                  boxShadow: showPurchaseDrawer ? "0 0 8px #4ade80" : "none"
              }} />
              GBDo GATEWAY
              </div>
              <span style={{ fontSize: "9px", transform: showPurchaseDrawer ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", opacity: 0.5 }}>
              ▼
              </span>
          </div>

          {showPurchaseDrawer && (
              <div style={{ ...styles.configSection, marginTop: "12px", borderTop: "1px dashed #222", paddingTop: "12px" }}>
              {!isConnected && (
                <p style={styles.microText}>Wallet connection required to proceed.</p>
              )}
              

              {/* NATIVE PURCHASE & LIQUIDATION MODAL LAYER */}
              {!isConnected && (
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
                        fontWeight: "700",
                        borderRadius: "4px",
                        border: "1px solid #222",
                        cursor: "pointer",
                        background: transactionType === "deposit" ? "#1a1a1a" : "transparent",
                        color: transactionType === "deposit" ? "#4ade80" : "#666",
                      }}
                      onClick={() => {
                        setTransactionType("deposit");
                        setPledgedAmount(""); // Reset inputs on switch to keep states clean
                      }}
                    >
                      DEPOSIT NATIVE
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
                      CASH OUT NATIVE
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
                        value={pledgedToken}
                        onChange={(e) => setPledgedToken(e.target.value)}
                      >
                        <option value="" disabled style={{ background: "#121212" }}>
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
                          placeholder={transactionType === "deposit" ? "Enter Amount Requested" : "Enter Amount to Cash Out"}
                          style={{...styles.sidebarInput, marginBottom: 0, paddingRight: '45px'}}
                          value={pledgedAmount}
                          onChange={(e) => {
                            const formatted = formatMoneyFromDigits(e.target.value);
                            setPledgedAmount(formatted);
                          }}
                        />
                      </div>

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
                            {transactionType === "deposit" ? "ESTIMATED GBDo" : `ESTIMATED ${pledgedToken || "NATIVE"}`}
                          </span>
                          <span style={{ 
                            fontSize: "13px", 
                            color: pledgedAmount && exchangeRate ? "#4ade80" : "#444", 
                            fontWeight: "400", 
                            fontFamily: "monospace" 
                          }}>
                            {(() => {
                              const amount = parseFloat(String(pledgedAmount).replace(/,/g, ''));
                              const rate = parseFloat(exchangeRate);
                              
                              if (!isNaN(amount) && !isNaN(rate) && amount > 0 && rate > 0) {
                                if (transactionType === "deposit") {
                                  // Deposit: Token Amount * Rate = GBDo Received
                                  const totalGbdo = amount * rate;
                                  return `${totalGbdo.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} GBDo`;
                                } else {
                                  // Cash Out: GBDo Amount / Rate = Native Token Returned
                                  const totalNative = amount / rate;
                                  return `${totalNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${pledgedToken}`;
                                }
                              }
                              
                              return transactionType === "deposit" ? "0.00 GBDo" : `0.0000 ${pledgedToken || "Token"}`;
                            })()}
                          </span>
                        </div>

                        {/* EXCHANGE RATE SUBTEXT */}
                        {exchangeRate && pledgedToken && (
                          <div style={{ fontSize: "10px", color: "#666", margin: "2px 0 8px 4px", display: "flex", justifyContent: "space-between" }}>
                            <span>CONVERSION RATE:</span>
                            <span style={{ fontFamily: "monospace", color: "#aaa" }}>
                              1 {pledgedToken} ≈ {isFinite(parseFloat(exchangeRate)) ? parseFloat(exchangeRate).toFixed(4) : "0.00"} GBDo
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
                  SUBMIT PURCHASE
                  </button>
              )}
              </div>
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
              background: isConnected ? "#4ade80" : "#333",
              boxShadow: isConnected ? "0 0 8px #4ade80" : "none",
              display: "inline-block"
            }} />
            WORKSPACE PORTALS
          </span>
          
          <button 
              onClick={() => setPortalView('admin')}
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
              onClick={() => setPortalView('gateway')}
              style={{
              ...styles.navItem, 
              background: portalView === 'gateway' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'gateway' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'gateway' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "9px", fontWeight: "lighter", cursor: "pointer"
              }}
          >
              GBDo GATEWAY
          </button>

          <button 
              onClick={() => setPortalView('swap')}
              style={{
              ...styles.navItem, 
              background: portalView === 'swap' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'swap' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'swap' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "9px", fontWeight: "lighter", cursor: "pointer"
              }}
          >
              XHANGE DASHBOARD
          </button>

          <button 
              onClick={() => setPortalView('affiliate')}
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
              onClick={() => setPortalView('wholesale')}
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
              onClick={() => setPortalView('investments')}
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
        <div style={{ 
        background: "rgba(0, 0, 0, 0.4)", 
        padding: "14px 12px", 
        borderRadius: "4px", 
        border: "1px solid #000000d0", 
        margin: "0 12px 24px 12px",
        fontSize: "12px",
        fontFamily: "system-ui, sans-serif"
        }}>
        <span style={{ color: "#666", display: "block", marginBottom: "12px", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter" }}>
            ACCOUNT BALANCES:
        </span>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {isConnected ? (
                // SAFE CHECK: Defends your layout if balances is null/undefined or not an array
                (!balances || !Array.isArray(balances) || balances.length === 0) ? (
                <div style={{ color: "#555", fontStyle: "italic" }}>No positive balances found or loading...</div>
                ) : (
                    balances.map((token, index) => {
                        // COMPLIANCE FALLBACKS: Prevents calculation explosions if properties are missing
                        const rawBalance = token?.balance || "0";
                        const decimals = typeof token?.decimals === "number" ? token.decimals : 18; 
                        const symbol = token?.symbol || "UNKNOWN";
                        const chain = token?.chain || "network";
                        const uniqueKey = token?.address ? `${chain}-${token.address}` : `${chain}-${symbol}-${index}`;

                        let formattedBalance = "0.0000";

                        try {
                        // HYBRID INT MATH: Uses floating strings if parsing a massive native BigInt string
                        if (typeof rawBalance === 'string' && rawBalance.length > 15) {
                            const pad = rawBalance.padStart(decimals + 1, '0');
                            const splitIdx = pad.length - decimals;
                            const whole = pad.slice(0, splitIdx);
                            const fraction = pad.slice(splitIdx, splitIdx + 4); // Capture up to 4 decimal places
                            formattedBalance = `${Number(whole).toLocaleString()}.${fraction}`;
                        } else {
                            formattedBalance = (Number(rawBalance) / Math.pow(10, decimals)).toFixed(4);
                        }
                        } catch (mathErr) {
                        console.error("Balance parser engine failed:", mathErr);
                        formattedBalance = "0.0000";
                        }

                        return (
                        <div 
                            key={uniqueKey} 
                            style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                            paddingBottom: "6px"
                            }}
                        >
                            <div>
                            <span style={{ color: "#888", fontSize: "9px", textTransform: "uppercase", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>
                                {chain}
                            </span>
                            <span style={{ color: "#ffffff", fontSize: "11px", fontWeight: "600", marginRight: "6px" }}>
                                {symbol}
                            </span>
                            </div>
                            
                            <b style={{ color: "#d3d3d3", fontSize: "9px", fontWeight: "bold", fontFamily: "monospace" }}>
                            {formattedBalance}
                            </b>
                        </div>
                        );
                    })
                )
            ) : (
                <span style={{ color: "#ef4444", fontWeight: "lighter", fontSize: "9px" }}>NO WALLET DETECTED</span>
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
            onClick={() => setIsOpen(!isOpen)}
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
        </div>
    </aside>
  );
}