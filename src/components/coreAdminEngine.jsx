// src/components/CoreAdminEngine.jsx
import React from 'react';

export default function CoreAdminEngine({
  styles,
  userAddress,
  authMethod,
  selectedType,
  setSelectedType,
  selectedContract,
  setSelectedContract,
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
  selectedAssetKey,
  setSelectedAssetKey,
  selectedPanelKey,
  setSelectedPanelKey,
  selectedGridTieKey,
  setSelectedGridTieKey,
  selectedMonitoringKey,
  setSelectedMonitoringKey,
  selectedCountryKey,
  setSelectedCountryKey,
  selectedStableTokenSymbol,
  setSelectedStableTokenSymbol,
  supportedTokens,
  setSelectedTokenAddress,
  setSelectedTokenDecimals,
  setSelectedTokenChain,
  purchaseTxHash,
  setPurchaseTxHash,
  buyerWalletAddress,
  setBuyerWalletAddress,
  genData,
  selectedVoltage,
  setSelectedVoltage,
  selectedFrequency,
  setSelectedFrequency,
  selectedPhase,
  setSelectedPhase,
  selectedReactor,
  setSelectedReactor,
  handlePurchase,
  transactionHash,
  setTransactionHash,
  custodialWallet,
  setCustodialWallet,
  handleVerifyDeposit
}) {
  return (
    <main style={styles.mainContent}>
      {/* GLOBAL SESSION STATUS BAR */}
       <div style={{ paddingTop: "10px", marginBottom: "30px", borderBottom: "1px solid #161616", paddingBottom: "16px" }}>
               
            {/* FLEX CONTAINER TO ALIGN ITEMS SIDE-BY-SIDE */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
                
                {/* LEFT FLANK: IDENTITY & STATUS */}
                <div>
                    <h1 style={{ ...styles.title, fontWeight: "100", margin: 0, paddingBottom: "4px" }}>ADMIN ENGINE</h1>
                    <p style={{ ...styles.subtitle, margin: 0 }}>
                        ACCOUNT STATUS: {userAddress ? (
                        <span style={{ fontFamily: "monospace", color: "#4ade80", fontWeight: "600" }}>ACTIVE</span>
                        ) : (
                        <span style={{ color: "#ef4444", fontWeight: "600" }}>DISCONNECTED</span>
                        )}
                    </p>
                </div>
                
                {/* RIGHT FLANK: ANCHORED ACTIVE WALLET COMPONENT */}
                <div style={{ display: "flex", alignItems: "center", fontSize: "13px" }}>
                    <span style={{ color: "#888", marginRight: "8px", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>ACTIVE WALLET:</span>
                    <code style={{ 
                        background: "#0a0a0a", 
                        padding: "6px 12px", 
                        borderRadius: "4px", 
                        color: userAddress ? "#00e676" : "#555",
                        fontFamily: "monospace",
                        border: "1px solid #111"
                    }}>
                        {userAddress 
                        ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` 
                        : "0xNone"}
                    </code>
                </div>

            </div>
        </div>
      
      {/* TWO-COLUMN DASHBOARD LAYOUT GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* COLUMN 1: CONTRACT READS & AUDIT DATA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* SECTION 1 — CONTRACT QUERIES */}
          <div style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>TIMESTAMP QUERY</h2>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>TYPE</label>
                <select
                  style={styles.inputElement}
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="" disabled style={{ background: "#121212" }}>Select Query Type</option>
                  <option value="DEPOSIT" style={{ background: "#121212" }}>Deposit</option>
                  <option value="WITHDRAW" style={{ background: "#121212" }}>Withdraw</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>CONTRACT</label>
                <select
                  style={styles.inputElement}
                  value={selectedContract}
                  onChange={(e) => setSelectedContract(e.target.value)}
                >
                  <option value="" disabled style={{ background: "#121212" }}>Select Contract</option>
                  {contracts.map((c) => (
                    <option key={c.address} value={c.address} style={{ background: "#121212" }}>
                      {c.name} ({c.address ? `${c.address.slice(0,6)}...` : 'No Address'})
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

            <button style={styles.btnForestGreen} onClick={handleTimestampQuery}>
              QUERY TIMESTAMPS
            </button>

            <h3 style={styles.resultsLabel}>CONTRACT RESULTS</h3>
            <pre style={{ ...styles.jsonDisplay, overflowX: "auto", maxHeight: "250px" }}>
              {JSON.stringify(timestampResults, null, 2)}
            </pre>
          </div>

          {/* SECTION 2 — USER TRANSACTION HISTORY */}
          <div style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>USER TRANSACTION HISTORY</h2>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>TYPE</label>
                <select
                  style={styles.inputElement}
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="" disabled style={{ background: "#121212" }}>Select Query Type</option>
                  <option value="DEPOSIT" style={{ background: "#121212" }}>Deposit</option>
                  <option value="WITHDRAW" style={{ background: "#121212" }}>Withdraw</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>TERM COUNT</label>
                <input
                  style={styles.inputElement}
                  placeholder="Default 5"
                  value={selectedTermNumber}
                  onChange={(e) => setSelectedTermNumber(e.target.value)}
                />
              </div>
            </div>

            <label style={styles.label}>WALLET ADDRESS</label>
            <input
              type="text"
              placeholder="0x..."
              style={styles.inputElement}
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
            />

            <button style={styles.btnForestGreen} onClick={handleUserQuery}>
              Query User Activity
            </button>

            <h3 style={styles.resultsLabel}>USER RESULTS</h3>
            <pre style={{ ...styles.jsonDisplay, overflowX: "auto", maxHeight: "250px" }}>
              {JSON.stringify(userQueryResults, null, 2)}
            </pre>
          </div>
        </div>

        {/* COLUMN 2: ASSET SETTLEMENTS & DEPOSITS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* SECTION 3 — ASSET PURCHASE */}
          <div style={styles.sectionCard}>
            <h3 style={styles.sectionTitle}>ASSET PURCHASE</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={styles.label}>ASSET POWER MODEL</label>
                <select 
                  style={styles.inputElement} 
                  value={selectedAssetKey} 
                  onChange={(e) => {
                    setSelectedAssetKey(e.target.value);
                    setSelectedPanelKey("");
                    setSelectedGridTieKey("");
                    setSelectedMonitoringKey("");
                    setSelectedCountryKey("");
                  }}
                >
                  <option value="">Select unit footprint...</option>
                  {Object.keys(genData).map(key => (
                    <option key={key} value={key}>{key} (ID: {genData[key].assetId})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>PANEL CONFIGURATION</label>
                <select 
                  style={styles.inputElement} 
                  disabled={!selectedAssetKey}
                  value={selectedPanelKey} 
                  onChange={(e) => setSelectedPanelKey(e.target.value)}
                >
                  <option value="">Select structural panel...</option>
                  {selectedAssetKey && Object.keys(genData[selectedAssetKey].panel).map(key => (
                    <option key={key} value={key}>
                      {genData[selectedAssetKey].panel[key].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedAssetKey && selectedPanelKey && genData[selectedAssetKey].panel[selectedPanelKey]?.label === "Customize" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px", padding: "12px", background: "#0a0a0a", borderRadius: "6px", border: "1px dashed #222" }}>
                <div>
                  <label style={styles.label}>VOLTAGE</label>
                  <input type="number" style={styles.inputElement} value={selectedVoltage} onChange={(e) => setSelectedVoltage(e.target.value)} placeholder="240" />
                </div>
                <div>
                  <label style={styles.label}>FREQUENCY</label>
                  <select style={styles.inputElement} value={selectedFrequency} onChange={(e) => setSelectedFrequency(e.target.value)}>
                    <option value="60Hz">60Hz</option>
                    <option value="50Hz">50Hz</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>PHASE TYPE</label>
                  <select style={styles.inputElement} value={selectedPhase} onChange={(e) => setSelectedPhase(e.target.value)}>
                    <option value="Single-Phase">Single-Phase</option>
                    <option value="Split-Phase">Split-Phase</option>
                    <option value="3-Phase">3-Phase</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>LINE REACTOR</label>
                  <select style={styles.inputElement} value={selectedReactor} onChange={(e) => setSelectedReactor(e.target.value)}>
                    <option value="Default (None)">Default (None)</option>
                    <option value="Line Reactor(s)">Line Reactor(s)</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <div>
                <label style={styles.label}>GRID TIE INFRASTRUCTURE</label>
                <select 
                  style={styles.inputElement} 
                  disabled={!selectedAssetKey}
                  value={selectedGridTieKey} 
                  onChange={(e) => setSelectedGridTieKey(e.target.value)}
                >
                  <option value="">Select busbar rating...</option>
                  {selectedAssetKey && Object.keys(genData[selectedAssetKey].gridTie).map(key => (
                    <option key={key} value={key}>
                      {genData[selectedAssetKey].gridTie[key].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>INTEGRATED MONITORING</label>
                <select 
                  style={styles.inputElement} 
                  disabled={!selectedAssetKey}
                  value={selectedMonitoringKey} 
                  onChange={(e) => setSelectedMonitoringKey(e.target.value)}
                >
                  <option value="">Select datalogger...</option>
                  {selectedAssetKey && Object.keys(genData[selectedAssetKey].monitoring).map(key => (
                    <option key={key} value={key}>
                      {genData[selectedAssetKey].monitoring[key].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <div>
                <label style={styles.label}>SHIPPING FREIGHT REGION</label>
                <select 
                  style={styles.inputElement} 
                  disabled={!selectedAssetKey}
                  value={selectedCountryKey} 
                  onChange={(e) => setSelectedCountryKey(e.target.value)}
                >
                  <option value="">Select target deployment country...</option>
                  {selectedAssetKey && Object.keys(genData[selectedAssetKey].countries).map(countryName => (
                    <option key={countryName} value={countryName}>
                      {countryName} (+{genData[selectedAssetKey].countries[countryName].toString()} days transit)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>STABLECOIN SETTLEMENT</label>
                <select 
                  style={styles.inputElement} 
                  value={selectedStableTokenSymbol} 
                  onChange={(e) => {
                    const symbol = e.target.value;
                    setSelectedStableTokenSymbol(symbol);
                    const tokenMeta = supportedTokens.find((t) => t.symbol === symbol);
                    if (tokenMeta) {
                      setSelectedTokenAddress(tokenMeta.address);
                      setSelectedTokenDecimals(tokenMeta.decimals || 18);
                      setSelectedTokenChain(tokenMeta.chain || "global");
                    }
                  }}
                >
                  <option value="" disabled style={{ background: "#121212" }}>Select Payment Token</option>
                  {supportedTokens
                    .filter((token) => !["BTC", "LINK", "ETHEREUM", "UNI", "MATIC", "COPx"].includes(token.symbol))
                    .map((token) => (
                      <option key={token.symbol} value={token.symbol} style={{ background: "#121212" }}>
                        {token.symbol} ({token.name || token.chain})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <div>
                <label style={styles.label}>DEPOSIT TRANSACTION HASH</label>
                <input type="text" placeholder="0x..." style={styles.inputElement} value={purchaseTxHash} onChange={(e) => setPurchaseTxHash(e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>BUYER'S WALLET ADDRESS</label>
                <input type="text" placeholder="0x..." style={styles.inputElement} value={buyerWalletAddress} onChange={(e) => setBuyerWalletAddress(e.target.value)} />
              </div>
            </div>

            {selectedAssetKey && selectedPanelKey && selectedGridTieKey && selectedMonitoringKey && (
              <div style={{ background: "#050505", padding: "12px", borderRadius: "6px", border: "1px solid #121212", marginTop: "12px", marginBottom: "16px", fontSize: "12px" }}>
                <span style={{ color: "#888888", display: "block", marginBottom: "2px" }}>ESTIMATED ASSET BREAKDOWN:</span>
                Base Model Price: <b style={{ color: "#ffffff" }}>${genData[selectedAssetKey].price.toString()}</b>
                <br />
                Customization Upcharges: <b style={{ color: "#4caf50" }}>+${((genData[selectedAssetKey].panel[selectedPanelKey]?.price || 0n) + (genData[selectedAssetKey].gridTie[selectedGridTieKey]?.price || 0n) + (genData[selectedAssetKey].monitoring[selectedMonitoringKey]?.price || 0n)).toString()}</b>
              </div>
            )}

            <button style={styles.btnForestGreen} onClick={handlePurchase}>
              Execute Purchase
            </button>
          </div>

          {/* SECTION 4 — DEPOSIT VERIFICATION */}
          <div style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>DEPOSIT VERIFICATION</h2>
            <label style={styles.label}>TRANSACTION HASH</label>
            <input type="text" placeholder="Transaction Hash" style={styles.inputElement} value={transactionHash} onChange={(e) => setTransactionHash(e.target.value)} />
            
            <label style={styles.label}>CUSTODIAL WALLET</label>
            <select style={styles.inputElement} value={custodialWallet} onChange={(e) => setCustodialWallet(e.target.value)}>
              <option value="" style={{ background: "#121212" }}>Select Custodial Wallet</option>
              {contracts.map((c) => (
                <option key={c.address} value={c.address} style={{ background: "#121212" }}>
                  {c.name}
                </option>
              ))}
            </select>

            <button style={styles.btnForestGreen} onClick={handleVerifyDeposit}>
              Verify Deposit
            </button>
          </div>

        </div> {/* END COLUMN 2 */}
      </div> {/* END TWO-COLUMN GRID */}
    </main>
  );
}