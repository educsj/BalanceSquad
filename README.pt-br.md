# BalanceSquad

> **Selecionar idioma:** [English](./README.md) | [Português]

App mobile para pelada casual: sorteia times equilibrados, registra cada partida da sessão e gera um ranking competitivo compartilhável em imagem pra animar o grupo.

Desenvolvido com **React Native + Expo SDK 54** (TypeScript).

---

## O que faz

Uma pelada típica de domingo com o BalanceSquad:

1. **Cadastra os jogadores** uma vez, com meia-estrela (0.5–5) e gênero opcional.
2. **Sorteia** marcando quem foi e configurando número de times. Algoritmo greedy + otimização local garante times equilibrados; opcionalmente equilibra também por gênero.
3. **Joga várias partidas na mesma pelada** — registra cada uma com lineup real (quem entrou em campo), placar, gols por jogador e MVP.
4. **Vê o ranking** filtrado por semana, mês, trimestre, semestre, ano ou histórico todo. Compartilha o pódio Top 3 como imagem direto no grupo.

---

## Destaques

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

## Fluxo de uso

```
Home  (peladas)
└── Pelada Hub
      ├── 👤  Cadastrar Jogador     (nome, meia-estrela, gênero)
      ├── 📋  Lista de Jogadores    (presença + busca + avulsos)
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

## Funcionalidades em detalhe

### Sorteio
- **Notas fracionadas** (0.5 a 5.0) por meia-estrela
- **Algoritmo greedy + otimização local** O(n²) pra minimizar a diferença entre as somas dos times
- **Equilíbrio por gênero** opcional via round-robin estrito (uma jogadora por time por rodada), tratando jogadores sem gênero como masculino
- **Sobra** quando os jogadores não dividem exatamente: time extra recebe os excedentes
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

## Stack

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

## Estrutura do projeto

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
    ├── PlayerListScreen.tsx      # Presença + busca + avulsos
    ├── DrawConfigScreen.tsx      # Times, jogadores/time, toggle de gênero
    ├── TeamsScreen.tsx           # Times sorteados, edit completo, share, partidas
    ├── ManualTeamsScreen.tsx     # Sorteio manual com chips
    ├── DrawHistoryScreen.tsx     # Histórico (até 20) com métricas + retomar
    ├── MatchesScreen.tsx         # Lista de partidas de um sorteio
    ├── MatchEditorScreen.tsx     # Editor de partida (lineup, gols, MVP, resultado)
    ├── RankingScreen.tsx         # 4 abas × 6 períodos × top 3 compartilhável
    └── PlayerProfileScreen.tsx   # Stats individuais + head-to-head
```

Pra referência técnica interna (estrutura de dados, detalhes do algoritmo, decisões de design), veja [CONTEXT.md](./CONTEXT.md).

---

## Como rodar

**Pré-requisitos:** Node.js 18+, app Expo Go no celular (Android ou iOS)

```bash
npm install
npx expo start
```

Escaneie o QR code com **Expo Go** pra abrir no celular. Ou gera um APK standalone:

```bash
eas build --profile preview --platform android
```

---

## Testes

```bash
npm test
```

Cobertura: algoritmo de balanceamento (greedy + round-robin por gênero + preservação de tamanho), filtros temporais, agregações do ranking (jogadores/artilheiros/MVPs/campeões) e parser do payload de sorteio.

---

## Roadmap

### Curto prazo (pequenas melhorias)

- [ ] Navegar prev/next no filtro de período (outros meses, outras semanas)
- [ ] Notificação de "dia da pelada"
- [ ] Foto/avatar do jogador
- [ ] Sincronização entre dispositivos (Firebase ou similar)

### Completar Time (Sorteio de Repescagem)

Repescagem rápida quando um time fica abaixo do limite de jogadores — em vez de adicionar manualmente, o app sorteia quem vem do "time perdedor" pra completar a vaga.

- [ ] Botão **"Completar Time"** no `TeamsScreen`, visível apenas nos times com menos jogadores que o limite configurado
- [ ] Modal de repescagem: seleção do **"Time Perdedor"** (origem) de onde os jogadores serão puxados
- [ ] **Sorteio Aleatório**: escolhe os jogadores do time perdedor de forma 100% aleatória, na quantidade exata que falta
- [ ] **Sorteio Balanceado**: analisa as estrelas dos jogadores que faltam e puxa do time perdedor o(s) jogador(es) que melhor aproximem a pontuação do time incompleto da média geral (comparando com o outro time completo)
- [ ] Ao confirmar, move os jogadores escolhidos pro time incompleto e atualiza as estrelas/totais na interface

### Visão: de sorteador a **plataforma de administração de pelada**

A próxima fase transforma o BalanceSquad numa ferramenta completa de gestão pra organizadores de pelada — controle financeiro, presença e prestação de contas convivendo com as partidas e o ranking que já existem. Objetivo: ser o único app que o organizador precisa abrir no domingo.

**Financeiro — entradas e saídas**
- [ ] Mensalidade fixa e taxa por sessão por jogador
- [ ] Recebimentos: quem pagou, quem está em atraso, vencimento
- [ ] Despesas por categoria: aluguel de quadra, bola, coletes, água, juiz
- [ ] Linha do tempo de pagamentos por jogador + saldo devedor
- [ ] Caixa da pelada: saldo corrente com lançamento em um toque

**Relatórios e prestação de contas**
- [ ] Demonstrativo mensal / trimestral (receitas vs despesas, por categoria)
- [ ] Recibo / fatura individual por jogador (PNG compartilhável)
- [ ] Balanço de período pro grupo (imagem compartilhável)
- [ ] Exportar histórico financeiro completo em CSV / JSON

**Presença e convocação**
- [ ] RSVP pras próximas peladas (confirmação antecipada)
- [ ] Lista de espera da partida quando passa do limite
- [ ] Histórico de presença por jogador (% de comparecimento)
- [ ] **Ranking de assiduidade** com card Top 3 compartilhável (mais fiéis da galera)
- [ ] Visão de calendário (peladas passadas + futuras)

**Mensalistas e fila de espera**
- [ ] **Tier "mensalista"** com vaga garantida em toda sessão
- [ ] Limite de mensalistas configurável por pelada (ex: 20)
- [ ] **Fila de espera de mensalidade**: ao abrir uma vaga, o próximo da fila vira mensalista automaticamente
- [ ] Histórico de mensalidade (quem entrou, quem saiu, tempo como mensalista)

**Notificações**
- [ ] Lembrete de dia da pelada (X horas antes)
- [ ] Lembrete de pagamento pendente
- [ ] Aviso de cancelamento ou mudança de horário
- [ ] **Lembrete pro admin da lista semanal** — alerta o organizador de mandar a lista da semana, com botão "rascunhar e mandar no WhatsApp" pré-preenchido com mensalistas confirmados + lista de espera

**Outras ferramentas do organizador**
- [ ] Multi-organizador (admin compartilhado entre 2+ pessoas)
- [ ] Presets de tipo de jogo (futsal, society, fut7) com regras default diferentes
- [ ] Backup automático na nuvem dos dados da pelada

---

## Autor

**Eduardo Coutinho** — [github.com/educsj](https://github.com/educsj)
