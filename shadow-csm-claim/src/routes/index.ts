import {Context, Next} from 'koa';
import BN = require('bn.js');
import Router = require('koa-router');
import logger from '../log';
import {ethTxParser, mintClaim} from '../services';
import {timeout} from 'promise-timeout';

const router = new Router();
const txLocker = {};

router.post('/claim/:hash', async (ctx: Context, next: Next) => {
  let ethTxHash = ctx.params.hash;
  const parseTx = async () => {
    ethTxHash = ethTxHash.trim();
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
        txLocker,
        'sendMintClaim',
        async () => {
          return await mintClaim(ethTxHash, claimer, amount);
        },
        {
          code: 409,
          msg: 'MintClaimIsOccupied',
        }
      );
    }
  };

  const result = await handleWithLock(ctx, txLocker, ethTxHash, parseTx, {
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
    return ctx.throw(error.code || 409, error);
  }

  try {
    lockCtx[key] = true;
    return await timeout(
      new Promise((resolve, reject) => {
        handler().then(resolve).catch(reject);
      }),
      2 * 60 * 1000 // 2 min will timeout
    );
  } finally {
    delete lockCtx[key];
  }
}

export default router;
