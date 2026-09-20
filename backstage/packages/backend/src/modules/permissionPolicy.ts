import { createBackendModule } from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { AuthorizeResult, PolicyDecision } from '@backstage/plugin-permission-common';
import { PermissionPolicy, PolicyQuery, PolicyQueryUser } from '@backstage/plugin-permission-node';

// TODO: OIDC 연동 후 이 map을 실제 OIDC 그룹/클레임 기반으로 교체
const ROLES: Record<string, Array<'platform-admin' | 'site-admin'>> = {
  'user:development/guest': ['site-admin'],
  // 아래 줄 주석 해제/교체해서 platform-admin으로 테스트
  // 'user:development/guest': ['platform-admin'],
};

class HardcodedPolicy implements PermissionPolicy {
  async handle(request: PolicyQuery, user?: PolicyQueryUser): Promise<PolicyDecision> {
    const entityRef = user?.info?.userEntityRef;
    const roles = (entityRef && ROLES[entityRef]) ?? [];

    if (roles.includes('platform-admin')) {
      return { result: AuthorizeResult.ALLOW }; // platform-admin은 전체 허용
    }
    if (roles.includes('site-admin') && request.permission.name === 'platform.sites.toolbindings.read') {
      return { result: AuthorizeResult.ALLOW };
    }
    return { result: AuthorizeResult.DENY };
  }
}

export default createBackendModule({
  pluginId: 'permission',
  moduleId: 'hardcoded-policy',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new HardcodedPolicy());
      },
    });
  },
});
