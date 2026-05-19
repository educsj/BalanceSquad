# BalanceSquad

> **Select language:** [English] | [Português](./README.pt-br.md)

A mobile app for casual pickup soccer: draws balanced teams, tracks every match of the session, and builds a competitive ranking that you can share as an image to motivate the group.

Built with **React Native + Expo SDK 54** (TypeScript).

---

## What it does

A typical Sunday with BalanceSquad:

1. **Cadastra os jogadores** uma vez, com meia-estrela (0.5–5) e gênero opcional.
2. **Sorteia** marcando quem foi e configurando número de times. Algoritmo greedy + otimização local garante times equilibrados; opcionalmente equilibra também por gênero.
3. **Joga várias partidas na mesma pelada** — registra cada uma com lineup real (quem entrou em campo), placar, gols por jogador e MVP.
4. **Vê o ranking** filtrado por semana, mês, trimestre, semestre, ano ou histórico todo. Compartilha o pódio Top 3 como imagem direto no grupo.

---

## Highlights

- ⭐ **Meia-estrela** nas notas dos jogadores (0.5 a 5.0)
- ⚖️ **Balanceamento por gênero opcional** com round-robin que garante distribuição proporcional
- 🥅 **Partidas com lineup real**: várias partidas por sorteio, jogadores podem trocar de lado, gols e MVP por partida
- 🏆 **Ranking multi-view**: Vitórias / Artilharia / Destaques / Times campeões, com filtros temporais (semana/mês/trimestre/semestre/ano)
- 📸 **Compartilhamento de pódio em PNG** + perfil individual do jogador (head-to-head, parceiros frequentes)
- 🔁 **"Quem perde sai" assistido**: após registrar vencedor, o app sugere a próxima partida com vencedor × time descansando
- 📤 **Sorteio exportável em .json** — outro celular importa e recria a pelada inteira com partidas
- 🌙 **Tema** automático do sistema ou forçado (claro / escuro)
- 🌍 **Trilíngue**: PT / EN / ES com detecção automática

---

## Usage flow

```
Home  (peladas)
└── Pelada Hub
      ├── 👤  Cadastrar Jogador     (nome, meia-estrela, gênero)
      ├── 📋  Lista de Jogadores    (presença + busca + diaristas avulsos)
      │     └── Configurar Sorteio  (times, players/time, toggle gênero)
      │           └── Times Sorteados
      │                 ├── ⚖  Rebalancear (mescla 2 times)
      │                 ├── ✏  Renomear time (toque no nome)
      │                 ├── 📤  Compartilhar (texto / imagem / .json)
      │                 └── 🏆  Partidas
      │                       └── Editor de Partida
      │                             ├── Mandante × Visitante
      │                             ├── Lineup com check-in/out
      │                             ├── Gols (-/+ por jogador, agrupado por lado)
      │                             ├── MVP (chips agrupados por lado)
      │                             └── 🎉 celebração + sugestão "próxima partida"
      ├── 📅  Histórico             (até 20 sorteios, métricas, retomar)
      └── 🏅  Ranking               (4 abas × 6 filtros temporais)
            └── Perfil do Jogador   (head-to-head + parceiros + share)
```

---

## Features in depth

### Sorteio
- **Notas fracionadas** (0.5 a 5.0) por meia-estrela
- **Algoritmo greedy + otimização local** O(n²) para minimizar a diferença entre as somas dos times
- **Equilíbrio por gênero** opcional via round-robin estrito (uma jogadora por time por rodada), tratando jogadores sem gênero como masculino
- **Sobra** quando os jogadores não dividem exatamente: time extra com os excedentes
- **Sorteio manual** alternativo com chips por time

### Partidas (a coleção dentro de cada sorteio)
- Cada partida tem **mandante, visitante, lineups próprios** (jogadores podem ser emprestados entre times), **resultado, gols por jogador e MVP**
- **Animação celebratória** com troféu ao registrar vencedor
- **Sugestão de próxima partida** automática: vencedor permanece, descansando entra
- Lista todas as partidas do sorteio com hora, lineup count e vencedor

### Ranking
- **4 abas**: Vitórias, Artilharia, Destaques (MVP), Times campeões (o time com mais vitórias em cada sorteio)
- **6 períodos**: Semana ISO, Mês, Trimestre, Semestre, Ano, Tudo (filtro temporal por timestamp da partida)
- **Threshold opcional** "≥3 jogos" pra esconder quem jogou pouco
- **Pódio Top 3 compartilhável** em PNG, gerado off-screen via `react-native-view-shot`

