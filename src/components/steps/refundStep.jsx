import React, { useState } from "react";
import { Info, Close } from "@mui/icons-material";
import { styles } from "../../utils/styles.jsx";
import { supportedTokens } from "../../utils/tokensX.js";

export default function RefundStep({
  receipt,
  setReceipt,
  firstname,
  setFirstname,
  lastname,
  setLastname,
  email,
  handleEmailChange,
  handleEmailBlur,
  emailError,
  onPrevious,
  onNext,
  isProcessing,
  isValidHash,
  userAddress,
  isConnected,
  onHelpToggle,
  onClose
}) {
  const [ledgerTarget, setLedgerTarget] = useState("AssetPurchase");
  const [showStablecoinInfo, setShowStablecoinInfo] = useState(false);

  const isFormValid = isValidHash && isConnected && userAddress && firstname && lastname && email && !emailError;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", position: "relative" }}>
      {/* Header Context */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0, letterSpacing: "1px" }}>REFUND REQUEST</h3>
        
        {/* Header Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={onHelpToggle} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}>
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

      {/* HORIZONTAL ETCHED DIVIDER */}
      <div style={{ display: "flex", alignItems: "center", width: "100%", margin: "0 0 20px 0" }}>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.2) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
      </div>

      {/* Hash Input */}
      <div style={{ display: "flex", flexDirection: "column", marginBottom: "16px" }}>
        <label style={styles.label}>PURCHASE TRANSACTION HASH</label>
        <input
          type="text"
          value={receipt}
          onChange={(e) => setReceipt(e.target.value)}
          placeholder="Input Receipt Hash '0x...'"
          style={styles.inputElement}
        />
      </div>

      {/* Confirmation Details Profile Fields */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px", marginBottom: "12px" }}>
        <p style={{ ...styles.label, color: "#fff", fontSize: "11px", marginBottom: "12px", letterSpacing: "1px" }}>
          CONFIRMATION CONTACT
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <input
            type="text"
            value={firstname}
            onChange={(e) => setFirstname(e.target.value)}
            placeholder="First Name"
            style={styles.inputElement}
          />
          <input
            type="text"
            value={lastname}
            onChange={(e) => setLastname(e.target.value)}
            placeholder="Last Name"
            style={styles.inputElement}
          />
        </div>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          placeholder="Email Address"
          style={{ ...styles.inputElement, borderColor: emailError ? "#ef4444" : "#1a1a1a" }}
        />
        {emailError && <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px", margin: 0 }}>{emailError}</p>}
      </div>

      {/* Footer Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #111" }}>
        <button 
          style={{ ...styles.btnForestGreen, background: "#222", color: "#999" }} 
          onClick={onPrevious}
        >
          PREVIOUS
        </button>
        <button
          style={{ 
            ...styles.btnForestGreen, 
            opacity: (!isFormValid || isProcessing) ? "0.4" : "1",
            cursor: (!isFormValid || isProcessing) ? "not-allowed" : "pointer"
          }}
          onClick={onNext}
          disabled={!isFormValid || isProcessing}
        >
          {isProcessing ? "PROCESSING..." : "CONFIRM REFUND"}
        </button>
      </div>
    </div>
  );
}