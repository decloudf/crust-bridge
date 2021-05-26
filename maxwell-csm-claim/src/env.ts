// Load env

// eslint-disable-next-line node/no-extraneous-require
require('dotenv').config();

export const crustABI = require('./abi');
export const ethEndpoint = process.env.ETH_ENDPOINT as string;
export const csmContractAddr = process.env.CSM_CONTRACT_ADDRESS as string;
export const minerSeeds = process.env.MINER_SEEDS as string;
export const cruEndpoint = process.env.CRU_ENDPOINT as string;
export const csmClaimAddr = process.env.CSM_CLAIM_ADDRESS as string;
export const minEthConfirmation = Number(
  process.env.MIN_ETH_CONFIRMATION as string
);
// export const csmClaimContract = process.env.CSM_CLAIM_CONTRACT as string;
export const apiPass = {
  name: process.env.API_AUTH_NAME as string,
  pass: process.env.API_AUTH_PWD as string,
};
