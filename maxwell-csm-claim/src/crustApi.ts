/* eslint-disable node/no-extraneous-import */
import {ApiPromise, WsProvider} from '@polkadot/api';
import {typesBundleForPolkadot} from '@crustio/type-definitions';
import {
  cruEndpoint,
  csmABI,
  ethEndpoint,
  csmContractAddr,
  minEthConfirmation,
  csmClaimAddr,
} from './env';
import logger from './log';
import {erc20ToCSM, parseObj, sendTx} from './util';
import BN from 'bn.js';
import * as _ from 'lodash';
const Web3 = require('web3');
const InputDecoder = require('ethereum-input-data-decoder');

function getApi() {
  return new ApiPromise({
    provider: new WsProvider(cruEndpoint),
    typesBundle: typesBundleForPolkadot,
  });
}

/**
 * Try to parse an ethereum transaction by hash
 * @param txHash ethereum transaction hash
 * @returns [ethAddress, claimAmount] or null(means parse error)
 */
export async function ethTxParser(
  txHash: string
): Promise<[string, BN] | null> {
  try {
    // 0. Load CSM decoder
    const decoder = new InputDecoder(csmABI);

    // 1. Connect to eth endpoint
    const web3 = new Web3(new Web3.providers.HttpProvider(ethEndpoint));

    // 2. Parse tx by tx hash
    const tx = parseObj(await web3.eth.getTransaction(txHash));
    const currentBN = await web3.eth.getBlockNumber();
    // Failed with not csm transfer tx or confirmation not enough
    if (
      !tx ||
      !tx.from ||
      !tx.to ||
      tx.to.toLowerCase() !== csmContractAddr.toLowerCase() ||
      currentBN - tx.blockNumber < minEthConfirmation
    ) {
      logger.info('  ↪ Illegal tx or not csm token transfer tx');
      return null;
    }

    // 4. Tx status should be success
    const txReceipt = parseObj(await web3.eth.getTransactionReceipt(txHash));
    // Failed with failed tx
    if (!txReceipt || txReceipt.status === false) {
      logger.info('  ↪ Failed tx');
      return null;
    }

    // 5. Parse input data
    const inputDetail = decoder.decodeData(tx.input);
    const method = inputDetail.method;
    const inputs = inputDetail.inputs;
    // Failed with not csm transfer
    if (method !== 'transfer' || !_.isArray(inputs) || inputs.length !== 2) {
      logger.info('  ↪ Not csm token transfer transaction');
      return null;
    }

    const to = ('0x' + inputs[0]).toLowerCase();
    // Failed with not csm claim
    if (
      to !== csmClaimAddr.toLowerCase()
      // && to !== csmClaimContract.toLowerCase()
    ) {
      logger.info(`  ↪ Not csm token claim transaction: ${to}`);
      return null;
    }
    const from = tx.from;
    const amount = web3.utils.toBN(inputs[1]);

    logger.info(
      `  ↪ Legal csm claim transaction: {'from': ${from}, 'to': ${to}, 'amount': ${amount.toString()}}`
    );

    return [tx.from, amount];
  } catch (e: any) {
    logger.error(`  ↪ Parse eth tx error: ${e}`);
    return null;
  }
}

/**
 * Claim and mint csm in Crust Maxwell
 * @param ethTx Legal eth tx hex string
 * @param ethAddr Legal eth address hex string
 * @param amount Claim amount with 18 decimals
 * @returns Mint success or not
 */
export async function mintCsmClaim(
  ethTx: string,
  ethAddr: string,
  amount: BN
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

    const csms: BN = erc20ToCSM(amount);
    logger.info(
      `  ↪ Try to mint claim: ${ethTx}, ${ethAddr}, ${csms.toString()}`
    );

    // Query chain
    const maybeClaim = parseObj(await api.query.claims.csmClaims(ethTx));
    if (maybeClaim) {
      logger.info(`  ↪ Claim already exist: ${ethTx}`);
      return true; // Already mint this eth tx
    }

    const mintClaim = api.tx.claims.mintCsmClaim(ethTx, ethAddr, csms);
    const txRes = parseObj(await sendTx(mintClaim));

    if (txRes) {
      const claimRes: [string, BN] | null = parseObj(
        await api.query.claims.csmClaims(ethTx)
      );
      logger.info(`  ↪ Got claims info on chain: ${claimRes}`);

      // Disconnect ws connection
      await api.disconnect();
      return (
        claimRes !== null &&
        claimRes[0].toLowerCase() === ethAddr.toLowerCase() &&
        Number(claimRes[1]) === Number(csms)
      );
    } else {
      return false;
    }
  } catch (e: any) {
    logger.error(`💥 Mint cru error: ${JSON.stringify(e)}`);
    return false;
  }
}
