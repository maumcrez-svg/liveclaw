FROM bluenviron/mediamtx:1.9.3 AS mtx

FROM alpine:3.19
RUN apk add --no-cache wget gettext
COPY --from=mtx /mediamtx /mediamtx
COPY mediamtx.yml /mediamtx.yml.template

ENTRYPOINT ["sh", "-c", "envsubst < /mediamtx.yml.template > /mediamtx.yml && exec /mediamtx"]
