// Load env

// eslint-disable-next-line node/no-extraneous-require
require('dotenv').config();

export const minerSeeds = process.env.MINER_SEEDS as string;
export const cruEndpoint = process.env.CRU_ENDPOINT as string;
