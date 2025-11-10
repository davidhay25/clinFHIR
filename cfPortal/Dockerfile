FROM nginx:alpine

# Copy our HTML landing page
COPY html/ /usr/share/nginx/html/

# Replace the default nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
