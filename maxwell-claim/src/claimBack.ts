/* eslint-disable no-process-exit */
import {
  claimBackAddress,
  claimBackEndBN,
  claimBackStartBN,
  cruClaimBackFee,
  csmClaimBackFee,
  subscanSecret,
} from './env';
import got from 'got';
import logger from './log';
import {parseObj} from './util';
import * as _ from 'lodash';
import {getApi} from './services/crustApi';
const sleep = require('util').promisify(setTimeout);
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const subscanEndpoint = 'https://maxwell.api.subscan.io';
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

async function getClaimBackTransfers(): Promise<
  [ClaimBackTransfer[], ClaimBackTransfer[]]
> {
  const transfersApi = subscanEndpoint + '/api/scan/transfers';
  const res: any = await got.post(transfersApi, {
    json: {
      address: claimBackAddress,
      row,
      page: 1,
      from_block: claimBackStartBN,
      to_block: claimBackEndBN,
    },
    responseType: 'json',
    headers: {
      'x-api-key': subscanSecret,
    },
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
        from_block: claimBackStartBN,
        to_block: claimBackEndBN,
      },
      responseType: 'json',
      headers: {
        'x-api-key': subscanSecret,
      },
    });
    const data = parseObj(res.body.data);

    if (data['transfers']) {
      logger.info(`Got new ${data['transfers'].length} transfers from Subscan`);
      totalTransfers = totalTransfers.concat(data['transfers']);
    }

    await sleep(500);
  }

  const toTargetTransfers = totalTransfers.filter(
    t =>
      t.to === claimBackAddress &&
      t.block_num > claimBackStartBN &&
      t.block_num <= claimBackEndBN &&
      t.success
  );

  const cruTransfers = new Array<ClaimBackTransfer>();
  const csmTransfers = new Array<ClaimBackTransfer>();
  toTargetTransfers.forEach((tt, idx) => {
    const cbt: ClaimBackTransfer = {
      account: tt.from,
      amount: tt.amount,
    };
    if (tt.module === 'balances') {
      logger.info(
        `${idx}: ${tt.from} -> ${tt.to}(BN: ${tt.block_num}): ${tt.amount} CRUs`
      );
      cruTransfers.push(cbt);
    } else if (tt.module === 'csm') {
      logger.info(
        `${idx}: ${tt.from} -> ${tt.to}(BN: ${tt.block_num}): ${tt.amount} CSMs`
      );
      csmTransfers.push(cbt);
    }
  });

  return [cruTransfers, csmTransfers];
}

async function getBondedEth(account: string): Promise<string | null> {
  const maybeEthAddr = parseObj(await api.query.claims.bondedEth(account));

  return maybeEthAddr ? maybeEthAddr : null;
}

async function getClaimBackRecord(
  transfers: ClaimBackTransfer[],
  fee: number
): Promise<ClaimBackRecord[]> {
  const claimBackMap: Map<string, [string | null, number]> = new Map();
  // 1. Get bonded ethereum address and sum up by same `crustAccount`
  for (const cbt of transfers) {
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
    if (value && value[1] > fee) {
      claimBackRecords.push({
        crustAccount,
        ethAccount: value[0] !== null ? value[0] : '',
        amount: value[1] - fee,
      });
    }
  }

  return claimBackRecords;
}

async function main(): Promise<boolean> {
  // 1. Get all legal claim back transfers
  const [cruTransfers, csmTransfers] = await getClaimBackTransfers();

  // 2. Build claim back record
  const cruClaimBackRecords = await getClaimBackRecord(
    cruTransfers,
    cruClaimBackFee
  );
  const csmClaimBackRecords = await getClaimBackRecord(
    csmTransfers,
    csmClaimBackFee
  );

  // 3. Write to csv file
  const csvWriter1 = createCsvWriter({
    path: `./crust-bridge-cru-claim-back-${new Date().toISOString()}.csv`,
    header: [
      {id: 'crustAccount', title: 'Crust Address'},
      {id: 'ethAccount', title: 'Ethereum Address'},
      {id: 'amount', title: 'Amount'},
    ],
  });
  const csvWriter2 = createCsvWriter({
    path: `./crust-bridge-csm-claim-back-${new Date().toISOString()}.csv`,
    header: [
      {id: 'crustAccount', title: 'Crust Address'},
      {id: 'ethAccount', title: 'Ethereum Address'},
      {id: 'amount', title: 'Amount'},
    ],
  });

  await csvWriter1.writeRecords(cruClaimBackRecords);
  await csvWriter2.writeRecords(csmClaimBackRecords);

  logger.info('Export csv success');
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
