#!/bin/bash
set -e

echo "→ Syncing files..."
rsync -az \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env.local' \
  --exclude 'ecosystem.config.js' \
  /Users/rishika/code/productivity/tasksTrackerWhatsapp/ root@168.231.120.137:/var/www/taskflow/

echo "→ Building on server..."
ssh root@168.231.120.137 "cd /var/www/taskflow && DATABASE_URL='postgresql://taskflow:taskflow123@localhost:5432/taskflow' npx prisma db push --accept-data-loss && DATABASE_URL='postgresql://taskflow:taskflow123@localhost:5432/taskflow' npx prisma generate && DATABASE_URL='postgresql://taskflow:taskflow123@localhost:5432/taskflow' npm run build"

echo "→ Restarting app..."
ssh root@168.231.120.137 "cd /var/www/taskflow && pm2 startOrRestart ecosystem.config.js && pm2 save"

echo "✓ Done"
