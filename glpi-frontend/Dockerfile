FROM php:8.3-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcurl4-openssl-dev \
        libldap2-dev \
    && docker-php-ext-configure ldap --with-libdir=lib/$(dpkg-architecture --query DEB_HOST_MULTIARCH) \
    && docker-php-ext-install curl ldap \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

EXPOSE 80

CMD ["php", "-S", "0.0.0.0:80", "server.php"]
