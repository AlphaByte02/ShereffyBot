ARG NODE_VERSION=16

FROM node:${NODE_VERSION} as base

WORKDIR /usr/app

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

FROM base as production
