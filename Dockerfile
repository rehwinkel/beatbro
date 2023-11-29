FROM node:21-bullseye-slim as build

WORKDIR /work

RUN apt-get update && apt-get install -y \
    libopus-dev \
    ffmpeg \
    python3 \
    python-is-python3 \
    python3-pip \
    make \
    g++ \
 && rm -rf /var/lib/apt/lists/*

ADD src /work/src
ADD vendor /work/vendor
COPY package.json tsconfig.json /work/
RUN ln -sfv /work/vendor/yt-dlp/dist/yt-dlp_linux yt-dlp

RUN npm install
RUN npm run build

WORKDIR /work/vendor/yt-dlp
RUN rm dist/*
RUN python3 -m pip install -U pyinstaller -r requirements.txt
RUN python3 pyinst.py

FROM node:21-bullseye-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python-is-python3 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY --from=build /work/ /work/

CMD ["npm", "run", "start"]