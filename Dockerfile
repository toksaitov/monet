FROM node:4.4.4-slim

EXPOSE 8080
WORKDIR /monet-api

COPY package.json /monet-api
RUN npm install

COPY . /monet-api

CMD ["npm", "start"]
