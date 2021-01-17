// Load env
require('dotenv').config();

export const crustABI = require('./abi');
export const ethEndpoint = process.env.ETH_ENDPOINT as string;
export const cruContractAddr = process.env.CRU_CONTRACT_ADDRESS as string;
export const cruClaimAddr = process.env.CRU_CLAIM_ADDRESS as string;
export const minerSeeds = process.env.MINER_SEEDS as string;
export const minerPwd = process.env.MINER_PWD as string;
export const cruEndpoint = process.env.CRU_ENDPOINT as string;
