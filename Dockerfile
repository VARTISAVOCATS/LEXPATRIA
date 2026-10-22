# Image de production de la plateforme Lexpatria (serveur OVHcloud).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS outils
WORKDIR /outils
RUN echo '{"private":true,"type":"module"}' > package.json && npm install --omit=dev drizzle-orm@0.44.5 pg@8.16.3

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variables publiques : intégrées au moment de la construction (clé publique Stripe, mesure d'audience).
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_SITE_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_TIKTOK_PIXEL_ID
ARG NEXT_PUBLIC_GOOGLE_ADS_ID
ARG NEXT_PUBLIC_TELEPHONE_CABINET
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S lex && adduser -S lex -G lex
COPY --from=build --chown=lex:lex /app/.next/standalone ./
COPY --from=build --chown=lex:lex /app/.next/static ./.next/static
COPY --from=build --chown=lex:lex /app/public ./public
COPY --from=build --chown=lex:lex /app/drizzle ./drizzle
# Scripts de migration et d'équipe, avec leurs seuls pilotes (dossier séparé de l'application).
COPY --from=outils --chown=lex:lex /outils ./outils
COPY --from=build --chown=lex:lex /app/scripts/migrer.mjs /app/scripts/equipe.mjs ./outils/
USER lex
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/api/sante || exit 1
CMD ["sh", "-c", "node outils/migrer.mjs && node server.js"]
