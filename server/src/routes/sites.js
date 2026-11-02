import express from 'express';
import Site from '../models/Site.js';
import { enqueueSiteAudit } from '../services/auditQueue.js';

export function createSitesRouter({ allowPrivate = false } = {}) {
  const router = express.Router();

  // GET /api/sites/:id
  router.get('/:id', async (req, res) => {
    try {
      const site = await Site.findById(req.params.id);
      if (!site) {
        return res.status(404).json({ error: 'Site not found' });
      }
      return res.json({ site });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve site', detail: err.message });
    }
  });

  // POST /api/sites/:id/reaudit
  router.post('/:id/reaudit', async (req, res) => {
    try {
      const site = await Site.findById(req.params.id);
      if (!site) {
        return res.status(404).json({ error: 'Site not found' });
      }

      site.auditStatus = 'pending';
      await site.save();

      // Trigger reaudit in background with reaudit: true
      enqueueSiteAudit(site._id, { reaudit: true, allowPrivate }).catch((err) => {
        console.error(`[Queue] Re-audit error for site ${site._id}:`, err.message);
      });

      return res.json({ site });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to trigger re-audit', detail: err.message });
    }
  });

  return router;
}

export default createSitesRouter;
