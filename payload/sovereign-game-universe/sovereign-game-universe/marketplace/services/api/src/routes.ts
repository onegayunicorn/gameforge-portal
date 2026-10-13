/** API Routes — v1 */
export const ROUTES = {
  auth: ['POST /auth/register', 'POST /auth/login', 'POST /auth/logout', 'POST /auth/verify-email', 'POST /auth/forgot-password', 'POST /auth/reset-password', 'POST /auth/mfa/enable', 'GET /me', 'PATCH /me'],
  catalog: ['GET /games', 'POST /games', 'GET /games/:slug', 'PATCH /games/:gameId', 'DELETE /games/:gameId', 'GET /tags', 'GET /genres', 'GET /platforms', 'GET /creators/:username'],
  publishing: ['POST /games/:gameId/uploads', 'POST /uploads/:uploadId/complete', 'POST /games/:gameId/releases', 'POST /releases/:releaseId/publish', 'POST /releases/:releaseId/unpublish', 'GET /releases/:releaseId/status'],
  commerce: ['POST /checkout/sessions', 'POST /payments/webhooks/provider', 'GET /orders', 'GET /orders/:orderId', 'POST /orders/:orderId/refund', 'GET /library', 'GET /creators/:creatorId/revenue', 'GET /creators/:creatorId/payouts'],
  download: ['GET /games/:gameId/downloads', 'POST /artifacts/:artifactId/download-url', 'GET /browser-games/:gameId/launch', 'POST /download-events'],
  community: ['POST /games/:gameId/comments', 'GET /games/:gameId/comments', 'PATCH /comments/:commentId', 'DELETE /comments/:commentId', 'POST /games/:gameId/rating', 'POST /games/:gameId/follow', 'POST /games/:gameId/wishlist'],
  moderation: ['POST /reports', 'GET /admin/moderation/queue', 'POST /admin/moderation/:reportId/resolve', 'POST /admin/moderation/:targetType/:targetId/sanction', 'POST /admin/moderation/:targetType/:targetId/restore'],
};
