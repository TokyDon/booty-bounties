# Booty & Bounties

A persistent multiplayer pirate naval combat game. Sail the high seas, upgrade your ship, and be the first pirate to earn ALL gold upgrades to win!

## Game Overview

- **Players** start with a basic wooden ship, 10 Doubloons, and 20 cannon ammo
- **Map**: Procedurally generated hexagonal grid, scales with player count
- **Turn System**: Simultaneous actions, 3 Action Points per turn
- **Ship Upgrades**: 4 upgrade types × 5 rarity tiers (Wood → Steel → Iron → Bronze → Gold)
- **Win Condition**: First player to have all ship upgrades at Gold rarity

## Tech Stack

| Layer | Tech |
|---|---|
| Client | Phaser 3, TypeScript, Vite |
| Server | Node.js, Express, Socket.io, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Shared | TypeScript types package |

## Project Structure

```
booty-bounties/
├── client/          # Phaser 3 game client (Vite + TypeScript)
│   └── src/
│       ├── scenes/  # BootScene, MainMenuScene, GameScene, UIScene
│       ├── services/ # SocketService (singleton)
│       └── utils/   # HexUtils (coordinate math)
├── server/          # Node.js game server
│   └── src/
│       ├── game/    # GameManager, HexMapGenerator, TurnManager
│       ├── routes/  # REST auth routes
│       └── socket/  # Socket.io event handlers
├── shared/          # Shared TypeScript types (GameTypes, SocketEvents)
└── package.json     # npm workspaces monorepo root
```

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (local or Docker)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
# Edit server/.env and set DATABASE_URL to your PostgreSQL connection string
```

### 3. Set up the database
```bash
# From project root (uses node directly to avoid Windows path issues):
node node_modules/prisma/build/index.js migrate dev --schema server/prisma/schema.prisma
```

### 4. Build the shared package
```bash
npm run build -w shared
```

### 5. Start development servers
```bash
npm run dev
# Starts client (http://localhost:5173) and server (:3000) concurrently
```

## Gameplay

| Mechanic | Details |
|---|---|
| Action Points | 3 AP per turn. Move (1), Attack (1), Port actions (1–3) |
| Upgrades | Hull (HP), Cannons (range+dmg), Sails (AP), Binoculars (vision) |
| Rarities | Wood → Steel → Iron → Bronze → Gold |
| Win condition | First pirate with ALL 4 upgrades at Gold rarity |
| NPCs | 2× players count, respawn with higher tier giving better loot |
| Death | Respawn as "Name II", drop loot; insurance saves 50% doubloons |
| Ports | Max 2 docked ships; attacking a docked ship deals 1 damage back |
| Bounties | Claim tokens at port, collect target, hand in at delivery port |

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env` in the `server/` directory and fill in your database URL.

### Development

```bash
npm run dev
```

This starts both the game server (port 3000) and the Vite dev server (port 5173) concurrently.

### Build

```bash
npm run build
```

## Gameplay

### Actions (3 AP per turn)
- **Move** (1 AP): Move to an adjacent hex
- **Fire Cannons** (1 AP): Attack a ship in range
- **Dock** (1 AP): Enter a port (ends movement for the turn)
- **Salvage** (1 AP): Loot a depleted ship location

### Port Actions (while docked)
- Buy ammo
- Buy / Sell ship upgrades
- Buy insurance
- Take a bounty
- Hand in a bounty
- Repair ship (costs 3 AP)

### Ship Upgrades
Four upgrade slots, each with 5 rarity tiers (Wood → Steel → Iron → Bronze → Gold). Upgrade rarity improves ship stats. First to achieve all Gold upgrades wins!
