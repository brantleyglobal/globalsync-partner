# GlobalSync-Partner

GlobalSync is the dedicated enterprise desktop terminal designed for affiliates, wholesalers, and strategic partners. It provides a secure, streamlined environment to verify historic purchases, audit transactional histories, and process inbound/outbound corporate orders in real time.

---

## Supported Platforms & Installation Warnings

Because this application compiles natively for multiple desktop operating systems directly via GitHub Actions without commercial code-signing certificate keys attached, your operating system will flag the initial installer out of caution. 

Please follow the platform-specific bypass instructions below to complete installation.

### Windows Setup (SmartScreen Bypass)
When launching the `.exe` installer for the first time, Microsoft Defender SmartScreen will flash a warning stating: *"Windows protected your PC. Microsoft Defender SmartScreen prevented an unrecognized app from starting."*

* **How to install:**
  1. Click on the tiny **"More info"** hyperlink text inside the blue/gray warning window.
  2. A new button labeled **"Run anyway"** will appear at the bottom.
  3. Click **Run anyway** to initialize the desktop app.

### macOS Setup (Gatekeeper Bypass)
When attempting to open the `.dmg` asset on Mac, Apple Gatekeeper will block execution and display an alert stating: *"GlobalSync can’t be opened because Apple cannot check it for malicious software."*

* **How to install:**
  1. Open your Mac's **System Settings** (or System Preferences).
  2. Navigate to the **Privacy & Security** panel.
  3. Scroll down to the *Security* section where you will see a note mentioning `GlobalSync` was blocked.
  4. Click the **"Open Anyway"** button and enter your Mac administrator password to authorize execution.

### Linux Setup
Distributed primarily as an **AppImage** and a Debian (`.deb`) package.
* For the AppImage, right-click the file, navigate to **Properties > Permissions**, check the box for **"Allow executing file as program"**, and double-click to launch.

---

## Development & Compilation Pipeline

This repository utilizes an automated cloud matrix via GitHub Actions to package production code seamlessly.

### Triggering a New Enterprise Build
Production binaries are completely managed via Git version tags. To build or push updates to your network partners:

1. Commit and push all operational changes to the primary branch.
2. Draft and deploy a release tag through your command line terminal:
   ```bash
   git tag v1.0.X
   git push origin v1.0.X
