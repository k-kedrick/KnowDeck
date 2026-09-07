FROM golang:1.26-alpine AS builder

WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/kb-server ./cmd/server

FROM alpine:3.22

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /out/kb-server /app/kb-server

RUN mkdir -p /data /uploads && chown -R app:app /data /uploads /app
USER app

ENV HOST=0.0.0.0 \
    PORT=8090 \
    DATA_DIR=/data \
    DB_PATH=/data/app.db \
    UPLOAD_DIR=/uploads

EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1

CMD ["/app/kb-server"]
