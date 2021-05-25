/* eslint-disable node/no-extraneous-import */
import {ApiPromise, WsProvider} from '@polkadot/api';
import {typesBundleForPolkadot} from '@crustio/type-definitions';
import {cruEndpoint} from './env';
import logger from './log';
import {parseObj, sendTx} from './util';
import BN from 'bn.js';

function getApi() {
  return new ApiPromise({
    provider: new WsProvider(cruEndpoint),
    typesBundle: typesBundleForPolkadot,
  });
}

export async function mintCru18LockedToken(
  ethAddr: string,
  amount: string
): Promise<boolean> {
  try {
    const api = getApi();
    await api.isReadyOrError
      .then(api => {
        logger.info(
          `⚡️ [global] Current chain info: ${api.runtimeChain}, ${api.runtimeVersion}`
        );
      })
      .catch(async e => {
        logger.error('💥 [global] Chain connection failed.');
        await api.disconnect();
        throw e;
      });

    const crus = new BN(amount); // BN not support decimal
    logger.info(`  ↪ Try to mint CRU18 pre claim: { ${ethAddr}, ${amount} }.`);

    // Query pre claims on chain
    const maybePreClaim = parseObj(
      await api.query.claims.cru18PreClaims(ethAddr)
    );
    if (maybePreClaim) {
      logger.info(`  ↪ Pre-claim already exist: ${ethAddr}`);
      return true; // Already mint this type of token of ethAddr
    }

    const mintPreClaim = api.tx.claims.mintCru18Claim(ethAddr, crus);
    const txRes = parseObj(await sendTx(mintPreClaim));

    if (txRes) {
      const preClaimRes: BN | null = parseObj(
        await api.query.claims.cru18PreClaims(ethAddr)
      );
      logger.info(
        `  ↪ Got pre claim info on chain: ${preClaimRes}, mint successfully`
      );

      // Disconnect ws connection
      await api.disconnect();
      return preClaimRes !== null && preClaimRes === crus;
    } else {
      return false;
    }
  } catch (e: any) {
    logger.error(`💥 Mint cru18 locked cru error: ${e}`);
    return false;
  }
}
