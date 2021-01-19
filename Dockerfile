FROM node:current-alpine3.10

# Create crust-bridge directory
WORKDIR /usr/src/crust-bridge

# Move source files to docker image
COPY . .

# Install dependencies
RUN yarn && yarn build

# Run
ENTRYPOINT yarn start
