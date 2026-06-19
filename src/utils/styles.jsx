// src/styles.jsx

export const styles = {
  appContainer: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "#000000",
    color: "#ffffff",
    overflow: "hidden"
  },
  sidebar: {
    width: "300px",
    background: "#021b0979",
    borderRight: "1px solid #1a1a1a",
    padding: "30px 24px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    height: "100vh",
    overflowY: "auto",
    scrollbarGutter: "stable", /* From our scroll fix */
  },
  brandContainer: {
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 8px",
    flexShrink: 0, /* From our layout squeeze fix */
  },
  title: {
    fontSize: "20px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    margin: 0,
    color: "#ffffff",
  },
  subtitle: {
    fontSize: "10px",
    color: "#666666",
    letterSpacing: "1px",
    fontWeight: "600"
  },
  divider: {
    border: "0",
    height: "1px",
    background: "#1a1a1a",
    margin: "8px 0 15px 0",
  },
  configSection: {
    display: "flex",
    flexDirection: "column",
  },
  sidebarTitle: {
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.5px",
    color: "#888888",
    margin: "0 0 4px 0",
  },
  microText: {
    fontSize: "11px",
    color: "#555555",
    margin: "0 0 20px 0",
    lineHeight: "1.4",
  },
  sidebarInput: {
    background: "#121212",
    border: "1px solid #222222",
    borderRadius: "6px",
    color: "#ffffff",
    padding: "6px 6px",
    fontSize: "13px",
    marginBottom: "16px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  cryptoInputWrapper: {
    position: "relative",
    width: "100%",
    marginBottom: "60px"
  },
  visibilityToggle: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#888888",
    fontSize: "11px",
    cursor: "pointer",
  },
  
  /* MAIN CONTENT & LEDGER PANELS */
  mainContent: {
    flex: 1,
    padding: "40px",
    paddingTop: "10px",
    overflowY: "auto",
    boxSizing: "border-box",
    height: "100vh"
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "30px",
    alignItems: "start",
  },
  columnGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "30px",
  },
  sectionCard: {
    background: "#0c0c0c",
    border: "1px solid #161616",
    borderRadius: "12px",
    padding: "28px",
    boxSizing: "border-box",
  },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: "200",
    letterSpacing: "1px",
    margin: "0 0 24px 0",
    color: "#ffffff",
    //borderBottom: "1px solid #161616",
    paddingBottom: "8px",
    textTransform: "uppercase",
    marginBottom: "0px"
  },
  formRow: {
    display: "flex",
    gap: "16px",
    marginBottom: "4px",
  },
  formGroup: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "10px",
    fontWeight: "200",
    color: "#666666",
    letterSpacing: "1px",
    marginBottom: "6px",
    marginTop: "8px"
  },
  inputElement: {
    background: "#121212",
    border: "1px solid #222222",
    borderRadius: "6px",
    color: "#ffffff",
    padding: "8px",
    fontSize: "13px",
    marginBottom: "16px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  btnForestGreen: {
    background: "#021b0979",
    color: "#ffffff",
    border: "1px solid #000000b6",
    borderRadius: "6px",
    padding: "8px",
    fontWeight: "200",
    fontSize: "12px",
    letterSpacing: "1px",
    cursor: "pointer",
    width: "100%",
    marginTop: "8px",
    transition: "opacity 0.2s",
  },
  resultsLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#444444",
    letterSpacing: "0.5px",
    margin: "24px 0 8px 0",
  },
  jsonDisplay: {
    background: "#050505",
    border: "1px solid #121212",
    borderRadius: "6px",
    padding: "8px",
    color: "#054e1a",
    fontSize: "12px",
    overflowX: "auto",
    maxHeight: "150px",
    margin: 0,
  }
};