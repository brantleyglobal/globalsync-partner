// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { styles } from '../utils/styles.jsx';
import logo from '../assets/logo.png';

export default function Sidebar({ 
  portalView, 
  setPortalView, 
  userAddress, 
  setUserAddress, 
  balances = [] // Defaulting to an array prevents crashing if undefined
}) {
  // Keep your local layout toggle states here
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // operational compliance drawer
  const [authMethod, setAuthMethod] = useState('privateKey');
  
  // Keep your local input visibility states here
  const [showKey, setShowKey] = useState(false);
  const [showKeystorePass, setShowKeystorePass] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  // Keep your form states here
  const [privateKey, setPrivateKey] = useState('');
  const [keystoreJson, setKeystoreJson] = useState('');
  const [keystorePassword, setKeystorePassword] = useState('');
  const [mnemonicPhrase, setMnemonicPhrase] = useState('');

  const handleSaveCredentials = () => { /* ... your logic */ };
  const handleDisconnectWallet = () => { /* ... your logic */ };

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
        
        <hr style={styles.divider} />
        
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
                color: showAuthDrawer ? "#4ade80" : "#555" 
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
              SIGN IN & CREDENTIALS
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

              <button style={{...styles.btnForestGreen, background: "#0a0a0a", fontWeight: "lighter", marginBottom: "8px"}} onClick={handleSaveCredentials}>
                  INITIALIZE CREDENTIALS
              </button>

              {userAddress && (
                  <button 
                  type="button"
                  onClick={handleDisconnectWallet}
                  style={{
                      width: "100%",
                      padding: "8px",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: "4px",
                      color: "#ef4444",
                      fontSize: "11px",
                      fontWeight: "600",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                      e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                      e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
                  }}
                  >
                  DISCONNECT WALLET
                  </button>
              )}
              </div>
          )}
        </div>

        {/* PORTAL VIEW SELECTION SYSTEM */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "0 12px 16px 12px", fontFamily: "system-ui" }}>
          <span style={{ color: "#444", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", marginBottom: "4px" }}>
            <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  background: showAuthDrawer ? "#4ade80" : "#333",
                  boxShadow: showAuthDrawer ? "0 0 8px #4ade80" : "none"
              }} />
              WORKSPACE PORTALS:
          </span>
          
          <button 
              onClick={() => setPortalView('admin')}
              style={{
              ...styles.navItem, 
              background: portalView === 'admin' ? "rgba(74, 222, 128, 0.08)" : "transparent",
              color: portalView === 'admin' ? "#4ade80" : "#777",
              border: "1px solid " + (portalView === 'admin' ? "rgba(74, 222, 128, 0.2)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer"
              }}
          >
              Core Admin Engine
          </button>

          <button 
              onClick={() => setPortalView('affiliate')}
              style={{
              ...styles.navItem, 
              background: portalView === 'affiliate' ? "rgba(74, 222, 128, 0.08)" : "transparent",
              color: portalView === 'affiliate' ? "#4ade80" : "#777",
              border: "1px solid " + (portalView === 'affiliate' ? "rgba(74, 222, 128, 0.2)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer"
              }}
          >
              Affiliate Matrix
          </button>

          <button 
              onClick={() => setPortalView('wholesale')}
              style={{
              ...styles.navItem, 
              background: portalView === 'wholesale' ? "rgba(74, 222, 128, 0.08)" : "transparent",
              color: portalView === 'wholesale' ? "#4ade80" : "#777",
              border: "1px solid " + (portalView === 'wholesale' ? "rgba(74, 222, 128, 0.2)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer"
              }}
          >
              Wholesale Partner Matrix
          </button>

          <button 
              onClick={() => setPortalView('investments')}
              style={{
              ...styles.navItem, 
              background: portalView === 'investments' ? "rgba(74, 222, 128, 0.08)" : "transparent",
              color: portalView === 'investments' ? "#4ade80" : "#777",
              border: "1px solid " + (portalView === 'investments' ? "rgba(74, 222, 128, 0.2)" : "transparent"),
              padding: "8px 12px", textAlign: "left", borderRadius: "4px", fontSize: "11px", fontWeight: "600", cursor: "pointer"
              }}
          >
              Investment Portfolio Matrix
          </button>
        </div>

        <hr style={styles.divider} />

        {/* ACCOUNT BALANCES DISPLAY (MIDDLE PANEL) */}
        <div style={{ 
          background: "rgba(0, 0, 0, 0.25)", 
          padding: "14px 12px", 
          borderRadius: "4px", 
          border: "1px solid #14141400", 
          margin: "0 12px 24px 12px",
          fontSize: "12px",
          fontFamily: "system-ui, sans-serif"
        }}>
          <span style={{ color: "#666", display: "block", marginBottom: "12px", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold" }}>
              ACCOUNT BALANCES:
          </span>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {balances.length === 0 ? (
              <div style={{ color: "#555", fontStyle: "italic" }}>No positive balances found or loading...</div>
              ) : (
              balances.map((token) => {
                  const formattedBalance = (Number(token.balance) / Math.pow(10, token.decimals)).toFixed(4);

                  return (
                  <div 
                      key={`${token.chain}-${token.address}`} 
                      style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                      paddingBottom: "6px"
                      }}
                  >
                      <div>
                      <span style={{ color: "#ffffff", fontWeight: "600", marginRight: "6px" }}>
                          {token.symbol}
                      </span>
                      <span style={{ color: "#444", fontSize: "9px", textTransform: "uppercase", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>
                          {token.chain}
                      </span>
                      </div>
                      
                      <b style={{ color: "#d3d3d3", fontSize: "13px", fontWeight: "bold", fontFamily: "monospace" }}>
                      {formattedBalance}
                      </b>
                  </div>
                  );
              })
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
                color: isOpen ? "#f87171" : "#555" 
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = isOpen ? "#f87171" : "#888"}
            onMouseLeave={(e) => e.currentTarget.style.color = isOpen ? "#f87171" : "#555"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", letterSpacing: "1px", fontWeight: "600" }}>
                  <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  background: isOpen ? "#f87171" : "#333",
                  boxShadow: isOpen ? "0 0 8px #f87171" : "none",
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
                However, executing asset purchases or routing settlement credits for managed nodes <b style={{ color: "#f87171", fontWeight: "500" }}>will fail</b> without an active, verified account relationship established directly with BG Company.
                </p>
                <p style={{ margin: "0", color: "#555", fontStyle: "italic" }}>
                Enforcing strict off-chain mapping is required prior to execution.
                </p>
            </div>
            )}
        </div>
    </aside>
  );
}