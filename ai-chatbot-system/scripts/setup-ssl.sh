#!/bin/bash

# SSL Setup Script for AI Chatbot System
# Replace 'your-domain.com' with your actual domain

DOMAIN="m2m.portal-syncsoft.com"
EMAIL="nick.nguyen@syncsoftvn.com"

echo "🔧 Setting up SSL certificates for $DOMAIN..."

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

# Stop nginx if running
sudo systemctl stop nginx

# Get SSL certificates
echo "🔒 Obtaining SSL certificates..."
sudo certbot certonly --standalone \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN \
    -d admin.$DOMAIN

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Set up auto-renewal
echo "⏰ Setting up auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --reload") | crontab -

echo "✅ SSL setup complete!"
echo "📝 Remember to update nginx.conf with your actual domain name"
echo "🔧 Test your setup with: sudo nginx -t"