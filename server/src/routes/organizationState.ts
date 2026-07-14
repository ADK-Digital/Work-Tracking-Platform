import { Router } from 'express';
import { getUserRole } from '../authorization';
import { getOrganizationState } from '../services/organizationState';

const organizationStateRouter = Router();

organizationStateRouter.get('/organization-state', async (req, res, next) => {
  try {
    const role = await getUserRole(req);
    res.json(await getOrganizationState({ user: req.user!, role: role ?? 'user' }));
  } catch (error) {
    next(error);
  }
});

export default organizationStateRouter;
