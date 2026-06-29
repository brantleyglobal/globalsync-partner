// src/components/coreSwap.jsx
import React, { useState, useEffect } from 'react';
import { styles, modalStyles } from '../utils/styles.jsx';
import { deployments, supportedTokens, dividendTokens } from '../utils/tokensX';
import { useRpcStatus } from "../utils/statusRpc";

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

export default function GlobalSwapPortal({ userAddress, isConnected }) {

  const rpcUp = useRpcStatus();
  const [swapRecords, setSwapRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [totals, setTotals] = useState({
    totalSwaps: 0,
    pendingCount: 0
  });

  // --- STATE ALIGNED WITH SOLIDITY createNewSwap INPUT MATRIX ---
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [tokenA, setTokenA] = useState('');
  const [amountA, setAmountA] = useState('');
  const [partyADepositHash, setPartyADepositHash] = useState(''); 
  const [tokenB, setTokenB] = useState('');
  const [amountB, setAmountB] = useState('');
  const [partyBDepositHash, setPartyBDepositHash] = useState(''); 
  const [createLoading, setCreateLoading] = useState(false);

  // --- STATE FOR POST-DEPLOYMENT INSTANCE SERVICE DESK ---
  const [targetSwapAddress, setTargetSwapAddress] = useState('');
  const [selectedAction, setSelectedAction] = useState('EXECUTE'); 
  const [interactionSender, setInteractionSender] = useState('');
  const [depositTxHash, setDepositTxHash] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  const [isEscrowModalOpen, setIsEscrowModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  const mergedTokens = [
      ...supportedTokens,
      ...dividendTokens.filter(
          dividend => !supportedTokens.some(
          supported => supported.symbol === dividend.symbol
          )
      ),
  ];

  useEffect(() => {
    if (userAddress) {
      if (!partyA) setPartyA(userAddress);
      if (!interactionSender) setInteractionSender(userAddress);
    }
  }, [userAddress]);

  const formatAllocation = (valueBigInt, decimals = 18, precision = 4) => {
    if (!valueBigInt || valueBigInt === 0n) return "0.0000";
    const padded = valueBigInt.toString().padStart(decimals + 1, '0');
    const splitIdx = padded.length - decimals;
    const integerPart = Number(padded.slice(0, splitIdx)).toLocaleString();
    const fractionalPart = padded.slice(splitIdx, splitIdx + precision);
    return `${integerPart}.${fractionalPart}`;
  };

  const sanitizeBytes32 = (inputString) => {
    const clean = inputString.trim();
    if (!clean || clean === "0x") return "0x0000000000000000000000000000000000000000000000000000000000000000";
    if (clean.startsWith("0x") && clean.length === 66) return clean;
    if (clean.length === 64 && !clean.startsWith("0x")) return `0x${clean}`;
    return clean;
  };

  const fetchSwapLogs = async () => {
    if (!userAddress || !isConnected) {
      setSwapRecords([]);
      setTotals({ totalSwaps: 0, pendingCount: 0 });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let records = null;
      try {
        // Point to the new single IPC handler mapping
        const response = await window.electronAPI.swapRegistry({
          action: "GET_HISTORY",
          contractAddress: deployments.GlobalSwapRegistry, 
          userAddress: userAddress
        });
        
        if (response.success) {
          records = response.data;
        }
      } catch (ipcError) {
        console.warn("Swap registry query catch-all fired:", ipcError);
        records = [];
      }

      if (!records || !Array.isArray(records)) {
        setSwapRecords([]);
        setTotals({ totalSwaps: 0, pendingCount: 0 });
        return;
      }

      let pendingEscrows = 0;
      const processedRecords = records.map((rec, index) => {
        const isPending = rec.status === 0;

        return {
          index: index,
          swapId: rec.id || index.toString(),
          partyA: rec.partyA || "0xUnknown",
          partyB: rec.partyB || "0xUnknown",
          contractAddress: rec.cloneAddress || "0x0000...0000",
          shortAddress: rec.cloneAddress 
            ? `${rec.cloneAddress.slice(0, 6)}...${rec.cloneAddress.slice(-4)}`
            : "0xNone",
          offered: `${parseFloat(ethers.formatUnits(rec.amountA || 0, 18)).toLocaleString()} ${rec.symbolA}`,
          requested: `${formatAllocation(BigInt(rec.amountB || 0))} ${rec.symbolB || 'Tokens'}`,
          statusLabel: rec.statusLabel.toUpperCase(),
          isPending: isPending
        };
      });

      const pendingEscrows = processedRecords.filter(rec => rec.isPending).length;

      setSwapRecords(processedRecords);
      setTotals({ totalSwaps: processedRecords.length, pendingCount: pendingEscrows });
    } catch (err) {
      console.error(err);
      setError("Failed to parse historical swap entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSwapLogs(); }, [userAddress, isConnected]);

  const handleDeployEscrow = async (e) => {
    e.preventDefault();
    if (!isConnected || !userAddress) return;
    setCreateLoading(true);
    setError(null);

    // INLINE HELPER: Strips formatting and scales to an 18-decimal integer string
    const toOnChainWeiString = (displayValue) => {
      if (!displayValue) return "0";
      const sanitized = displayValue.replace(/,/g, '').trim();
      if (isNaN(sanitized) || sanitized === "") return "0";
      
      return ethers.parseEther(sanitized).toString();
    };

    try {
      // Convert the formatted user strings to BigInt-compatible strings
      const rawAmountA = toOnChainWeiString(amountA);
      const rawAmountB = toOnChainWeiString(amountB);

      // Swapped out legacy deployment signature for unified handler payload
      const response = await window.electronAPI.swapRegistry({
        action: "CREATE_SWAP",
        contractAddress: deployments.GlobalSwapRegistry,
        partyA: partyA.trim(),
        partyB: partyB.trim(),
        tokenA: tokenA.trim(),
        amountA: rawAmountA,
        partyADepositHash: sanitizeBytes32(partyADepositHash),
        tokenB: tokenB.trim(),
        amountB: rawAmountB,
        partyBDepositHash: sanitizeBytes32(partyBDepositHash)
      });

      if (response.success) {
        setPartyB(''); setTokenA(''); setAmountA(''); setPartyADepositHash('');
        setTokenB(''); setAmountB(''); setPartyBDepositHash('');
        await fetchSwapLogs();
      } else {
        throw new Error(response.error || "Deployment instruction rejected.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!isConnected || !targetSwapAddress) return;
    if (!depositTxHash) {
      alert("Deposit Transaction Hash Required.");
      return;
    }
    setActionLoading(true);
    setActionFeedback(null);

    try {
      
      const response = await window.electronAPI.swapRegistry({
        action: selectedAction.toUpperCase(), // "DEPOSIT" or "REFUND"
        contractAddress: deployments.GlobalSwapRegistry,
        targetSwapAddress: targetSwapAddress.trim(),
        userAddress: interactionSender.trim() || userAddress,
        clearingHash: sanitizeBytes32(depositTxHash)
      });

      if (response.success) {
        setActionFeedback({ success: true, message: `Operation completed. Tx: ${response.txHash || '0xOK'}` });
        setDepositTxHash(''); 
        
        setTimeout(async () => {
          await fetchSwapLogs();
        }, 1500);
      } else {
        throw new Error(response.error || "Execution reverted.");
      }
    } catch (err) {
      setActionFeedback({ success: false, message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={styles.mainContent}>
      {/* GLOBAL SESSION STATUS BAR */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
        
        {/* HEADER LAYER: Matched perfectly to the premium blueprint layout */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: "16px", marginBottom: "20px" }}>
          
          {/* Left Side: Clean Title */}
          <div>
            <h1 style={{ ...styles.label, color: "#ffffff", fontSize: "20px", fontWeight: "300", letterSpacing: "1px", margin: "0" }}>
              GLOBAL XCHANGE DESK
            </h1>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "0.5px", margin: 0 }}>
              SWAP ASSETS, LIQUIDITY POOLS & INTER-CHAIN ROUTING VIA SMART CONTRACTS
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

      {(!isConnected || error || loading) && (
        <div style={{ ...styles.jsonDisplay, color: error ? "#ef4444" : "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {loading && <div>Reading investment records...</div>}
          {error && <div><strong>AUTHORIZATION FAILURE:</strong> {error}</div>}
          {!userAddress && <div>Ready to initialize. Connect your wallet to extract active affiliate records.</div>}
        </div>
      )}

      {/* METRIC ROW */}
      {isConnected && userAddress && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>TOTAL DEPLOYED SWAPS</span>
            <hr style={styles.divider} />
            <b style={{ ...styles.label, fontSize: "16px", color: "#fff" }}>{totals.totalSwaps} <span style={{fontSize:"12px", color:"#555"}}>INSTANCES</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(74, 222, 128, 0.15)" }}>
            <span style={{ color: "#1d5c34", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>ACTIVE PENDING ESCROWS</span>
            <hr style={styles.divider} />
            <b style={{ ...styles.label, fontSize: "16px", color: "#1d5c34" }}>{totals.pendingCount} <span style={{fontSize:"12px", color:"#2e7d43"}}>OPEN</span></b>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button style={styles.btnForestGreen} onClick={() => setIsEscrowModalOpen(true)}>
            OPEN ESCROW CREATION
        </button>
        <button style={styles.btnForestGreen} onClick={() => setIsDepositModalOpen(true)}>
            OPEN XCHANGE UPDATE
        </button>
      </div>

      {/* --- MODAL 1: XCHANGE ESCROW CREATION --- */}
      {isEscrowModalOpen && (
      <div style={modalStyles.overlay} onClick={() => setIsEscrowModalOpen(false)}>
        <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
          <div style={{ ...styles.sectionCard, width: "100%", boxSizing: "border-box", margin: 0, border: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", marginBottom: "8px" }}>
                <h2 style={{ ...styles.sectionTitle, margin: 0 }}>XCHANGE ESCROW CREATION</h2>
                <button style={modalStyles.closeButton} onClick={() => setIsEscrowModalOpen(false)}>✕</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", width: "100%", paddingTop: "0px", margin: "0 0 40px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.49) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
                {/* LEFT SUB-GRID: PARTY A COMPONENT */}
                <div style={{ borderRight: "1px solid #141414", paddingRight: "20px" }}>
                  <label style={styles.label}>PARTY A WALLET ADDRESS</label>
                  <input type="text" placeholder="0x..." style={styles.inputElement} value={partyA} onChange={(e) => setPartyA(e.target.value)} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                      <div>
                        <label style={styles.label}>ASSET SELECTION</label>
                        <select 
                            style={styles.inputElement} 
                            value={tokenA} 
                            onChange={(e) => setTokenA(e.target.value)}
                        >
                            <option value="" disabled style={{ background: "#121212" }}> Token Asset</option>
                            {mergedTokens.map((token) => (
                            <option key={`tokenA-${token.address}`} value={token.address} style={{ background: "#121212" }}>
                                {token.symbol} ({token.name || token.chain})
                            </option>
                            ))}
                        </select>
                      </div>
                      <div>
                          <label style={styles.label}>AMOUNT</label>
                          <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*"
                              placeholder="Pledged Amount"
                              style={styles.inputElement} // Keeping your global styles architecture
                              value={amountA}
                              onChange={(e) => {
                              const formatted = formatMoneyFromDigits(e.target.value);
                              setAmountA(formatted);
                              }}
                          />
                      </div>
                  </div>

                  <div style={{ marginTop: "10px" }}>
                      <label style={{ ...styles.label, color: "#888" }}>PARTY DEPOSIT TRANSACTION HASH</label>
                      <input type="text" placeholder="0x... (Optional for creation)" style={{ ...styles.inputElement }} value={partyADepositHash} onChange={(e) => setPartyADepositHash(e.target.value)} />
                  </div>
                </div>

                {/* RIGHT SUB-GRID: PARTY B COMPONENT */}
                <div>
                  <label style={styles.label}>PARTY B WALLET ADDRESS</label>
                  <input type="text" placeholder="0x..." style={styles.inputElement} value={partyB} onChange={(e) => setPartyB(e.target.value)} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                      <div>
                        <label style={styles.label}>ASSET SELECTION</label>
                        <select 
                            style={styles.inputElement} 
                            value={tokenB} 
                            onChange={(e) => setTokenB(e.target.value)}
                        >
                            <option value="" disabled style={{ background: "#121212" }}>Token Asset</option>
                            {mergedTokens
                            .filter((token) => !["BTC", "COPx", "CGRi"].includes(token.symbol))
                            .map((token) => (
                            <option key={`tokenB-${token.address}`} value={token.address} style={{ background: "#121212" }}>
                                {token.symbol} ({token.name || token.chain})
                            </option>
                            ))}
                        </select>
                      </div>
                      <div>
                          <label style={styles.label}>AMOUNT</label>
                          <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*"
                              placeholder="Pledged Amount"
                              style={styles.inputElement}
                              value={amountB}
                              onChange={(e) => {
                              const formatted = formatMoneyFromDigits(e.target.value);
                              setAmountB(formatted);
                              }}
                          />
                      </div>
                  </div>

                  <div style={{ marginTop: "10px" }}>
                      <label style={{ ...styles.label, color: "#888" }}>PARTY DEPOSIT TRANSACTION HASH</label>
                      <input type="text" placeholder="0x... (Optional for creation)" style={{ ...styles.inputElement }} value={partyBDepositHash} onChange={(e) => setPartyBDepositHash(e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "20px", borderTop: "1px solid #141414", paddingTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                <button style={{ ...styles.btnForestGreen, width: "auto", paddingLeft: "32px", paddingRight: "32px" }} onClick={handleDeployEscrow} disabled={createLoading || !isConnected}>
                    {createLoading ? "CREATING XCHANGE ESCROW..." : "SUBMIT XCHANGE"}
                </button>
              </div>
          </div>
        </div>
      </div>
      )}

      {/* --- MODAL 2: XCHANGE DEPOSIT --- */}
      {isDepositModalOpen && (
      <div style={modalStyles.overlay} onClick={() => setIsDepositModalOpen(false)}>
        <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...styles.sectionCard, width: "100%", boxSizing: "border-box", margin: 0, border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", marginBottom: "8px" }}>
              <h2 style={{ ...styles.sectionTitle, margin: 0 }}>XCHANGE UPDATE</h2>
              <button style={modalStyles.closeButton} onClick={() => setIsDepositModalOpen(false)}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", width: "100%", paddingTop: "0px", margin: "0 0 40px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.49) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
            </div>

            {/* ROW 1: 2 Inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
            <div>
                <label style={styles.label}>XCHANGE CONTRACT ADDRESS</label>
                <input type="text" placeholder="0x..." style={styles.inputElement} value={targetSwapAddress} onChange={(e) => setTargetSwapAddress(e.target.value)} />
            </div>
            <div>
                <label style={styles.label}>WALLET ADDRESS (SENDER)</label>
                <input type="text" placeholder="0x..." style={styles.inputElement} value={interactionSender} onChange={(e) => setInteractionSender(e.target.value)} />
            </div>
            </div>

            {/* ROW 2: 2 Inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "16px", alignItems: "start" }}>
            <div>
                <label style={styles.label}>SELECT UPDATE TYPE</label>
                <select style={styles.inputElement} value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
                <option value="DEPOSIT" style={{ background: "#121212" }}>XChange Deposit</option>
                <option value="REFUND" style={{ background: "#121212" }}>Refund / Cancellation</option>
                </select>
            </div>
              <div>
                  <label style={styles.label}>DEPOSIT TRANSACTION HASH (Required)</label>
                  <input type="text" placeholder="0x..." style={{ ...styles.inputElement }} value={depositTxHash} onChange={(e) => setDepositTxHash(e.target.value)} />
              </div>
            </div>

            {/* ROW 3: Divider and Action Button */}
            <div style={{ marginTop: "20px", borderTop: "1px solid #141414", paddingTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button style={{ ...styles.btnForestGreen, width: "auto", paddingLeft: "32px", paddingRight: "32px" }} onClick={handleExecuteAction} disabled={actionLoading || !targetSwapAddress || !isConnected}>
                  {actionLoading ? "SUBMITTING..." : (selectedAction === "REFUND" ? "SUBMIT REFUND" : "SUBMIT DEPOSIT")}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* --- SWAP REGISTRY LEDGER TABLE --- */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Escrow Settlement Registry</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>ESCROW CONTRACT</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>PARTY A</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>PARTY A ASSET</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>STATUS</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>PARTY B</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>PARTY B ASSET</th>
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "right" }}>STATUS</th>
              {/* STEP 1: ADD AN ACTIONS COLUMN HEADER */}
              <th style={{ ...styles.label, padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {swapRecords.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ ...styles.label, padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                  {loading ? "Loading swap records..." : "No swap records found for the connected wallet..."}
                </td>
              </tr>
            ) : (
              swapRecords.map((rec) => (
                <tr key={`swap-row-${rec.index}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* Column 1: Contract Address Trigger */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#aaaaaa" }}>
                    <span 
                        title={rec.contractAddress} 
                        style={{ borderBottom: "1px dashed #1d5c34", color: "#4ade80", cursor: "pointer" }} 
                        onClick={() => handleSelectEscrowFromTable(rec.contractAddress)}
                    >
                        {rec.shortAddress}
                    </span>
                    </td>

                    {/* Column 2: Party A */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#888888" }}>
                    {rec.partyA !== "0xUnknown" ? `${rec.partyA.slice(0, 6)}...${rec.partyA.slice(-4)}` : "0xUnknown"}
                    </td>

                    {/* Column 3: Asset Offered */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#666666" }}>{rec.offered}</td>

                    {/* Column 4: Party A Sub-Status (FIXED: Uses a conditional fallback) */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#eab308" }}>
                    {rec.statusLabel === "PENDINGDEPOSITS" ? "PENDING" : "CLEARED"}
                    </td>

                    {/* Column 5: Party B */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#888888" }}>
                    {rec.partyB !== "0xUnknown" ? `${rec.partyB.slice(0, 6)}...${rec.partyB.slice(-4)}` : "0xUnknown"}
                    </td>

                    {/* Column 6: Asset Requested */}
                    <td style={{ ...styles.label, padding: "12px 8px", color: "#666666" }}>{rec.requested}</td>

                    {/* Column 7: Global Status Label */}
                    <td style={{ 
                    ...styles.label, 
                    padding: "12px 8px",
                    textAlign: "right", 
                    color: rec.statusLabel === "COMPLETED" || rec.statusLabel === "FULLYSETTLED" ? "#4ade80" : "#eab308", 
                    fontWeight: "600" 
                    }}>
                    {rec.statusLabel || "UNKNOWN"}
                    </td>
                    
                    {/* Column 8: Action Button (Now guaranteed to render) */}
                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <button
                        onClick={() => {
                        setTargetSwapAddress(rec.contractAddress);
                        setSelectedAction('REFUND');
                        setIsRefundModalOpen(true);
                        }}
                        style={{
                        ...styles.label, 
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid #ef4444",
                        color: "#ef4444",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "600"
                        }}
                    >
                        Refund
                    </button>
                    </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}