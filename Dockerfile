FROM node:alpine as node-dev

WORKDIR /src

COPY package.json yarn.lock .npmrc ./

RUN  yarn install --development --network-timeout 100000

COPY . .

RUN yarn build

# Using nginx to serve front-end
FROM nginx:1.25

EXPOSE 8080

WORKDIR /var/www/html

USER root
RUN chmod -R g+w /var/cache/
RUN chmod -R g+w /var/run/

# Copy built artifacts
COPY --from=node-dev /src/build/ ./

# Copy nginx configuration folder
COPY ./nginx/conf.d/nginx.conf /etc/nginx/conf.d/default.conf