### Perfil do jogador
- Toque em qualquer linha do ranking abre stats detalhadas
- **Head-to-head** contra os principais oponentes (V/E/D quando jogou no outro lado)
- **Parceiros mais frequentes** (taxa de vitória quando juntos)
- Card próprio compartilhável em PNG

### Compartilhamento
- **Texto** estilo WhatsApp (sem estrelas, ordem dos jogadores embaralhada por time)
- **Imagem PNG** com card visual do sorteio
- **Arquivo .json** que outro celular importa via "Importar sorteio" no menu Preferências → cria nova pelada com todos os jogadores + partidas

### Histórico
- **Até 20 sorteios** por pelada, com métricas (diferença, média por time, mix de gênero)
- **Retomar** abre o sorteio passado em modo de edição (mesma tela de Times Sorteados, full editing)
- **Indicador no topo** mostra o tally de vitórias por time naquele sorteio

### Edição pós-sorteio
- Adicionar/remover jogador de qualquer time, com avulsos criados na hora
- **Snackbar "Desfazer"** após cada remoção (5s)
- Aviso visual quando o time ultrapassa o limite de jogadores
- Toque no nome do time abre rename inline

### Preferências
- **Tema** (Sistema / Claro / Escuro), persistido por dispositivo
- **Ocultar notas** durante o jogo (botão de olho na Home)
- **Idioma** PT / EN / ES com detecção automática do device
- **Backup global** export/import JSON

---

## Tech Stack

| Camada | Tecnologia |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Linguagem | TypeScript |
| Navegação | React Navigation (Stack) |
| Persistência | AsyncStorage (local, por dispositivo) |
| i18n | react-i18next + expo-localization (PT / EN / ES) |
| Captura de imagem | react-native-view-shot |
| Compartilhamento | expo-sharing |
| Arquivos | expo-file-system (.json export/import) |
| Estilização | StyleSheet nativo, tema light/dark via Context |

---

## Project Structure

```
src/
├── types/index.ts                # Player (level: number, gender?), Team, Match, DrawRecord, RootStackParamList
├── storage/index.ts              # Peladas CRUD, drawHistory, matches helpers, prefs
├── theme/index.tsx               # Tema 3-state (system/light/dark) + paleta light/dark
├── i18n/index.ts                 # Setup react-i18next com detecção de locale
├── locales/{pt,en,es}.json       # Traduções
├── utils/
│   ├── balancer.ts               # Greedy + otimizador local + round-robin por gênero
│   ├── periods.ts                # Período de calendário (semana ISO, mês, tri, sem, ano)
│   ├── rankings.ts               # Agregações: stats / scorers / mvps / team champions / player profile
│   ├── stars.ts                  # formatStars(n), teamAverage(team), clampLevel(v)
│   └── drawSharePayload.ts       # Build/parse do payload .json (puro, testável)
├── components/
│   ├── StarRating.tsx            # Meia-estrela (tap em metades)
│   ├── PodiumCard.tsx            # Card Top 3 pra share em PNG
│   ├── AnimatedSplash.tsx
│   └── EmptyState.tsx
├── navigation/AppNavigator.tsx   # Stack com 10 telas
└── screens/
    ├── HomeScreen.tsx            # Lista de peladas, prefs, onboarding
    ├── PeladaHubScreen.tsx       # Hub com 4 ações (cadastrar, lista, histórico, ranking)
    ├── PlayerRegisterScreen.tsx  # Nome + meia-estrela + gênero
    ├── PlayerListScreen.tsx      # Presença + busca + diaristas
    ├── DrawConfigScreen.tsx      # Times, jogadores/time, toggle de gênero
    ├── TeamsScreen.tsx           # Times sorteados, edit completo, share, partidas
    ├── ManualTeamsScreen.tsx     # Sorteio manual com chips
    ├── DrawHistoryScreen.tsx     # Histórico (até 20) com métricas + retomar
    ├── MatchesScreen.tsx         # Lista de partidas de um sorteio
    ├── MatchEditorScreen.tsx     # Editor de partida (lineup, gols, MVP, resultado)
    ├── RankingScreen.tsx         # 4 abas × 6 períodos × top 3 compartilhável
    └── PlayerProfileScreen.tsx   # Stats individuais + head-to-head
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

## Roadmap (next ideas)

- [ ] Múltiplas semanas/meses no filtro de período (navegar prev/next)
- [ ] Notificação de "dia da pelada"
- [ ] Foto/avatar do jogador
- [ ] Sincronização entre dispositivos (Firebase ou similar)

---

## Author

**Eduardo Coutinho** — [github.com/educsj](https://github.com/educsj)
