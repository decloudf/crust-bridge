FROM node:current-alpine3.10

# Create maxwell-csm-claim directory
WORKDIR /usr/src/maxwell-csm-claim

# Move source files to docker image
COPY . .

# Install dependencies
RUN yarn && yarn build

# Run
ENTRYPOINT yarn start