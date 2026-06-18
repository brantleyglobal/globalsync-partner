// src/components/AffiliatePortal.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';

export default function AffiliatePortal({ userAddress, activeContract, isConnected }) {
  const [referralRecords, setReferralRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [totals, setTotals] = useState({
    totalEarned: 0,
    referralCount: 0
  });

  useEffect(() => {
    const fetchAffiliateLogs = async () => {
      if (!userAddress || !activeContract || !isConnected) return;
      setLoading(true);
      setError(null);

      try {
        // Query the dedicated view function using current wallet as affiliate address
        const records = await activeContract.getAffiliateHistory(userAddress);
        
        let aggregatePayout = 0;

        const formattedRecords = records.map((rec, idx) => {
          const rawCommission = Number(rec.commission) / 10 ** 18;
          aggregatePayout += rawCommission;

          return {
            index: idx,
            buyer: rec.user,
            orderIdx: rec.purchaseIndex.toString(),
            payout: `${rawCommission.toFixed(4)} NATIVE`,
            // Extract the hex strings for clear short-string viewing
            hashRef: rec.commissionHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" 
              ? `${rec.commissionHash.slice(0, 8)}...` 
              : "AUTO_SYSTEM_SETTLED"
          };
        });

        setTotals({
          totalEarned: aggregatePayout,
          referralCount: formattedRecords.length
        });
        
        setReferralRecords(formattedRecords.reverse()); // Put freshest payouts at the top
      } catch (err) {
        console.error("Affiliate ledger read failure:", err);
        setError(err.message || "Failed to load affiliate ledger records.");
      } finally {
        setLoading(false);
      }
    };

    fetchAffiliateLogs();
  }, [userAddress, activeContract]);

  return (
    <div style={styles.mainContent}>
      {/* GLOBAL SESSION STATUS BAR */}
    <div style={{ paddingTop: "10px", marginBottom: "30px", borderBottom: "1px solid #161616", paddingBottom: "16px" }}>
        
        {/* FLEX CONTAINER TO ALIGN ITEMS SIDE-BY-SIDE */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
            
            {/* LEFT FLANK: IDENTITY & STATUS */}
            <div>
                <h1 style={{ ...styles.title, fontWeight: "100", margin: 0, paddingBottom: "4px" }}>AFFILIATE PORTAL</h1>
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

      {/* COMPLIANCE MONITOR */}
      {error && (
        <div style={{ ...styles.jsonDisplay, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)", marginBottom: "30px" }}>
          <strong>AFFILIATE CONTEXT ERROR:</strong> {error}
        </div>
      )}

      {/* METRIC ROW */}
      {isConnected && userAddress && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0 }}>
            <span style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>CONVERTED ORDERS</span>
            <b style={{ fontSize: "20px", fontFamily: "monospace", color: "#fff" }}>{totals.referralCount} Accounts</b>
          </div>
          <div style={{ ...styles.sectionCard, flex: 1, padding: "16px", margin: 0, border: "1px solid rgba(74, 222, 128, 0.15)" }}>
            <span style={{ color: "#4ade80", fontSize: "10px", letterSpacing: "1px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>TOTAL ACCRUED NETWORK REWARDS</span>
            <b style={{ fontSize: "20px", fontFamily: "monospace", color: "#4ade80" }}>{totals.totalEarned.toFixed(4)} <span style={{fontSize:"12px", color:"#2e7d43"}}>NATIVE</span></b>
          </div>
        </div>
      )}

      {/* REFERRAL LEDGER SHEET */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Commission Credit Settlements</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #161616" }}>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>PAYOUT RECORD</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>BUYER IDENTITY</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "center" }}>BUYER TX INDEX</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>CLEARING HASH</th>
              <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "right" }}>SETTLED REWARD</th>
            </tr>
          </thead>
          <tbody>
            {referralRecords.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: "30px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                  {loading ? "Recompiling commercial partner allocations..." : "No affiliate commissions parsed for this account node yet."}
                </td>
              </tr>
            ) : (
              referralRecords.map((rec) => (
                <tr key={`affiliate-row-${rec.index}`} style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#888888" }}>REC-AFF-{rec.index.toString().padStart(3, '0')}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#aaaaaa" }}>
                    {rec.buyer.slice(0, 6)}...{rec.buyer.slice(-4)}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "center", fontFamily: "monospace" }}>TX-TERM-{rec.orderIdx.padStart(3, '0')}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#666666" }}>{rec.hashRef}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", textAlign: "right", color: "#4ade80", fontWeight: "600" }}>
                    {rec.payout}
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