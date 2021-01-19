import BN = require('bn.js');
import {Context} from 'koa';
import * as Router from 'koa-router';
import logger from '../log';
import {ethTxParser, claimMiner} from '../services';

const router = new Router();
const handleTx = {};

// TODO: add credential and cors restrict
router.post('/claim/:hash', async (ctx, next) => {
  const ethTxHash = ctx.params.hash;
  logger.info(`Received eth tx hash: ${ethTxHash}`);
  // TODO: judge if there is tx pending

  const parseTx = async () => {
    // 1. Parse eth tx
    const parseRes: [string, BN] | null = await ethTxParser(ethTxHash);
    // Illegal crust claim transaction
    if (!parseRes) {
      return false;
    } else {
      // 2. Mint into crust maxwell
      const claimer = parseRes[0];
      const amount = parseRes[1];
      return await claimMiner(ethTxHash, claimer, amount);
    }
  };

  const result = await handleWithLock(ctx, handleTx, ethTxHash, parseTx, {
    type: 'TxIsHandling',
  });

  ctx.response.status = result ? 200 : 400;
  await next();
});

async function handleWithLock(
  ctx: Context,
  lockCtx: any,
  key: string,
  handler: Function,
  error: any
) {
  logger.debug(`Handle with locking key: ${key}`);

  if (lockCtx[key]) {
    return ctx.throw(423, error);
  }

  try {
    lockCtx[key] = true;
    return await handler();
  } finally {
    delete lockCtx[key];
  }
}

export default router;
