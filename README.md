# BalanceSquad

> **Select language:** [English] | [Português](./README.pt-br.md)

A mobile app for casual pickup soccer: draws balanced teams, tracks every match of the session, and builds a competitive ranking that you can share as an image to motivate the group.

Built with **React Native + Expo SDK 54** (TypeScript).

---

## What it does

A typical Sunday with BalanceSquad:

1. **Register players** once, with half-star ratings (0.5–5) and optional gender.
2. **Draw teams** by picking who showed up and configuring the number of teams. Greedy + local-search algorithm keeps teams balanced; optionally also balances by gender.
3. **Play several matches** in the same session — log each one with the real lineup (who was on the field), winner, goals per player, and MVP.
4. **Check the ranking** filtered by week, month, quarter, semester, year, or all-time. Share the Top 3 podium as an image straight into the group chat.

---

## Highlights

- ⭐ **Half-star ratings** (0.5 to 5.0)
- ⚖️ **Optional gender balancing** with strict round-robin to guarantee proportional distribution
- 🥅 **Matches with real lineups**: many per draw, players can swap sides, goals and MVP tracked per match
- 🏆 **Multi-view ranking**: Wins / Top scorers / MVPs / Champion teams, with calendar period filters
- 📸 **Top 3 podium PNG sharing** + individual player profile (head-to-head, frequent teammates)
- 🔁 **Winner-stays assist**: after logging a result, the app suggests the next match with the winner vs. the resting team
- 📤 **Draw export as .json** — another phone can import it and rebuild the entire session with matches intact
- 🌙 **Theme** follows the system or can be forced (light / dark)
- 🌍 **Trilingual**: PT / EN / ES with automatic device detection

---

## Usage flow

```
Home  (squads list)
└── Squad Hub
      ├── 👤  Register Player        (name, half-star rating, gender)
      ├── 📋  Player List             (attendance + search + one-off guests)
      │     └── Draw Config          (teams, players/team, gender toggle)
      │           └── Sorted Teams
      │                 ├── ⚖  Rebalance (merge 2 teams)
      │                 ├── ✏  Rename team (tap the name)
      │                 ├── 📤  Share (text / image / .json)
      │                 └── 🏆  Matches
      │                       └── Match Editor
      │                             ├── Home × Away
      │                             ├── Lineup check-in/out
      │                             ├── Goals (-/+ per player, grouped by side)
      │                             ├── MVP (chips grouped by side)
      │                             └── 🎉 celebration + "next match" prompt
      ├── 📅  Draw History            (up to 20 sessions, metrics, resume)
      └── 🏅  Ranking                 (4 tabs × 6 period filters)
            └── Player Profile        (head-to-head + frequent partners + share)
```

---

## Features in depth

### Draw
- **Half-star ratings** (0.5 to 5.0)
- **Greedy + local-search optimizer** (O(n²)) to minimize the spread between team star totals
- **Optional gender balancing** via strict round-robin (one player per team per round) — treats players without a gender tag as male
- **Overflow team** when players don't divide evenly: extra slot takes the leftovers
- **Manual draw** alternative with per-team chips

### Matches (the collection inside each draw)
- Each match has **home, away, its own lineups** (players can be borrowed between teams), **result, goals per player, and MVP**
- **Celebration animation** with trophy when a winner is logged
- **Next-match suggestion**: winner stays, resting team comes in
- Lists every match of the session with time, lineup count, and winner

### Ranking
- **4 tabs**: Wins, Top scorers, MVPs, Champion teams (the team with most wins in each draw)
- **6 periods**: ISO week, month, quarter, semester, year, or all-time (filter by match timestamp)
- **Optional "≥3 games" threshold** to hide low-sample players
- **Shareable Top 3 podium card** (PNG) generated off-screen via `react-native-view-shot`

### Player profile
- Tap any ranking row to see detailed stats
- **Head-to-head** vs top opponents (W/D/L when playing on the other side)
- **Frequent teammates** (win rate when together)
- Shareable card in PNG

### Sharing
- **Text** in WhatsApp style (no stars, randomized player order per team)
- **PNG image** with the visual card of the draw
- **.json file** that another phone imports via "Import draw" in the Preferences menu → creates a new squad with all players + matches

### History
- **Up to 20 draws** per squad, with metrics (spread, average per team, gender mix)
- **Resume** reopens an old draw in full edit mode
- **Top chip** shows the per-team win tally for that session

### Post-draw editing
- Add/remove players from any team, with one-off guests created on the fly
- **Undo snackbar** after each removal (5s)
- Visual warning when a team exceeds the configured size
- Tap the team name to rename inline

