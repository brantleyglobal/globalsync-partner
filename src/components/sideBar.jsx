// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { styles } from '../utils/styles.jsx';
import logo from '../assets/logo.png';

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
  isConnected,
  onConnectWallet,
  onDisconnectWallet
}) {
  // Keep your local layout toggle states here
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // operational compliance drawer

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

  return (
    <aside style={{
        ...styles.sidebar,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowY: "auto",
        scrollbarGutter: "stable",
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
        
        {/*<hr style={styles.divider} />*/}
        
        {/* 1. SIGN-IN / CREDENTIALS DRAWER */}
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", margin: "0 12px 16px 12px" }}>
          <div 
              onClick={() => setShowAuthDrawer(!showAuthDrawer)} 
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

              {/* OPTION 2: KEYSTORE */}
              {authMethod === 'keystore' && (
                  <>
                  <label style={styles.label}>KEYSTORE JSON</label>
                  <textarea
                      placeholder='{"version":3,"id":"..."}'
                      style={styles.sidebarInput}
                      value={keystoreJson}
                      onChange={(e) => setKeystoreJson(e.target.value)}
                  />

                  <label style={{...styles.label, marginTop:'10px'}}>KEYSTORE PASSWORD</label>
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
                  <div style={{...styles.cryptoInputWrapper, marginBottom: '16px'}}>
                      <textarea
                        key={`mnemonic-field-${mnemonicPhrase === ''}`}
                        placeholder="word1 word2 word3..."
                        style={{...styles.sidebarInput, height: '70px', paddingRight: '45px', WebkitTextSecurity: showMnemonic ? 'none' : 'disc'}}
                        value={mnemonicPhrase}
                        onChange={(e) => setMnemonicPhrase(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowMnemonic(!showMnemonic)} style={{...styles.visibilityToggle, top: '20px'}}>
                        {showMnemonic ? "Hide" : "Show"}
                      </button>
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

        {/*<hr style={styles.divider} />*/}

        {/* PORTAL VIEW SELECTION SYSTEM */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "0 12px 16px 12px", marginTop: "30px", fontFamily: "system-ui" }}>
          <span style={{ color: "#444", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", marginBottom: "4px" }}>
            <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  background: showAuthDrawer ? "#050505" : "#333",
                  boxShadow: showAuthDrawer ? "0 0 8px #131614" : "none",
                  borderTop: "1px solid #1a1a1a",
                  borderBottom: "1px solid #1a1a1a"
              }} />
              WORKSPACE PORTALS:
          </span>
          
          <button 
              onClick={() => setPortalView('admin')}
              style={{
              ...styles.navItem, 
              background: portalView === 'admin' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'admin' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'admin' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer"
              }}
          >
              Administrative Dashboard
          </button>

          <button 
              onClick={() => setPortalView('affiliate')}
              style={{
              ...styles.navItem, 
              background: portalView === 'affiliate' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'affiliate' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'affiliate' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer"
              }}
          >
              Affiliate Matrix
          </button>

          <button 
              onClick={() => setPortalView('wholesale')}
              style={{
              ...styles.navItem, 
              background: portalView === 'wholesale' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'wholesale' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'wholesale' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer"
              }}
          >
              Wholesale Partner Matrix
          </button>

          <button 
              onClick={() => setPortalView('investments')}
              style={{
              ...styles.navItem, 
              background: portalView === 'investments' ? "rgba(0, 0, 0, 0.36)" : "transparent",
              color: portalView === 'investments' ? "#5b6b5f" : "#777",
              border: "1px solid " + (portalView === 'investments' ? "rgba(0, 0, 0, 0.31)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer"
              }}
          >
              Investor Matrix
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
        <span style={{ color: "#666", display: "block", marginBottom: "12px", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold" }}>
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
                <span style={{ color: "#ef4444", fontWeight: "400", fontSize: "10px" }}>NO WALLET DETECTED</span>
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