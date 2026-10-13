FROM node:24-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends autoconf automake pkg-config libevent-dev libncurses-dev ncurses-base ncurses-term libutf8proc-dev bison patchelf && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.21.0 bun@1.4.2
WORKDIR /work
COPY source/ /work/
ENV TMUX_IDE_RUNTIME_MODE=development
RUN --mount=type=cache,target=/pnpm/store NODE_OPTIONS=--max-old-space-size=512 pnpm --filter tmux-ide... --filter './packages/**' install --frozen-lockfile --child-concurrency=1 --network-concurrency=2 --store-dir=/pnpm/store
RUN node scripts/build-cli.mjs --outfile /work/.tasks/private-cli.mjs
RUN git init --quiet /tmp/tmux-src && git -C /tmp/tmux-src remote add origin https://github.com/tmux/tmux.git && git -C /tmp/tmux-src fetch --depth=1 origin e476c1230b958df0cb12977517d24b3dc931375b && git -C /tmp/tmux-src checkout --detach FETCH_HEAD && cd /tmp/tmux-src && sh autogen.sh && ./configure --prefix=/opt/tmux-supported && make -j2 && make install
ENV PATH="/opt/tmux-supported/bin:${PATH}"
ENV TMUX_GPUI_TEST_CLI=/work/.tasks/private-cli.mjs
CMD ["node", "--import", "tsx", "apps/tmux-gpui/bridge/new-window-smoke.mjs"]
