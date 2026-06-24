// src/components/coreSwap.jsx
import React, { useState, useEffect } from 'react';
import { styles, modalStyles } from '../utils/styles.jsx';
import { deployments, supportedTokens, dividendTokens } from '../utils/tokensX';

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
        // FIXED: Point to the new single IPC handler mapping
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
        if (isPending) pendingEscrows++;

        return {
          index: index,
          swapId: rec.id || index.toString(),
          partyA: rec.partyA || "0xUnknown",
          partyB: rec.partyB || "0xUnknown",
          contractAddress: rec.cloneAddress || "0x0000...0000",
          shortAddress: rec.cloneAddress 
            ? `${rec.cloneAddress.slice(0, 6)}...${rec.cloneAddress.slice(-4)}`
            : "0xNone",
          offered: `${formatAllocation(BigInt(rec.amountA || 0))} ${rec.symbolA || 'Tokens'}`,
          requested: `${formatAllocation(BigInt(rec.amountB || 0))} ${rec.symbolB || 'Tokens'}`,
          // FIXED: Leverage the true descriptive status label calculated directly by your backend
          statusLabel: rec.statusLabel.toUpperCase() 
        };
      });

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
      // Strip out commas or spaces introduced by the masking formatter
      const sanitized = displayValue.replace(/,/g, '').trim();
      if (isNaN(sanitized) || sanitized === "") return "0";
      
      // Forces precision math to evaluate cleanly as a flat integer string
      return (parseFloat(sanitized) * 1e18).toFixed(0).toString();
    };

    try {
      // Convert the formatted user strings to BigInt-compatible strings
      const rawAmountA = toOnChainWeiString(amountA);
      const rawAmountB = toOnChainWeiString(amountB);

      // FIXED: Swapped out legacy deployment signature for unified handler payload
      const response = await window.electronAPI.swapRegistry({
        action: "CREATE_SWAP",
        contractAddress: deployments.GlobalSwapRegistry,
        partyA: partyA.trim(),
        partyB: partyB.trim(),
        tokenA: tokenA.trim(),
        amountA: rawAmountA, // <-- FIXED: Sends clean 18-decimal string (e.g. "1000000000000000000")
        partyADepositHash: sanitizeBytes32(partyADepositHash),
        tokenB: tokenB.trim(),
        amountB: rawAmountB, // <-- FIXED: Sends clean 18-decimal string (e.g. "55000000000000000000")
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
    setActionLoading(true);
    setActionFeedback(null);

    try {
      // FIXED: Formatted object schema to pass expected parameters down to unified handler
      const response = await window.electronAPI.swapRegistry({
        action: selectedAction.toUpperCase(), // "DEPOSIT", "REFUND", or "EXECUTE_PAYOUT"
        contractAddress: deployments.GlobalSwapRegistry,
        targetSwapAddress: targetSwapAddress.trim(),
        userAddress: interactionSender.trim() || userAddress,
        clearingHash: sanitizeBytes32(depositTxHash)
      });

      if (response.success) {
        setActionFeedback({ success: true, message: `Operation completed. Tx: ${response.txHash || '0xOK'}` });
        setDepositTxHash(''); 
        await fetchSwapLogs();
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
      <div style={{ paddingTop: "0px", marginBottom: "6px", borderBottom: "1px solid #161616", paddingBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <p style={{ ...styles.subtitle, margin: 0, padding: "4px 0px" }}>
              ACCOUNT STATUS: {isConnected ? <span style={{ fontFamily: "monospace", color: "#1d5c34", fontWeight: "600" }}>CONNECTED</span> : <span style={{ color: "#ef4444", fontWeight: "600" }}>DISCONNECTED</span>}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: "13px" }}>
            <span style={{ color: "#888", marginRight: "8px", fontSize: "11px", letterSpacing: "0.5px", fontWeight: "600" }}>ACTIVE WALLET:</span>
            <code style={{ background: "#0a0a0a", padding: "4px 4px", borderRadius: "4px", color: userAddress ? "#1d5c34" : "#555", fontFamily: "monospace", border: "1px solid #111" }}>
              {isConnected && userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "0xNone"}
            </code>
          </div>
        </div>
      </div>
      
      <div style={{ paddingTop: "8px", marginBottom: "6px", paddingBottom: "6px" }}>
        <h1 style={{ ...styles.title, fontSize: "18px", fontWeight: "100", margin: 0, paddingBottom: "10px" }}>GLOBAL XCHANGE DESK</h1>
      </div>  

      {error && (
        <div style={{ ...styles.jsonDisplay, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)", marginBottom: "24px" }}>
          <strong>SWAP ENGINE ERROR:</strong> {error}
        </div>
      )}

      {/* METRIC ROW */}
      {isConnected && userAddress && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>TOTAL DEPLOYED SWAPS</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontFamily: "monospace", color: "#fff" }}>{totals.totalSwaps} <span style={{fontSize:"12px", color:"#555"}}>INSTANCES</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(74, 222, 128, 0.15)" }}>
            <span style={{ color: "#1d5c34", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>ACTIVE PENDING ESCROWS</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontFamily: "monospace", color: "#1d5c34" }}>{totals.pendingCount} <span style={{fontSize:"12px", color:"#2e7d43"}}>OPEN</span></b>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button style={styles.btnForestGreen} onClick={() => setIsEscrowModalOpen(true)}>
            OPEN ESCROW CREATION
        </button>
        <button style={styles.btnForestGreen} onClick={() => setIsDepositModalOpen(true)}>
            OPEN XCHANGE DEPOSIT
        </button>
      </div>

      {/* --- MODAL 1: XCHANGE ESCROW CREATION --- */}
      {isEscrowModalOpen && (
      <div style={modalStyles.overlay} onClick={() => setIsEscrowModalOpen(false)}>
        <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...styles.sectionCard, width: "100%", boxSizing: "border-box", margin: 0, border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #141414", paddingBottom: "8px", marginBottom: "16px" }}>
            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>XCHANGE ESCROW CREATION</h2>
            <button style={modalStyles.closeButton} onClick={() => setIsEscrowModalOpen(false)}>✕</button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
            {/* LEFT SUB-GRID: PARTY A COMPONENT */}
            <div style={{ borderRight: "1px solid #141414", paddingRight: "20px" }}>
            <label style={styles.label}>PARTY A WALLET ADDRESS</label>
            <input type="text" placeholder="0x..." style={styles.inputElement} value={partyA} onChange={(e) => setPartyA(e.target.value)} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                <div>
                <label style={styles.label}>ASSET A SELECTION</label>
                <select 
                    style={styles.inputElement} 
                    value={tokenA} 
                    onChange={(e) => setTokenA(e.target.value)}
                >
                    <option value="" disabled style={{ background: "#121212" }}>Select Asset A</option>
                    {mergedTokens.map((token) => (
                    <option key={`tokenA-${token.address}`} value={token.address} style={{ background: "#121212" }}>
                        {token.symbol} ({token.name || token.chain})
                    </option>
                    ))}
                </select>
                </div>
                <div>
                    <label style={styles.label}>AMOUNT A</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*"
                        placeholder="Enter Amount Offered"
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
                <label style={{ ...styles.label, color: "#888" }}>PARTY A AUTO-DEPOSIT HASH (BYTES32)</label>
                <input type="text" placeholder="0x... (Optional for creation)" style={{ ...styles.inputElement, fontFamily: "monospace" }} value={partyADepositHash} onChange={(e) => setPartyADepositHash(e.target.value)} />
            </div>
            </div>

            {/* RIGHT SUB-GRID: PARTY B COMPONENT */}
            <div>
            <label style={styles.label}>PARTY B WALLET ADDRESS</label>
            <input type="text" placeholder="0x..." style={styles.inputElement} value={partyB} onChange={(e) => setPartyB(e.target.value)} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                <div>
                <label style={styles.label}>ASSET B SELECTION</label>
                <select 
                    style={styles.inputElement} 
                    value={tokenB} 
                    onChange={(e) => setTokenB(e.target.value)}
                >
                    <option value="" disabled style={{ background: "#121212" }}>Select Asset B</option>
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
                    <label style={styles.label}>AMOUNT B</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*"
                        placeholder="Enter Amount Requested"
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
                <label style={{ ...styles.label, color: "#888" }}>PARTY B AUTO-DEPOSIT HASH (BYTES32)</label>
                <input type="text" placeholder="0x... (Optional for creation)" style={{ ...styles.inputElement, fontFamily: "monospace" }} value={partyBDepositHash} onChange={(e) => setPartyBDepositHash(e.target.value)} />
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #141414", paddingBottom: "8px", marginBottom: "16px" }}>
            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>XCHANGE DEPOSIT</h2>
            <button style={modalStyles.closeButton} onClick={() => setIsDepositModalOpen(false)}>✕</button>
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
                <label style={styles.label}>SELECT METHOD TARGET</label>
                <select style={styles.inputElement} value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
                <option value="DEPOSIT" style={{ background: "#121212" }}>Xchange Deposit</option>
                <option value="REFUND" style={{ background: "#121212" }}>Refund / Cancellation</option>
                </select>
            </div>
            <div>
                <label style={styles.label}>DEPOSIT TRANSACTION HASH (BYTES32)</label>
                <input type="text" placeholder="0x... (Required for late DEPOSIT actions)" style={{ ...styles.inputElement, fontFamily: "monospace" }} value={depositTxHash} onChange={(e) => setDepositTxHash(e.target.value)} />
            </div>
            </div>

            {/* ROW 3: Divider and Action Button */}
            <div style={{ marginTop: "20px", borderTop: "1px solid #141414", paddingTop: "16px", display: "flex", justifyContent: "flex-end" }}>
            <button style={{ ...styles.btnForestGreen, width: "auto", paddingLeft: "32px", paddingRight: "32px" }} onClick={handleExecuteAction} disabled={actionLoading || !targetSwapAddress || !isConnected}>
                {actionLoading ? "SUBMITTING ROUTINE..." : "SUBMIT DEPOSIT"}
            </button>
            </div>
        </div>
        </div>
      </div>
      )}

      {isRefundModalOpen && (
      <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.85)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 1000,
            backdropFilter: "blur(4px)"
      }}>
            <div style={{
            background: "#0c0c0c", border: "1px solid #1c1c1c",
            borderRadius: "8px", width: "100%", maxWidth: "500px",
            padding: "24px", boxSizing: "border-box"
            }}>
            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: "600", letterSpacing: "0.5px" }}>
                INITIATE ESCROW REFUND
                </h3>
                <button 
                onClick={() => { setIsRefundModalOpen(false); setActionFeedback(null); }}
                style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "18px" }}
                >
                &times;
                </button>
            </div>

            <form onSubmit={handleExecuteAction}>
                {/* FIELD 1: CLONE ESCROW ADDRESS */}
                <div style={{ marginBottom: "14px" }}>
                <label style={styles.label}>TARGET CLONE ESCROW ADDRESS</label>
                <input 
                    type="text" 
                    required
                    placeholder="0x... (Paste your specific clone address here)" 
                    style={styles.inputElement} 
                    value={targetSwapAddress} 
                    onChange={(e) => {
                    setTargetSwapAddress(e.target.value);
                    setSelectedAction('REFUND'); // Ensures action configuration forces the correct sub-routine route
                    }} 
                />
                </div>

                {/* FIELD 2: SENDER OVERRIDE PROFILE */}
                <div style={{ marginBottom: "14px" }}>
                <label style={styles.label}>INTERACTION SENDER</label>
                <input 
                    type="text" 
                    placeholder="0x... (Defaults to your connected wallet)" 
                    style={styles.inputElement} 
                    value={interactionSender} 
                    onChange={(e) => setInteractionSender(e.target.value)} 
                />
                </div>

                {/* FIELD 3: ON-CHAIN CLEARING TRANSACTIONS HASH */}
                <div style={{ marginBottom: "20px" }}>
                <label style={{ ...styles.label, color: "#888" }}>
                    CLEARING REFUND HASH (BYTES32)
                </label>
                <input 
                    type="text" 
                    required
                    placeholder="0x... (Enter your internal transaction or tracking reference)" 
                    style={{ ...styles.inputElement, fontFamily: "monospace" }} 
                    value={depositTxHash} 
                    onChange={(e) => setDepositTxHash(e.target.value)} 
                />
                </div>

                {/* STATE & ACTION FEEDBACK DIALOGS */}
                {actionFeedback && (
                <div style={{
                    padding: "12px", borderRadius: "4px", marginBottom: "16px", fontSize: "13px",
                    background: actionFeedback.success ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    border: actionFeedback.success ? "1px solid #10b981" : "1px solid #ef4444",
                    color: actionFeedback.success ? "#10b981" : "#ef4444",
                    wordBreak: "break-all"
                }}>
                    {actionFeedback.message}
                </div>
                )}

                {/* INTERACTION TRIGGERS */}
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                    type="button"
                    onClick={() => { setIsRefundModalOpen(false); setActionFeedback(null); }}
                    style={{
                    background: "#141414", color: "#ccc", border: "1px solid #222",
                    padding: "10px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px"
                    }}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={actionLoading}
                    style={{
                    background: actionLoading ? "#333" : "#ef4444", 
                    color: "#fff", border: "none",
                    padding: "10px 20px", borderRadius: "4px", cursor: actionLoading ? "not-allowed" : "pointer",
                    fontSize: "13px", fontWeight: "600"
                    }}
                >
                    {actionLoading ? "Processing Refund..." : "Execute Refund"}
                </button>
                </div>
            </form>
            </div>
        </div>
      )}

      {/* --- SWAP REGISTRY LEDGER TABLE --- */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Escrow Settlement Registry</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>ESCROW CONTRACT</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>PARTY A</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>PARTY A ASSET</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>STATUS</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>PARTY B</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>PARTY B ASSET</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>STATUS</th>
              {/* STEP 1: ADD AN ACTIONS COLUMN HEADER */}
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {swapRecords.map((rec) => (
                <tr key={`swap-row-${rec.index}`} style={{ borderBottom: "1px solid #111111" }}>
                    {/* Column 1: Contract Address Trigger */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#aaaaaa" }}>
                    <span 
                        title={rec.contractAddress} 
                        style={{ borderBottom: "1px dashed #1d5c34", color: "#4ade80", cursor: "pointer" }} 
                        onClick={() => handleSelectEscrowFromTable(rec.contractAddress)}
                    >
                        {rec.shortAddress}
                    </span>
                    </td>

                    {/* Column 2: Party A */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888888" }}>
                    {rec.partyA !== "0xUnknown" ? `${rec.partyA.slice(0, 6)}...${rec.partyA.slice(-4)}` : "0xUnknown"}
                    </td>

                    {/* Column 3: Asset Offered */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#666666" }}>{rec.offered}</td>

                    {/* Column 4: Party A Sub-Status (FIXED: Uses a conditional fallback) */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#eab308" }}>
                    {rec.statusLabel === "PENDINGDEPOSITS" ? "PENDING" : "CLEARED"}
                    </td>

                    {/* Column 5: Party B */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888888" }}>
                    {rec.partyB !== "0xUnknown" ? `${rec.partyB.slice(0, 6)}...${rec.partyB.slice(-4)}` : "0xUnknown"}
                    </td>

                    {/* Column 6: Asset Requested */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#666666" }}>{rec.requested}</td>

                    {/* Column 7: Global Status Label */}
                    <td style={{ 
                    padding: "12px 8px", 
                    fontFamily: "monospace", 
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
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid #ef4444",
                        color: "#ef4444",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "600",
                        fontFamily: "sans-serif"
                        }}
                    >
                        Refund
                    </button>
                    </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}