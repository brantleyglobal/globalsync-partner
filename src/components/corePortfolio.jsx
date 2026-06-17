// src/components/CorePortfolioMatrix.jsx
import React, { useState, useEffect } from 'react';
import { styles } from '../utils/styles.jsx';

export default function CorePortfolioMatrix({ userAddress, activeContract }) {
  const [nativeAllocation, setNativeAllocation] = useState(null);
  const [nativePurchase, setNativePurchase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNativeOnChainData = async () => {
      if (!userAddress || !activeContract) return;
      setLoading(true);
      setError(null);

      try {
        // Query the authorized view mapping
        const userOverviews = await activeContract.getUserOverview(userAddress);

        if (!userOverviews || userOverviews.length === 0) {
          setNativeAllocation(null);
          setNativePurchase(null);
          return;
        }

        // Target the latest chronological state entry
        const latestState = userOverviews[userOverviews.length - 1];
        
        // Extract Index 0 directly to isolate Native Platform Currency from FIFO stablecoin lapses
        const rawBalance = latestState.balanceAmount[0];
        const rawPurchase = latestState.purchases[0];
        const timestamp = latestState.timestamp;

        // Process Native Allocation (Index 0)
        if (rawBalance && rawBalance > 0n) {
          setNativeAllocation({
            register: "REG-000",
            classification: "Primary Native Yield Node",
            balance: `${(Number(rawBalance) / 10 ** 18).toFixed(4)} NATIVE`
          });
        } else {
          setNativeAllocation(null);
        }

        // Process Native Procurement History (Index 0)
        if (rawPurchase && rawPurchase > 0n) {
          setNativePurchase({
            index: "IDX-000",
            date: timestamp 
              ? new Date(Number(timestamp) * 1000).toISOString().split('T')[0] 
              : "N/A",
            cost: `${(Number(rawPurchase) / 10 ** 18).toFixed(4)} NATIVE`
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
  }, [userAddress, activeContract]);

  return (
    <div style={styles.mainContent}>
      {/* SECTION HEADER */}
      <div style={{ paddingTop: "10px", marginBottom: "30px", borderBottom: "1px solid #161616", paddingBottom: "16px" }}>
              
          {/* FLEX CONTAINER TO ALIGN ITEMS SIDE-BY-SIDE */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
              
              {/* LEFT FLANK: IDENTITY & STATUS */}
              <div>
                  <h1 style={{ ...styles.title, fontWeight: "100", margin: 0, paddingBottom: "4px" }}>INVESTMENT MATRIX</h1>
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

      {/* ACCESS & OPERATIONAL MONITOR */}
      {(!userAddress || error || loading) && (
        <div style={{ ...styles.jsonDisplay, color: error ? "#ef4444" : "#054e1a", marginBottom: "30px", maxHeight: "none" }}>
          {loading && <div>Reading isolated baseline index [0] from admin struct matrix...</div>}
          {error && <div><strong>AUTHORIZATION FAILURE:</strong> {error}</div>}
          {!userAddress && <div>Ready to initialize. Provide a verified credential target address to extract active native records.</div>}
        </div>
      )}

      {/* DASHBOARD LAYOUT GRID */}
      <div style={styles.gridContainer}>
        
        {/* PANEL 1: NATIVE ALLOCATIONS */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Verified Platform Allocations</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616" }}>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>REGISTER</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>CLASSIFICATION</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "right" }}>BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {!nativeAllocation ? (
                <tr>
                  <td colSpan="3" style={{ padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                    No active index [0] native currency records found.
                  </td>
                </tr>
              ) : (
                <tr style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#555555" }}>{nativeAllocation.register}</td>
                  <td style={{ padding: "12px 8px", color: "#ffffff" }}>{nativeAllocation.classification}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#4ade80", fontWeight: "600", textAlign: "right" }}>{nativeAllocation.balance}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PANEL 2: PROCUREMENT HISTORY */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Asset Procurement History</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #161616" }}>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>INDEX</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600" }}>TIMESTAMP</th>
                <th style={{ padding: "12px 8px", color: "#666666", fontSize: "11px", fontWeight: "600", textAlign: "right" }}>VALUE</th>
              </tr>
            </thead>
            <tbody>
              {!nativePurchase ? (
                <tr>
                  <td colSpan="3" style={{ padding: "24px 8px", color: "#444444", textAlign: "center", fontStyle: "italic" }}>
                    No historical index [0] native transactions recorded.
                  </td>
                </tr>
              ) : (
                <tr style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#555555" }}>{nativePurchase.index}</td>
                  <td style={{ padding: "12px 8px", color: "#aaaaaa" }}>{nativePurchase.date}</td>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ffffff", textAlign: "right" }}>{nativePurchase.cost}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}