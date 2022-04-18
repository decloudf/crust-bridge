FROM node:current-alpine3.10

# Create directory
WORKDIR /usr/src/crust-shadow-claim

# Move source files to docker image
COPY . .

# Install dependencies
RUN yarn && yarn build

# Run
ENTRYPOINT yarn start
