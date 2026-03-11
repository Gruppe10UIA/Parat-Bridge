# Hosting on Local Network

The app is accessible to any device on the same network. No extra setup needed — just find your machine's IP and share the URL.

## Find Your Local IP

**Linux:**
```bash
hostname -I | awk '{print $1}'
```

**macOS:**
```bash
ipconfig getifaddr en0
```

**Windows:**
```cmd
ipconfig
```
Look for the **IPv4 Address** under your active network adapter.

## Access the App

Once you have the IP, the app is available at:

```
http://<your-ip>:1880/hjem
```

Share this URL with anyone on the same network.

## Notes

- The IP may change if you reconnect to the network or restart your machine.
- All devices must be on the same WiFi/network.
- Make sure the Docker container is running (`docker compose up`).
