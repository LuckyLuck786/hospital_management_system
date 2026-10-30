import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from './test-utils';

const patch = vi.fn().mockResolvedValue({ data: { data: {} } });
vi.mock('@/lib/api', () => ({ api: { patch: (...a: any[]) => patch(...a), get: vi.fn() } }));

import { FamilyHistoryPanel } from '@/components/modules/patient-panels';

describe('FamilyHistoryPanel', () => {
  const patient = { id: 'p1', familyHistoryDiabetes: true, familyHistoryHypertension: false, familyHistoryCancer: false, familyHistoryCardiac: false };

  it('marks active flags and toggles one for clinicians', async () => {
    renderWithQuery(<FamilyHistoryPanel patient={patient} canEdit />);
    expect(screen.getByRole('button', { name: /Diabetes/ }).textContent).toContain('●');
    await userEvent.click(screen.getByRole('button', { name: /Hypertension/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/patients/p1/family-history', { familyHistoryHypertension: true }));
  });

  it('is read-only for non-clinicians', () => {
    renderWithQuery(<FamilyHistoryPanel patient={patient} />);
    expect(screen.getByRole('button', { name: /Cancer/ })).toBeDisabled();
  });
});
