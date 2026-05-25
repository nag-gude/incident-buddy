# payments-api — Error rate spike

## 1-triage

Confirm alert is not a false positive. Check error rate dashboard for `payments-api` over the last 15 minutes.

## 2-correlate

Compare error spike timing with recent deploys and dependency health (payment gateway, DB connection pool).

## 3-evidence

Collect: current error rate, p99 latency, last 3 deploys, recent similar incidents.

## 4-rollback

If deploy within 30 minutes correlates with spike, consider rollback to previous stable version.

```bash
kubectl rollout undo deployment/payments-api
```

## 5-communicate

Post stakeholder update: impact, scope, next check-in ETA (30 min).

## 6-scale

If not rolling back immediately, scale replicas to absorb load while investigating.

## 7-circuit-breaker

Enable checkout circuit breaker feature flag to limit customer blast radius.
