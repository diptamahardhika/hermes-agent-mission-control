## Docker Deployment

Run the hermy-hq dashboard in a Docker container with minimal breaking changes.

### Quick Start

```bash
# Build the image
docker build -t hermy-hq-dashboard .

# Run with default port 8080 (dashboard runs on 3000 internally)
docker run -d -p 8080:3000 --name hermy-hq hermy-hq-dashboard

# Or use docker-compose (recommended)
docker-compose up -d
```

### Access the Dashboard

- http://localhost:8080 (default Docker port)
- http://localhost:3000 (if you changed the port mapping)

### Environment Variables

Copy `.env.example` and configure:

```bash
cp .env.example .env
# Edit .env with your secrets
```

Key variables:
- `DATABASE_URL` - Postgres connection string
- `NEXTAUTH_SECRET` - NextAuth secret
- `NEXTAUTH_URL` - Your production URL
- `HERMES_CUSTOM_FREELLMAPI_API_KEY` - FreeLLM API key

### Health Check

```bash
curl http://localhost:8080/api/hermes/health
```

### Stop and Remove

```bash
docker stop hermy-hq && docker rm hermy-hq
# or with docker-compose
docker-compose down
```

### Development with Hot Reload

For development with hot reload, use docker-compose with volume mounts:

```yaml
# In docker-compose.yml, add:
volumes:
  - .:/app
  - /app/node_modules
```
