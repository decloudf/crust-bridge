import {ApiPromise, WsProvider} from '@polkadot/api';
import {typesBundleForPolkadot} from '@crustio/type-definitions';
import {cruEndpoint} from '../env';

export function getApi() {
  return new ApiPromise({
    provider: new WsProvider(cruEndpoint),
    typesBundle: typesBundleForPolkadot,
  });
}
