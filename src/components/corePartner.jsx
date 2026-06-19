// src/components/PartnerPortal.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';
import { deployments } from '../utils/tokensX.js';

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
    const fetchPartnerLedgerData = async () => {
      if (!userAddress || !isConnected) {
        setPartnerOrders([]);
        setMetrics({ totalVolume: 0, settledCost: 0, totalCredits: 0 });
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        // Correctly call the backend IPC link handler
        const ledgerResponse = await window.electronAPI.getPartnerLedger({
          userAddress,
          contractAddress: deployments.AssetPurchase, 
          chainKey: "global"
        });

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

        // Convert big integers to numbers cleanly for UI display strings
        setMetrics({
          totalVolume: cumulativeVolume,
          settledCost: parseFloat(formatAllocation(cumulativeCost)),
          totalCredits: parseFloat(formatAllocation(cumulativeCredits))
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
      <div style={{ paddingTop: "0px", marginBottom: "6px", borderBottom: "1px solid #161616", paddingBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
            
          {/* LEFT FLANK: IDENTITY & STATUS */}
          <div>
            <p style={{ ...styles.subtitle, margin: 0, padding: "4px 0px" }}>
              ACCOUNT STATUS: {isConnected ? (
                <span style={{ fontFamily: "monospace", color: "#1d5c34", fontWeight: "600" }}>CONNECTED</span>
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
              padding: "4px 4px", 
              borderRadius: "4px", 
              color: userAddress ? "#1d5c34" : "#555",
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
      <div style={{ paddingTop: "8px", marginBottom: "6px", paddingBottom: "6px" }}>
        <h1 style={{ ...styles.title, fontSize: "18px", fontWeight: "100", margin: 0, paddingBottom: "10px" }}>PARTNER PORTAL</h1>
      </div>  

      {/* ERROR MONITOR */}
      {error && (
        <div style={{ ...styles.jsonDisplay, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)", marginBottom: "30px" }}>
          <strong>PARTNER LEDGER EXCEPTION:</strong> {error}
        </div>
      )}

      {(!isConnected || loading) && (
        <div style={{ ...styles.jsonDisplay, color: "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {loading && <div>Reading investment records...</div>}
          {!isConnected && <div>Ready to initialize. Connect your wallet to extract active purchase records.</div>}
        </div>
      )}

      {/* METRIC SUMMARIES */}
      {isConnected && userAddress && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>CUMULATIVE VOLUME</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px",  fontWeight: "lighter", fontFamily: "monospace", color: "#fff" }}>{metrics.totalVolume} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#555"}}>UNITS</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>GROSS SETTLEMENT VALUE</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "lighter", fontFamily: "monospace", color: "#fff" }}>{metrics.settledCost.toFixed(2)} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#555"}}>GBDo</span></b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(74, 222, 128, 0.15)" }}>
            <span style={{ color: "#1d5c34", fontSize: "10px", letterSpacing: "1px", fontWeight: "lighter", display: "block", marginBottom: "6px" }}>TOTAL RETURNED SAVINGS</span>
            <hr style={styles.divider} />
            <b style={{ fontSize: "16px", fontWeight: "lighter", fontFamily: "monospace", color: "#1d5c34" }}>{metrics.totalCredits.toFixed(4)} <span style={{fontSize:"12px", fontWeight: "lighter", color:"#2e7d43"}}>GBDo</span></b>
          </div>
        </div>
      )}

      {/* VOLUME DISTRIBUTION REGISTER */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Wholesale Partner Ledger</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #161616", borderTop: "1px solid #161616" }}>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>PURCHASE RECORD</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200" }}>TIMESTAMP</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "center" }}>QUANTITY</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>SETTLEMENT COST</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "200", textAlign: "right" }}>BUYER CREDIT</th>
            </tr>
          </thead>
          <tbody>
            {partnerOrders.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                  {loading ? "Decrypting partner allocation lines..." : "No operational activity recorded for the connected wallet."}
                </td>
              </tr>
            ) : (
              partnerOrders.map((order) => (
                <tr key={`partner-order-${order.id}-${order.index}`} style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888888" }}>PT-TERM-{order.index.toString().padStart(3, '0')}</td>
                  <td style={{ padding: "12px 8px", color: "#aaaaaa" }}>{order.date}</td>
                  <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: "monospace", color: "#bbb" }}>{order.quantity}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", textAlign: "right", color: "#fff" }}>{order.cost}</td>
                  <td style={{ 
                    padding: "12px 8px", 
                    fontFamily: "monospace", 
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
    </div>
  );
}