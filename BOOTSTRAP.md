# Bootstrap

## Backstage

```bash
node -v; npm -v; yarn -v

npx @backstage/create-app@latest

yarn workspace backend remove better-sqlite3
yarn install

touch app-config.local.yaml
yarn start
```

### Backstage Plugins

#### Spring Batch Dashboard

```bash
curl -sL https://github.com/zc149/backstage-plugin-spring-batch-dashboard/archive/refs/heads/main.tar.gz | tar -xz -C plugins --strip-components=2 "backstage-plugin-spring-batch-dashboard-main/plugins"

yarn workspace app add "@jikwan/backstage-plugin-spring-batch-dashboard@workspace:*"
yarn workspace backend add "@jikwan/backstage-plugin-spring-batch-dashboard-backend@workspace:*"
```

### Backstage Appendix

```bash
# Behind Proxy
corepack enable
```