### Preferences
- **Theme** (System / Light / Dark), persisted per device
- **Hide ratings** during the game (eye toggle on Home)
- **Language** PT / EN / ES with automatic device detection
- **Global backup** export/import JSON

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Navigation | React Navigation (Stack) |
| Storage | AsyncStorage (local, per device) |
| i18n | react-i18next + expo-localization (PT / EN / ES) |
| Image capture | react-native-view-shot |
| Sharing | expo-sharing |
| Files | expo-file-system (.json export/import) |
| Styling | Native StyleSheet, light/dark theme via Context |

---

## Project Structure

```
src/
├── types/index.ts                # Player (level: number, gender?), Team, Match, DrawRecord, navigation
├── storage/index.ts              # Squads CRUD, drawHistory, matches helpers, prefs
├── theme/index.tsx               # 3-state theme (system/light/dark) + light/dark palette
├── i18n/index.ts                 # react-i18next setup with locale auto-detection
├── locales/{pt,en,es}.json       # Translations
├── utils/
│   ├── balancer.ts               # Greedy + local optimizer + gender round-robin
│   ├── periods.ts                # Calendar-period filters (ISO week, month, qtr, sem, year)
│   ├── rankings.ts               # Aggregations: stats / scorers / mvps / champions / profile
│   ├── stars.ts                  # formatStars, teamAverage, clampLevel
│   └── drawSharePayload.ts       # Pure helpers for .json build/parse (testable)
├── components/
│   ├── StarRating.tsx            # Half-star (tap halves to pick 0.5/1.0/...)
│   ├── PodiumCard.tsx            # Top 3 card for PNG share
│   ├── AnimatedSplash.tsx
│   └── EmptyState.tsx
├── navigation/AppNavigator.tsx   # Stack with 10 screens
└── screens/
    ├── HomeScreen.tsx            # Squad list, prefs, onboarding
    ├── PeladaHubScreen.tsx       # Hub with 4 actions
    ├── PlayerRegisterScreen.tsx  # Name + half-star + gender
    ├── PlayerListScreen.tsx      # Attendance + search + guests
    ├── DrawConfigScreen.tsx      # Teams, players/team, gender toggle
    ├── TeamsScreen.tsx           # Sorted teams, full editing, share, matches
    ├── ManualTeamsScreen.tsx     # Manual draw with chips
    ├── DrawHistoryScreen.tsx     # History (up to 20) with metrics + resume
    ├── MatchesScreen.tsx         # Match list per draw
    ├── MatchEditorScreen.tsx     # Match editor (lineup, goals, MVP, result)
    ├── RankingScreen.tsx         # 4 tabs × 6 periods × shareable Top 3
    └── PlayerProfileScreen.tsx   # Individual stats + head-to-head
```

For internal tech reference (data shapes, algorithm details, design decisions), see [CONTEXT.md](./CONTEXT.md).

---

## Getting Started

**Prerequisites:** Node.js 18+, Expo Go app on your phone (Android or iOS)

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** to open it on your device. Or build a standalone APK:

```bash
eas build --profile preview --platform android
```

---

## Tests

```bash
npm test
```

Covers the balancing algorithm (greedy + gender round-robin + size preservation), period filters, ranking aggregations (players/scorers/MVPs/champions), and the draw payload parser.

---

## Roadmap

### Near-term (small wins)

- [ ] Navigate prev/next inside the period filter (other months, other weeks)
- [ ] Push notification for "pelada day"
- [ ] Player photo / avatar
- [ ] Cloud sync across devices (Firebase or similar)

### Vision: from team-balancer to **pelada admin platform**

The next phase turns BalanceSquad into a full management tool for pelada organizers — handling money, attendance, and accountability alongside the existing matches and ranking. The aim is to be the only app the organizer needs every Sunday.

**Money — income and expenses**
- [ ] Recurring fee (monthly) and per-session fee per player
- [ ] Receivables: who paid, who's behind, due dates
- [ ] Expenses by category: court rental, ball, bibs, water, referee
- [ ] Per-player payment timeline + outstanding balance
- [ ] Pelada cash register: running balance with one-tap entry

**Reports and accountability**
- [ ] Monthly / quarterly statement (income vs expenses, category breakdown)
- [ ] Individual invoice / receipt per player (shareable PNG)
- [ ] End-of-period report card for the group (shareable image)
- [ ] Export full financial history to CSV / JSON

**Attendance and scheduling**
- [ ] RSVP for upcoming sessions (confirm presence in advance)
- [ ] Waiting list when capacity is exceeded
- [ ] Attendance history per player (% participation over time)
- [ ] Calendar view of past + upcoming sessions

**Notifications**
- [ ] Pelada-day reminder (X hours before)
- [ ] Payment-due reminder
- [ ] Cancellation / schedule-change broadcast

**Other organizer tools**
- [ ] Multi-organizer (admin shared between 2+ people)
- [ ] Game-type presets (futsal, society, fut7) with different default rules
- [ ] Automatic cloud backup of the squad data

---

## Author

**Eduardo Coutinho** — [github.com/educsj](https://github.com/educsj)
