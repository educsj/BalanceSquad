# BalanceSquad

> **Select language:** [English] | [Português](./README.pt-br.md)

A mobile app for drawing balanced soccer teams, preventing all the best players from ending up on the same side.

Built with **React Native + Expo** (TypeScript).

---

## The Problem It Solves

In casual pickup games, manual team draws almost always create unbalanced sides — all the best players on one team, all beginners on the other. BalanceSquad distributes players so that each team's total star rating is as close as possible.

---

## Who It's For

- Organizers of weekly casual soccer games
- Anyone tired of one-sided matches and post-game complaints
- People who want to keep a history of past team draws

---

## Highlights

- ⚽ Star-based skill ratings keep teams nearly equal every draw
- 🎲 Fast automatic draw with zero arguments — or go fully manual
- 📤 One-tap sharing to WhatsApp without revealing individual ratings
- 📅 History of the last 5 draws with timestamps and merge support

---

## Usage Flow

1. Open the app and select or create a **Pelada** (your group)
2. Register players with a name and a 1–5 star skill level
3. Mark who's present today and choose **Auto Draw** or **Manual Draw**
4. View the sorted teams, merge or share them, and save to history

```
Home (pelada list)
└── Pelada Hub
        ├── 👤 Register Player
        │     └── Form with name and level (1–5 ★)
        ├── 📋 Player List
        │     └── Select present players → Configure Draw
        │               ├── ⚽ Auto draw → Sorted Teams
        │               └── ✋ Manual draw → Sorted Teams
        └── 📅 Draw History
                └── View, merge and share previous draws
```

---

## Features

### Peladas (Groups)
- Create and manage multiple peladas, each with its own player list and history

### Players
- Register players with a name and a 1–5 star level
- Edit or remove players directly from the attendance list
- **Hide ratings** — a toggle on the home screen hides individual stars in the attendance list and on the sorted teams, showing only each team's total; useful to avoid awkwardness when players are watching

### Auto Draw
- Select today's attendees and configure number of teams and players per team
- A greedy algorithm distributes players so each team's star total is as close as possible
- If the player count isn't an exact multiple, a leftover team receives the remaining players

### Manual Draw
- Assign each player to a team by tapping T1 / T2 / T3
- Full teams automatically stop accepting new players
- You can confirm the draw once all teams are full, even if some players remain unassigned

### History
- The last 5 draws are saved with date and time for reference
- Each record can be expanded, merged, or shared individually
- Merge is available both on the current draw and on past history records

### Merge Teams
- Select 2 teams to redistribute their players (useful after a team wins several games in a row)
- The merged result is automatically saved to history

### Share
- Send teams via WhatsApp or any messaging app
- Shared text omits star ratings and randomizes player order

---

## Balancing Algorithm

1. Calculates `totalTeams = Math.ceil(players / playersPerTeam)`
2. Sorts players from strongest (5★) to weakest (1★), shuffling within each level
3. For each player, assigns them to the eligible team with the **lowest current star total** (greedy)
4. Main teams fill to capacity before the leftover team receives any player

Typical result for 18 players across 3 teams of 6: totals **17 / 17 / 17**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Navigation | React Navigation (Stack) |
| Persistence | AsyncStorage (local, per device) |
| Styling | Native StyleSheet |

---

## Project Structure

```
src/
├── types/index.ts              # Player, Pelada, Team, DrawRecord, navigation types
├── storage/index.ts            # Pelada CRUD, draw history, preferences
├── utils/balancer.ts           # Draw and merge algorithm
├── navigation/
│   └── AppNavigator.tsx        # Stack navigator (all screens)
├── screens/
│   ├── HomeScreen.tsx          # Pelada list + create/edit + rating toggle
│   ├── PeladaHubScreen.tsx     # Hub with 3 actions: register, list, history
│   ├── PlayerRegisterScreen.tsx# Player registration and edit form
│   ├── PlayerListScreen.tsx    # Attendance selection + inline edit/remove
│   ├── DrawConfigScreen.tsx    # Configure teams and players/team before draw
│   ├── TeamsScreen.tsx         # Sorted teams, merge and share
│   ├── ManualTeamsScreen.tsx   # Manual player distribution by team
│   └── DrawHistoryScreen.tsx   # Last 5 draws with timestamps
└── components/
    └── StarRating.tsx          # Reusable 1–5 star selector
```

For detailed types, navigation flow and business rules, see [CONTEXT.md](./CONTEXT.md).

---

## Getting Started

**Prerequisites:** Node.js 18+, Expo Go app on your phone (Android or iOS)

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app to open it on your device.

---

## Roadmap

- [ ] Guest mode for quick one-off games
- [ ] Export full draw history as CSV / JSON
- [ ] Cloud sync across devices
- [ ] Dark / light theme toggle

---

## Author

**Eduardo Coutinho** — [github.com/educsj](https://github.com/educsj)
