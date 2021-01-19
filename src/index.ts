import Koa = require('koa');
import logger from './log';
import router from './routes';

const koa = new Koa();

koa.use(router.routes());

if (require.main === module) {
  logger.info(`🌉  Crust bridge runs on ${process.env.PORT}`);
  koa.listen(process.env.PORT); // default ports
}
