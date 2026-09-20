FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY servidor.js ./
ENV DADOS_DIR=/dados
VOLUME /dados
EXPOSE 8090
CMD ["node", "servidor.js"]
