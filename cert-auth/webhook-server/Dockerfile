FROM node:6.10.0

ENV NPM_CONFIG_LOGLEVEL=warn
EXPOSE 3000
WORKDIR /usr/src/app

COPY . /usr/src/app
RUN npm install

CMD ["node", "server.js"]
