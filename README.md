# WhatsApp Interview Bot

An AI-powered WhatsApp bot for conducting job interviews with conversation memory, calendar integration, and email capabilities.

## Features

- **AI-Powered Conversations**: Uses LangChain with Claude/GPT for intelligent interview conversations
- **Conversation Memory**: Redis-backed memory for maintaining context across messages
- **WhatsApp Business API**: Official Meta Cloud API integration
- **Google Calendar Integration**: Schedule interviews with automatic calendar events and Google Meet links
- **Email Notifications**: Automated emails for scheduling, reminders, and follow-ups via Gmail API
- **Interview Management**: Full CRUD operations for candidates, positions, and interviews
- **Security**: Rate limiting, CORS, helmet security headers, input validation with Zod
- **Type Safety**: Full TypeScript with strict mode enabled
- **Production Ready**: Health checks, graceful shutdown, structured logging

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.6 |
| Framework | Express.js |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis (ioredis) |
| AI | LangChain + Anthropic/OpenAI |
| WhatsApp | Meta Cloud API |
| Google APIs | googleapis |
| Validation | Zod |
| Logging | Pino |

## Architecture

```
src/
├── config/           # Configuration and environment validation
├── controllers/      # Request handlers
├── middleware/       # Express middleware (auth, validation, errors)
├── repositories/     # Database access layer (Prisma)
├── routes/           # API route definitions
├── services/         # Business logic
│   ├── ai/           # LangChain integration
│   ├── calendar/     # Google Calendar
│   ├── email/        # Gmail API
│   ├── memory/       # Redis memory management
│   └── whatsapp/     # WhatsApp Business API
├── types/            # TypeScript types and interfaces
├── utils/            # Utility functions and error classes
├── validators/       # Zod validation schemas
└── index.ts          # Application entry point
```

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 14+
- Redis 6+
- Meta Business Account with WhatsApp API access
- Google Cloud Project with Calendar and Gmail APIs enabled
- Anthropic or OpenAI API key

---

# Setup Guide

## 1. System Setup (Debian/GCP VM)

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x.x
```

### Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER whatsapp_bot WITH PASSWORD 'your_secure_password';
CREATE DATABASE whatsapp_bot OWNER whatsapp_bot;
GRANT ALL PRIVILEGES ON DATABASE whatsapp_bot TO whatsapp_bot;
EOF
```

### Install Redis

```bash
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
```

Edit the following in redis.conf:

```conf
# Bind to localhost only (secure)
bind 127.0.0.1

# Set password
requirepass your_redis_password

# Enable persistence
appendonly yes

# Memory limit
maxmemory 256mb
maxmemory-policy allkeys-lru
```

Restart Redis:

```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli -a your_redis_password ping
# Should return: PONG
```

---

## 2. WhatsApp Business API Setup (Meta)

### Create Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app (Business type)
3. Add WhatsApp product to your app

### Get API Credentials

1. Go to WhatsApp > API Setup
2. Note down:
   - **Phone Number ID**: `WHATSAPP_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID**: `WHATSAPP_BUSINESS_ACCOUNT_ID`
3. Generate a permanent access token:
   - Go to Business Settings > System Users
   - Create a system user with WhatsApp permissions
   - Generate a token with `whatsapp_business_messaging` permission
   - Save as `WHATSAPP_ACCESS_TOKEN`

### Configure Webhook

1. In your Meta app, go to WhatsApp > Configuration
2. Set Webhook URL: `https://your-domain.com/api/v1/webhook`
3. Set Verify Token: Create a random string and save as `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to these webhook fields:
   - `messages`
   - `message_deliveries` (optional)
   - `message_reads` (optional)

### Add Test Phone Numbers

1. Go to WhatsApp > API Setup
2. Add recipient phone numbers for testing
3. Verify them via the sent code

---

## 3. Google Cloud Setup

### Create Project and Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable these APIs:
   - Google Calendar API
   - Gmail API

### Create Service Account (Recommended for Server)

```bash
# In Google Cloud Console:
# 1. Go to IAM & Admin > Service Accounts
# 2. Create service account
# 3. Grant roles: Calendar Editor, Gmail API access
# 4. Create and download JSON key
```

Set environment variables from the JSON key:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### Or Use OAuth 2.0 (For User-Delegated Access)

1. Go to APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs
4. Note down Client ID and Client Secret

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback
```

### Share Calendar with Service Account

