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
const sleep = require('util').promisify(setTimeout);

const subscanEndpoint = 'https://crust.subscan.io/api/scan/transfers';
const row = 20;

async function scanClaimBack(): Promise<any[]> {
  const res: any = await got.post(subscanEndpoint, {
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
    const res: any = await got.post(subscanEndpoint, {
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
      t.amount > claimBackFee &&
      t.block_num >= claimBackStartBN &&
      t.block_num < claimBackEndBN
  );

  toTargetTransfers.forEach(tt => {
    logger.info(`${tt.from} -> ${tt.to}: ${tt.amount} CRUs`);
  });

  return toTargetTransfers;
}

scanClaimBack()
  .then(r => {
    //logger.info(JSON.stringify(r));
  })
  .catch(e => {
    logger.error(e.toString());
    return -1;
  });
