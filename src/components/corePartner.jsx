// src/components/PartnerPortal.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';
import { deployments, supportedTokens } from '../utils/tokensX.js';
import { useRpcStatus } from "../utils/statusRpc";

export default function PartnerPortal({
  userAddress,
  activeContract,
  cumalativeChange,
  purchaseTxHash,
  setPurchaseTxHash,
  buyerWalletAddress,
  setBuyerWalletAddress,
  genData,
  quantity,
  setSelectedQuantity,
  selectedVoltage,
  setSelectedVoltage,
  selectedFrequency,
  setSelectedFrequency,
  selectedPhase,
  setSelectedPhase,
  selectedReactor,
  setSelectedReactor,
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
  setSelectedTokenAddress,
  firstname,
  setFirstname,
  lastname,
  setLastname,
  email,
  setEmail,
  phone,
  setPhone,
  postalCode,
  setPostalCode,
  address,
  setAddress,
  handlePurchase,
  isConnected
}) {

  const rpcUp = useRpcStatus();
  const [partnerOrders, setPartnerOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  
  // High-level aggregate metrics for partner tracking
  const [metrics, setMetrics] = useState({
    totalVolume: 0,
    settledCost: 0,
    totalCredits: 0
  });

  const [emailError, setEmailError] = useState("");

  const validateEmail = (emailx) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailx);
  };

  // 1. Keeps the input snappy. Only clears errors while typing, never creates them.
  const handleEmailChange = (e) => {
    const emailx = e.target.value;
    setEmail(emailx);

    // If they clear the input, or type a valid string, clear any active error
    if (emailx === "" || validateEmail(emailx)) {
      setEmailError("");
    }
  };

  // 2. The critical "drop" check. Only throws an error when they step away.
  const handleEmailBlur = (e) => {
    const emailx = e.target.value;
    
    if (emailx === "") {
      setEmailError(""); // Optional: change to "Email is required" if it's mandatory
    } else if (!validateEmail(emailx)) {
      setEmailError("Please enter a valid email address");
    }
  };

  useEffect(() => {
    const fetchPartnerLedgerData = async () => {
      if (!userAddress || !isConnected) {
        setPartnerOrders([]);
        setMetrics({ totalVolume: 0, settledCost: 0, totalCredits: 0 });
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        let ledgerResponse = null;

        try {
          // Correctly call the backend IPC link handler
          ledgerResponse = await window.electronAPI.getPartnerLedger({
            userAddress,
            contractAddress: deployments.AssetPurchase, 
            chainKey: "global"
          });
        } catch (ipcError) {
          // Send the raw blockchain revert trace strictly to the developer console log
          console.warn("Partner ledger revert caught quietly. Initializing clean empty view:", ipcError);
          
          // Fallback to a mock empty ledger layout: [ [serializedTerms], [serializedCredits] ]
          ledgerResponse = [[], []];
        }

        if (!ledgerResponse || !Array.isArray(ledgerResponse)) {
          setPartnerOrders([]);
          return;
        }

        const [serializedTerms, serializedCredits] = ledgerResponse;

        let cumulativeVolume = 0;
        let cumulativeCost = 0n;
        let cumulativeCredits = 0n;

        // Map data arrays together
        const dynamicOrders = (serializedTerms || []).map((term, index) => {
          const rawAmount = BigInt(term.amount);
          const rawCredit = serializedCredits && serializedCredits[index] ? BigInt(serializedCredits[index]) : 0n;
          const orderQuantity = parseInt(term.quantity, 10) || 0;

          // Accumulate running numbers for aggregate cards
          cumulativeVolume += orderQuantity;
          cumulativeCost += rawAmount;
          cumulativeCredits += rawCredit;

          return {
            id: term.id,
            index: index,
            date: term.timestamp && term.timestamp !== "0"
              ? new Date(Number(term.timestamp) * 1000).toISOString().split('T')[0] 
              : "N/A",
            quantity: orderQuantity,
            cost: `${formatAllocation(rawAmount)} GBDo`,
            hasCredit: rawCredit > 0n,
            manufacturerCredit: `${formatAllocation(rawCredit)} GBDo`
          };
        });

        setPartnerOrders(dynamicOrders);

        const scaleFactor = 1000000000000000000n; // 10^18

        setMetrics({
          totalVolume: cumulativeVolume,
          // Division extracts whole units, remainder extracts decimals safely
          settledCost: Number(cumulativeCost / scaleFactor) + Number(cumulativeCost % scaleFactor) / Number(scaleFactor),
          totalCredits: Number(cumulativeCredits / scaleFactor) + Number(cumulativeCredits % scaleFactor) / Number(scaleFactor)
        });

      } catch (err) {
        console.error("Partner ledger layout processing failed:", err);
        setError(err.message || "Failed to retrieve authorized native data arrays.");
      } finally {
        setLoading(false);
      }
    };

    fetchPartnerLedgerData();
  }, [userAddress, isConnected]);

  return (
    <div style={styles.mainContent}>
      {/* GLOBAL SESSION STATUS BAR */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
        
        {/* HEADER LAYER: Matched perfectly to the premium blueprint layout */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "16px", marginBottom: "20px" }}>
          
          {/* Left Side: Clean Title */}
          <div>
            <h1 style={{ ...styles.label, color: "#ffffff", fontSize: "20px", fontWeight: "300", letterSpacing: "1px", margin: "0" }}>
              LIQUIDITY DESK
            </h1>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "0.5px", margin: 0 }}>
              ADD ASSETS TO POOLS, MONITOR AMM STATISTICS & EARN REWARDS FROM PROTOCOL FEES
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

        {/* NEW ETCHED HORIZONTAL DIVIDER (Using your exact opacity weight) */}
        <div style={{ display: "flex", alignItems: "center", width: "100%", paddingTop: "20px", margin: "0 0 40px 0" }}>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.49) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
        </div>
      </div>

      {(!isConnected || loading) && (
        <div style={{ ...styles.jsonDisplay, color: "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {loading && <div>Reading investment records...</div>}
          {!isConnected && <div>Ready to initialize. Connect your wallet to extract active purchase records.</div>}
        </div>
      )}

      {/* ACTION TRIGGERS BAR */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        {/* Trigger button mapped for the Asset Purchase structural form */}
        <button style={styles.btnForestGreen} onClick={() => setIsPurchaseModalOpen(true)}>
          EXECUTE PURCHASE
        </button>
      </div>

      {/* METRIC SUMMARIES */}
      {isConnected && userAddress && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ ...styles.label, color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>CUMULATIVE VOLUME</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px",  fontWeight: "lighter", color: "#fff" }}>{metrics.totalVolume} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#555"}}>UNITS</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ ...styles.label, color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>GROSS SETTLEMENT VALUE</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "lighter", color: "#fff" }}>{metrics.settledCost.toFixed(2)} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#555"}}>GBDo</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(74, 222, 128, 0.15)" }}>
            <span style={{ ...styles.label, color: "#1d5c34", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>TOTAL RETURNED SAVINGS</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "lighter", color: "#1d5c34" }}>{metrics.totalCredits.toFixed(4)} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#2e7d43"}}>GBDo</span></b>
          </div>
        </div>
      )}

      {/* VOLUME DISTRIBUTION REGISTER */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Wholesale Partner Ledger</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>PURCHASE RECORD</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px" }}>TIMESTAMP</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "center" }}>QUANTITY</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>SETTLEMENT COST</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", textAlign: "right" }}>BUYER CREDIT</th>
            </tr>
          </thead>
          <tbody>
            {partnerOrders.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ ...styles.label, padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                  {loading ? "Decrypting partner allocation lines..." : "No operational activity recorded for the connected wallet."}
                </td>
              </tr>
            ) : (
              partnerOrders.map((order) => (
                <tr key={`partner-order-${order.id}-${order.index}`} style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#888888" }}>PT-TERM-{order.index.toString().padStart(3, '0')}</td>
                  <td style={{ ...styles.label, padding: "12px 8px", color: "#aaaaaa" }}>{order.date}</td>
                  <td style={{ ...styles.label, padding: "12px 8px", textAlign: "center", color: "#bbb" }}>{order.quantity}</td>
                  <td style={{ ...styles.label, padding: "12px 8px", textAlign: "right", color: "#fff" }}>{order.cost}</td>
                  <td style={{ 
                    padding: "12px 8px", 
                    
                    textAlign: "right", 
                    color: order.hasCredit ? "#1d5c34" : "#555555", 
                    fontWeight: order.hasCredit ? "600" : "normal" 
                  }}>
                    {order.hasCredit ? order.manufacturerCredit : "PENDING QUOTE ADJUSTMENT"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* ASSET PURCHASE MODAL OVERLAY */}
      {isPurchaseModalOpen && (
        <div 
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
          onClick={() => setIsPurchaseModalOpen(false)}
        >
          {/* Replace your old CSS Style Injection tag with this: */}
          <style>{`
            .custom-modal-scroll {
              -ms-overflow-style: none;  /* IE and Edge */
              scrollbar-width: none;     /* Firefox */
            }
            .custom-modal-scroll::-webkit-scrollbar {
              display: none;             /* Chrome, Safari, and Opera */
              width: 0 !important;
              height: 0 !important;
            }
          `}</style>

          <div 
            className="custom-modal-scroll"
            style={{ 
              ...styles.sectionCard, 
              width: "100%", 
              maxWidth: "680px", 
              maxHeight: "calc(100vh - 40px)",
              overflowY: "auto", 
              position: "relative", 
              padding: "20px",
              background: "#0d0d0d", 
              border: "1px solid #1a1a1a", 
              boxShadow: "0px 12px 40px rgba(0,0,0,0.7)" 
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            {/* CLOSE CONTROLLER ACTION */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px", paddingBottom: "8px" }}>
              <h3 style={{ ...styles.sectionTitle, margin: 0, letterSpacing: "1px" }}>ASSET PURCHASE MANAGEMENT</h3>
              <button 
                onClick={() => setIsPurchaseModalOpen(false)}
                style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "18px", fontWeight: "100", transition: "color 0.2s" }}
                onMouseEnter={(e) => e.target.style.color = "#ef4444"}
                onMouseLeave={(e) => e.target.style.color = "#666"}
              >
                ✕
              </button>
            </div>
            {/* NEW ETCHED HORIZONTAL DIVIDER (Using your exact opacity weight) */}
            <div style={{ display: "flex", alignItems: "center", width: "100%", paddingTop: "0px", margin: "0 0 40px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.49) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
            </div>

            {/* ASSET CONFIGURATION LAYER */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={styles.label}>SELECT MODEL (Required)</label>
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
                  <option value="">Unit Model</option>
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
                  <option value="">Output Customization</option>
                  {selectedAssetKey && Object.keys(genData[selectedAssetKey].panel).map(key => (
                    <option key={key} value={key}>
                      {genData[selectedAssetKey].panel[key].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* DYNAMIC EXPANSION PANEL: HARDWARE CUSTOMIZATION */}
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
                  <option value="">Power Rating</option>
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
                  <option value="">Remote Monitoring</option>
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
                <label style={styles.label}>STABLECOIN SETTLEMENT (Required)</label>
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
                  <option value="" disabled style={{ background: "#121212" }}>Payment Token</option>
                  {supportedTokens
                    .filter((token) => !["BTC", "LINK", "ETH", "UNI", "MATIC", "COPx"].includes(token.symbol))
                    .map((token) => (
                      <option key={token.symbol} value={token.symbol} style={{ background: "#121212" }}>
                        {token.symbol} ({token.name || token.chain})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>SHIPPING FREIGHT REGION (Required)</label>
                <select 
                  style={styles.inputElement} 
                  disabled={!selectedAssetKey}
                  value={selectedCountryKey} 
                  onChange={(e) => setSelectedCountryKey(e.target.value)}
                >
                  <option value="">Country/Region</option>
                  {selectedAssetKey && Object.keys(genData[selectedAssetKey].countries).map(countryName => (
                    <option key={countryName} value={countryName}>
                      {countryName} (+{genData[selectedAssetKey].countries[countryName].toString()} days transit)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* LOGISTICS LAYER */}
            <style>{`
              .no-spinners-ever::-webkit-outer-spin-button,
              .no-spinners-ever::-webkit-inner-spin-button {
                -webkit-appearance: none !important;
                margin: 0 !important;
              }
              .no-spinners-ever[type=number] {
                -moz-appearance: textfield !important;
              }
            `}</style>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "16px", marginTop: "12px" }}>
              <div>
                {/* 1. Global Browser Override for Spinners */}
                <style>{`
                  /* Chrome, Safari, Edge, Opera */
                  .clean-qty-input::-webkit-outer-spin-button,
                  .clean-qty-input::-webkit-inner-spin-button {
                    -webkit-appearance: none !important;
                    margin: 0 !important;
                  }
                  /* Firefox */
                  .clean-qty-input[type=number] {
                    -moz-appearance: textfield !important;
                  }
                `}</style>

                <label style={styles.label}>QUANTITY</label>
                <div 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    background: "#121212", 
                    border: "1px solid #1a1a1a", 
                    borderRadius: "4px", 
                    height: "30px", 
                    overflow: "hidden"
                  }}
                >
                  {/* DECREMENT BUTTON */}
                  <button
                    type="button"
                    onClick={(e) => {
                      // 1. Grab the actual input box sitting right next to this button
                      const input = e.currentTarget.parentNode.querySelector('.clean-qty-input');
                      if (input) {
                        const currentVal = parseInt(input.value, 10) || 1;
                        const nextVal = Math.max(1, currentVal - 1);
                        
                        // 2. Explicitly change its value attribute
                        input.value = nextVal;
                        
                        // 3. Fire a real native browser event so your parent onChange listener wakes up
                        const event = new Event('input', { bubbles: true });
                        input.dispatchEvent(event);
                      }
                    }}
                    style={{ 
                      background: "none", 
                      border: "none", 
                      color: "#666", 
                      width: "30px", 
                      height: "100%", 
                      cursor: "pointer", 
                      fontSize: "6px",
                      fontWeight: "600",
                      transition: "color 0.2s, background 0.2s",
                      padding: 0,
                      display: "flex",          
                      alignItems: "center",      
                      justifyContent: "center"   
                    }}
                    onMouseEnter={(e) => { e.target.style.color = "#ffffff"; e.target.style.background = "#141414"; }}
                    onMouseLeave={(e) => { e.target.style.color = "#666"; e.target.style.background = "none"; }}
                  >
                    —
                  </button>

                  {/* THE NUMERIC INPUT BOX */}
                  <input 
                    type="number" 
                    min="1"
                    className="clean-qty-input" 
                    style={{ 
                      background: "none", 
                      border: "none", 
                      color: "#ffffff", 
                      textAlign: "center", 
                      width: "100%", 
                      height: "100%",
                      padding: 0,
                      margin: 0,
                      outline: "none"
                    }} 
                    // Safe fallback formatting to make sure it reads from the parent initially
                    value={quantity === undefined || quantity === null || isNaN(parseInt(quantity, 10)) ? "1" : String(quantity)} 
                    onChange={(e) => {
                      if (typeof setSelectedQuantity === 'function') {
                        setSelectedQuantity(e);
                      }
                    }}
                  />

                  {/* INCREMENT BUTTON */}
                  <button
                    type="button"
                    onClick={(e) => {
                      // 1. Grab the actual input box sitting right next to this button
                      const input = e.currentTarget.parentNode.querySelector('.clean-qty-input');
                      if (input) {
                        const currentVal = parseInt(input.value, 10) || 1;
                        const nextVal = currentVal + 1;
                        
                        // 2. Explicitly change its value attribute
                        input.value = nextVal;
                        
                        // 3. Fire a real native browser event so your parent onChange listener wakes up
                        const event = new Event('input', { bubbles: true });
                        input.dispatchEvent(event);
                      }
                    }}
                    style={{ 
                      background: "none", 
                      border: "none", 
                      color: "#666", 
                      width: "30px", 
                      height: "100%", 
                      cursor: "pointer", 
                      fontSize: "10px", 
                      transition: "color 0.2s, background 0.2s",
                      padding: 0,
                      display: "flex",          
                      alignItems: "center",      
                      justifyContent: "center"   
                    }}
                    onMouseEnter={(e) => { e.target.style.color = "#1d5c34"; e.target.style.background = "#141414"; }}
                    onMouseLeave={(e) => { e.target.style.color = "#666"; e.target.style.background = "none"; }}
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label style={styles.label}>DESTINATION EMAIL</label>
                <input 
                  type="email" 
                  placeholder="client@domain.com" 
                  style={{
                    ...styles.inputElement,
                    borderColor: emailError ? "#ef4444" : (styles.inputElement?.borderColor || "#1a1a1a")
                  }} 
                  value={email} 
                  onChange={handleEmailChange} 
                  onBlur={handleEmailBlur}
                />
                {emailError && (
                  <span style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px", display: "block", letterSpacing: "0.5px" }}>
                    {emailError}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <div>
                <label style={styles.label}>FIRST NAME</label>
                <input type="text" placeholder="John" style={styles.inputElement} value={firstname} onChange={(e) => setFirstname(e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>LAST NAME</label>
                <input type="text" placeholder="Doe" style={styles.inputElement} value={lastname} onChange={(e) => setLastname(e.target.value)} />
              </div>
            </div>

            {/* CONTACT & STREET ADDRESS INFRASTRUCTURE */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <div>
                <label style={styles.label}>PHONE NUMBER</label>
                <input 
                  type="tel" 
                  placeholder="+1 (555) 000-0000" 
                  style={styles.inputElement} 
                  value={phone} 
                  onFocus={() => {
                    if (!phone) setPhone("+");
                  }}
                  onChange={(e) => {
                    let input = e.target.value;
                    if (!input.startsWith("+")) input = "+" + input;
                    const digits = input.replace(/\D/g, "");
                    let formatted = "+";
                    
                    if (digits.length > 0) {
                      const countryCode = digits.slice(0, 1); 
                      const rest = digits.slice(1);
                      
                      if (rest.length === 0) {
                        formatted = `+${countryCode}`;
                      } else if (rest.length <= 3) {
                        formatted = `+${countryCode} (${rest}`;
                      } else if (rest.length <= 6) {
                        formatted = `+${countryCode} (${rest.slice(0, 3)}) ${rest.slice(3)}`;
                      } else {
                        formatted = `+${countryCode} (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
                      }
                    }
                    setPhone(formatted);
                  }} 
                />
              </div>
              <div>
                <label style={styles.label}>POSTAL / ZIP CODE</label>
                <input type="text" placeholder="10001" style={styles.inputElement} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={styles.label}>SHIPPING STREET ADDRESS</label>
                <input type="text" placeholder="123 Global Dr, Apt 4B" style={styles.inputElement} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <div>
                <label style={styles.label}>DEPOSIT TRANSACTION HASH (Required)</label>
                <input type="text" placeholder="0x..." style={styles.inputElement} value={purchaseTxHash} onChange={(e) => setPurchaseTxHash(e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>BUYER'S WALLET ADDRESS (Required)</label>
                <input type="text" placeholder="0x..." style={styles.inputElement} value={buyerWalletAddress} onChange={(e) => setBuyerWalletAddress(e.target.value)} />
              </div>
            </div>

            {/* VALUATION BREAKDOWN VIEW */}
            {selectedAssetKey && selectedPanelKey && selectedGridTieKey && selectedMonitoringKey && (
              <div style={{ background: "#050505", padding: "12px", borderRadius: "6px", border: "1px solid #121212", marginTop: "12px", marginBottom: "16px", fontSize: "12px" }}>
                <span style={{ color: "#888888", display: "block", marginBottom: "2px" }}>ESTIMATED ASSET BREAKDOWN:</span>
                Base Model Price: <b style={{ color: "#ffffff" }}>${genData[selectedAssetKey].price.toString()}</b>
                <br />
                Customization Upcharges: <b style={{ color: "#1d5c34" }}>+${((genData[selectedAssetKey].panel[selectedPanelKey]?.price || 0n) + (genData[selectedAssetKey].gridTie[selectedGridTieKey]?.price || 0n) + (genData[selectedAssetKey].monitoring[selectedMonitoringKey]?.price || 0n)).toString()}</b>
              </div>
            )}

            <button 
              style={{ ...styles.btnForestGreen, width: "100%", marginTop: "8px", padding: "14px" }} 
              onClick={(e) => {
                handlePurchase(e);
                setIsPurchaseModalOpen(false); // Clean exit option on execution completion
              }}
            >
              SUBMIT PURCHASE ORDER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}