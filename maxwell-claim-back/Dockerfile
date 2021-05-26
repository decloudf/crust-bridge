FROM node:current-alpine3.10

# Create directory
WORKDIR /usr/src/crust-maxwell-claim-back

# Move source files to docker image
COPY . .

# Install dependencies
RUN yarn && yarn build

# Run
ENTRYPOINT yarn start
