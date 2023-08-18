FROM node:18
WORKDIR /usr/src/app
COPY package*.json ./
COPY . .
RUN NODE_ENV=production yarn install && yarn add typescript tsc ts-node && yarn build
CMD [ "node", "./dist/app.js" ]

