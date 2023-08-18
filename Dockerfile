FROM node:18
WORKDIR /usr/src/app
COPY package*.json ./
COPY . .
RUN NODE_ENV=production yarn install && yarn add typescript tsc ts-node && yarn build
# EXPOSE 8080
CMD [ "node", "./dist/app.js" ]

