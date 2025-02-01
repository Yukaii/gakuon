# Gakuon Docker Setup Guide

## Prerequisites

- Docker and Docker Compose installed
- SSH access to your server (if running remotely)

## First Time Setup

1. Clone this repository and navigate to the directory:

```bash
git clone https://github.com/Yukaii/gakuon.git
cd gakuon
```

2. If you plan to use Anki's built-in sync service (recommended for first-time setup), you'll need to configure X11 forwarding:

   a. Add these lines to your SSH config (`~/.ssh/config`):
   ```
   ForwardX11 yes
   ForwardX11Trusted yes
   ```

   b. Prepare X11 authentication:
   ```bash
   cp ~/.Xauthority /tmp/container-xauth
   chmod 644 /tmp/container-xauth
   ```

   c. Edit `docker-compose.yml` and uncomment these lines:
   ```yaml
   #   - /tmp/container-xauth:/home/anki/.Xauthority:rw
   # environment:
   #   - DISPLAY=${DISPLAY}
   #   - QT_QPA_PLATFORM=xcb
   #   - XAUTHORITY=/home/anki/.Xauthority
   # network_mode: host
   ```

3. Start the services:

```bash
docker compose up -d
```

4. For first-time setup with GUI:
   - The Anki window should appear
   - Create a new profile if needed
   - Go to Tools -> Add-ons to verify AnkiConnect is installed
   - Set up your AnkiWeb account in Tools -> Preferences -> Network
   - Sync your collection

5. After initial setup is complete:
   - Stop the containers: `docker compose down`
   - Comment out the X11 forwarding lines in docker-compose.yml
   - Restart the containers: `docker compose up -d`

## Regular Usage

Once initial setup is complete, you can access:
- Gakuon web interface at `http://localhost:4989`
- AnkiConnect API at `http://localhost:8765`

Your Anki data will persist in Docker volumes between restarts.

## Troubleshooting

If you encounter permission issues:
- Ensure X11 forwarding is properly configured in your SSH session
- Check that `/tmp/container-xauth` has the correct permissions (644)
- Verify your DISPLAY environment variable is set correctly
