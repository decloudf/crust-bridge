import {Context, Next} from 'koa';
import BN = require('bn.js');
import Router = require('koa-router');
import logger from '../log';
import {ethTxParser, claimMiner} from '../services';

const router = new Router();
const handleTx = {};

// TODO: add credential and cors restrict
router.post('/claim/:hash', async (ctx: Context, next: Next) => {
  const ethTxHash = ctx.params.hash;
  const parseTx = async () => {
    logger.info(`Received eth tx hash: ${ethTxHash}`);
    // 1. Parse eth tx
    const parseRes: [string, BN] | null = await ethTxParser(ethTxHash);

    // Illegal crust claim transaction
    if (!parseRes) {
      return false;
    } else {
      // 2. Mint into crust maxwell
      const claimer = parseRes[0];
      const amount = parseRes[1];

      return await handleWithLock(
        ctx,
        handleTx,
        'sendMintClaim',
        async () => {
          await claimMiner(ethTxHash, claimer, amount);
        },
        {
          code: 503,
          msg: 'MintClaimIsOccupied',
        }
      );
    }
  };

  const result = await handleWithLock(ctx, handleTx, ethTxHash, parseTx, {
    code: 423,
    msg: 'SameEthTxIsHandling',
  });

  if (result) {
    ctx.response.status = 200;
    ctx.response.body = {
      msg: 'MintClaimSuccess',
    };
  } else {
    ctx.response.status = 400;
    ctx.response.body = {
      msg: 'MintClaimFailed',
    };
  }
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
    return ctx.throw(error.code || 400, error);
  }

  try {
    lockCtx[key] = true;
    return await handler();
  } finally {
    delete lockCtx[key];
  }
}

export default router;
