import Koa = require('koa');
import logger from './log';
import router from './routes';

const koa = new Koa();
const cors = require('@koa/cors');

koa.use(router.routes());
koa.use(cors());

if (require.main === module) {
  logger.info(`🌉  Crust bridge runs on ${process.env.PORT}`);
  koa.listen(process.env.PORT); // default ports
}
