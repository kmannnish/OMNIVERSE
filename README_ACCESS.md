# ✦ OMNIVERSE — Access & Deployment Guide

This guide covers 1-click startup, local Wi-Fi network sharing, custom domain names, and global internet access via Tailscale Funnel.

---

## 1. One-Click Launch (Desktop Shortcut)

You can launch everything with **a single double-click**:
- **Desktop Shortcut:** Double-click the **`OMNIVERSE`** shortcut on your Windows Desktop.
- **Or Direct Batch File:** Double-click [`start-omniverse.bat`](file:///c:/Users/PRAPTI/Downloads/yt-download/start-omniverse.bat).

### What the 1-Click Launcher Does Automatically:
1. **Checks Docker Engine:** If Docker Desktop is closed, it automatically boots Docker Desktop in the background and waits for the daemon to become ready.
2. **Spins up the Stack:** Runs `docker compose up -d` (Next.js, Fastify API, BullMQ Worker, Redis, and MinIO).
3. **Healthcheck:** Verifies the web application is responding on port 3000.
4. **Network Detection:** Detects your local Wi-Fi / LAN IP address (e.g. `10.39.225.59`) and Tailscale IP.
5. **Auto-Opens Browser:** Pops open your default browser directly to `http://localhost:3000`.

To stop the entire stack, double-click [`stop-omniverse.bat`](file:///c:/Users/PRAPTI/Downloads/yt-download/stop-omniverse.bat).

---

## 2. Access from Any Phone, Tablet, or Laptop on the Same Wi-Fi

Because OMNIVERSE runs on port `3000` bound to `0.0.0.0`, any device connected to your same home or office Wi-Fi network can access it instantly:

1. Look up your PC's IP address (shown in the launcher terminal, e.g. `10.39.225.59`).
2. On your iPhone, Android, iPad, or another computer, open any web browser and go to:
   ```
   http://10.39.225.59:3000
   ```
3. *Windows Firewall Note:* If your phone cannot connect initially, ensure Windows Firewall permits port 3000 on private networks. You can run this one-line command in PowerShell (Run as Administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "OMNIVERSE Web Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

---

## 3. Custom Domain Name (e.g., `http://omniverse.local:3000`)

### Option A: Standard Windows mDNS (Works on Apple & Windows devices automatically)
Your PC's hostname is automatically broadcasted on modern local networks. You can type:
```
http://<YOUR-COMPUTER-NAME>.local:3000
```
(e.g., `http://DESKTOP-ABC.local:3000`).

### Option B: Custom Hostname on Your PC (e.g., `http://omniverse.dev:3000`)
1. Open Notepad as Administrator.
2. Open `C:\Windows\System32\drivers\etc\hosts`.
3. Add the following line at the bottom:
   ```
   127.0.0.1   omniverse.local
   127.0.0.1   omniverse.dev
   ```
4. Save the file. You can now access `http://omniverse.local:3000` directly in your browser.

---

## 4. Remote & Worldwide Access via Tailscale

Tailscale allows you to access OMNIVERSE from outside your home without port-forwarding on your router.

Run [`scripts/enable-tailscale-funnel.bat`](file:///c:/Users/PRAPTI/Downloads/yt-download/scripts/enable-tailscale-funnel.bat) or use the commands below:

### Mode 1: Private Tailnet Access (Only Your Devices)
Access OMNIVERSE from your phone with the Tailscale app installed:
```powershell
tailscale serve --bg 3000
```
Your phone can then open:
```
http://<your-tailscale-ip>:3000
# or
https://<machine-name>.<tailnet>.ts.net
```

### Mode 2: Public Internet Funnel (Share with Anyone Worldwide)
Tailscale Funnel publishes your local port 3000 to the public internet with a valid SSL/TLS certificate (`https://`):
```powershell
tailscale funnel --bg 3000
```
To view your public URL:
```powershell
tailscale funnel status
```
Anyone on any network in the world can now open that public `https://...` link to use OMNIVERSE!

### Mode 3: Disable Remote Funnel
To turn off remote access when you are finished:
```powershell
tailscale funnel reset
tailscale serve reset
```

---

## 5. Universal Downloads Across All Networks

When media finishes processing:
- Download links stream directly through the `/api/jobs/:jobId/download` proxy pipeline.
- This ensures downloads work with zero configuration whether you are on `localhost`, local Wi-Fi (`10.39.225.59`), Tailscale, or Tailscale Funnel.
