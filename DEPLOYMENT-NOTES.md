# Deployment Notes - Special Projects Tracker

## Production Environment

Application runs inside Docker on an Ubuntu VM.

Host:
pm-server

Internal DNS:
pm-dev.bscsd.org

VM IP (DHCP reservation):
10.11.40.85

DHCP Reservation MAC:
00:15:5d:28:03:00


--------------------------------------------------

## Starting the Stack

On the VM:

cd ~/pm-prod/ADK-Digital-Site
docker compose -f docker-compose.prod.yml up -d


--------------------------------------------------

## TLS Certificate (Internal CA)

TLS certificates are NOT stored in the Git repository.

They must exist on the VM at:

/home/stefan/pm-prod/ADK-Digital-Site/nginx/certs/

Required files:

pm-dev.bscsd.org.cer
pm-dev.bscsd.org.key


nginx container mounts them via:

./nginx/certs:/etc/nginx/certs:ro


--------------------------------------------------

## Generating a New Certificate

1. Generate key + CSR on the VM

openssl req -new -newkey rsa:2048 -nodes \
-keyout pm-dev.bscsd.org.key \
-out pm-dev.bscsd.org.csr


2. Convert CSR to DER

openssl req -in pm-dev.bscsd.org.csr -outform DER -out pm-dev.bscsd.org.der


3. Copy DER file to Windows PC


4. Submit to internal CA

certreq -submit pm-dev.bscsd.org.der


5. Save issued certificate as:

pm-dev.bscsd.org.cer


6. Copy certificate back to VM:

/home/stefan/pm-prod/ADK-Digital-Site/nginx/certs/


7. Restart nginx

docker compose -f docker-compose.prod.yml restart nginx


--------------------------------------------------

## DNS

Internal DNS record:

pm-dev.bscsd.org → 10.11.40.85


--------------------------------------------------

## Google OAuth

Authorized JavaScript origin:

https://pm-dev.bscsd.org


Authorized redirect URI:

https://pm-dev.bscsd.org/auth/google/callback


--------------------------------------------------

## Notes

If nginx fails to start, check:

docker logs adk-digital-site-nginx-1

Common cause:
certificate and private key mismatch.

Certificate must be issued from the CSR generated on the VM.