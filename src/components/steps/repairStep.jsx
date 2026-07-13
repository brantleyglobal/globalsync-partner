import React, { useState } from "react";
import { Info, Close } from "@mui/icons-material";
import { styles } from "../../utils/styles.jsx";

export default function RepairStep({
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
  const [systemSerialNumber, setSystemSerialNumber] = useState("");
  const [repairDescription, setRepairDescription] = useState("");

  const isFormValid = 
    isValidHash && 
    isConnected && 
    userAddress && 
    systemSerialNumber && 
    repairDescription && 
    firstname && 
    lastname && 
    email && 
    !emailError;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Header Context */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0, letterSpacing: "1px" }}>REPAIR REQUEST</h3>
        
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

      {/* NEW ETCHED HORIZONTAL DIVIDER */}
      <div style={{ display: "flex", alignItems: "center", width: "100%", margin: "0 0 20px 0" }}>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255, 255, 255, 0.2) 0%, rgba(255,255,255,0.02) 80%, transparent 100%)" }} />
      </div>

      {/* Proof of Original Purchase Ledger Hash */}
      <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px" }}>
        <label style={styles.label}>PURCHASE TRANSACTION HASH (Required)</label>
        <input
          type="text"
          value={receipt}
          onChange={(e) => setReceipt(e.target.value)}
          placeholder="Input Purchase Reference Hash '0x...'"
          style={styles.inputElement}
        />
      </div>

      {/* Hardware Diagnostic Logs Metadata Input */}
      <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px" }}>
        <label style={styles.label}>SERIAL NUMBER (S/N)</label>
        <input
          type="text"
          value={systemSerialNumber}
          onChange={(e) => setSystemSerialNumber(e.target.value)}
          placeholder="Ex: BLD-1207XXX-XXXXX..."
          style={styles.inputElement}
        />
      </div>

      {/* Shared Logistics Shipping Contact Profile */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px", marginBottom: "20px" }}>
        <p style={{ ...styles.label, color: "#fff", fontSize: "11px", marginBottom: "12px", letterSpacing: "1px" }}>
          CONFIRMATION | INSTRUCTION CONTACT
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
        {emailError && (
          <span style={{ color: "#ef4444", fontSize: "11px", display: "block", marginTop: "4px" }}>
            {emailError}
          </span>
        )}
      </div>

      {/* Action Controls Footer */}
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
          {isProcessing ? "PROCESSING..." : "SUBMIT REPAIR REQUEST"}
        </button>
      </div>
    </div>
  );
}