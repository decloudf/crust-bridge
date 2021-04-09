import Koa = require('koa');
import logger from './log';
import router from './routes';
import {apiPass} from './env';

const app = new Koa();
const cors = require('@koa/cors');
const auth = require('koa-basic-auth');

app.use(cors());

// Global error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    if (401 === e.status) {
      ctx.status = 401;
      ctx.body = {msg: 'You have no access.'};
    } else {
      logger.error(`💥 Unknown global error catched: ${JSON.stringify(e)}`);
      ctx.status = e.statusCode || e.status || 500;
      ctx.body = {msg: 'Unknown error'};
    }
    ctx.app.emit('error', e, ctx);
  }
});

// Authentication
app.use(auth(apiPass));

app.use(router.routes());

if (require.main === module) {
  logger.info(`🌉  Crust Maxwell bridge runs on ${process.env.PORT}`);
  app.listen(process.env.PORT); // default ports
}
