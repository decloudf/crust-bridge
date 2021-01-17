import BN = require('bn.js');
import * as Router from 'koa-router';
import logger from '../log';
import {ethTxParser, claimMiner} from '../services';

const router = new Router();

// TODO: add credential and cors restrict
router.post('/claim/:hash', async (ctx, next) => {
  const ethTxHash = ctx.params.hash;
  logger.info(`Received eth tx hash: ${ethTxHash}`);
  // TODO: judge if there is tx pending

  // 1. Parse eth tx
  const parseRes: [string, BN] | null = await ethTxParser(ethTxHash);
  // Illegal crust claim transaction
  if (!parseRes) {
    ctx.response.status = 400;
  } else {
    // 2. Mint into crust maxwell
    const claimer = parseRes[0];
    const amount = parseRes[1];
    const mintRes = await claimMiner(ethTxHash, claimer, amount);
    if (mintRes) {
      ctx.response.status = 200;
    } else {
      ctx.response.status = 400;
    }
  }

  await next();
});

export default router;
