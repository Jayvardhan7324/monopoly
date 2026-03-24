# Richup Clone

A real-time multiplayer Monopoly-inspired board game built with React 19, TypeScript, Socket.io, and Express. Supports up to 6 players online, bot AI opponents, property trading, auctions, and a full board game loop.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Framer Motion, Radix UI / shadcn
- **Backend:** Express 5, Socket.io 4, tsx (Node.js TypeScript runner)
- **Build:** Vite 6
- **Audio:** Web Audio API (synth) + real MP3 assets

---

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- npm (comes with Node.js)

### Setup

```bash
# 1. Clone or download the project
cd monopoly

# 2. Install dependencies
npm install

# 3. (Optional) Add a Gemini API key if you want AI features
#    Create a .env.local file in the project root:
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The dev server runs both the Express backend (Socket.io) and Vite frontend together via `tsx server.ts`. Hot module reload is active for React components.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Express + Vite HMR) |
| `npm run build` | Build frontend for production into `dist/` |
| `npm start` | Run production server (serves built `dist/`) |
| `npm run lint` | TypeScript type-check with no emit |

---

## Production Deployment (VPS)

### Requirements

- Ubuntu 22.04 / Debian 12 (or any Linux distro)
- Node.js v20+ installed on the server
- A domain name (optional but recommended for HTTPS)
- Open port: `3000` (or your chosen `PORT`)

### Step 1 — Install Node.js on the VPS

```bash
# Using NodeSource (Node 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
```

### Step 2 — Transfer the Project

Option A — Git:
```bash
git clone https://github.com/your-username/monopoly.git
cd monopoly
```

Option B — SCP from your local machine:
```bash
scp -r ./monopoly user@your-server-ip:/home/user/monopoly
ssh user@your-server-ip
cd ~/monopoly
```

### Step 3 — Install Dependencies and Build

```bash
npm install
npm run build
```

This outputs the compiled frontend into `dist/`. The Express server serves these static files in production.

### Step 4 — Set Environment Variables

```bash
# Create a .env file (or export inline)
cat > .env << EOF
PORT=3000
GEMINI_API_KEY=your_key_here   # optional
EOF
```

### Step 5 — Run with PM2 (Recommended)

PM2 keeps the server alive after crashes and across reboots.

```bash
# Install PM2 globally
npm install -g pm2

# Start the app
pm2 start "npm start" --name richup

# Save process list so it restarts on reboot
pm2 save
pm2 startup   # follow the printed command to enable auto-start

# Useful PM2 commands
pm2 logs richup       # tail logs
pm2 restart richup    # restart
pm2 stop richup       # stop
pm2 status            # show all processes
```

### Step 6 — Reverse Proxy with Nginx (Optional but Recommended)

Using Nginx lets you run on port 80/443 with a domain and add HTTPS via Let's Encrypt.

```bash
sudo apt install nginx -y
```

Create a site config:

```bash
sudo nano /etc/nginx/sites-available/richup
```

Paste the following (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket support (required for Socket.io)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/richup /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7 — HTTPS with Let's Encrypt (Optional)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will auto-configure HTTPS and schedule renewals.

---

## Deployment with Nixpacks / Railway / Render

The project includes a `nixpacks.toml` for platforms like Railway or any Nixpacks-compatible host:

```toml
[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

Just connect your repo — the platform will install dependencies, build, and start automatically. Set `PORT` and `GEMINI_API_KEY` in the platform's environment variables dashboard.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3000`) |
| `GEMINI_API_KEY` | No | Google Gemini API key for AI features |

---

## Project Structure

```
monopoly/
├── App.tsx                  # Root React component, routing, Socket.io client
├── index.tsx                # React entry point
├── index.html               # HTML shell
├── index.css                # Global styles (Tailwind v4 + custom)
├── types.ts                 # TypeScript type definitions
├── constants.ts             # Board tiles, card decks, game constants
├── server.ts                # Express + Socket.io server
├── vite.config.ts           # Vite configuration
├── components/
│   ├── Board.tsx            # 11x11 CSS Grid board with ResizeObserver scaling
│   ├── Controls.tsx         # In-game action buttons (roll, buy, trade, etc.)
│   ├── Tile.tsx             # Individual board tile
│   ├── PropertyModal.tsx    # Property details + trade builder
│   └── ...
├── services/
│   ├── gameReducer.ts       # useReducer game state machine
│   ├── botService.ts        # Bot AI with personality types
│   └── audioService.ts      # MP3 + Web Audio API sound effects
├── richup_assets/
│   ├── sounds/              # MP3 sound effects served at /sounds
│   └── website_ui/          # Reference screenshots from richup.io
└── dist/                    # Production build output (generated)
```

---

## Multiplayer

- Create a room and share the room link — players join via URL
- Supports 2–6 players (mix of human and bot)
- Reconnect window: 5 minutes (disconnected players can rejoin)
- Votekick system for removing inactive players

## Game Features

- Full 40-tile Monopoly-style board
- Property buying, upgrading (houses/hotels), and mortgaging
- Chance and Community Chest card decks
- Auctions for unclaimed properties
- Player-to-player trading (properties + cash)
- Jail mechanics (pay, use card, or roll doubles)
- Bot AI opponents with AGGRESSIVE / CONSERVATIVE / BALANCED / OPPORTUNISTIC personalities
- Real-time sound effects (dice roll, buy, pay rent, trade, win, etc.)
