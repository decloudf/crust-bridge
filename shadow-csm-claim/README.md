# Crust MainNet Claim

Bridge between Crust MainNet Network and Crust ERC20 Token

## Start Steps

1. Set Claim Superior(by sudo, cold key, should have tx fee)
2. Set Claim Miner(by sudo, hot key, should have tx fee)
3. Set Claim Limit(by superior, set periodically)
4. Init Claim Pot(by sudo)

## Dockerize

> MAKE SURE do not make docker image go public with env variables

```shell
> ./dockerize.sh
```
