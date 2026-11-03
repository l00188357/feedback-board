FROM alpine:3.22

ARG PB_VERSION=0.41.1

RUN apk add --no-cache ca-certificates curl unzip \
    && mkdir -p /pb \
    && curl -fsSL \
      "https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
      -o /tmp/pocketbase.zip \
    && unzip -q /tmp/pocketbase.zip pocketbase -d /pb \
    && chmod +x /pb/pocketbase \
    && rm /tmp/pocketbase.zip

WORKDIR /pb
COPY pb_migrations/ ./pb_migrations/

EXPOSE 8090
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]