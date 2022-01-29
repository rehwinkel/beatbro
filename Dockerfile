FROM node:17.4.0-alpine3.15

RUN apk add opus ffmpeg python3 make gcc musl-dev g++ redis
RUN ln -sfv /usr/bin/python3 /usr/bin/python
RUN adduser -D botuser
USER botuser
WORKDIR /home/botuser/

COPY package.json youtube-dl ./

RUN npm config set unsafe-perm true
RUN npm install

COPY index.js youtube.js run.sh .env ./

CMD ["./run.sh"]