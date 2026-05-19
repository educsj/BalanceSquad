# BalanceSquad — Contexto Técnico Completo

> Documento de referência pra onboarding, continuação de desenvolvimento e contexto de IA.
> Atualizado em: 2026-05-19

---

## 1. Visão geral

**BalanceSquad** é um app mobile pra organizar peladas. Cobre o ciclo inteiro: cadastro de jogadores, sorteio balanceado (estrelas + gênero opcional), registro de várias partidas dentro de cada sorteio (com lineup real, gols, MVP) e ranking competitivo filtrado por período com cards de pódio compartilháveis em PNG.

- **Plataforma:** Android (APK via EAS Build) e iOS (via Expo Go)
- **Stack:** React Native + Expo SDK 54, TypeScript, React Navigation (Stack), AsyncStorage, react-i18next, react-native-view-shot, expo-sharing
- **Autor:** Eduardo Coutinho ([github.com/educsj](https://github.com/educsj))
- **Package Android:** `com.educsjr.BalanceSquad`
- **EAS Project ID:** `6e5f9c6a-9e88-475b-a5f3-fcdf54798a96`

---

## 2. Fluxo de navegação

Stack Navigator único (sem abas). Fluxo completo:

```
HomeScreen
  ├── (settings modal) Tema, idioma, backup global, importar sorteio
  └── PeladaHubScreen        (título = nome da pelada)
        ├── PlayerRegisterScreen
        ├── PlayerListScreen
        │     └── DrawConfigScreen
        │           ├── TeamsScreen          (sorteio automático)
        │           └── ManualTeamsScreen
        │                 └── TeamsScreen
        ├── DrawHistoryScreen
        │     └── TeamsScreen                (retomar histórico)
        └── RankingScreen
              └── PlayerProfileScreen

TeamsScreen
  └── MatchesScreen
        └── MatchEditorScreen
              └── (navigation.replace) MatchEditorScreen
                    (prefilled com vencedor × descansando)
```

---

## 3. Modelos de dados (`src/types/index.ts`)

```typescript
type StarLevel = number;                  // 0.5..5.0 (passos de 0.5)
type Gender = 'M' | 'F';

interface Player {
  id: string;
  name: string;
  level: StarLevel;
  gender?: Gender;
}

interface Team {
  id: number;                              // 1-based, gerado no sorteio
  name: string;                            // "Time 1" por padrão; editável
  players: Player[];
  totalStars: number;                      // soma dos levels (display usa teamAverage)
}

// Resultado por partida (não usar o legado DrawResult abaixo)
type MatchResult =
  | { type: 'win'; winner: 'home' | 'away' }
  | { type: 'draw' };

interface GoalEntry { playerId: string; count: number }

interface Match {
  id: string;
  timestamp: string;                       // ISO 8601
  homeTeamId: number;                      // refs Team.id no mesmo DrawRecord
  awayTeamId: number;
  homePlayerIds: string[];                 // lineup real (pode divergir do roster do time)
  awayPlayerIds: string[];
  result: MatchResult;
  goals?: GoalEntry[];
  mvpPlayerId?: string;
}

// LEGADO — campo result do DrawRecord não é usado pelo ranking novo.
// Mantido em disco pra retrocompatibilidade.
type DrawResult =
  | { type: 'win'; winnerTeamId: number }
  | { type: 'draw' };

interface DrawRecord {
  teams: Team[];
  timestamp: string;
  balanceByGender?: boolean;
  result?: DrawResult;                     // legado
  matches?: Match[];                       // fonte de verdade do ranking
}

interface Pelada {
  id: string;
  name: string;
  playersPerTeam: number;
  players: Player[];
  lastDraw?: Team[];                       // legado — migrado em loadPeladas
  drawHistory?: DrawRecord[];              // até 20, mais recente no índice 0
}
```

Rotas:

```typescript
type RootStackParamList = {
  Home: undefined;
  PeladaHub:       { peladaId: string };
  PlayerRegister:  { peladaId: string; editPlayerId?: string };
  PlayerList:      { peladaId: string };
  DrawConfig:      { peladaId: string; selectedPlayerIds: string[]; guestPlayers?: Player[] };
  Teams: {
    teams: Team[]; peladaId: string;
    historyIndex?: number;
    openMergeModal?: boolean;
    balanceByGender?: boolean;
  };
  ManualTeams:     { players: Player[]; numTeams: number; peladaId: string; playersPerTeam: number };
  DrawHistory:     { peladaId: string };
  Ranking:         { peladaId: string };
  Matches:         { peladaId: string; historyIndex: number };
  MatchEditor: {
    peladaId: string;
    historyIndex: number;
    matchId?: string;
    prefillHomeTeamId?: number;
    prefillAwayTeamId?: number;
  };
  PlayerProfile:   { peladaId: string; playerId: string };
};
```

---

## 4. Persistência (`src/storage/index.ts`)

Tudo em AsyncStorage. Chaves:

| Chave | Conteúdo |
|---|---|
| `@balancesquad:peladas` | `Pelada[]` (JSON) |
| `@balancesquad:hideRatings` | `'true'` / `'false'` |
| `@balancesquad:language` | código de idioma (`pt`, `en`, `es`) |
| `@balancesquad:themeMode` | `'system'` / `'light'` / `'dark'` |
| `@balancesquad:onboardingSeen` | `'true'` / `'false'` |

Constantes:
- `DRAW_HISTORY_LIMIT = 20`

Funções públicas:

```typescript
// Peladas
loadPeladas() / savePeladas() / getPeladaById() / updatePelada()

// Histórico
addDrawRecord(peladaId, teams, meta?)       // prepend + trunca em 20
updateDrawRecord(peladaId, teams, index)    // só substitui teams[]

// Resultado legado por sorteio (não usar no fluxo novo)
setDrawResult(peladaId, index, result?)

// Partidas — fluxo atual
addMatch(peladaId, historyIndex, match)
updateMatch(peladaId, historyIndex, match)
removeMatch(peladaId, historyIndex, matchId)

// Preferências
getHideRatings() / setHideRatings()
getLanguage() / setLanguage()
getThemeMode() / setThemeMode()
getOnboardingSeen() / setOnboardingSeen()

// Backup global
exportData(): Promise<string>               // JSON string de tudo
parseBackupData(json): BackupData | null    // valida estrutura
importData(json): Promise<boolean>          // false em payload inválido
```

Migração: `migratePelada()` converte `lastDraw` antigo em `drawHistory[0]` ao carregar.

---

## 5. Balanceamento (`src/utils/balancer.ts`)

### `balanceTeams(present, numTeams, playersPerTeam, options?)`

Modo padrão (sem gênero):

1. `totalTeams = Math.ceil(present.length / playersPerTeam)` — cria N+overflow times.
2. Shuffle Fisher-Yates → últimos `present.length - numTeams*playersPerTeam` vão pra sobra.
3. Sort restantes por level desc (com shuffle dentro de cada nível).
4. Pra cada jogador, escolhe time via `getEligibleTeam` (main > overflow, menor stars > menor count > random).
5. `optimizeBalance` faz local search O(n²) trocando jogadores entre main teams quando reduz o spread.

Modo `balanceByGender: true`:

1. `applyGenderRoundRobin`: divide em **F** vs **não-F** (M + sem-gênero juntos pela regra "sem-gênero = homem"). Grupo menor primeiro.
2. Cada grupo é distribuído em **rounds** — em cada rodada, todo time elegível recebe um jogador, na ordem de menor stars. Garante diff ≤ 1 entre times.
3. `optimizeBalance(respectGender: true)` só troca F↔F e não-F↔não-F.
4. `enforceGenderBalance` safety pass: se ainda há diff > 1 em F, força swap até balancear.

### `rematchTwoTeams(teamA, teamB, options?)`

Combina ambos times e redistribui. Preserva **tamanhos originais** via `caps = [teamA.players.length, teamB.players.length]` — só achata pra `Math.ceil(total/2)` quando algum tem 0 jogadores (caso edge). Modo gênero também suportado.

### `recalcTeams(teams)`

Recomputa `totalStars` de cada team a partir do `players.length` atual. Usado pós-edição.

---

## 6. Filtros temporais (`src/utils/periods.ts`)

```typescript
type PeriodKind = 'week' | 'month' | 'quarter' | 'semester' | 'year' | 'all';

computePeriodRange(kind, ref?): { startIso, endIso, label } | null
// 'all' retorna null (sem filtro). Demais retornam intervalo [start, end) em ISO.

isInPeriod(timestamp, range): boolean
```

Calendário ISO: semana começa segunda. Trimestre = Q1 (Jan-Mar)..Q4 (Out-Dez). Semestre = H1 (Jan-Jun) e H2 (Jul-Dez).

---

## 7. Agregações de ranking (`src/utils/rankings.ts`)

Todas iteram `drawHistory[].matches[]`, filtram por período opcional e retornam arrays ordenados.

| Função | Retorna |
|---|---|
| `aggregatePlayerStats(pelada, range)` | `PlayerStat[]` ordenado por winRate desc, então wins, então played |
| `aggregateScorers(pelada, range)` | `ScorerStat[]` ordenado por goals desc, então perMatch |
| `aggregateMvps(pelada, range)` | `MvpStat[]` ordenado por count desc |
| `aggregateTeamChampions(pelada, range)` | `TeamChampionEntry[]` — pra cada sorteio do período, o time com mais vitórias |
| `buildPlayerProfile(pelada, playerId, range)` | `PlayerProfile` com head-to-head + parceiros + lista de matches do jogador |
| `periodMatchCount(pelada, range)` | número total de partidas dentro do período |

Nome do jogador: lookup snapshot — preferência pelo nome atual na pelada, fallback pra nome em `team.players` no `DrawRecord`. Funciona pra jogadores deletados/renomeados.

---

## 8. Componentes-chave

### `StarRating` (`components/StarRating.tsx`)
- Suporta valores fracionados (0.5–5.0)
- Cada estrela tem duas zonas de toque (esquerda = N-0.5, direita = N)
- Layout: tocáveis base + glifos da estrela em overlay com `pointerEvents="none"` pra confiabilidade do tap
- Readonly desabilita os tocáveis

### `PodiumCard` (`components/PodiumCard.tsx`)
- Card Top 3 com paleta light fixa (ouro / prata / bronze)
- Largura fixa 360px pra consistência cross-device
- Renderizado off-screen via `position: 'absolute', left: -9999`
- Capturado com `captureRef` do `react-native-view-shot` → PNG → `Sharing.shareAsync`

---

## 9. Tema (`src/theme/index.tsx`)

`ThemeMode = 'system' | 'light' | 'dark'`, persistido. Contexto expõe:

```typescript
{ colors: ThemeColors; isDark: boolean; mode: ThemeMode; setMode: (m) => void }
```

`useColorScheme()` é consultado só quando mode = `'system'`. Mudança de mode é instantânea via setState; persistência via `setThemeMode`.

Paleta inclui `genderTintMale` / `genderTintFemale` (rgba sutis, light e dark) usados pra tingir linhas no TeamsScreen quando `balanceByGender` está ativo.

---

## 10. i18n (`src/i18n/index.ts` + `src/locales/`)

- `react-i18next` + `expo-localization` pra autodetecção
- 3 idiomas: PT (default fallback), EN, ES
- Plural via `_one` / `_other`
- Chaves agrupadas por tela (`home.*`, `playerRegister.*`, `teams.*`, `matches.*`, `matchEditor.*`, `ranking.*`, `profile.*`, etc)

---

## 11. Compartilhamento

| Formato | Componente | Mecanismo |
|---|---|---|
| Texto WhatsApp | `Share.share({ message })` | Sem estrelas, ordem dos jogadores embaralhada |
| Imagem PNG do sorteio | `captureRef` no card hidden + `Sharing.shareAsync` | Layout `shareCardInner` (paleta light fixa) |
| .json do sorteio | `buildDrawPayload` em `utils/drawSharePayload.ts` + FS write + Sharing | Carrega teams + matches; outro celular importa via HomeScreen |
| Imagem PNG do pódio | `PodiumCard` hidden + `captureRef` | Disponível em todas as 4 abas do Ranking |
| Imagem PNG do perfil | `shareCard` hidden no `PlayerProfileScreen` | Card resumido (J/V/E/D/%/Gols/MVPs) |

`parseDrawPayload` valida estrutura (incluindo matches, goals, mvpPlayerId) e rejeita JSONs malformados retornando `null`.

---

## 12. Decisões de design

| Decisão | Motivo |
|---|---|
| Sem estado global (Redux/Zustand) | `useFocusEffect` + AsyncStorage cobrem; app pequeno |
| `Match.homePlayerIds` (lineup explícito) | Suporta swaps mid-session sem afetar o roster do `Team` |
| Lista de partidas dentro do sorteio, não no nível da pelada | Casa o modelo mental "uma sessão = um sorteio = várias partidas" |
| Period filter via calendário (não rolling) | "Maio 2026" é mais natural pra compartilhar como "campeão do mês" |
| F vs não-F na regra de gênero | Reflete a regra do usuário: "sem-gênero conta como masculino" |
| Round-robin estrito por gênero | Greedy clusterava mulheres no time mais fraco; round-robin garante diff ≤ 1 |
| `teamAverage` no display, `totalStars` no storage | Display por jogador é comparável; soma é a representação interna |
| `react-native-view-shot` off-screen | Cards de compartilhamento renderizam sempre na paleta light pra legibilidade no WhatsApp |

---

## 13. Build e deploy

### Expo Go (desenvolvimento)
```bash
npm install
npx expo start
```

### APK pra distribuição direta (Android)
```bash
eas build --profile preview --platform android
```

### Produção (Google Play)
```bash
eas build --profile production --platform android
```

`eas.json`:
- `preview` → `buildType: "apk"`
- `production` → padrão `.aab`

---

## 14. Testes

`jest` + `ts-jest`. Tests rodam puros (sem RN runtime), então cobrem só lógica em `src/utils/`:

- `balancer.test.ts` — balanceTeams (estrutura, integridade, balanceamento, fuzz por gênero), rematchTwoTeams (preserve sizes, empty team fallback)
- `rankings.test.ts` — aggregatePlayerStats (lineup real), aggregateScorers, aggregateMvps, aggregateTeamChampions, period filters
- `drawShare.test.ts` — buildDrawPayload + parseDrawPayload (roundtrip + rejeição de payloads inválidos) + payloadToPelada

```bash
npm test
```

---

## 15. Estrutura de arquivos

```
BalanceSquad/
├── App.tsx
├── app.json
├── eas.json
├── package.json
├── babel.config.js                  # presets ['babel-preset-expo'] (sem reanimated)
├── tsconfig.json
├── jest.config.js
├── assets/{icon,splash-icon,favicon}.png
├── scripts/generate-icons.js
└── src/
    ├── types/index.ts
    ├── storage/index.ts
    ├── theme/index.tsx
    ├── i18n/index.ts
    ├── locales/{pt,en,es}.json
    ├── utils/
    │   ├── balancer.ts
    │   ├── periods.ts
    │   ├── rankings.ts
    │   ├── stars.ts
    │   ├── drawShare.ts             # wrappers que dependem de FS/Sharing
    │   ├── drawSharePayload.ts      # pure helpers, testáveis
    │   └── __tests__/{balancer,rankings,drawShare}.test.ts
    ├── components/
    │   ├── StarRating.tsx
    │   ├── PodiumCard.tsx
    │   ├── EmptyState.tsx
    │   └── AnimatedSplash.tsx
    ├── navigation/AppNavigator.tsx
    └── screens/
        ├── HomeScreen.tsx
        ├── PeladaHubScreen.tsx
        ├── PlayerRegisterScreen.tsx
        ├── PlayerListScreen.tsx
        ├── DrawConfigScreen.tsx
        ├── TeamsScreen.tsx
        ├── ManualTeamsScreen.tsx
        ├── DrawHistoryScreen.tsx
        ├── MatchesScreen.tsx
        ├── MatchEditorScreen.tsx
        ├── RankingScreen.tsx
        └── PlayerProfileScreen.tsx
```
