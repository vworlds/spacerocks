# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS deps
WORKDIR /workspace
ENV HUSKY=0

COPY package.json package-lock.json tsconfig.base.json eslint.config.js .prettierignore ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/common/package.json packages/common/package.json

RUN npm ci

FROM deps AS build
WORKDIR /workspace

COPY . .

# lint-staged depends on git staged state; full lint is the deterministic Docker equivalent.
RUN npm run typecheck
RUN npm run lint
RUN npm run test --workspaces --if-present
RUN npm run build -w @spacerocks/client

FROM nginx:1.27-alpine AS runtime

COPY apps/client/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/client/docker/entrypoint.sh /docker-entrypoint.d/40-spacerocks-vars.sh
COPY --from=build /workspace/apps/client/dist/ /usr/share/nginx/html/

RUN chmod +x /docker-entrypoint.d/40-spacerocks-vars.sh

EXPOSE 80