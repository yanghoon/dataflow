package io.slim.workflow.app.job;

public class GatewayArch {

    // RedisRouteDefinitionRepository
    // k8s informer
    // Single ConfigMap (or CRD)
    // RedisRateLimiter

    // RedisRateLimiter, appliedRevision, failback 30s, RefreshRoutesResultEvent
    // Redis Streams, isScoped() partial refresh, jitter/coalescing
    // SharedIndexInformer (remove redis)
    
    ConfigMapReouteDefinitionRepository {
        SharedIndexInformer<V1ConfigMap> informer
        CoreV1Api k8sApiClient;
        ApplicationEventPublisher eventPublisher;
        List<RouteDefinition> cachedRoutes = List.of();

        informer.addEventHandler(ResouceEventHandler<> {
            onAdd({ updateCache(cm) })
            onUpdate(old, cm { updateCache(cm) })
            onDelete(cm, stale) { routes = List.of(); publish(); }
        })
    }

}
