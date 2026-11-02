FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
WORKDIR /app
ENV NODE_ENV=production RACELAB_JUDGE_MODE=1 RACELAB_DATA_DIR=/app/.racelab/judge
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY server.mjs ./
COPY THIRD_PARTY_NOTICES.md ./
COPY src ./src
COPY public ./public
COPY scripts/serve-judge.mjs scripts/prepare-judge.mjs ./scripts/
RUN node scripts/prepare-judge.mjs && chown -R node:node /app/.racelab
USER node
EXPOSE 4174
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4174)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve-judge.mjs"]
