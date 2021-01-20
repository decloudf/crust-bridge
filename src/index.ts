import Koa = require('koa');
import logger from './log';
import router from './routes';

const app = new Koa();
const cors = require('@koa/cors');

app.use(cors());

// Global error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    logger.error(`💥 Unknown global error catched: ${JSON.stringify(e)}`);
    ctx.status = e.statusCode || e.status || 500;
    ctx.body = {msg: 'Unknown error'};
    ctx.app.emit('error', e, ctx);
  }
});

app.use(router.routes());

if (require.main === module) {
  logger.info(`🌉  Crust bridge runs on ${process.env.PORT}`);
  app.listen(process.env.PORT); // default ports
}
