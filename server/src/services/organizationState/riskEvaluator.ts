import type { OrganizationState, RiskSummary } from './types';
export const evaluateRisks = (_state: Omit<OrganizationState, 'risks'>): RiskSummary[] => [];
