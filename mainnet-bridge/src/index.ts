import BigNumber from 'bignumber.js';
import logger from './log';
import {parseObj} from './util';
import {mintMainnetLockedToken} from './crustApi';
const csv = require('csvtojson');

const CruUnit = new BigNumber(1_000_000_000_000);

interface TokenInfo {
  address: string;
  tokenType: string;
  amount: BigNumber;
}

async function loadCRU18Holders(): Promise<Array<TokenInfo>> {
  const cru18Holders: Array<TokenInfo> = (
    await csv().fromFile('./cru18Holders.csv')
  ).map((h: any) => {
    const holder = parseObj(h);
    const balance = new BigNumber(holder.Balance as number);
    const amount = balance.multipliedBy(CruUnit).decimalPlaces(0, 6);
    return {
      address: holder.HolderAddress as string,
      tokenType: 'CRU18',
      amount,
    };
  });
  const totalCru18Amount = cru18Holders.reduce((acc, h) => {
    logger.info(`Get cru18 token holder: ${JSON.stringify(h)}`);
    return acc.plus(h.amount);
  }, new BigNumber(0));

  logger.info(`Total CRU18 amount: ${totalCru18Amount.toString()}`);
  return cru18Holders;
}

async function main() {
  // 1. Load CRU18 holders
  const cru18Holders = await loadCRU18Holders();

  // 2. Mint Pre claim
  for (const holder of cru18Holders) {
    await mintMainnetLockedToken(
      holder.address,
      holder.tokenType,
      holder.amount.toString()
    );
  }
}

main();
