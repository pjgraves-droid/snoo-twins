# --- build stage: compile TypeScript ---
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

# --- run stage: minimal image, no runtime deps needed ---
FROM node:20-slim AS run
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]
