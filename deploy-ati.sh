#!/bin/bash

# ATI UI Deployment Script
# Deploys to ati.13.201.224.59.nip.io

set -e  # Exit on any error

# Configuration
SERVER_IP="13.201.224.59"
SERVER_USER="ubuntu"
PEM_FILE="./agri-ati-ui-key.pem"
REMOTE_PATH="/var/www/oan-ui-service"
LOCAL_DIST="./dist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}   ATI UI Deployment Script${NC}"
echo -e "${YELLOW}========================================${NC}"

# Check if PEM file exists
if [ ! -f "$PEM_FILE" ]; then
    echo -e "${RED}Error: PEM file not found at $PEM_FILE${NC}"
    exit 1
fi

# Step 1: Build
echo -e "\n${GREEN}[1/4] Building project...${NC}"
npm run build:ati

if [ ! -d "$LOCAL_DIST" ]; then
    echo -e "${RED}Error: Build failed - dist directory not found${NC}"
    exit 1
fi

# Step 2: Backup existing deployment
echo -e "\n${GREEN}[2/4] Backing up existing deployment...${NC}"
BACKUP_NAME="oan-ui-service.backup.$(date +%Y%m%d_%H%M%S)"
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "sudo mv $REMOTE_PATH /var/www/$BACKUP_NAME 2>/dev/null || true && \
     sudo mkdir -p $REMOTE_PATH && \
     sudo chown $SERVER_USER:$SERVER_USER $REMOTE_PATH"
echo -e "Backup created: /var/www/$BACKUP_NAME"

# Step 3: Deploy new files
echo -e "\n${GREEN}[3/4] Deploying new files...${NC}"
rsync -avz --progress -e "ssh -i $PEM_FILE" "$LOCAL_DIST/" "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/"

# Step 4: Set permissions and reload nginx
echo -e "\n${GREEN}[4/4] Setting permissions and reloading nginx...${NC}"
ssh -i "$PEM_FILE" "$SERVER_USER@$SERVER_IP" \
    "sudo chown -R www-data:www-data $REMOTE_PATH && \
     sudo chmod -R 755 $REMOTE_PATH && \
     sudo systemctl reload nginx"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "URL: https://ati.13.201.224.59.nip.io/"
