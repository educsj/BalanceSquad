# BalanceSquad

Aplicativo mobile para sortear times equilibrados, eliminando a concentração de jogadores fortes ou fracos no mesmo time.

Desenvolvido com **React Native + Expo** (TypeScript).

---

## O problema que resolve

Nas peladas informais, o sorteio manual costuma gerar times desequilibrados — todos os craques no mesmo time, ou todos os iniciantes juntos. O BalanceSquad distribui os jogadores de forma que a soma de estrelas de cada time seja a mais próxima possível.

---

## Fluxo de uso

```
Home (lista de peladas)
  └── Pelada Hub
        ├── 👤 Cadastrar Jogador(a)
        │     └── Formulário de cadastro/edição com nome e nível (1–5 ★)
        ├── 📋 Lista de Jogadores
        │     └── Selecionar presentes → Configurar Sorteio
        │               ├── ⚽ Sortear automaticamente → Times Sorteados
        │               └── ✋ Montar manualmente     → Times Sorteados
        └── 📅 Histórico de Sorteios
              └── Ver, mesclar e compartilhar sorteios anteriores
```

---

## Funcionalidades

### Peladas
- Crie e gerencie múltiplas peladas, cada uma com sua lista de jogadores e histórico próprio

### Jogadores
- Cadastre jogadores com nome e nível de 1 a 5 estrelas
- Edite e remova jogadores diretamente pela lista de presença
- **Ocultar notas** — botão na tela inicial esconde as estrelas individuais na lista de presença e nos times sorteados, mantendo apenas a nota total de cada time; útil para evitar constrangimentos quando outros jogadores estão olhando

### Sorteio automático
- Selecione os presentes do dia e configure número de times e jogadores por time
- Algoritmo greedy distribui os jogadores garantindo que a soma de estrelas de cada time seja a mais próxima possível
- Se o número de jogadores não for múltiplo exato, um time de sobra recebe os excedentes (qualquer jogador pode ser sorteado para a sobra)

### Sorteio manual
- Atribua cada jogador a um time tocando nos botões T1 / T2 / T3
- Times cheios bloqueiam novas adições automaticamente
- É possível confirmar o sorteio assim que todos os times atingem o limite, mesmo que sobrem jogadores sem time

### Histórico
- Os 5 últimos sorteios ficam salvos com data e hora para auditoria
- Cada registro pode ser expandido para ver os times, mesclado ou compartilhado individualmente
- Mescla disponível tanto no sorteio atual quanto em registros anteriores do histórico

### Mesclar Times
- Selecione 2 times para redistribuir os jogadores entre eles (útil quando um time vence consecutivamente)
- O resultado mesclado é salvo automaticamente no histórico

### Compartilhar
- Envie os times via WhatsApp ou qualquer app de mensagens
- O texto compartilhado omite as estrelas e embaralha a ordem dos jogadores

---

## Algoritmo de balanceamento

1. Calcula `totalTimes = Math.ceil(jogadores / jogadoresPorTime)`
2. Ordena os jogadores do mais forte (5★) ao mais fraco (1★), embaralhando dentro de cada nível
3. Para cada jogador, escolhe o time elegível com a **menor soma de estrelas atual** (greedy)
4. Os times principais preenchem até a capacidade antes do time de sobra receber qualquer jogador

O resultado típico para 18 jogadores em 3 times de 6: somas **17 / 17 / 17**.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Linguagem | TypeScript |
| Navegação | React Navigation (Stack) |
| Persistência | AsyncStorage (local, por dispositivo) |
| Estilização | StyleSheet nativo |

---

## Estrutura do projeto

```
src/
├── types/index.ts                # Player, Pelada, Team, DrawRecord, tipos de navegação
├── storage/index.ts              # CRUD de peladas, histórico de sorteios, preferências
├── utils/balancer.ts             # Algoritmo de sorteio e mescla
├── navigation/
│   └── AppNavigator.tsx          # Stack navigator (todas as telas)
├── screens/
│   ├── HomeScreen.tsx            # Lista de peladas + criação/edição + toggle de notas
│   ├── PeladaHubScreen.tsx       # Hub com 3 ações: cadastrar, listar, histórico
│   ├── PlayerRegisterScreen.tsx  # Formulário de cadastro e edição de jogador
│   ├── PlayerListScreen.tsx      # Seleção de presença + editar/remover inline
│   ├── DrawConfigScreen.tsx      # Configurar times e jogadores/time antes do sorteio
│   ├── TeamsScreen.tsx           # Times sorteados, mescla e compartilhamento
│   ├── ManualTeamsScreen.tsx     # Distribuição manual de jogadores por time
│   └── DrawHistoryScreen.tsx     # Histórico dos 5 últimos sorteios com timestamps
└── components/
    └── StarRating.tsx            # Seletor de 1–5 estrelas reutilizável
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
