# BalanceSquad — Contexto Completo do Projeto

> Documento de referência para onboarding, continuação de desenvolvimento e contexto de IA.
> Atualizado em: 03/05/2026

---

## 1. Visão Geral

**BalanceSquad** é um aplicativo mobile para organizar peladas de futebol. O problema central que resolve: sorteios manuais de times costumam concentrar jogadores fortes ou fracos no mesmo lado. O app distribui os jogadores de forma que a **soma de estrelas de cada time seja a mais próxima possível**.

- **Plataforma:** Android (APK via EAS Build) e iOS (via Expo Go)
- **Stack:** React Native + Expo SDK 54, TypeScript, React Navigation (Stack), AsyncStorage
- **Autor:** Eduardo Coutinho ([github.com/educsj](https://github.com/educsj))
- **Package Android:** `com.educsjr.BalanceSquad`
- **EAS Project ID:** `6e5f9c6a-9e88-475b-a5f3-fcdf54798a96`

---

## 2. Fluxo de Navegação

Toda a navegação é um **Stack Navigator** (sem abas). O fluxo completo:

```
HomeScreen
  └── PeladaHubScreen  (título = nome da pelada)
        ├── PlayerRegisterScreen   (cadastrar ou editar jogador)
        ├── PlayerListScreen       (selecionar presença)
        │     └── DrawConfigScreen (configurar times e jogadores/time)
        │           ├── TeamsScreen       (sorteio automático)
        │           └── ManualTeamsScreen (sorteio manual)
        │                 └── TeamsScreen
        └── DrawHistoryScreen  (histórico de sorteios)
              └── TeamsScreen  (mesclar um sorteio histórico)
```

**Pontos de entrada do TeamsScreen:**
- DrawConfig → sorteio automático (historyIndex = 0, mais recente)
- ManualTeams → sorteio manual confirmado (historyIndex = 0)
- DrawHistory → visualizar/mesclar sorteio histórico (historyIndex = N)

---

## 3. Modelos de Dados (`src/types/index.ts`)

```typescript
type StarLevel = 1 | 2 | 3 | 4 | 5;

interface Player {
  id: string;        // gerado com Date.now().toString(36) + random
  name: string;
  level: StarLevel;
}

interface Team {
  id: number;        // índice 1-based
  name: string;      // "Time 1", "Time 2" ...
  players: Player[];
  totalStars: number; // soma de levels — usado para balanceamento e exibição
}

interface DrawRecord {
  teams: Team[];
  timestamp: string; // ISO 8601 — gerado no momento do sorteio
}

interface Pelada {
  id: string;
  name: string;
  playersPerTeam: number; // padrão definido na criação, editável por sorteio
  players: Player[];
  lastDraw?: Team[];       // LEGACY — migrado automaticamente para drawHistory
  drawHistory?: DrawRecord[]; // até 5 registros, mais recente no índice 0
}
```

**Tipos de navegação:**

```typescript
type RootStackParamList = {
  Home: undefined;
  PeladaHub:      { peladaId: string };
  PlayerRegister: { peladaId: string; editPlayerId?: string };
  PlayerList:     { peladaId: string };
  DrawConfig:     { peladaId: string; selectedPlayerIds: string[] };
  Teams:          { teams: Team[]; peladaId: string; historyIndex?: number };
  ManualTeams:    { players: Player[]; numTeams: number; peladaId: string; playersPerTeam: number };
  DrawHistory:    { peladaId: string };
};
```

---

## 4. Persistência (`src/storage/index.ts`)

Toda a persistência é **local** via `@react-native-async-storage/async-storage`.

### Chaves do AsyncStorage

| Chave | Tipo | Conteúdo |
|---|---|---|
| `@balancesquad:peladas` | `Pelada[]` JSON | Todas as peladas com jogadores e histórico |
| `@balancesquad:hideRatings` | `'true'` / `'false'` | Preferência global de ocultar notas |

### Funções exportadas

```typescript
// Peladas
loadPeladas(): Promise<Pelada[]>           // carrega e migra dados legados
savePeladas(peladas): Promise<void>
getPeladaById(id): Promise<Pelada | undefined>
updatePelada(updated): Promise<void>

// Histórico de sorteios
addDrawRecord(peladaId, teams): Promise<void>
  // cria DrawRecord com timestamp ISO, prepend no drawHistory, trunca em 5

updateDrawRecord(peladaId, teams, index = 0): Promise<void>
  // atualiza o registro no índice especificado (usado pelo merge no TeamsScreen)

// Preferência de exibição
getHideRatings(): Promise<boolean>
setHideRatings(value: boolean): Promise<void>
```

### Migração de dados legados

Ao carregar, `loadPeladas()` aplica `migratePelada()` em cada item. Se uma pelada tiver `lastDraw` mas não tiver `drawHistory`, converte automaticamente para `drawHistory: [{ teams: lastDraw, timestamp: '' }]` e remove `lastDraw`.

---

## 5. Algoritmo de Balanceamento (`src/utils/balancer.ts`)

### `balanceTeams(present, numTeams, playersPerTeam) → Team[]`

1. Calcula `totalTeams = Math.ceil(present.length / playersPerTeam)`
2. Embaralha todos os jogadores (Fisher-Yates) — garante que **qualquer** jogador pode ir para a sobra
3. Separa os últimos `present.length - numTeams * playersPerTeam` jogadores como `overflowPlayers` e pré-preenche o último time com eles
4. Ordena os jogadores restantes do mais forte (5★) ao mais fraco (1★), com embaralhamento dentro de cada nível
5. Distribui um a um usando `getEligibleTeam()`:
   - Times principais (0..numTeams-1) têm prioridade sobre o time de sobra
   - O time de sobra só fica elegível quando todos os principais estão cheios
   - Entre elegíveis: escolhe o de menor `totalStars`; empate → menor número de jogadores; empate → aleatório

### `rematchTwoTeams(teamA, teamB) → [Team, Team]`

Une os jogadores dos dois times e redistribui usando o mesmo algoritmo greedy. Preserva `id` e `name` originais. Usado no merge do TeamsScreen.

### `pickBest(candidates)` (interno)

Recebe candidatos `{ i, stars, count }` e retorna o índice do melhor:
1. Menor `totalStars`
2. Menor `players.length` (desempate)
3. Aleatório (desempate final — elimina viés de índice)

---

## 6. Telas

### `HomeScreen`
- Lista todas as peladas com badge mostrando quantos sorteios estão salvos ("1 sorteio salvo" / "3 sorteios")
- Cria e edita peladas via modal (nome + jogadores por time)
- Toggle 👁/🙈 no header que persiste `hideRatings` globalmente
- Navega para `PeladaHub` ao tocar em uma pelada

### `PeladaHubScreen`
- Define o título do header dinamicamente com `navigation.setOptions({ title: pelada.name })`
- Mostra contagem de jogadores e data/hora do último sorteio
- 3 botões de ação: Cadastrar Jogador → `PlayerRegister`, Lista de Jogadores → `PlayerList`, Histórico → `DrawHistory`

### `PlayerRegisterScreen`
- Modo **cadastro** (`editPlayerId` ausente): form vazio, ao salvar volta ao hub; mostra contador de jogadores para contexto
- Modo **edição** (`editPlayerId` presente): form pré-preenchido, título muda para "Editar Jogador"
- Título definido dinamicamente via `navigation.setOptions`

### `PlayerListScreen`
- Carrega `hideRatings` e lista de jogadores via `useFocusEffect` (recarrega ao voltar de `PlayerRegister`)
- Checkboxes para seleção de presença; stars ocultas se `hideRatings` ativo
- ✏️ navega para `PlayerRegister` com `editPlayerId`; 🗑️ remove com confirmação
- Botão "Continuar" fica desabilitado até 2+ selecionados; navega para `DrawConfig` passando `selectedPlayerIds`

### `DrawConfigScreen`
- Recebe `selectedPlayerIds`, carrega os `Player[]` reais da pelada via storage
- Seletor de número de times: 2 / 3 / 4
- Stepper +/- para jogadores por time (mínimo 1, não persiste na pelada)
- Banner informativo: "distribuição perfeita" / "X na sobra" / "X vagas livres"
- Validação: mínimo `numTeams * 2` jogadores
- "Sortear Times" → `balanceTeams` → `addDrawRecord` → `TeamsScreen`
- "Montar Manualmente" → `ManualTeamsScreen`

### `TeamsScreen`
- Recebe `teams`, `peladaId` e `historyIndex` (padrão 0)
- Carrega `hideRatings` via `useFocusEffect`; oculta `StarRating` por jogador se ativo
- Mostra `totalStars` de cada time sempre (não afetado por `hideRatings`)
- **Mesclar Times**: modal para selecionar 2 times → `rematchTwoTeams` → `updateDrawRecord(peladaId, updatedTeams, historyIndex)` — salva no índice correto do histórico
- **Compartilhar**: texto sem estrelas, ordem dos jogadores embaralhada por time
- "↩ Refazer": `navigation.goBack()` — volta para `DrawConfig` ou `DrawHistory` dependendo da origem

### `ManualTeamsScreen`
- Recebe `players`, `numTeams`, `peladaId`, `playersPerTeam`
- Estado: `assignments: Record<string, number | null>` (playerId → teamIndex | null)
- Chips de resumo: "T1 · 3/5" — ficam preenchidos na cor do time quando cheios
- Botão de time **desabilitado** quando time está cheio e o jogador não está nele (pode desatribuir tocando no seu time atual)
- Confirmação habilitada quando `teamCounts.every(count => count >= playersPerTeam)` — independente de jogadores sem time
- Ao confirmar: `addDrawRecord` + navega para `TeamsScreen`

### `DrawHistoryScreen`
- Carrega `drawHistory` via `useFocusEffect`; exibe até 5 registros
- Cada `DrawEntry` é expansível (primeiro expandido por padrão)
- Botões por entrada: "🔀 Mesclar Times" → `TeamsScreen` com `historyIndex: index`; "📤 Compartilhar"
- Timestamps formatados: `DD/MM/YYYY às HH:mm`

---

## 7. Componente `StarRating`

```typescript
interface Props {
  value: StarLevel;          // nível atual (1–5)
  onChange?: (level) => void; // ausente = readonly
  readonly?: boolean;         // desabilita toque
  size?: number;              // fontSize das estrelas (padrão 22)
}
```

Estrela preenchida (`#F5C518`) quando `star <= value`; cinza (`#CBD5E1`) quando maior.

---

## 8. Paleta de Cores

| Token | Hex | Uso principal |
|---|---|---|
| Navy | `#1E3A5F` | Headers, botões primários, bordas de seleção |
| Blue | `#2563EB` | Time 2 |
| Teal | `#0F766E` | Time 3 |
| Purple | `#7C3AED` | Time 4 |
| Red | `#B91C1C` | Time 5 |
| Light Blue BG | `#F0F4FF` | Background de todas as telas |
| Card White | `#FFFFFF` | Cards e modais |
| Sky Blue | `#93C5FD` | Textos secundários sobre navy |
| Slate | `#64748B` | Labels e metadados |
| Muted | `#94A3B8` | Placeholders e estados desabilitados |
| Star Gold | `#F5C518` | Estrelas preenchidas |

---

## 9. Decisões de Design

| Decisão | Motivo |
|---|---|
| Sem estado global (Redux/Zustand/Context) | App pequeno; `useFocusEffect` + AsyncStorage suficientes para sincronizar telas |
| `useFocusEffect` em todas as telas com dados | Garante dados atualizados ao voltar de outra tela sem complexidade extra |
| `historyIndex` no TeamsScreen | Permite mesclar qualquer sorteio do histórico sem duplicar lógica |
| Overflow pré-preenchido antes do greedy | Garante que times principais fiquem cheios; overflow é aleatório (qualquer nível) |
| `playersPerTeam` não persiste no DrawConfig | É configuração por sorteio, não por pelada; evita efeito colateral inesperado |
| Stack puro (sem abas) | UX mais limpa; abas misturavam cadastro com ação (sorteio) em contexto errado |
| Notas ocultas em `PlayerList` e `TeamsScreen` | São as telas "públicas" visíveis durante o racha; `PlayerRegister` é uso exclusivo do organizador |

---

## 10. Build e Deploy

### Expo Go (desenvolvimento)
```bash
npm install
npx expo start
# escanear QR com Expo Go no celular
```

### APK para distribuição direta (Android)
```bash
eas build --profile preview --platform android
# gera .apk; link de download ao final
```

### Produção (Google Play)
```bash
eas build --profile production --platform android
# gera .aab para upload na Play Store
```

O `eas.json` já está configurado:
- `preview` → `buildType: "apk"` (distribuição direta)
- `production` → padrão Expo (`.aab`)

---

## 11. Estrutura de Arquivos

```
BalanceSquad/
├── App.tsx                           # Entry point (registra AppNavigator)
├── app.json                          # Config Expo (ícone, package, projectId EAS)
├── eas.json                          # Perfis de build EAS
├── package.json
├── tsconfig.json
├── assets/
│   ├── icon.png                      # Ícone do app (fundo azul #1E3A5F)
│   ├── splash-icon.png
│   └── favicon.png
└── src/
    ├── types/index.ts                # Todos os tipos e interfaces
    ├── storage/index.ts              # AsyncStorage: CRUD, histórico, preferências
    ├── utils/
    │   └── balancer.ts               # Algoritmo greedy de balanceamento e mescla
    ├── components/
    │   └── StarRating.tsx            # Seletor 1–5 estrelas (editável e readonly)
    ├── navigation/
    │   └── AppNavigator.tsx          # Stack navigator completo
    └── screens/
        ├── HomeScreen.tsx            # Lista peladas + toggle hideRatings
        ├── PeladaHubScreen.tsx       # Hub com 3 ações por pelada
        ├── PlayerRegisterScreen.tsx  # Cadastro e edição de jogador
        ├── PlayerListScreen.tsx      # Seleção de presença (hideRatings aplicado)
        ├── DrawConfigScreen.tsx      # Configurar sorteio (times, jogadores/time)
        ├── TeamsScreen.tsx           # Exibição, mescla e compartilhamento
        ├── ManualTeamsScreen.tsx     # Atribuição manual com limite por time
        └── DrawHistoryScreen.tsx     # Histórico com mescla e compartilhamento
```
