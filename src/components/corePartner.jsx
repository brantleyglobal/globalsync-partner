// src/components/PartnerPortal.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';

export default function PartnerPortal({ userAddress, activeContract, isConnected }) {
  const [partnerOrders, setPartnerOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // High-level aggregate metrics for partner tracking
  const [metrics, setMetrics] = useState({
    totalVolume: 0,
    settledCost: 0,
    totalCredits: 0
  });

  useEffect(() => {
    const fetchNativeOnChainData = async () => {
      if (!userAddress || !isConnected) return;
      setLoading(true);
      setError(null);

      try {
        // PRODUCTION SAFE IPC BRIDGE CALL
        const overview = await window.electronAPI.getUserOverview({
          userAddress,
          contractAddress: "0xYourMatrixContractAddress", 
          chainKey: "polygon"
        });

        if (!overview) {
          setNativeAllocation(null);
          setNativePurchase(null);
          return;
        }

        // Convert back to BigInt for safe logic checks
        const balanceVal = BigInt(overview.balance);
        const purchaseVal = BigInt(overview.purchase);

        // Process Native Allocation (Preserving Index 0 Logic)
        if (balanceVal > 0n) {
          const padded = balanceVal.toString().padStart(19, '0');
          const splitIdx = padded.length - 18;
          const cleanBalance = `${Number(padded.slice(0, splitIdx)).toLocaleString()}.${padded.slice(splitIdx, splitIdx + 4)}`;

          setNativeAllocation({
            register: "REG-000",
            classification: "Primary Native Yield Node",
            balance: `${cleanBalance} NATIVE`
          });
        } else {
          setNativeAllocation(null);
        }

        // Process Native Procurement History (Preserving Index 0 Logic)
        if (purchaseVal > 0n) {
          const padded = purchaseVal.toString().padStart(19, '0');
          const splitIdx = padded.length - 18;
          const cleanPurchase = `${Number(padded.slice(0, splitIdx)).toLocaleString()}.${padded.slice(splitIdx, splitIdx + 4)}`;

          setNativePurchase({
            index: "IDX-000",
            date: overview.timestamp && overview.timestamp !== "0"
              ? new Date(Number(overview.timestamp) * 1000).toISOString().split('T')[0] 
              : "N/A",
            cost: `${cleanPurchase} NATIVE`
          });
        } else {
          setNativePurchase(null);
        }

      } catch (err) {
        console.error("Administrative matrix processing failed:", err);
        setError(err.message || "Failed to retrieve authorized native data arrays.");
      } finally {
        setLoading(false);
      }
    };

    fetchNativeOnChainData();
  }, [userAddress, isConnected]);

  return (
    <div style={styles.mainContent}>
      {/* PORTAL HEADER */}
      <div style={{ paddingTop: "10px", marginBottom: "30px", borderBottom: "1px solid #161616", paddingBottom: "16px" }}>
              
            {/* FLEX CONTAINER TO ALIGN ITEMS SIDE-BY-SIDE */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
                
                {/* LEFT FLANK: IDENTITY & STATUS */}
                <div>
                    <h1 style={{ ...styles.title, fontWeight: "100", margin: 0, paddingBottom: "4px" }}>PARTNER PORTAL</h1>
                    <p style={{ ...styles.subtitle, margin: 0 }}>
                        ACCOUNT STATUS: {isConnected ? (
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
                        {isConnected && userAddress 
                        ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` 
                        : "0xNone"}
                    </code>
                </div>

            </div>
        </div>

      {/* ERROR MONITOR */}
      {error && (
        <div style={{ ...styles.jsonDisplay, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)", marginBottom: "30px" }}>
          <strong>PARTNER LEDGER EXCEPTION:</strong> {error}
        </div>
      )}

      {/* METRIC SUMMARIES */}
      {isConnected && userAddress && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>CUMULATIVE VOLUME</span>
            <b style={{ fontSize: "20px", fontFamily: "monospace", color: "#fff" }}>{metrics.totalVolume} units</b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>GROSS SETTLEMENT VALUE</span>
            <b style={{ fontSize: "20px", fontFamily: "monospace", color: "#fff" }}>{metrics.settledCost.toFixed(2)} <span style={{fontSize:"12px", color:"#555"}}>NATIVE</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(74, 222, 128, 0.15)" }}>
            <span style={{ color: "#4ade80", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>TOTAL RETURNED SAVINGS</span>
            <b style={{ fontSize: "20px", fontFamily: "monospace", color: "#4ade80" }}>{metrics.totalCredits.toFixed(4)} <span style={{fontSize:"12px", color:"#2e7d43"}}>NATIVE</span></b>
          </div>
        </div>
      )}

      {/* VOLUME DISTRIBUTION REGISTER */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Partner Execution Ledger</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #161616" }}>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>RECORD INDEX</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>TIMESTAMP</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "center" }}>QUANTITY</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "right" }}>SETTLEMENT COST</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "right" }}>MANUFACTURER CREDIT</th>
            </tr>
          </thead>
          <tbody>
            {partnerOrders.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                  {loading ? "Decrypting partner allocation lines..." : "No operational activity recorded for this partner destination."}
                </td>
              </tr>
            ) : (
              partnerOrders.map((order) => (
                <tr key={`${order.id}-${order.index}`} style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888888" }}>PT-TERM-{order.index.toString().padStart(3, '0')}</td>
                  <td style={{ padding: "12px 8px", color: "#aaaaaa" }}>{order.date}</td>
                  <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: "monospace" }}>{order.quantity}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", textAlign: "right", color: "#fff" }}>{order.cost}</td>
                  <td style={{ 
                    padding: "12px 8px", 
                    fontFamily: "monospace", 
                    textAlign: "right", 
                    color: order.hasCredit ? "#4ade80" : "#555555", 
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
    </div>
  );
}