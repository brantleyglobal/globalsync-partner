// src/components/CoreAdminEngine.jsx
import React, { useState } from 'react';
import { useRpcStatus } from "../utils/statusRpc";

export default function CoreAdminEngine({
  styles,
  userAddress,
  authMethod,
  selectedType,
  setSelectedType,
  selectedLType,
  setSelectedLType,
  selectedContract,
  setSelectedContract,
  selectedLContract,
  setSelectedLContract,
  contracts,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  handleTimestampQuery,
  timestampResults,
  selectedTermNumber,
  setSelectedTermNumber,
  walletAddress,
  setWalletAddress,
  handleUserQuery,
  userQueryResults,
  supportedTokens,
  setSelectedTokenAddress,
  setSelectedTokenDecimals,
  setSelectedTokenChain,
  transactionHash,
  setTransactionHash,
  custodialWallet,
  setCustodialWallet,
  handleVerifyDeposit,
  isConnected,
}) {

  const rpcUp = useRpcStatus();

  const [queryMode, setQueryMode] = React.useState("USER");
  const [swapWalletAddress, setSwapWalletAddress] = useState("");
  const [swapQueryResults, setSwapQueryResults] = useState(null);

  const handleSwapQuery = async () => {
    if (!swapWalletAddress || !swapWalletAddress.startsWith('0x')) {
      setSwapQueryResults({ 
        status: "Error", 
        message: "Please enter a structurally valid cryptographic hex address." 
      });
      return;
    }

    setSwapQueryResults({ status: "Querying", message: `Executing ${queryMode} query ledger route...` });

    try {
      // Pass both parameters down the line to main.js
      const response = await window.electronAPI.querySwapRegistry({
        mode: queryMode || "USER",
        target: swapWalletAddress
      });
      setSwapQueryResults(response);
    } catch (error) {
      setSwapQueryResults({ 
        status: "Exception", 
        message: "Context bridge execution exception." 
      });
    }
  };

  return (
    <main style={{ ...styles.mainContent, scrollbarWidth: "thin" }}>
      {/* GLOBAL SESSION STATUS BAR */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
        
        {/* HEADER LAYER: Matched perfectly to the premium blueprint layout */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "16px", marginBottom: "20px" }}>
          
          {/* Left Side: Clean Title */}
          <div>
            <h1 style={{ ...styles.label, color: "#ffffff", fontSize: "20px", fontWeight: "300", letterSpacing: "1px", margin: "0" }}>
              ADMINISTRATIVE DASHBOARD
            </h1>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "0.5px", margin: 0 }}>
              MANAGE ASSOCIATED USERS & OVERSEE TRANSACTION HISTORY
            </p>
          </div>
          
          {/* Right Side: Consolidated Status Bar with Wallet Telemetry */}
          <div style={{ ...styles.label, display: "flex", gap: "24px", fontSize: "11px", letterSpacing: "0.5px" }}>
            <div>
              <span style={{ color: "#444" }}>NETWORK: </span>
              <span style={{ color: rpcUp > 0 ? "#1c9c31bd" : "#ef4444" }}>
                {rpcUp > 0 ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div>
              <span style={{ color: "#444" }}>ACTIVE WALLET: </span>
              <span style={{ color: isConnected && userAddress ? "#1c9c31bd" : "#555" }}>
                {isConnected && userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`.toUpperCase() : "0XNONE"}
              </span>
            </div>
          </div>
        </div>

        {/* NEW ETCHED HORIZONTAL DIVIDER */}
        <div style={{ display: "flex", alignItems: "center", width: "100%", paddingTop: "20px", margin: "0 0 40px 0" }}>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.49) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
        </div>
      </div>  

      {/* ACCESS & OPERATIONAL MONITOR */}
      {(!isConnected) && (
        <div style={{ ...styles.jsonDisplay, color: "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {!userAddress && <div>Ready to initialize. Connect your wallet to query records and process transactions.</div>}
        </div>
      )}
      
      {/* =======================================================================
          TOP ROW: SYMMETRICAL INTERACTION CARDS (2-COLUMN FIXED INFRASTRUCTURE)
          ======================================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "stretch", marginBottom: "24px" }}>
        
        {/* LEFT BLOCK: PRIMARY CORE LEDGER INTEGRATIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* SECTION 1 — TIMESTAMP METADATA FORM */}
          <div style={{ ...styles.sectionCard, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h2 style={styles.sectionTitle}>TIMESTAMP QUERY ENGINE</h2>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>QUERY TYPE</label>
                  <select
                    style={styles.inputElement}
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    <option value="" disabled style={{ background: "#121212", color: "#555" }}>Log Type</option>
                    <option value="DEPOSIT" style={{ background: "#121212" }}>Deposit Logs</option>
                    <option value="WITHDRAW" style={{ background: "#121212" }}>Withdraw Logs</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>TARGET CONTRACT</label>
                  <select
                    style={styles.inputElement}
                    value={selectedContract}
                    onChange={(e) => setSelectedContract(e.target.value)}
                  >
                    <option value="" disabled style={{ background: "#121212" }}>Contract</option>
                    {contracts.map((c) => (
                      <option key={c.address} value={c.address} style={{ background: "#121212" }}>
                        {c.name} ({c.address ? `${c.address.slice(0,6)}...` : 'No Hex'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>START DATE</label>
                  <input
                    type="date"
                    style={styles.inputElement}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>END DATE</label>
                  <input
                    type="date"
                    style={styles.inputElement}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button style={{ ...styles.btnForestGreen, marginTop: "16px" }} onClick={handleTimestampQuery}>
              EXECUTE QUERY
            </button>
          </div>

          {/* SECTION 2 — DEPOSIT VERIFICATION */}
          <div style={{ ...styles.sectionCard, margin: 0 }}>
            <h2 style={styles.sectionTitle}>DEPOSIT VERIFICATION</h2>
            <label style={styles.label}>DEPOSIT TRANSACTION HASH</label>
            <input type="text" placeholder="0x..." style={styles.inputElement} value={transactionHash} onChange={(e) => setTransactionHash(e.target.value)} />
            
            <label style={styles.label}>SETTLEMENT CUSTODIAL VAULT</label>
            <select style={{ ...styles.inputElement, marginBottom: "20px" }} value={custodialWallet} onChange={(e) => setCustodialWallet(e.target.value)}>
              <option value="" style={{ background: "#121212" }}>Select Vault Interface Account</option>
              {contracts.map((c) => (
                <option key={c.address} value={c.address} style={{ background: "#121212" }}>
                  {c.name}
                </option>
              ))}
            </select>

            <button style={styles.btnForestGreen} onClick={handleVerifyDeposit}>
              SUBMIT VERIFICATION
            </button>
          </div>
        </div>

        {/* RIGHT BLOCK: SWAP REGISTRY & USER TRANSACTIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* SECTION 3 — USER ACCOUNT MATRIX AUDITOR */}
          <div style={{ ...styles.sectionCard, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h2 style={styles.sectionTitle}>USER TRANSACTIONS</h2>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>HISTORY TYPE</label>
                  <select
                    style={styles.inputElement}
                    value={selectedLType}
                    onChange={(e) => setSelectedLType(e.target.value)}
                  >
                    <option value="" disabled style={{ background: "#121212" }}>Transaction Type</option>
                    <option value="DEPOSIT" style={{ background: "#121212" }}>Deposits</option>
                    <option value="WITHDRAW" style={{ background: "#121212" }}>Withdrawals</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>MAX LOG RETRIEVAL COUNT</label>
                  <input
                    style={styles.inputElement}
                    placeholder="Default max: 5 logs"
                    value={selectedTermNumber}
                    onChange={(e) => setSelectedTermNumber(e.target.value)}
                  />
                </div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>TARGET WALLET ADDRESS</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    style={styles.inputElement}
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>TARGET CONTRACT</label>
                  <select
                    style={styles.inputElement}
                    value={selectedLContract}
                    onChange={(e) => setSelectedLContract(e.target.value)}
                  >
                    <option value="" disabled style={{ background: "#121212" }}>Contract</option>
                    {contracts.map((c) => (
                      <option key={c.address} value={c.address} style={{ background: "#121212" }}>
                        {c.name} ({c.address ? `${c.address.slice(0,6)}...` : 'No Hex'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <button style={{ ...styles.btnForestGreen, marginTop: "16px" }} onClick={handleUserQuery}>
              PULL LEDGER HISTORY
            </button>
          </div>
          
          {/* SECTION 4 — XCHANGE REGISTRY ESCROW */}
          <div style={{ ...styles.sectionCard, margin: 0 }}>
            <h2 style={styles.sectionTitle}>XCHANGE ESCROW (SWAPS)</h2>
            
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>FILTER MODE</label>
                <select
                  style={styles.inputElement}
                  value={queryMode || "USER"}
                  onChange={(e) => setQueryMode(e.target.value)}
                >
                  <option value="USER" style={{ background: "#121212" }}>User Address (Party A/B)</option>
                  <option value="SWAP" style={{ background: "#121212" }}>XChange | Swap Address</option>
                </select>
              </div>
            </div>

            <label style={styles.label}>
              {queryMode === "SWAP" ? "XCHANGE ADDRESS" : "USER WALLET ADDRESS"}
            </label>
            <input
              type="text"
              placeholder="0x..."
              style={styles.inputElement}
              value={swapWalletAddress || ''}
              onChange={(e) => setSwapWalletAddress(e.target.value)}
            />

            <button style={styles.btnForestGreen} onClick={handleSwapQuery}>
              QUERY XCHANGE
            </button>
          </div>
        </div> {/* END RIGHT BLOCK */}
      </div> {/* END TOP ROW INPUT GRID */}

      {/* =======================================================================
          BOTTOM ROW: UNIFIED LEDGER TELEMETRY TERMINAL (FULL-WIDTH DISPLAY OUT)
          ======================================================================= */}
      <div style={styles.sectionCard}>
        <style dangerouslySetInnerHTML={{__html: `
        .clean-scrollbar::-webkit-scrollbar { width: 4px !important; height: 6px !important; }
        .clean-scrollbar::-webkit-scrollbar-track { background: transparent !important; }
        .clean-scrollbar::-webkit-scrollbar-thumb { background: #333 !important; border-radius: 2px !important; }
        .clean-scrollbar::-webkit-scrollbar-thumb:hover { background: #444 !important; }
      `}} />
        <h2 style={styles.sectionTitle}>OUTPUT CONSOLE</h2>
        <p style={{ color: "#555", fontSize: "11px", margin: "-10px 0 16px 0", letterSpacing: "0.5px" }}></p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", minWidth: 0 }}>
          
          <div style={{ minWidth: 0 }}>
            <span style={{ ...styles.label, fontSize: "10px", color: "#8d8d8d" }}>CORE SYSTEM | USER QUERY LOGS</span>
            <pre 
            className="clean-scrollbar"
            style={{ 
              ...styles.jsonDisplay, 
              overflowY: "auto", 
              maxHeight: "220px", 
              marginTop: "6px", 
              background: "#050505", 
              border: "1px solid #222",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              overflowWrap: "break-word",
              scrollbarWidth: "thin"
            }}>
              {(() => {
                const activeData = timestampResults || userQueryResults;
                if (!activeData || (Array.isArray(activeData) && activeData.length === 0)) {
                  return JSON.stringify({ status: "IDLE", message: "Console pipeline open. Awaiting user telemetry inputs." }, null, 2);
                }
                return JSON.stringify(activeData, null, 2);
              })()}
            </pre>
          </div>

          <div style={{ minWidth: 0 }}>
            <span style={{ ...styles.label, fontSize: "10px", color: "#8d8d8d" }}>XCHANGE REGISTRY OUTPUTS</span>
            <pre 
            className="clean-scrollbar"
            style={{ 
              ...styles.jsonDisplay, 
              overflowY: "auto", 
              maxHeight: "220px", 
              marginTop: "6px", 
              background: "#050505", 
              border: "1px solid #222",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              overflowWrap: "break-word",
              scrollbarWidth: "thin"
            }}>
              {JSON.stringify(swapQueryResults || { status: "IDLE", message: "XChange sub-matrix pipeline open. Awaiting hash target inputs." }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
}