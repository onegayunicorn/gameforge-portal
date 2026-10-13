# Rollback Plan
1. Identify bad release version.
2. Promote previous known-good release.
3. Invalidate CDN cache for index.html and sw.js.
4. Verify smoke tests pass.
5. Monitor error rates for 30 minutes.
