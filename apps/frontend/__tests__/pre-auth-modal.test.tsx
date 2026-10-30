import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from './test-utils';

const post = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...a: any[]) => post(...a), get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));

import { PreAuthModal } from '@/components/modules/pre-auth-modal';

const patient = { id: 'p1', patientId: 'PAT-2026-0001', insuranceProvider: 'HDFC ERGO', insurancePolicyNumber: 'HE-77', user: { firstName: 'Rahul', lastName: 'Verma' } };

describe('PreAuthModal', () => {
  beforeEach(() => post.mockReset());

  it('pre-fills the policy and sends the estimate for the locked patient', async () => {
    post.mockResolvedValue({ data: { data: { id: 'pa1' } } });
    const onClose = vi.fn();
    renderWithQuery(<PreAuthModal open patient={patient} onClose={onClose} />);
    expect(screen.getByText(/Rahul Verma/)).toBeInTheDocument();
    await waitFor(() => expect((screen.getByLabelText('Insurer') as HTMLInputElement).value).toBe('HDFC ERGO'));
    await userEvent.type(screen.getByLabelText('Planned treatment'), 'Knee arthroscopy, 2-day stay');
    await userEvent.type(screen.getByLabelText(/Estimated cost/), '85000');
    await userEvent.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith(
      '/insurance-claims/pre-auth',
      expect.objectContaining({ patientId: 'p1', treatment: 'Knee arthroscopy, 2-day stay', estimatedAmount: 85000, insurer: 'HDFC ERGO', policyNumber: 'HE-77' }),
    );
  });

  it('cannot be sent until a patient is chosen', () => {
    renderWithQuery(<PreAuthModal open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /send request/i })).toBeDisabled();
  });
});
