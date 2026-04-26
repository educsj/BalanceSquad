# Plano de Desenvolvimento: Sorteador de Times Equilibrados

Este documento detalha os requisitos técnicos e funcionais para a criação de um aplicativo mobile focado no balanceamento de equipes, priorizando a paridade competitiva.

## 1. Objetivo do Projeto
Desenvolver uma ferramenta para Android (via Expo) que elimine a disparidade técnica entre times, evitando a concentração de jogadores "estrelas" (5 estrelas) ou iniciantes (1 estrela) na mesma equipe.

## 2. Stack Tecnológico
- **Framework:** React Native com Expo.
- **Linguagem:** JavaScript ou TypeScript.
- **Persistência de Dados:** AsyncStorage (Armazenamento local).
- **Estilização:** Styled Components ou StyleSheet.

## 3. Funcionalidades (MVP)
- **Cadastro de Jogadores:** CRUD de jogadores com Nome e Nível (1 a 5 estrelas).
- **Seleção de Presença:** Lista para marcar quem participará do sorteio atual.
- **Configuração:** Definir o número de times.
- **Exportação:** Compartilhamento dos times via WhatsApp/Texto.

## 4. Lógica do Algoritmo de Balanceamento
O algoritmo deve seguir esta hierarquia para evitar que jogadores de elite se potencializem no mesmo time:

1.  **Segregação:** Divide os jogadores em: Elite (5 estrelas), Base (1 estrela) e Geral (2-4 estrelas).
2.  **Distribuição de Extremos:**
    - Embaralha o Grupo Elite e distribui um por time. **Regra:** Nunca dois jogadores 5 estrelas no mesmo time enquanto houver times sem nenhum.
    - Repete o processo para o Grupo Base (1 estrela).
3.  **Preenchimento:** Distribui o Grupo Geral usando o método de menor soma (Greedy), onde o próximo jogador mais forte entra no time que tem a menor soma de estrelas atual.

## 5. UI/UX
- **Cores:** Sugestão de paleta azul e branca (estilo Cruzeiro).
- **Fluxo:** Home (Lista) -> Configuração (Checklist) -> Resultado (Cards por Time).
