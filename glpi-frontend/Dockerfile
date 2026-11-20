FROM php:8.3-fpm
RUN apt-get update && apt-get install -y --no-install-recommends nginx libcurl4-openssl-dev libldap2-dev \
    && docker-php-ext-configure ldap --with-libdir=lib/$(dpkg-architecture --query DEB_HOST_MULTIARCH) \
    && docker-php-ext-install curl ldap \
    && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN printf "upload_max_filesize = 10M\npost_max_size = 12M\nmemory_limit = 256M\n" > /usr/local/etc/php/conf.d/uploads.ini \
    && printf "[www]\nclear_env = no\nlisten = 127.0.0.1:9000\n" > /usr/local/etc/php-fpm.d/zz-app.conf
WORKDIR /app
EXPOSE 80
CMD ["sh", "-c", "php-fpm -D && exec nginx -g 'daemon off;'"]
