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
RUN npm run bundle -w @spacerocks/server

FROM node:24-alpine AS runtime-deps
WORKDIR /workspace
ENV HUSKY=0
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/common/package.json packages/common/package.json

RUN npm pkg delete scripts.prepare && npm ci --omit=dev --workspace @spacerocks/server --include-workspace-root=false

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2567
ENV SPACEROCKS_WEBRTC_UDP_PORT=2568

COPY --from=runtime-deps /workspace/node_modules/ ./node_modules/
COPY --from=build /workspace/apps/server/dist/ ./dist/
COPY --from=build /workspace/apps/server/assets/ ./assets/

EXPOSE 2567
EXPOSE 2568/udp
CMD ["node", "dist/index.js"]