If using service account, share your calendar:

1. Go to Google Calendar
2. Settings > Share with specific people
3. Add service account email with "Make changes to events" permission

---

## 4. AI Provider Setup

### Anthropic (Claude)

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Set in environment:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### OpenAI (GPT-4)

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Set in environment:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

---

## 5. Application Setup

### Clone and Install

```bash
# Clone repository
git clone <your-repo-url>
cd whatsapp-bot

# Install dependencies
npm install
```

### Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env
```

Required environment variables:

```env
# Application
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1
LOG_LEVEL=info

# Security (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Database
DATABASE_URL=postgresql://whatsapp_bot:your_secure_password@localhost:5432/whatsapp_bot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# WhatsApp (from Meta Developer Console)
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id
WHATSAPP_ACCESS_TOKEN=your-permanent-access-token
WHATSAPP_VERIFY_TOKEN=your-custom-verify-token

# AI Provider
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google APIs
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CALENDAR_ID=primary

# Email
EMAIL_FROM_NAME=Interview Bot
EMAIL_FROM_ADDRESS=interviews@yourdomain.com

# Interview Settings
COMPANY_NAME=Your Company Name
```

### Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:prod

# (Optional) Seed sample data
npm run db:seed
```

### Build and Start

```bash
# Build TypeScript
npm run build

# Start server
npm start
```

---

## 6. Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start dist/index.js --name whatsapp-bot

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### Nginx Reverse Proxy

```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/whatsapp-bot
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 7. GCP Firewall Configuration

In GCP Console > VPC Network > Firewall:

Create rules:
- Allow HTTP (80) from anywhere
- Allow HTTPS (443) from anywhere
- Keep PostgreSQL (5432) internal only
- Keep Redis (6379) internal only

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Basic health check |
| GET | `/api/v1/health/detailed` | Detailed service status |
| GET | `/api/v1/webhook` | WhatsApp webhook verification |
| POST | `/api/v1/webhook` | Incoming WhatsApp messages |
| GET | `/api/v1/interviews` | List all interviews |
| POST | `/api/v1/interviews` | Create new interview |
| POST | `/api/v1/interviews/:id/schedule` | Schedule with calendar |
| POST | `/api/v1/interviews/:id/start` | Start interview |
| POST | `/api/v1/interviews/:id/complete` | Complete interview |

---

## Development

```bash
# Run in development mode (with hot reload)
npm run dev

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run tests
npm run test

# View database with Prisma Studio
npm run db:studio
```

---

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:3000/api/v1/health

# Detailed status
curl http://localhost:3000/api/v1/health/detailed
```

### Logs

```bash
# PM2 logs
pm2 logs whatsapp-bot

# Follow logs
pm2 logs whatsapp-bot --lines 100 -f
```

---

## Troubleshooting

### Webhook Not Receiving Messages

1. Verify webhook URL is accessible from internet
2. Check Meta App webhook subscription is active
3. Verify `WHATSAPP_VERIFY_TOKEN` matches
4. Check nginx/firewall allows incoming requests

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U whatsapp_bot -d whatsapp_bot

# Check service status
sudo systemctl status postgresql
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -a your_redis_password ping

# Check service status
sudo systemctl status redis-server
```

### AI Not Responding

1. Verify API key is valid
2. Check API rate limits
3. Review logs for specific errors

---

## Security Considerations

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Rotate API keys** periodically
3. **Use strong passwords** for database and Redis
4. **Enable HTTPS** in production
5. **Review rate limits** based on expected traffic
6. **Keep dependencies updated** - Run `npm audit` regularly

---

## Quick Start (Development with ngrok)

For quick testing without a domain, use ngrok:

```bash
# Install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Configure ngrok (get token from ngrok.com)
ngrok config add-authtoken YOUR_TOKEN

# Start the bot
npm run dev

# In another terminal, start ngrok
ngrok http 3000
```

Then configure the webhook URL in Meta Developer Console with the ngrok URL:
`https://YOUR_NGROK_ID.ngrok-free.app/api/v1/webhook`

---

## Changelog

### v1.0.1 - TypeScript Fixes
- Fixed TypeScript strict mode compatibility issues
- Relaxed `exactOptionalPropertyTypes` for better type inference
- Fixed `PaginationOptions` export conflicts in repositories
- Updated `TypedRequest` interface to properly extend Express Request
- Fixed readonly property assignments in error classes

---

## License

MIT
