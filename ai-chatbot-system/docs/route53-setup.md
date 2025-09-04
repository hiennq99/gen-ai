# Route 53 Setup Guide

## Prerequisites
- AWS account with Route 53 access
- Domain name purchased through Route 53 or external registrar
- EC2 instance with public IP address

## Step 1: Create Hosted Zone

1. Go to AWS Route 53 console
2. Click "Create hosted zone"
3. Enter your domain name (e.g., `your-domain.com`)
4. Select "Public hosted zone"
5. Click "Create hosted zone"

## Step 2: Configure DNS Records

Create the following records in your hosted zone:

### A Records
```
Name: your-domain.com
Type: A
Value: YOUR_EC2_PUBLIC_IP
TTL: 300

Name: www.your-domain.com  
Type: A
Value: YOUR_EC2_PUBLIC_IP
TTL: 300

Name: admin.your-domain.com
Type: A  
Value: YOUR_EC2_PUBLIC_IP
TTL: 300
```

### CNAME Record (Optional)
```
Name: api.your-domain.com
Type: CNAME
Value: your-domain.com
TTL: 300
```

## Step 3: Update Name Servers (if domain not purchased through Route 53)

If you purchased your domain through an external registrar:

1. Copy the 4 name servers from your Route 53 hosted zone
2. Go to your domain registrar's control panel
3. Update the name servers to use Route 53's servers
4. Save changes (propagation takes 24-48 hours)

## Step 4: Test DNS Resolution

```bash
# Test main domain
nslookup your-domain.com

# Test subdomain
nslookup admin.your-domain.com

# Test from different locations
dig your-domain.com @8.8.8.8
```

## Step 5: Update Nginx Configuration

Replace placeholders in `/nginx/nginx.conf`:
- Replace `your-domain.com` with your actual domain
- Replace `your-email@example.com` with your email in SSL script

## Step 6: Deploy on Server

1. Copy nginx config to server:
```bash
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
```

2. Run SSL setup:
```bash
sudo ./scripts/setup-ssl.sh
```

3. Test nginx configuration:
```bash
sudo nginx -t
```

4. Restart nginx:
```bash
sudo systemctl restart nginx
```

## Verification

After setup, your services will be available at:
- Frontend: `https://your-domain.com`
- Admin CMS: `https://admin.your-domain.com`
- API: `https://your-domain.com/api`

## Troubleshooting

### DNS not resolving
- Check propagation: `dig your-domain.com`
- Wait 24-48 hours for full propagation
- Verify A records point to correct IP

### SSL certificate issues  
- Ensure domains are accessible via HTTP first
- Check firewall allows ports 80 and 443
- Verify domain ownership with certbot

### Nginx errors
- Check logs: `sudo tail -f /var/log/nginx/error.log`
- Test config: `sudo nginx -t`
- Check service status: `sudo systemctl status nginx`