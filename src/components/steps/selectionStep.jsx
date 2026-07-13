import React from 'react';
import { Info, Close } from "@mui/icons-material"; // Imported Close icon
import { styles } from '../../utils/styles.jsx';

export default function SelectionStep({ userAction, setUserAction, onHelpToggle, onNext, onClose }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      {/* Header Context View */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0, letterSpacing: "1px" }}>PORTAL ACTIONS</h3>
        
        {/* Header Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={onHelpToggle}
            aria-label="Toggle help documentation"
            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
          >
            <Info style={{ fontSize: "18px" }} />
          </button>
          
          <button
            onClick={onClose}
            aria-label="Close portal modal"
            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", transition: "color 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#666"}
          >
            <Close style={{ fontSize: "18px" }} />
          </button>
        </div>
      </div>

      {/* NEW ETCHED HORIZONTAL DIVIDER */}
      <div style={{ display: "flex", alignItems: "center", width: "100%", margin: "0 0 24px 0" }}>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.2) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
      </div>

      {/* OPTION 1: PURCHASE ASSET */}
      <div
        role="tab"
        tabIndex={0}
        aria-selected={userAction === "purchase"}
        onClick={() => setUserAction("purchase")}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setUserAction("purchase") }}
        style={{
          ...styles.sectionCard,
          cursor: "pointer",
          marginBottom: "12px",
          padding: "16px",
          transition: "transform 0.2s, background-color 0.2s",
          backgroundColor: userAction === "purchase" ? "rgba(29, 92, 52, 0.2)" : "#0a0a0a",
          border: userAction === "purchase" ? "1px solid #1d5c34" : "1px solid #1a1a1a"
        }}
      >
        <h4 style={{ ...styles.label, fontSize: "14px", color: "#fff", margin: "0 0 6px 0", fontWeight: "400" }}>ASSET PURCHASE</h4>
        <p style={{ color: "#888", fontSize: "11px", margin: 0, textAlign: "justify", lineHeight: "1.4" }}>
          Initialize purchase of production assets directly using whitelisted stablecoins.
        </p>
      </div>

      {/* OPTION 2: REFUND */}
      <div
        role="tab"
        tabIndex={0}
        aria-selected={userAction === "refund"}
        onClick={() => setUserAction("refund")}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setUserAction("refund") }}
        style={{
          ...styles.sectionCard,
          cursor: "pointer",
          marginBottom: "12px",
          padding: "16px",
          transition: "transform 0.2s, background-color 0.2s",
          backgroundColor: userAction === "refund" ? "rgba(29, 92, 52, 0.2)" : "#0a0a0a",
          border: userAction === "refund" ? "1px solid #1d5c34" : "1px solid #1a1a1a"
        }}
      >
        <h4 style={{ ...styles.label, fontSize: "14px", color: "#fff", margin: "0 0 6px 0", fontWeight: "400" }}>REQUEST ASSET REFUND</h4>
        <p style={{ color: "#888", fontSize: "11px", margin: 0, textAlign: "justify", lineHeight: "1.4" }}>
          Request a refund for a physical asset. Subject to purchase terms.
        </p>
      </div>

      {/* OPTION 3: REPAIRS */}
      <div
        role="tab"
        tabIndex={0}
        aria-selected={userAction === "repair"}
        onClick={() => setUserAction("repair")}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setUserAction("repair") }}
        style={{
          ...styles.sectionCard,
          cursor: "pointer",
          marginBottom: "24px",
          padding: "16px",
          transition: "transform 0.2s, background-color 0.2s",
          backgroundColor: userAction === "repair" ? "rgba(29, 92, 52, 0.2)" : "#0a0a0a",
          border: userAction === "repair" ? "1px solid #1d5c34" : "1px solid #1a1a1a"
        }}
      >
        <h4 style={{ ...styles.label, fontSize: "14px", color: "#fff", margin: "0 0 6px 0", fontWeight: "400" }}>SYSTEM MAINTENANCE & REPAIR</h4>
        <p style={{ color: "#888", fontSize: "11px", margin: 0, textAlign: "justify", lineHeight: "1.4" }}>
          Request for system repair or maintenance. Logistics and reverse transport options are completely included at no cost.
        </p>
      </div>

      {/* Step Navigation Bar Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto", pt: "16px", borderTop: "1px solid #111" }}>
        <button
          style={{ 
            ...styles.btnForestGreen, 
            opacity: !userAction ? "0.4" : "1", 
            cursor: !userAction ? "not-allowed" : "pointer",
            padding: "8px 24px"
          }}
          onClick={onNext}
          disabled={!userAction}
        >
          NEXT STEP
        </button>
      </div>
    </div>
  );
}