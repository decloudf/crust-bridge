/* eslint-disable node/no-extraneous-import */
import {Keyring} from '@polkadot/keyring';
import {KeyringPair} from '@polkadot/keyring/types';
import {SubmittableExtrinsic} from '@polkadot/api/promise/types';
import {minerSeeds} from '../env';
import BN = require('bn.js');
import logger from '../log';

/**
 * Parse object into JSON object
 * @param o any object
 */
export function parseObj(o: any) {
  return JSON.parse(JSON.stringify(o));
}

/**
 * Send tx to crust network
 * @param tx substrate-style tx
 * @returns tx already been sent
 */
export async function sendTx(tx: SubmittableExtrinsic) {
  const krp = loadKeyringPair();
  return new Promise((resolve, reject) => {
    tx.signAndSend(krp, ({events = [], status}) => {
      logger.info(
        `    ↪ 💸  Transaction status: ${status.type}, nonce: ${tx.nonce}`
      );

      if (
        status.isInvalid ||
        status.isDropped ||
        status.isUsurped ||
        status.isRetracted
      ) {
        reject(new Error('Invalid transaction.'));
      } else {
        // Pass it
      }

      if (status.isInBlock) {
        events.forEach(({event: {method, section}}) => {
          if (section === 'system' && method === 'ExtrinsicFailed') {
            // Error with no detail, just return error
            logger.info(`    ↪ ❌  Send transaction(${tx.hash}) failed`);
            resolve(false);
          } else if (method === 'ExtrinsicSuccess') {
            logger.info(`    ↪ ✅  Send transaction(${tx.hash}) success`);
            resolve(true);
          }
        });
      } else {
        // Pass it
      }
    }).catch(e => {
      reject(e);
    });
  });
}

/**
 * ERC20 CRU(decimal: 18) to Crust CRU(decimal: 12)
 * @param amount ERC20 CRU
 * @returns Crust CRU(round to pico unit)
 */
export function erc20ToCru(amount: BN): BN {
  const crus = amount.div(new BN(1000000));
  logger.info(
    `  ↪ 🔗  Convert ERC20(${amount.toString()}) into CRU(${crus.toString()})`
  );
  return crus;
}

/**
 * Load keyring pair with seeds
 */
function loadKeyringPair(): KeyringPair {
  const kr = new Keyring({
    type: 'sr25519',
  });

  const krp = kr.addFromUri(minerSeeds);
  return krp;
}
