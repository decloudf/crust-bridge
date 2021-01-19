#!/bin/bash

PACKAGE_VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')
IMAGEID="crustio/crust-bridge:$PACKAGE_VERSION"
echo "Building crustio/crust-bridge:$PACKAGE_VERSION ..."
docker build -t $IMAGEID .