# The DOCKERFILE creates the container for deployment.
# Use the docker-compose-yml to modify the local docker environment.


# Defult node-red image, newest version per 28.01.2026 (make sure version is the same in DOCKERFILE)
FROM nodered/node-red:4.1.4-22

USER root
RUN apk add --no-cache ffmpeg
USER node-red  

COPY data/flows/ /data/flows/
COPY data/settings.js /data/settings.js
COPY data/package.json /data/package.json

RUN npm install --prefix /data
