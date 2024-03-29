import logger from '../log';
import {erc20ToCru, sendTx, parseObj} from '../util';
import {
  crustABI,
  ethEndpoint,
  cruContractAddr,
  cruBurnAddr,
  minEthConfirmation,
} from '../env';
import {getApi} from './crustApi';
import * as _ from 'lodash';
import BN = require('bn.js');
const Web3 = require('web3');
const InputDecoder = require('ethereum-input-data-decoder');

/**
 * Try to parse an ethereum transaction by hash
 * @param txHash ethereum transaction hash
 * @returns [ethAddress, claimAmount] or null(means parse error)
 */
export async function ethTxParser(
  txHash: string
): Promise<[string, BN] | null> {
  try {
    logger.info(`🙋🏻‍♂️  Received eth tx hash: ${txHash}`);
    if (!txHash || txHash.length !== 66) {
      logger.warn('  ↪ ☠️  Bad length of tx hash');
      return null;
    }

    // 0. Load CRUST decoder
    const decoder = new InputDecoder(crustABI);

    // 1. Connect to eth endpoint
    const web3 = new Web3(new Web3.providers.HttpProvider(ethEndpoint));

    // 2. Parse tx by tx hash
    const currentBN = await web3.eth.getBlockNumber();
    const tx = await web3.eth.getTransaction(txHash);
    // Failed with not crust transfer tx or confirmation not enough
    if (
      !tx ||
      !tx.from ||
      !tx.to ||
      tx.to.toLowerCase() !== cruContractAddr.toLowerCase() ||
      currentBN - tx.blockNumber < minEthConfirmation
    ) {
      logger.warn(
        `  ↪ ☠️  Illegal transaction / Not crust token tx / Confirmation < ${minEthConfirmation}`
      );
      return null;
    }

    // 4. Tx status should be success
    const txReceipt = parseObj(await web3.eth.getTransactionReceipt(txHash));
    // Failed with failed tx
    if (!txReceipt || txReceipt.status === false) {
      logger.warn('  ↪ ☠️  Transaction failed');
      return null;
    }

    // 5. Parse input data
    const inputDetail = decoder.decodeData(tx.input);
    const method = inputDetail.method;
    const inputs = inputDetail.inputs;
    // Failed with not cru transfer
    if (method !== 'transfer' || !_.isArray(inputs) || inputs.length !== 2) {
      logger.warn('  ↪ ☠️  Not CRU transfer transaction');
      return null;
    }

    const to = ('0x' + inputs[0]).toLowerCase();
    // Failed with not cru claim
    if (to !== cruBurnAddr) {
      logger.info(`  ↪ ☠️  Not CRU burn transaction: ${to} != ${cruBurnAddr}`);
      return null;
    }
    const from = tx.from;
    const amount = web3.utils.toBN(inputs[1]);

    logger.info(
      `  ↪ ✨  Got legal CRU claim transaction: {'from': ${from}, 'to': ${to}, 'amount': ${amount.toString()}}`
    );

    return [tx.from, amount];
  } catch (e: any) {
    logger.error(`  ↪ 💥  Parse eth tx error: ${e}`);
    return null;
  }
}

/**
 * Claim and mint cru in Crust Maxwell
 * @param ethTx Legal eth tx hex string
 * @param ethAddr Legal eth address hex string
 * @param amount Claim amount with 18 decimals
 * @returns Mint success or not
 */
export async function mintClaim(
  ethTx: string,
  ethAddr: string,
  amount: BN
): Promise<boolean> {
  try {
    const api = getApi();
    await api.isReadyOrError
      .then(api => {
        logger.info(
          `  ↪ ⚡️  [global] Current chain info: ${api.runtimeChain}, ${api.runtimeVersion}`
        );
      })
      .catch(async e => {
        logger.error('💥  [global] Chain connection failed');
        await api.disconnect();
        throw e;
      });

    const crus: BN = erc20ToCru(amount);
    logger.info(
      `  ↪ ⛏  Try to mint claim: { tx: ${ethTx}, ethAddr: ${ethAddr}, amount: ${crus.toString()} pico }`
    );

    // Query chain
    const maybeClaim = parseObj(await api.query.claims.claims(ethTx));
    if (maybeClaim) {
      logger.info(`  ↪ 💡  Claim already exist: ${ethTx}`);
      return true; // Already mint this eth tx
    }

    const mintClaim = api.tx.claims.mintClaim(ethTx, ethAddr, crus);
    const txRes = parseObj(await sendTx(mintClaim));

    if (txRes) {
      const claimRes: [string, BN] | null = parseObj(
        await api.query.claims.claims(ethTx)
      );
      logger.info(
        `  ↪ 💎  Mint success and got claim info on chain: ${claimRes}`
      );

      // Disconnect ws connection
      await api.disconnect();
      return (
        claimRes !== null &&
        claimRes[0].toLowerCase() === ethAddr.toLowerCase() &&
        String(claimRes[1]) === crus.toString()
      );
    } else {
      logger.warn('  ↪ 🧨  Mint failed');
      return false;
    }
  } catch (e: any) {
    logger.error(`💥  Mint claim error: ${JSON.stringify(e)}`);
    return false;
  }
}
