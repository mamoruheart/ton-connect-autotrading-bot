# ton-connect-autotrading-bot

> TON AutoTrading Bot

## Prerequisites

```yaml
node.js: 18.1.0
```

`.env` file:

```yaml
TELEGRAM_BOT_TOKEN= DELETE_SEND_TX_MESSAGE_TIMEOUT_MS= TELEGRAM_BOT_LINK= MANIFEST_URL=
CONNECTOR_TTL_MS= REDIS_URL= WALLETS_LIST_CAHCE_TTL_MS=
```

## Getting Started

Copy `.env.example` as `.env` and add your bot token there

```bash
npm i

docker run -p 127.0.0.1:6379:6379 -it redis/redis-stack-server:latest

npm run compile
npm start
```

### Run process manager

```bash
npm run start:daemon
```

### Stop process manager

```bash
npm run stop:daemon
```

## Try it

[ton_connect_bot](https://t.me/AutoTradingTON_bot)

<img src="imgpsh_fullsize_anim.png" alt="" width="150" />

---

&copy; 2024 All rights reserved.
