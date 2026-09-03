FROM ubuntu:24.04

ARG BRIDGE_VERSION

LABEL gg.serverk.bridge.version="${BRIDGE_VERSION}"

LABEL org.opencontainers.image.source="https://github.com/serverkgg/rust"
LABEL gg.serverk.game="rust"

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      tini ca-certificates curl util-linux tzdata locales \
      lib32gcc-s1 lib32stdc++6 libsdl2-2.0-0; \
    rm -rf /var/lib/apt/lists/*; \
    locale-gen en_US.UTF-8; \
    if getent passwd 1000 > /dev/null; then \
      userdel -r "$(getent passwd 1000 | cut -d: -f1)"; \
    fi; \
    groupadd -g 1000 container; \
    useradd -M -d /home/container -u 1000 -g 1000 -s /usr/sbin/nologin container; \
    mkdir -p /home/container /serverk/run /opt/steamcmd; \
    curl -fsSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz \
      | tar -xz -C /opt/steamcmd; \
    chmod -R a+rX /opt/steamcmd

ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    TZ=UTC \
    HOME=/home/container

COPY dist/bridge /serverk/bridge

RUN chmod 0755 /serverk/bridge

WORKDIR /home/container

ENTRYPOINT ["/usr/bin/tini", "--", "/serverk/bridge"]
