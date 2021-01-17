// TODO:
//  1. Provide RESUful API(with cors and credential)
// 2. Parse eth tx(with web3.js)
// 3. Call claims.mintClaim(ethTx, ethAddress, amount);

import * as Koa from 'koa';
import logger from './log';
import router from './routes';

const koa = new Koa();

koa.use(router.routes());

if (require.main === module) {
  koa.listen(4000); // default ports
}
