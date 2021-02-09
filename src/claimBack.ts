/* eslint-disable no-process-exit */
import {
  claimBackAddress,
  claimBackEndBN,
  claimBackStartBN,
  claimBackFee,
} from './env';
import got from 'got';
import logger from './log';
import {parseObj} from './util';
import * as _ from 'lodash';
import {getApi} from './services/crustApi';
const sleep = require('util').promisify(setTimeout);
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const subscanEndpoint = 'https://crust.subscan.io';
const row = 20;
const api = getApi();

interface ClaimBackTransfer {
  account: string;
  amount: number;
}

interface ClaimBackRecord {
  crustAccount: string;
  ethAccount: string;
  amount: number;
}

async function getClaimBackTransfers(): Promise<ClaimBackTransfer[]> {
  const transfersApi = subscanEndpoint + '/api/scan/transfers';
  const res: any = await got.post(transfersApi, {
    json: {
      address: claimBackAddress,
      row,
      page: 1,
    },
    responseType: 'json',
  });
  const data = parseObj(res.body.data);
  const totalTransferCount: number = data['count'];
  const queryNum = totalTransferCount / row;
  let totalTransfers: any[] = [];

  logger.info(`Got ${totalTransferCount} transfers from ${claimBackAddress}`);

  for (let i = 0; i <= queryNum; i++) {
    const res: any = await got.post(transfersApi, {
      json: {
        address: claimBackAddress,
        row,
        page: i,
      },
      responseType: 'json',
    });
    const data = parseObj(res.body.data);

    logger.info(`Got new ${data['transfers'].length} transfers from Subscan`);
    totalTransfers = totalTransfers.concat(data['transfers']);

    await sleep(500);
  }

  const toTargetTransfers = totalTransfers.filter(
    t =>
      t.to === claimBackAddress &&
      t.block_num > claimBackStartBN &&
      t.block_num <= claimBackEndBN
  );

  toTargetTransfers.forEach((tt, idx) => {
    logger.info(
      `${idx}: ${tt.from} -> ${tt.to}(BN: ${tt.block_num}): ${tt.amount} CRUs`
    );
  });

  return toTargetTransfers.map(tt => {
    const cbt: ClaimBackTransfer = {
      account: tt.from,
      amount: tt.amount,
    };
    return cbt;
  });
}

async function getBondedEth(account: string): Promise<string | null> {
  const maybeEthAddr = parseObj(await api.query.claims.bondedEth(account));

  return maybeEthAddr ? maybeEthAddr : null;
}

async function main(): Promise<boolean> {
  // 0. Get all legal claim back transfers
  const claimBackTransfers: ClaimBackTransfer[] = await getClaimBackTransfers();
  const claimBackMap: Map<string, [string | null, number]> = new Map();

  // 1. Get bonded ethereum address and sum up by same `crustAccount`
  for (const cbt of claimBackTransfers) {
    const crustAccount = cbt.account;
    if (claimBackMap.has(crustAccount)) {
      // a. Sum up with existed account
      const value = claimBackMap.get(crustAccount);
      if (value) {
        const amount = Number(value[1]) + Number(cbt.amount);
        claimBackMap.set(crustAccount, [value[0], amount]);
      }
    } else {
      // b. Insert with new account
      const maybeEthAddr = await getBondedEth(cbt.account);
      claimBackMap.set(crustAccount, [maybeEthAddr, cbt.amount]);
    }
  }

  // 2. Construct records
  const claimBackRecords: ClaimBackRecord[] = [];
  for (const crustAccount of claimBackMap.keys()) {
    const value = claimBackMap.get(crustAccount);

    // - claimBackFee
    if (value && value[1] > claimBackFee) {
      claimBackRecords.push({
        crustAccount,
        ethAccount: value[0] !== null ? value[0] : '',
        amount: value[1] - claimBackFee,
      });
    }
  }

  // 3. Write to csv file
  const csvWriter = createCsvWriter({
    path: `./crust-bridge-claim-back-${new Date().toISOString()}.csv`,
    header: [
      {id: 'crustAccount', title: 'Crust Address'},
      {id: 'ethAccount', title: 'Ethereum Address'},
      {id: 'amount', title: 'Amount'},
    ],
  });

  await csvWriter.writeRecords(claimBackRecords);

  return true;
}

main()
  .then(r => {
    logger.info('Parse claim back txs success');
    process.exit(0);
  })
  .catch(e => {
    logger.error(`Parse finished with error: ${e}`);
    process.exit(1);
  });
