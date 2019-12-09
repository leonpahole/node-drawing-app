FROM node:10

RUN npm install yarn -g
RUN npm install pm2 -g

WORKDIR /usr/src/app

COPY package.json .

RUN yarn install

COPY . .

EXPOSE 3000

CMD ["pm2-runtime", "process.yml"]