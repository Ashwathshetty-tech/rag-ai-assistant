# Using node:20-slim (Debian) rather than alpine: @xenova/transformers pulls in
# onnxruntime-node, whose prebuilt native binaries target glibc, not musl.
FROM node:20-slim AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
