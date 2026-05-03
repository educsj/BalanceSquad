# BalanceSquad

Aplicativo mobile para sortear times equilibrados, eliminando a concentração de jogadores fortes ou fracos no mesmo time.

Desenvolvido com **React Native + Expo** (TypeScript).

---

## O problema que resolve

Nas peladas informais, o sorteio manual costuma gerar times desequilibrados — todos os craques no mesmo time, ou todos os iniciantes juntos. O BalanceSquad distribui os jogadores de forma que a soma de estrelas de cada time seja a mais próxima possível.

---

## Funcionalidades

- **Múltiplas Peladas** — crie quantas peladas quiser, cada uma com sua própria lista de jogadores
- **Cadastro de jogadores** — nome + nível de 1 a 5 estrelas, com edição e remoção
- **Seleção de presença** — marque quem está no racha do dia antes de sortear
- **Sorteio automático equilibrado** — algoritmo greedy que garante times com somas de estrelas próximas
- **Sorteio manual** — monte os times você mesmo, atribuindo cada jogador a um time; o app valida que todos foram distribuídos antes de confirmar
- **Time de sobra** — se o número de jogadores não for múltiplo exato, um time extra recebe os excedentes
- **Histórico de sorteios** — os 5 últimos sorteios ficam salvos com data e hora (auditoria); um banner na tela de presença mostra o mais recente e um botão acessa o histórico completo
- **Mesclar Times** — selecione 2 times para redistribuir os jogadores; o resultado é salvo automaticamente no histórico
- **Ocultar notas individuais** — botão na home permite esconder as estrelas dos jogadores nas telas de sorteio e times, mantendo apenas a nota geral de cada time; útil para preservar privacidade durante a exibição dos resultados
- **Compartilhar** — envie o resultado via WhatsApp ou qualquer app de mensagens (sem estrelas, ordem dos jogadores embaralhada)

---

## Algoritmo de balanceamento

1. Calcula `totalTimes = Math.ceil(jogadores / jogadoresPorTime)`
2. Ordena todos os jogadores do mais forte (5★) para o mais fraco (1★), embaralhando dentro de cada nível
3. Para cada jogador, escolhe o time elegível com a **menor soma de estrelas atual** (greedy)
4. Os times principais preenchem até a capacidade antes do time de sobra receber qualquer jogador

O resultado típico para 18 jogadores em 3 times de 6: somas **17 / 17 / 17**.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Linguagem | TypeScript |
| Navegação | React Navigation (Stack + Bottom Tabs) |
| Persistência | AsyncStorage (local, por dispositivo) |
| Estilização | StyleSheet nativo |

---

## Estrutura do projeto

```
src/
├── types/index.ts              # Player, Pelada, Team, DrawRecord, tipos de navegação
├── storage/index.ts            # CRUD de Peladas, histórico de sorteios, preferências
├── utils/balancer.ts           # Algoritmo de sorteio e mescla
├── navigation/
│   └── AppNavigator.tsx        # Stack (Home → PeladaTabs → Teams / ManualTeams / DrawHistory)
├── screens/
│   ├── HomeScreen.tsx          # Lista de Peladas + criação/edição + toggle de notas
│   ├── PlayersScreen.tsx       # CRUD de jogadores por Pelada
│   ├── PresenceScreen.tsx      # Checklist de presença + sorteio automático e manual
│   ├── TeamsScreen.tsx         # Resultado, compartilhamento e mescla
│   ├── ManualTeamsScreen.tsx   # Distribuição manual de jogadores por time
│   └── DrawHistoryScreen.tsx   # Histórico dos 5 últimos sorteios com timestamps
└── components/
    └── StarRating.tsx          # Seletor de 1–5 estrelas reutilizável
```

---

## Como rodar

**Pré-requisitos:** Node.js 18+, Expo Go no celular (Android ou iOS)

```bash
npm install
npx expo start
```

Escaneie o QR code com o app **Expo Go** para abrir no celular.

---

## Autor

**Eduardo Coutinho** — [github.com/educsj](https://github.com/educsj)
